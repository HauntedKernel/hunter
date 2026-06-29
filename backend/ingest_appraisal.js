/**
 * Ingest the FREE DCAD bulk appraisal file to add OWNERSHIP TENURE + YEAR BUILT to
 * Hunter — the two signals the tax-collections roll (tax_roll.db) completely lacks.
 *
 * WHY: tax_roll.db is built from the Dallas tax-office COLLECTIONS roll (delinquency,
 * suits, bankruptcy) — it has no deed date, no sale date, no year built. The DCAD
 * APPRAISAL roll has all three and is a FREE download (no export caps, unlike
 * PropStream). Tenure is the strongest residential-mobility predictor in the
 * literature (RESEARCH.md §A), and long tenure is a free FREE-AND-CLEAR proxy:
 * a standard 30-yr mortgage on a home owned 30+ years is almost certainly paid off
 * — especially stacked with the over-65 exemption.
 *
 * SOURCE (free): https://www.dallascad.org/dataproducts.aspx
 *   -> "Current Appraisal Data" (comma-delimited) ZIP. Inside are several CSVs;
 *      the owner/account file carries the DEED TRANSFER DATE, the residential-detail
 *      file carries YEAR BUILT. Account number is the SAME id as tax_roll.account_id
 *      (17-char DCAD format), so it joins directly.
 *
 * Headers vary by file, so columns are matched fuzzily (like map_propstream.js).
 * Pass whichever CSV(s) hold the fields; run it on each — it merges by account.
 * It PRINTS which columns it found; if a field didn't map, paste me the header row.
 *
 * Usage:
 *   node ingest_appraisal.js <dcad_file.csv> [more.csv ...]
 *   # e.g. node ingest_appraisal.js "imports/account_info.csv" "imports/res_detail.csv"
 *
 * Writes table appraisal_detail(account_id PK, deed_transfer_date, deed_year,
 * tenure_years, year_built, updated_at) and reports the join rate vs tax_roll.
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const NOW_YEAR = new Date().getFullYear();

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return { keys: [], rows: [] };
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const keys = split(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = split(lines[i]); const row = {};
    keys.forEach((k, j) => { row[k] = vals[j] || ''; });
    rows.push(row);
  }
  return { keys, rows };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function pick(keys, aliases) {
  const al = aliases.map(norm);
  for (const k of keys) if (al.includes(k)) return k;          // exact
  for (const k of keys) if (al.some(a => k.includes(a))) return k; // loose contains
  return null;
}

// DCAD account numbers are 17-char; tax_roll.account_id is the same id. Normalize
// to digits zero-padded to 17 so the join lines up regardless of leading zeros.
function normAccount(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return null;
  return d.length >= 17 ? d.slice(-17) : d.padStart(17, '0');
}

// Pull a 4-digit year out of a deed date in any common format (mm/dd/yyyy, yyyymmdd,
// yyyy-mm-dd, or a bare year). Reject implausible years.
function yearOf(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  let y = null;
  let m = s.match(/\b(19|20)\d{2}\b/);            // a 4-digit year anywhere
  if (m) y = Number(m[0]);
  else if (/^\d{8}$/.test(s)) y = Number(s.slice(0, 4)); // yyyymmdd
  if (y == null || y < 1850 || y > NOW_YEAR) return null;
  return y;
}

(async () => {
  const inputs = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!inputs.length) { console.error('Provide one or more DCAD appraisal CSV paths'); process.exit(1); }

  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS appraisal_detail (
    account_id TEXT PRIMARY KEY,
    deed_transfer_date TEXT,
    deed_year INTEGER,
    tenure_years INTEGER,
    year_built INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Merge across files by account: a file may carry only some of the fields.
  const merged = new Map(); // account_id -> { deedDate, deedYear, yearBuilt }
  for (const inPath of inputs) {
    const { keys, rows } = parseCsv(fs.readFileSync(inPath, 'utf8'));
    const col = {
      acct: pick(keys, ['accountnum', 'acctnum', 'accountnumber', 'account', 'acct', 'gisparcelid', 'parcelid', 'propertyid']),
      deedDate: pick(keys, ['deedtxfrdate', 'deedtransferdate', 'deeddate', 'deedtxfr', 'txfrdate', 'transferdate', 'recordingdate']),
      yearBuilt: pick(keys, ['yrbuilt', 'yearbuilt', 'actyrbuilt', 'actualyearbuilt', 'effyrbuilt', 'effectiveyearbuilt']),
    };
    console.log(`\n${path.basename(inPath)}: ${rows.length} rows`);
    console.log('  detected:', JSON.stringify(col));
    if (!col.acct) { console.log('  ⚠ no account-number column found — skipping this file'); continue; }
    let withDeed = 0, withYear = 0;
    for (const r of rows) {
      const id = normAccount(r[col.acct]);
      if (!id) continue;
      const cur = merged.get(id) || {};
      if (col.deedDate && r[col.deedDate]) {
        const y = yearOf(r[col.deedDate]);
        if (y) { cur.deedDate = r[col.deedDate]; cur.deedYear = y; withDeed++; }
      }
      if (col.yearBuilt) {
        const yb = yearOf(r[col.yearBuilt]) || (/^\d{4}$/.test(String(r[col.yearBuilt]).trim()) ? Number(r[col.yearBuilt]) : null);
        if (yb) { cur.yearBuilt = yb; withYear++; }
      }
      merged.set(id, cur);
    }
    console.log(`  -> ${withDeed} deed dates, ${withYear} year-built values`);
  }

  // Upsert merged rows.
  await db.exec('BEGIN');
  const stmt = await db.prepare(`INSERT INTO appraisal_detail
    (account_id, deed_transfer_date, deed_year, tenure_years, year_built, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(account_id) DO UPDATE SET
      deed_transfer_date=COALESCE(excluded.deed_transfer_date, deed_transfer_date),
      deed_year=COALESCE(excluded.deed_year, deed_year),
      tenure_years=COALESCE(excluded.tenure_years, tenure_years),
      year_built=COALESCE(excluded.year_built, year_built),
      updated_at=CURRENT_TIMESTAMP`);
  let written = 0;
  for (const [id, v] of merged) {
    const tenure = v.deedYear != null ? NOW_YEAR - v.deedYear : null;
    await stmt.run(id, v.deedDate || null, v.deedYear ?? null, tenure, v.yearBuilt ?? null);
    written++;
  }
  await stmt.finalize();
  await db.exec('COMMIT');

  // Report join rate + a tenure histogram so we can see the free-and-clear proxy supply.
  const total = (await db.get('SELECT COUNT(*) n FROM appraisal_detail')).n;
  const joined = (await db.get(
    'SELECT COUNT(*) n FROM appraisal_detail a JOIN tax_roll t ON t.account_id = a.account_id')).n;
  const longTenure = (await db.get(
    'SELECT COUNT(*) n FROM appraisal_detail a JOIN tax_roll t ON t.account_id=a.account_id WHERE a.tenure_years >= 30')).n;
  const longElderly = (await db.get(
    `SELECT COUNT(*) n FROM appraisal_detail a JOIN tax_roll t ON t.account_id=a.account_id
     WHERE a.tenure_years >= 30 AND t.over65_exemption = 1`)).n;
  console.log(`\nappraisal_detail: ${written} rows written, ${total} total`);
  console.log(`join vs tax_roll: ${joined}/${total} (${(joined / total * 100).toFixed(1)}% of appraisal rows match a tax_roll account)`);
  console.log(`free-and-clear PROXY supply: ${longTenure.toLocaleString()} owned 30+ yrs; ${longElderly.toLocaleString()} of those are over-65 (high-confidence paid-off).`);
  if (joined / Math.max(total, 1) < 0.5) console.log('⚠ low join rate — the account-number format may differ; paste me a few account values and I will adjust normAccount().');
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
