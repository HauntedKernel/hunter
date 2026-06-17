/**
 * Ingest skip-trace results (owner phone/email) into a `contacts` table in
 * tax_roll.db, so leads can become *contactable* (STRATEGY.md §5).
 *
 * Skip tracing (name + mailing address -> phone/email) has NO public source —
 * it requires a paid vendor (TLOxp, IDI/LexisNexis, BatchSkipTracing, REISkip,
 * PropStream, Skip Genie, Whitepages Pro). Most REI workflows run a batch and
 * get a CSV back; this loads that CSV. (A live-API path also exists behind env
 * keys in SkipTraceService — see that file.)
 *
 * COMPLIANCE: phones are stored with dnc='unknown' and are NOT callable until
 * DNC-scrubbed (fail-closed). See SkipTraceService + STRATEGY.md §7.
 *
 * CSV columns (header required): account_id,phones,emails,source
 *   phones / emails: semicolon-separated (e.g. "2145550101;2145550102")
 *
 * Usage:
 *   node ingest_contacts.js <file.csv>     load/replace contacts from CSV
 *   node ingest_contacts.js --clear        wipe the contacts table
 */
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false; else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = split(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(l => {
    const vals = split(l); const row = {};
    headers.forEach((h, j) => { row[h] = vals[j] || ''; });
    return row;
  });
}

const normalizePhone = (p) => String(p || '').replace(/\D/g, '');
const splitList = (s) => String(s || '').split(';').map(x => x.trim()).filter(Boolean);

(async () => {
  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      account_id TEXT PRIMARY KEY,
      owner_name TEXT,
      phones TEXT,
      emails TEXT,
      source TEXT,
      dnc_checked_at TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const arg = process.argv[2];
  if (arg === '--clear') {
    await db.run('DELETE FROM contacts');
    console.log('contacts cleared');
    await db.close();
    return;
  }
  if (!arg) { console.error('Provide a CSV path, or --clear'); process.exit(1); }

  const rows = parseCsv(await fs.readFile(arg, 'utf8'));
  console.log(`parsed ${rows.length} rows`);

  let matched = 0, skipped = 0;
  await db.exec('BEGIN');
  for (const r of rows) {
    const accountId = (r.account_id || '').trim();
    if (!accountId) { skipped++; continue; }
    const owner = await db.get('SELECT owner_name FROM tax_roll WHERE account_id = ?', [accountId]);
    // Phones stored with dnc='unknown' — NOT callable until scrubbed (fail-closed).
    const phones = splitList(r.phones).map(p => ({ number: normalizePhone(p), dnc: 'unknown', type: r.phone_type || 'unknown' }));
    const emails = splitList(r.emails);
    await db.run(
      `INSERT INTO contacts (account_id, owner_name, phones, emails, source, dnc_checked_at)
       VALUES (?, ?, ?, ?, ?, NULL)
       ON CONFLICT(account_id) DO UPDATE SET
         phones = excluded.phones, emails = excluded.emails,
         source = excluded.source, dnc_checked_at = NULL, updated_at = CURRENT_TIMESTAMP`,
      [accountId, owner?.owner_name || r.owner_name || null, JSON.stringify(phones), JSON.stringify(emails), r.source || 'csv']
    );
    matched++;
  }
  await db.exec('COMMIT');
  console.log(`ingested ${matched} contacts (${skipped} skipped, no account_id)`);
  console.log('NOTE: phones are NOT callable until DNC-scrubbed (compliance fail-closed).');
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
