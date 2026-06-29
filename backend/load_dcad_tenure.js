/*
 * Stream a DCAD certified ACCOUNT_INFO.CSV (one annual file, ~350 MB / ~2.6 M rows)
 * and load just ACCOUNT_NUM + DEED_TXFR_DATE into an appraisal_detail table, computing
 * ownership tenure as-of a given year. MEMORY-SAFE: reads line-by-line (readline) and
 * batches inserts — unlike ingest_appraisal.js, which slurps the whole file (fine for
 * small extracts, OOMs on the full 350 MB annual file).
 *
 * Used by scripts/backtrain_sell_model.js to get LEAKAGE-SAFE tenure: load the YEAR's
 * own certified file so deed dates are as-of that year (today's file would show a sold
 * parcel's NEW deed). tenure_years = asofYear - deed_year.
 *
 * Usage (load the 2025 annual file as the 2025-as-of tenure source):
 *   APPRAISAL_DB=src/data/appraisal_2025.db node load_dcad_tenure.js dcad_work/ACCOUNT_INFO_2025.csv 2025
 *   # arg2 (as-of year) defaults to the 4-digit year found in the filename, else current year.
 *
 * Writes appraisal_detail(account_id PK, deed_transfer_date, deed_year, tenure_years).
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const NOW_YEAR = new Date().getFullYear();

// Minimal quoted-CSV line splitter (handles "" escapes and commas inside quotes).
function splitCsv(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function normAccount(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return null;
  return d.length >= 17 ? d.slice(-17) : d.padStart(17, '0');
}
function yearOf(v) {
  const s = String(v || '').trim();
  let m = s.match(/\b(19|20)\d{2}\b/);
  let y = m ? Number(m[0]) : (/^\d{8}$/.test(s) ? Number(s.slice(0, 4)) : null);
  return (y == null || y < 1850 || y > NOW_YEAR) ? null : y;
}

(async () => {
  const input = process.argv[2];
  if (!input) { console.error('Provide a DCAD ACCOUNT_INFO.CSV path'); process.exit(1); }
  const asofYear = Number(process.argv[3]) || yearOf(path.basename(input)) || NOW_YEAR;
  const dbPath = process.env.APPRAISAL_DB
    ? path.resolve(process.env.APPRAISAL_DB)
    : path.join(__dirname, 'src', 'data', 'tax_roll.db');

  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS appraisal_detail (
    account_id TEXT PRIMARY KEY,
    deed_transfer_date TEXT,
    deed_year INTEGER,
    tenure_years INTEGER,
    year_built INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;');

  console.log(`loading ${path.basename(input)} → ${dbPath}  (as-of year ${asofYear})`);
  const rl = readline.createInterface({ input: fs.createReadStream(input, 'utf8'), crlfDelay: Infinity });

  let acctIdx = -1, deedIdx = -1, n = 0, withDeed = 0, header = true;
  const stmt = await db.prepare(`INSERT INTO appraisal_detail (account_id, deed_transfer_date, deed_year, tenure_years)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      deed_transfer_date=COALESCE(excluded.deed_transfer_date, deed_transfer_date),
      deed_year=COALESCE(excluded.deed_year, deed_year),
      tenure_years=COALESCE(excluded.tenure_years, tenure_years)`);
  await db.exec('BEGIN');
  for await (const line of rl) {
    if (header) {
      const cols = splitCsv(line).map(norm);
      acctIdx = cols.findIndex(c => ['accountnum', 'acctnum', 'accountnumber', 'account'].includes(c));
      deedIdx = cols.findIndex(c => c.includes('deedtxfr') || c.includes('deedtransfer') || c === 'deeddate');
      if (acctIdx < 0 || deedIdx < 0) { console.error(`could not find ACCOUNT_NUM (${acctIdx}) / DEED_TXFR_DATE (${deedIdx}) columns`); process.exit(1); }
      header = false;
      continue;
    }
    if (!line) continue;
    const f = splitCsv(line);
    const id = normAccount(f[acctIdx]);
    if (!id) continue;
    const deedRaw = f[deedIdx];
    const dy = yearOf(deedRaw);
    const tenure = dy != null ? Math.max(0, asofYear - dy) : null;
    if (dy != null) withDeed++;
    await stmt.run(id, deedRaw || null, dy, tenure);
    if (++n % 100000 === 0) { await db.exec('COMMIT'); await db.exec('BEGIN'); process.stdout.write(`\r  ${n} rows…`); }
  }
  await db.exec('COMMIT');
  await stmt.finalize();
  process.stdout.write('\n');

  const total = (await db.get('SELECT COUNT(*) n FROM appraisal_detail')).n;
  const long30 = (await db.get('SELECT COUNT(*) n FROM appraisal_detail WHERE tenure_years >= 30')).n;
  console.log(`done: ${n} rows scanned, ${withDeed} with deed dates; appraisal_detail total ${total} (${long30} owned 30+ yrs as-of ${asofYear})`);
  await db.close();
})().catch(e => { console.error('LOAD FAILED:', e.message); process.exit(1); });
