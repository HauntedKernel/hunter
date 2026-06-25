/**
 * Ingest mortgage / lien status into a `liens` table in tax_roll.db, matched to
 * tax-roll properties, to power the FREE-AND-CLEAR signal (and, later, a
 * high-equity signal).
 *
 * WHY (RESEARCH.md §A): mortgage rate lock-in is the best-quantified suppressor
 * of home sales — each 1pt that market rates exceed an owner's locked rate cuts
 * quarterly sale probability ~18%. The clean inversion: an owner with **no
 * mortgage (free-and-clear)** has no lock-in friction, so free-and-clear +
 * long-tenure + elderly is the cleanest "can-sell AND likely-to" cluster. The
 * tax roll has NO mortgage/lien data, so this must come from a lien feed.
 *
 * WHERE TO GET THE FEED (RESEARCH.md §E):
 *   - Fastest: a per-property export from an aggregator (PropStream $99/mo has a
 *     free-and-clear / equity filter; ATTOM / ReportAll via API). Export the
 *     normalized fields below.
 *   - Free-but-harder: derive open-lien status from Dallas County Clerk
 *     deed-of-trust + release records (dallas.tx.publicsearch.us) — reconstruct,
 *     per property, whether the latest deed of trust has a matching release.
 *     (Verify the property-portal ToS before any bulk extraction.)
 *
 * CSV columns (header required, order-independent; provide what you have):
 *   account_id,address,owner_name,free_and_clear,open_lien_count,mortgage_balance,
 *   est_value,est_equity,last_mortgage_date,last_mortgage_amount,source
 *   - Match keys: account_id (BEST) or address+owner_name.
 *   - free_and_clear: 0/1 if the source states it. If omitted, it's DERIVED:
 *       free_and_clear = 1 when open_lien_count == 0 OR mortgage_balance <= 0.
 *       (If neither is present, it's left 0 / unknown — we don't guess FAC.)
 *   - equity_pct is computed from est_equity / est_value when both are present.
 *
 * Usage:
 *   node ingest_liens.js <file.csv>     upsert lien rows from CSV (keyed by account)
 *   node ingest_liens.js --clear        wipe the liens table
 *   ALLOW_LOOSE_MATCH=1 node ingest_liens.js <file.csv>   allow street+ZIP-only match
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
const NAME_STOP = new Set(['AND', 'THE', 'LIFE', 'ESTATE', 'HEIRS', 'TRUST', 'LLC', 'INC', 'COMPANY', 'UNKNOWN', 'SPOUSE', 'HUSBAND', 'WIFE']);
const nameTokens = (name) => ([...new Set((String(name || '').toUpperCase().match(/[A-Z]{4,}/g) || []))])
  .filter(t => !NAME_STOP.has(t));

// number-or-null
const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

(async () => {
  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS liens (
      account_id TEXT PRIMARY KEY,
      owner_name TEXT,
      free_and_clear INTEGER DEFAULT 0,
      open_lien_count INTEGER,
      mortgage_balance REAL,
      est_value REAL,
      est_equity REAL,
      equity_pct REAL,
      last_mortgage_date TEXT,
      last_mortgage_amount REAL,
      source TEXT,
      match_method TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const arg = process.argv[2];
  if (arg === '--clear') {
    await db.run('DELETE FROM liens');
    console.log('liens cleared');
    await db.close();
    return;
  }
  if (!arg) { console.error('Provide a CSV path, or --clear'); process.exit(1); }

  const loose = process.env.ALLOW_LOOSE_MATCH === '1';
  const text = await fs.readFile(arg, 'utf8');
  const rows = parseCsv(text);
  console.log(`parsed ${rows.length} rows from ${path.basename(arg)}`);

  async function resolveAccount(r) {
    let accountId = (r.account_id || '').trim();
    if (accountId) {
      const hit = await db.get('SELECT account_id FROM tax_roll WHERE account_id = ?', [accountId]);
      if (hit) return { accountId, method: 'account_id' };
      accountId = '';
    }
    if (r.address) {
      const tok = streetToken(r.address);
      const zip = (r.address.match(/\b(\d{5})\b/) || [])[1];
      const names = nameTokens(r.owner_name);
      if (tok && zip && names.length) {
        const ownerOr = names.map(() => 'UPPER(owner_name) LIKE ?').join(' OR ');
        const hit = await db.get(
          `SELECT account_id FROM tax_roll WHERE UPPER(property_address) LIKE ? AND zip_code LIKE ? AND (${ownerOr}) LIMIT 1`,
          [`%${tok}%`, `${zip}%`, ...names.map(n => `%${n}%`)]
        );
        if (hit) return { accountId: hit.account_id, method: 'address+owner' };
      }
      if (tok && !names.length && loose) {
        const hit = await db.get(
          `SELECT account_id FROM tax_roll WHERE UPPER(property_address) LIKE ? ${zip ? 'AND zip_code LIKE ?' : ''} LIMIT 1`,
          zip ? [`%${tok}%`, `${zip}%`] : [`%${tok}%`]
        );
        if (hit) return { accountId: hit.account_id, method: 'address' };
      }
    }
    return { accountId: '', method: 'unmatched' };
  }

  const counts = {};
  let fac = 0, upserts = 0;
  await db.exec('BEGIN');
  for (const r of rows) {
    const { accountId, method } = await resolveAccount(r);
    counts[method] = (counts[method] || 0) + 1;
    if (!accountId) continue;

    const openLiens = num(r.open_lien_count);
    const balance = num(r.mortgage_balance);
    const estValue = num(r.est_value);
    const estEquity = num(r.est_equity);
    // Derive free_and_clear if not explicitly given.
    let freeClear = null;
    if (r.free_and_clear !== undefined && String(r.free_and_clear).trim() !== '') {
      freeClear = /^(1|y|yes|true)$/i.test(String(r.free_and_clear).trim()) ? 1 : 0;
    } else if (openLiens !== null) {
      freeClear = openLiens === 0 ? 1 : 0;
    } else if (balance !== null) {
      freeClear = balance <= 0 ? 1 : 0;
    } else {
      freeClear = 0; // unknown — do not assume free-and-clear
    }
    if (freeClear === 1) fac++;
    const equityPct = (estEquity !== null && estValue) ? +(estEquity / estValue).toFixed(4) : null;

    await db.run(
      `INSERT INTO liens (account_id, owner_name, free_and_clear, open_lien_count, mortgage_balance,
         est_value, est_equity, equity_pct, last_mortgage_date, last_mortgage_amount, source, match_method, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(account_id) DO UPDATE SET
         owner_name=excluded.owner_name, free_and_clear=excluded.free_and_clear,
         open_lien_count=excluded.open_lien_count, mortgage_balance=excluded.mortgage_balance,
         est_value=excluded.est_value, est_equity=excluded.est_equity, equity_pct=excluded.equity_pct,
         last_mortgage_date=excluded.last_mortgage_date, last_mortgage_amount=excluded.last_mortgage_amount,
         source=excluded.source, match_method=excluded.match_method, updated_at=CURRENT_TIMESTAMP`,
      [accountId, r.owner_name || null, freeClear, openLiens, balance,
       estValue, estEquity, equityPct, r.last_mortgage_date || null, num(r.last_mortgage_amount),
       r.source || 'csv', method]
    );
    upserts++;
  }
  await db.exec('COMMIT');

  console.log('match breakdown:', JSON.stringify(counts));
  console.log(`upserted ${upserts} lien rows (${fac} free-and-clear)`);
  const total = await db.get('SELECT COUNT(*) c, SUM(free_and_clear) f FROM liens');
  console.log(`liens table: ${total.c} rows, ${total.f || 0} free-and-clear`);
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
