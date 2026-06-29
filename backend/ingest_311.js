/**
 * Ingest Dallas 311 CODE-COMPLIANCE requests into a `code_violations` table in
 * tax_roll.db, matched to tax-roll properties so discovery can use them as a
 * distress motivation signal (SIGNAL_GAPS.md P1 #3).
 *
 * These are EVENTS from the Dallas OpenData 311 feed (dataset gc4d-8a49), NOT the
 * tax roll. An OPEN code-compliance request (substandard structure, junk/debris,
 * high weeds/grass, etc.) flags a neglected or over-extended owner.
 *
 * Get a CSV from `fetch_311.js` (pulls the free SODA API and normalizes columns),
 * or hand any CSV with the header below.
 *
 * CSV columns (header required): request_type,account_id,address,status,opened_date,closed_date,source
 *   request_type: the 311 service-request type (e.g. "Substandard Structure")
 *   account_id:   DCAD account id (BEST match key). 311 rarely carries one — if
 *                 absent we fall back to address matching (see the precision note).
 *
 * ⚠️ MATCHING PRECISION: 311 records carry a full street address WITH a house
 * number, but the tax roll's `property_address` has NO house numbers — so a
 * street+ZIP match lands on an arbitrary house on the street. Precision-first:
 * without an account id, rows are left UNMATCHED unless you opt in with
 * ALLOW_LOOSE_MATCH=1 (accepting false positives). The real fix is a DCAD
 * situs-address → account crosswalk (future). Unmatched rows are still stored.
 *
 * Usage:
 *   node ingest_311.js <file.csv>     load/replace events from CSV
 *   node ingest_311.js --clear        wipe the code_violations table
 *   ALLOW_LOOSE_MATCH=1 node ingest_311.js <file.csv>   street+ZIP fallback on
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

// Longest alpha street token (4+ chars) — same definition the foreclosure ingester
// uses, so address matching behaves consistently across feeds.
function streetToken(addr) {
  return (String(addr || '').toUpperCase().match(/[A-Z]{4,}/g) || [])
    .sort((a, b) => b.length - a.length)[0] || '';
}

(async () => {
  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS code_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT,
      request_type TEXT,
      address TEXT,
      status TEXT,
      opened_date TEXT,
      closed_date TEXT,
      source TEXT,
      match_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_code_violations_account ON code_violations(account_id);
  `);

  const arg = process.argv[2];
  if (arg === '--clear') {
    await db.run('DELETE FROM code_violations');
    console.log('code_violations cleared');
    await db.close();
    return;
  }
  if (!arg) { console.error('Provide a CSV path, or --clear'); process.exit(1); }

  const text = await fs.readFile(arg, 'utf8');
  const rows = parseCsv(text);
  console.log(`parsed ${rows.length} rows from ${path.basename(arg)}`);

  const loose = process.env.ALLOW_LOOSE_MATCH === '1';
  let byAccount = 0, byAddress = 0, unmatched = 0;
  await db.exec('BEGIN');
  for (const r of rows) {
    let accountId = (r.account_id || '').trim();
    let method = 'unmatched';

    if (accountId) {
      const hit = await db.get('SELECT account_id FROM tax_roll WHERE account_id = ?', [accountId]);
      if (hit) { method = 'account_id'; byAccount++; }
      else accountId = ''; // bad id, fall through to address
    }
    if (!accountId && r.address && loose) {
      // 311 has no owner name to disambiguate and the tax roll lacks house numbers,
      // so this street+ZIP match lands on an ARBITRARY house on the street. Off by
      // default; ALLOW_LOOSE_MATCH=1 accepts the false-positive risk.
      const tok = streetToken(r.address);
      const zip = (r.address.match(/\b(\d{5})\b/) || [])[1];
      if (tok) {
        const hit = await db.get(
          `SELECT account_id FROM tax_roll WHERE UPPER(property_address) LIKE ? ${zip ? 'AND zip_code LIKE ?' : ''} LIMIT 1`,
          zip ? [`%${tok}%`, `${zip}%`] : [`%${tok}%`]
        );
        if (hit) { accountId = hit.account_id; method = 'address'; byAddress++; }
        else unmatched++;
      } else unmatched++;
    } else if (!accountId) unmatched++;

    await db.run(
      `INSERT INTO code_violations (account_id, request_type, address, status, opened_date, closed_date, source, match_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId || null, r.request_type || null, r.address || null,
       (r.status || '').trim() || null, r.opened_date || null, r.closed_date || null,
       r.source || 'dallas_311', method]
    );
  }
  await db.exec('COMMIT');

  console.log(`ingested: ${byAccount} by account_id, ${byAddress} by address-only${loose ? '' : ' (loose matching OFF — set ALLOW_LOOSE_MATCH=1 to enable)'}, ${unmatched} unmatched`);
  const total = await db.get('SELECT COUNT(*) c FROM code_violations');
  const matched = await db.get('SELECT COUNT(*) c FROM code_violations WHERE account_id IS NOT NULL');
  console.log(`code_violations total rows: ${total.c} (${matched.c} matched to a tax-roll account)`);
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
