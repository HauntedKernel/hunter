/**
 * Derive FREE-AND-CLEAR status from raw county deed records (Dallas County Clerk
 * deeds of trust + releases) and emit a CSV for ingest_liens.js.
 *
 * The tax roll / DCAD appraisal data has NO lien info — it must be reconstructed
 * from recorded instruments (RESEARCH.md §E). This is the hard, DIY part of the
 * free-and-clear signal; aggregators (PropStream/ATTOM) sell it pre-built because
 * matching deeds-of-trust to their releases and then to a DCAD account is fiddly.
 *
 * MODEL: for every property that appears in the deed extract,
 *   free_and_clear = (number of OPEN, unreleased deeds-of-trust == 0)
 * This naturally handles:
 *   - cash buyers (a deed but no DOT)        -> free-and-clear
 *   - paid-off mortgages (DOT + a release)   -> free-and-clear
 *   - open mortgages (unreleased DOT)        -> financed
 * A DOT is considered RELEASED if a release links to it by instrument number
 * (related_instrument), or — failing that — a later release at the same property
 * for the same owner pairs to it (greedy by date). Caveat: this is only as
 * complete as the deed extract; a per-property pull from the Clerk is complete
 * for that property, a partial bulk file is not.
 *
 * INPUT — a deed-records CSV (header required, order-independent). This mirrors a
 * GovOS/Kofile (dallas.tx.publicsearch.us) export:
 *   instrument_number,instrument_type,recording_date,grantor,grantee,
 *   property_address,legal_description,related_instrument,amount
 *   - instrument_type: e.g. "DEED OF TRUST", "RELEASE OF LIEN", "SATISFACTION",
 *     "WARRANTY DEED". Classified by keyword (DOT vs RELEASE vs other).
 *   - grantor/grantee: for a DOT, grantor=borrower(owner), grantee=lender; for a
 *     release the roles invert. We match on EITHER name to be role-agnostic.
 *   - related_instrument: the DOT instrument_number a release discharges (best link).
 *   - amount: DOT loan amount (-> last_mortgage_amount).
 *
 * OUTPUT — a liens CSV consumable by ingest_liens.js:
 *   account_id,owner_name,free_and_clear,open_lien_count,last_mortgage_date,
 *   last_mortgage_amount,source
 *
 * Usage:
 *   node derive_liens_from_deeds.js <deeds.csv> [out.csv]   (default out: liens_derived.csv)
 *   then: node ingest_liens.js <out.csv>
 */
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return rows;
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = split(lines[0]).map(h => h.toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const vals = split(lines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h] = vals[j] || ''; });
    rows.push(row);
  }
  return rows;
}

function streetToken(addr) {
  return (String(addr || '').toUpperCase().match(/[A-Z]{4,}/g) || [])
    .sort((a, b) => b.length - a.length)[0] || '';
}
const NAME_STOP = new Set(['AND', 'THE', 'LIFE', 'ESTATE', 'HEIRS', 'TRUST', 'LLC', 'INC', 'COMPANY', 'UNKNOWN', 'SPOUSE', 'HUSBAND', 'WIFE', 'BANK', 'MORTGAGE', 'LOANS', 'FINANCIAL', 'NA', 'NATIONAL']);
const nameTokens = (name) => ([...new Set((String(name || '').toUpperCase().match(/[A-Z]{4,}/g) || []))])
  .filter(t => !NAME_STOP.has(t));

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function classify(type) {
  const t = String(type || '').toUpperCase();
  if (/RELEASE|SATISFACTION|RECONVEYANCE|DISCHARGE/.test(t)) return 'release';
  if (/DEED OF TRUST|\bD\/T\b|MORTGAGE|LIEN/.test(t)) return 'dot';
  return 'other';
}

(async () => {
  const inPath = process.argv[2];
  const outPath = process.argv[3] || path.join(process.cwd(), 'liens_derived.csv');
  if (!inPath) { console.error('Provide a deeds CSV path'); process.exit(1); }

  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  const text = await fs.readFile(inPath, 'utf8');
  const rows = parseCsv(text);
  console.log(`parsed ${rows.length} deed records from ${path.basename(inPath)}`);

  // Match a deed instrument to a DCAD account via property_address (street+ZIP) +
  // either party name; fall back to a 2-token name-only match. Returns account row.
  async function matchAccount(r) {
    const addr = r.property_address || r.legal_description || '';
    const tok = streetToken(addr);
    const zip = (String(addr).match(/\b(\d{5})\b/) || [])[1];
    const names = [...new Set([...nameTokens(r.grantor), ...nameTokens(r.grantee)])];
    if (tok && zip && names.length) {
      const ownerOr = names.map(() => 'UPPER(owner_name) LIKE ?').join(' OR ');
      const hit = await db.get(
        `SELECT account_id, owner_name FROM tax_roll WHERE UPPER(property_address) LIKE ? AND zip_code LIKE ? AND (${ownerOr}) LIMIT 1`,
        [`%${tok}%`, `${zip}%`, ...names.map(n => `%${n}%`)]
      );
      if (hit) return hit;
    }
    // name-only fallback (>=2 tokens of a single party), preferring homestead
    for (const party of [r.grantee, r.grantor]) {
      const toks = nameTokens(party);
      if (toks.length < 2) continue;
      const andC = toks.map(() => 'UPPER(owner_name) LIKE ?').join(' AND ');
      const hit = await db.get(
        `SELECT account_id, owner_name FROM tax_roll WHERE ${andC} ORDER BY homestead_exemption DESC LIMIT 1`,
        toks.map(t => `%${t}%`)
      );
      if (hit) return hit;
    }
    return null;
  }

  // Group instruments by matched account.
  const byAccount = new Map(); // account_id -> { owner, dots:[], releases:[] }
  let matched = 0, unmatched = 0;
  for (const r of rows) {
    const kind = classify(r.instrument_type);
    const acct = await matchAccount(r);
    if (!acct) { unmatched++; continue; }
    matched++;
    if (!byAccount.has(acct.account_id)) byAccount.set(acct.account_id, { owner: acct.owner_name, dots: [], releases: [] });
    const bucket = byAccount.get(acct.account_id);
    // 'other' (e.g. a warranty deed) registers the property as seen — so a cash
    // buyer with a deed but no DOT resolves to free-and-clear — but contributes
    // no lien.
    if (kind === 'other') continue;
    const rec = {
      instr: (r.instrument_number || '').trim(),
      date: (r.recording_date || '').trim(),
      amount: r.amount ? Number(String(r.amount).replace(/[$,]/g, '')) : null,
      related: (r.related_instrument || '').trim()
    };
    if (kind === 'dot') bucket.dots.push(rec); else bucket.releases.push(rec);
  }

  // Per account, compute open (unreleased) DOTs.
  const out = [];
  let facCount = 0;
  for (const [accountId, b] of byAccount) {
    const releasedByLink = new Set(b.releases.map(rel => rel.related).filter(Boolean));
    const dots = b.dots.slice().sort((a, c) => String(a.date).localeCompare(String(c.date)));
    // Greedy date-pairing for releases with no instrument link.
    const looseReleases = b.releases.filter(rel => !rel.related)
      .map(rel => rel.date).sort();
    const openDots = [];
    for (const d of dots) {
      if (d.instr && releasedByLink.has(d.instr)) continue;        // released by link
      const li = looseReleases.findIndex(rd => String(rd) >= String(d.date)); // earliest later release
      if (li !== -1) { looseReleases.splice(li, 1); continue; }    // released by date-pairing
      openDots.push(d);
    }
    const openCount = openDots.length;
    const freeClear = openCount === 0 ? 1 : 0;
    if (freeClear) facCount++;
    const latest = (openDots.length ? openDots : dots).slice(-1)[0] || null;
    out.push({
      account_id: accountId,
      owner_name: b.owner,
      free_and_clear: freeClear,
      open_lien_count: openCount,
      last_mortgage_date: latest ? latest.date : '',
      last_mortgage_amount: latest && latest.amount != null ? latest.amount : '',
      source: 'derived:clerk_deeds'
    });
  }

  const header = 'account_id,owner_name,free_and_clear,open_lien_count,last_mortgage_date,last_mortgage_amount,source';
  const body = out.map(o => [o.account_id, o.owner_name, o.free_and_clear, o.open_lien_count, o.last_mortgage_date, o.last_mortgage_amount, o.source].map(csvCell).join(','));
  await fs.writeFile(outPath, [header, ...body].join('\n') + '\n', 'utf8');

  console.log(`matched ${matched} DOT/release instruments (${unmatched} unmatched), ${byAccount.size} accounts`);
  console.log(`-> ${out.length} accounts written to ${outPath} (${facCount} free-and-clear, ${out.length - facCount} financed)`);
  console.log(`next: node ingest_liens.js ${path.basename(outPath)}`);
  await db.close();
})().catch(e => { console.error('DERIVE FAILED:', e.message); process.exit(1); });
