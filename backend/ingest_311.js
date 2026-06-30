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

// --- SITUS CROSSWALK key (precise account matching). MUST mirror build_situs_xref.py
// situs_key() exactly, or keys won't line up. key = house|zip5|street-core. ---
const DIR = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST']);
const SUF = new Set(['ST', 'STREET', 'AVE', 'AV', 'AVENUE', 'DR', 'DRIVE', 'LN', 'LANE', 'RD', 'ROAD',
  'BLVD', 'BL', 'CT', 'COURT', 'PL', 'PLACE', 'WAY', 'CIR', 'CIRCLE', 'TER', 'TERR', 'TERRACE',
  'TRL', 'TRAIL', 'PKWY', 'PARKWAY', 'CV', 'COVE', 'PT', 'POINT', 'HWY', 'HIGHWAY', 'LOOP',
  'PASS', 'PATH', 'RUN', 'ROW', 'XING', 'CROSSING', 'SQ', 'PLZ', 'PLAZA', 'EXPY', 'EXPWY', 'FWY']);
function streetCore(name) {
  let toks = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (toks.length && DIR.has(toks[0])) toks = toks.slice(1);
  if (toks.length && SUF.has(toks[toks.length - 1])) toks = toks.slice(0, -1);
  return toks.join(' ');
}
// Parse a full 311 address ("9030 MARKVILLE DR, DALLAS, TX, 75243") into the situs key.
function situsKeyFrom311(addr) {
  const s = String(addr || '');
  const first = s.split(',')[0] || '';                 // "9030 MARKVILLE DR"
  const hm = first.match(/^\s*0*(\d+)\s+(.*)$/);        // house (strip leading zeros) + street
  if (!hm) return null;
  const house = hm[1];
  const zs = s.match(/\d{5}/g);                         // ZIP = last 5-digit group (not the house num)
  const zip = zs ? zs[zs.length - 1] : '';
  const core = streetCore(hm[2]);
  return (house && zip && core) ? `${house}|${zip}|${core}` : null;
}

(async () => {
  const dbPath = process.env.HUNTER_DB
    ? path.resolve(process.env.HUNTER_DB)
    : path.join(__dirname, 'src', 'data', 'tax_roll.db');
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
  // The situs crosswalk (build_situs_xref.py) is the PRECISE matcher: it resolves a
  // 311 street address to a parcel via DCAD house numbers. Present = use it; absent =
  // fall back to the loose street+ZIP path (gated). Honestly report which was used.
  const hasXref = !!(await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='situs_xref'"));
  if (!hasXref) console.log('NOTE: situs_xref not found — run build_situs_xref.py for precise matching (falling back to loose).');
  let byAccount = 0, byXref = 0, byAddress = 0, unmatched = 0;
  await db.exec('BEGIN');
  for (const r of rows) {
    let accountId = (r.account_id || '').trim();
    let method = 'unmatched';

    if (accountId) {
      const hit = await db.get('SELECT account_id FROM tax_roll WHERE account_id = ?', [accountId]);
      if (hit) { method = 'account_id'; byAccount++; }
      else accountId = ''; // bad id, fall through to address
    }
    // PRECISE: resolve the full street address to a parcel via the situs crosswalk.
    if (!accountId && r.address && hasXref) {
      const key = situsKeyFrom311(r.address);
      if (key) {
        const hit = await db.get('SELECT account_id FROM situs_xref WHERE addr_key = ?', [key]);
        if (hit) { accountId = hit.account_id; method = 'situs_xref'; byXref++; }
      }
    }
    // LOOSE fallback (only if no crosswalk hit and explicitly opted in): street+ZIP
    // lands on an ARBITRARY house on the street, so it's off unless ALLOW_LOOSE_MATCH=1.
    if (!accountId && r.address && loose) {
      const tok = streetToken(r.address);
      const zip = (r.address.match(/\b(\d{5})\b/) || [])[1];
      if (tok) {
        const hit = await db.get(
          `SELECT account_id FROM tax_roll WHERE UPPER(property_address) LIKE ? ${zip ? 'AND zip_code LIKE ?' : ''} LIMIT 1`,
          zip ? [`%${tok}%`, `${zip}%`] : [`%${tok}%`]
        );
        if (hit) { accountId = hit.account_id; method = 'address'; byAddress++; }
      }
    }
    if (!accountId) unmatched++;

    await db.run(
      `INSERT INTO code_violations (account_id, request_type, address, status, opened_date, closed_date, source, match_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId || null, r.request_type || null, r.address || null,
       (r.status || '').trim() || null, r.opened_date || null, r.closed_date || null,
       r.source || 'dallas_311', method]
    );
  }
  await db.exec('COMMIT');

  console.log(`ingested: ${byAccount} by account_id, ${byXref} by situs crosswalk (precise), ${byAddress} by loose address${loose || hasXref ? '' : ' (loose OFF — set ALLOW_LOOSE_MATCH=1)'}, ${unmatched} unmatched`);
  const total = await db.get('SELECT COUNT(*) c FROM code_violations');
  const matched = await db.get('SELECT COUNT(*) c FROM code_violations WHERE account_id IS NOT NULL');
  console.log(`code_violations total rows: ${total.c} (${matched.c} matched to a tax-roll account)`);
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
