/**
 * One-time migration: precompute the `is_absentee` signal column and add
 * area indexes, so discovery can surface non-delinquent absentee/elderly owners
 * (STRATEGY.md §2). Safe to re-run — idempotent.
 *
 * Absentee definition (must match MotivationScorer/formatPropertyResult): the
 * owner's mailing address doesn't reference the property's main street token.
 * owner_address has no city/ZIP in this dataset, so street-token is the only
 * reliable signal.
 *
 * Run: node migrate_signal_columns.js   (stop the backend first — it holds the DB)
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

function isAbsentee(propertyAddress, ownerAddress) {
  const p = String(propertyAddress || '').toUpperCase();
  const o = String(ownerAddress || '').toUpperCase();
  const token = (p.match(/[A-Z]{4,}/g) || []).sort((a, b) => b.length - a.length)[0] || '';
  return o && token && !o.includes(token) ? 1 : 0;
}

(async () => {
  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  const cols = await db.all("PRAGMA table_info(tax_roll)");
  if (!cols.find(c => c.name === 'is_absentee')) {
    await db.exec('ALTER TABLE tax_roll ADD COLUMN is_absentee INTEGER DEFAULT 0');
    console.log('added column is_absentee');
  } else {
    console.log('is_absentee already exists — recomputing');
  }

  console.log('loading rows...');
  const rows = await db.all('SELECT account_id, property_address, owner_address FROM tax_roll');
  console.log('rows:', rows.length.toLocaleString());

  const absenteeIds = [];
  for (const r of rows) {
    if (isAbsentee(r.property_address, r.owner_address)) absenteeIds.push(r.account_id);
  }
  console.log('absentee:', absenteeIds.length.toLocaleString());

  await db.exec('BEGIN');
  await db.run('UPDATE tax_roll SET is_absentee = 0'); // reset for idempotency
  const CHUNK = 500;
  for (let i = 0; i < absenteeIds.length; i += CHUNK) {
    const chunk = absenteeIds.slice(i, i + CHUNK);
    const ph = chunk.map(() => '?').join(',');
    await db.run(`UPDATE tax_roll SET is_absentee = 1 WHERE account_id IN (${ph})`, chunk);
  }
  await db.exec('COMMIT');
  console.log('is_absentee populated');

  await db.exec('CREATE INDEX IF NOT EXISTS idx_tax_roll_zip ON tax_roll(zip_code)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_tax_roll_city ON tax_roll(city)');
  console.log('indexes ready');

  const chk = await db.get('SELECT COUNT(*) c FROM tax_roll WHERE is_absentee = 1');
  console.log('verify is_absentee=1 count:', chk.c.toLocaleString());
  await db.close();
  console.log('migration done');
})().catch(e => { console.error('MIGRATION FAILED:', e.message); process.exit(1); });
