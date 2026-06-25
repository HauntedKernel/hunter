/**
 * Ingest divorce / family-law filings into a `divorce_events` table in
 * tax_roll.db, matched to tax-roll properties so discovery can use them as a
 * motivation signal. Divorce/separation is one of the largest residential
 * mobility drivers in the literature (RESEARCH.md §A) — a divorcing couple
 * commonly sells the marital home.
 *
 * These are court EVENTS, NOT the tax roll. In Texas, divorces are filed in the
 * District Courts; for us that's the **Dallas County District Clerk**.
 *
 * ⚠️ SOURCE CAVEAT (round-2 research, RESEARCH.md §E): Dallas family-court records
 * have NO public online access — online access was suspended by Texas Supreme Court
 * order effective 2014, and is attorneys-only via re:SearchTX. There is NO free
 * scrapable feed. The non-attorney paths are: the county's PAID "Civil/Family Case
 * Bulk Data Subscription" (Paymentus portal; price/fields unpublished — call the
 * District Clerk), an open-records/PIA request, or a commercial vendor. This
 * ingester is ready for whichever CSV you obtain; it does not (and cannot) scrape.
 *
 * CSV columns (header required, order-independent):
 *   party1_name,party2_name,address,account_id,filed_date,case_number,court,source
 *   - party1_name / party2_name: petitioner / respondent (at least one required)
 *   - address:    optional. If present, sharpens matching (street+ZIP+name).
 *   - account_id: DCAD account id. If present and valid, the BEST match key.
 *   - the rest are metadata.
 *
 * MATCHING (precision-first — a divorce record names PEOPLE, usually with no
 * property address, so name-only matching is inherently noisier than the
 * foreclosure feed):
 *   1. account_id (exact) — best.
 *   2. address + owner name (street-token + ZIP + a party name token) — when an
 *      address is given. The tax roll has no house numbers, so address alone is
 *      not enough; we require a party-name token too.
 *   3. name-only — requires >= 2 significant tokens of a single party (e.g.
 *      first + last) to ALL appear in owner_name, and prefers the homestead
 *      (the marital residence). A 1-token party is skipped unless
 *      ALLOW_LOOSE_MATCH=1. Ambiguous (common) names will still produce some
 *      false positives — that's the nature of name-only matching.
 *
 * Usage:
 *   node ingest_divorce_events.js <file.csv>     load/replace events from CSV
 *   node ingest_divorce_events.js --clear        wipe the divorce_events table
 *   ALLOW_LOOSE_MATCH=1 node ingest_divorce_events.js <file.csv>   allow 1-token names
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

// Significant name tokens (>=3 chars), minus joiners / titles / generational
// suffixes that don't identify a person.
const NAME_STOP = new Set([
  'AND', 'THE', 'TRUST', 'LLC', 'INC', 'COMPANY', 'UNKNOWN', 'SPOUSE', 'HUSBAND',
  'WIFE', 'MRS', 'JR', 'SR', 'III', 'IV', 'ESTATE', 'HEIRS', 'AKA', 'ETAL'
]);
const nameTokens = (name) => ([...new Set((String(name || '').toUpperCase().match(/[A-Z]{3,}/g) || []))])
  .filter(t => !NAME_STOP.has(t));

(async () => {
  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS divorce_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT,
      party1_name TEXT,
      party2_name TEXT,
      filed_date TEXT,
      case_number TEXT,
      court TEXT,
      source TEXT,
      match_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_divorce_events_account ON divorce_events(account_id);
  `);

  const arg = process.argv[2];
  if (arg === '--clear') {
    await db.run('DELETE FROM divorce_events');
    console.log('divorce_events cleared');
    await db.close();
    return;
  }
  if (!arg) { console.error('Provide a CSV path, or --clear'); process.exit(1); }

  const loose = process.env.ALLOW_LOOSE_MATCH === '1';
  const text = await fs.readFile(arg, 'utf8');
  const rows = parseCsv(text);
  console.log(`parsed ${rows.length} rows from ${path.basename(arg)}`);

  // Try to resolve a single tax-roll account for a divorce filing.
  async function resolve(r) {
    // 1) account_id
    let accountId = (r.account_id || '').trim();
    if (accountId) {
      const hit = await db.get('SELECT account_id FROM tax_roll WHERE account_id = ?', [accountId]);
      if (hit) return { accountId, method: 'account_id' };
      accountId = '';
    }

    const parties = [r.party1_name, r.party2_name].filter(Boolean);

    // 2) address + party-name token
    if (r.address) {
      const tok = streetToken(r.address);
      const zip = (r.address.match(/\b(\d{5})\b/) || [])[1];
      const names = parties.flatMap(nameTokens);
      if (tok && zip && names.length) {
        const ownerOr = names.map(() => 'UPPER(owner_name) LIKE ?').join(' OR ');
        const hit = await db.get(
          `SELECT account_id FROM tax_roll WHERE UPPER(property_address) LIKE ? AND zip_code LIKE ? AND (${ownerOr})
           ORDER BY homestead_exemption DESC LIMIT 1`,
          [`%${tok}%`, `${zip}%`, ...names.map(n => `%${n}%`)]
        );
        if (hit) return { accountId: hit.account_id, method: 'address+name' };
      }
    }

    // 3) name-only — require ALL of a single party's tokens (>=2) in owner_name,
    //    prefer the homestead (marital residence). Order-independent so it works
    //    whether the roll stores "LAST FIRST" or "FIRST LAST".
    for (const party of parties) {
      const toks = nameTokens(party);
      const use = (toks.length >= 2) ? toks : (loose && toks.length === 1 ? toks : null);
      if (!use) continue;
      const andClause = use.map(() => 'UPPER(owner_name) LIKE ?').join(' AND ');
      const hit = await db.get(
        `SELECT account_id FROM tax_roll WHERE ${andClause}
         ORDER BY homestead_exemption DESC LIMIT 1`,
        use.map(t => `%${t}%`)
      );
      if (hit) return { accountId: hit.account_id, method: toks.length >= 2 ? 'name(2+)' : 'name(loose)' };
    }

    return { accountId: '', method: 'unmatched' };
  }

  const counts = {};
  const seenAccounts = new Set();
  let inserted = 0;
  await db.exec('BEGIN');
  for (const r of rows) {
    const { accountId, method } = await resolve(r);
    counts[method] = (counts[method] || 0) + 1;
    // Dedup: one divorce event per matched account (keep the first).
    if (accountId && seenAccounts.has(accountId)) { counts['dup_skipped'] = (counts['dup_skipped'] || 0) + 1; continue; }
    if (accountId) seenAccounts.add(accountId);

    await db.run(
      `INSERT INTO divorce_events (account_id, party1_name, party2_name, filed_date, case_number, court, source, match_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId || null, r.party1_name || null, r.party2_name || null,
       r.filed_date || null, r.case_number || null, r.court || null, r.source || 'csv', method]
    );
    inserted++;
  }
  await db.exec('COMMIT');

  console.log('match breakdown:', JSON.stringify(counts));
  console.log(`inserted ${inserted} rows`);
  const total = await db.get('SELECT COUNT(*) c FROM divorce_events WHERE account_id IS NOT NULL');
  console.log(`divorce_events matched to a property: ${total.c}`);
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
