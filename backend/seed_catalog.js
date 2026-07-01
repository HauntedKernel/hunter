/*
 * Seed the TERRITORY CATALOG — the sellable inventory for the marketplace page.
 * Derives real (ZIP × category) units from the delinquent tax roll so availability + lead
 * counts are honest, then seeds pricing and a little demo "sold" state (e.g. 75218 Land → Lee).
 *
 * Model (see LLC_BREAKER.md sibling — pricing decided 2026-06-30):
 *   - Unit of exclusivity = (ZIP × category): Residential / Land / Commercial.
 *   - Category exclusive $799/mo (sole owner). ZIP-wide exclusive $1,899/mo (all categories).
 *   - Shared territory $249/mo, ZIP-wide, capped at 3 agents (on-ramp). Ratchet: exclusive price
 *     always > shared cap revenue (3×249=747 < 799), so exclusivity is never a revenue sacrifice.
 *
 * Categories from Dallas CAD state category_code prefixes: A/B → residential, C/D/E → land,
 * F → commercial. (L = business personal property, M = mobile/tangible — not saleable lists.)
 *
 * Run on the box from backend/:  node seed_catalog.js
 * Env: HUNTER_DB (default src/data/tax_roll.db), MIN_ZIP_LEADS (default 20), RESEED=1 to wipe.
 */
const path = require('path');
const sqlite3 = require('sqlite3');

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const MIN_ZIP_LEADS = Number(process.env.MIN_ZIP_LEADS || 20);
const SHARED_PRICE = 249, SHARED_CAP = 3, CAT_EXCL_PRICE = 799, ZIP_EXCL_PRICE = 1899;

function categoryOf(code) {
  const c = String(code || '').trim().toUpperCase()[0];
  if (c === 'A' || c === 'B') return 'residential';
  if (c === 'C' || c === 'D' || c === 'E') return 'land';
  if (c === 'F') return 'commercial';
  return null;                                        // L/M/null → not a saleable list
}

// A little demo "sold" state so the page shows real scarcity. Keyed to real ZIPs; applied only
// if that (zip,category) actually exists in the derived inventory.
const DEMO_CATEGORY_SOLD = [
  { zip: '75218', category: 'land', owner: 'Lee Buchanan' },        // Big Lee's exclusive land list
  { zip: '75208', category: 'residential', owner: 'Marisol Vega' },
  { zip: '75215', category: 'commercial', owner: 'Grant Holloway' },
];
const DEMO_ZIP_EXCLUSIVE_SOLD = [
  { zip: '75203', owner: 'Priya Anand' },                           // whole-ZIP exclusive taken
];
const DEMO_SHARED_FULL = ['75211', '75217'];                        // shared cap reached (waitlist)

const db = new sqlite3.Database(DB);
const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));
const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));

(async () => {
  await run('PRAGMA busy_timeout=15000');
  await run(`CREATE TABLE IF NOT EXISTS territory_zips (
    zip TEXT PRIMARY KEY, lead_count INTEGER, shared_price INTEGER, shared_cap INTEGER,
    shared_count INTEGER DEFAULT 0, zip_excl_price INTEGER, zip_excl_owner TEXT, zip_excl_since TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await run(`CREATE TABLE IF NOT EXISTS territory_units (
    zip TEXT, category TEXT, lead_count INTEGER, excl_price INTEGER, excl_owner TEXT, excl_since TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (zip, category))`);
  await run(`CREATE TABLE IF NOT EXISTS territory_orders (
    id TEXT PRIMARY KEY, zip TEXT, category TEXT, tier TEXT, customer_name TEXT, customer_email TEXT,
    amount INTEGER, stripe_session TEXT, stripe_subscription TEXT, status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  if (process.env.RESEED === '1') { await run('DELETE FROM territory_units'); await run('DELETE FROM territory_zips'); }

  // Derive (zip, category) delinquent lead counts from the roll.
  const rows = await all(`SELECT substr(zip_code,1,5) zip, category_code, COUNT(*) n
    FROM tax_roll WHERE is_delinquent=1 AND zip_code IS NOT NULL AND length(zip_code)>=5
    GROUP BY substr(zip_code,1,5), category_code`);

  const zipCat = new Map();   // zip -> {residential,land,commercial} counts
  for (const r of rows) {
    const cat = categoryOf(r.category_code);
    if (!cat) continue;
    if (!zipCat.has(r.zip)) zipCat.set(r.zip, { residential: 0, land: 0, commercial: 0 });
    zipCat.get(r.zip)[cat] += r.n;
  }

  let zips = 0, units = 0;
  await run('BEGIN');
  for (const [zip, cats] of zipCat) {
    const total = cats.residential + cats.land + cats.commercial;
    if (total < MIN_ZIP_LEADS) continue;
    await run(`INSERT INTO territory_zips (zip, lead_count, shared_price, shared_cap, zip_excl_price)
      VALUES (?,?,?,?,?) ON CONFLICT(zip) DO UPDATE SET lead_count=excluded.lead_count,
      shared_price=excluded.shared_price, shared_cap=excluded.shared_cap, zip_excl_price=excluded.zip_excl_price`,
      [zip, total, SHARED_PRICE, SHARED_CAP, ZIP_EXCL_PRICE]);
    zips++;
    for (const cat of ['residential', 'land', 'commercial']) {
      if (!cats[cat]) continue;
      await run(`INSERT INTO territory_units (zip, category, lead_count, excl_price)
        VALUES (?,?,?,?) ON CONFLICT(zip,category) DO UPDATE SET lead_count=excluded.lead_count,
        excl_price=excluded.excl_price`, [zip, cat, cats[cat], CAT_EXCL_PRICE]);
      units++;
    }
  }
  await run('COMMIT');

  // Apply demo sold state (only where the unit actually exists).
  for (const d of DEMO_CATEGORY_SOLD)
    await run(`UPDATE territory_units SET excl_owner=?, excl_since=date('now','-'||(abs(random())%40+3)||' days')
      WHERE zip=? AND category=? AND excl_owner IS NULL`, [d.owner, d.zip, d.category]);
  for (const d of DEMO_ZIP_EXCLUSIVE_SOLD)
    await run(`UPDATE territory_zips SET zip_excl_owner=?, zip_excl_since=date('now','-14 days')
      WHERE zip=? AND zip_excl_owner IS NULL`, [d.owner, d.zip]);
  for (const z of DEMO_SHARED_FULL)
    await run(`UPDATE territory_zips SET shared_count=shared_cap WHERE zip=?`, [z]);

  const zc = (await all('SELECT COUNT(*) c FROM territory_zips'))[0].c;
  const uc = (await all('SELECT COUNT(*) c FROM territory_units'))[0].c;
  const sold = (await all("SELECT COUNT(*) c FROM territory_units WHERE excl_owner IS NOT NULL"))[0].c;
  console.log(`seeded ${zc} ZIPs, ${uc} category units; ${sold} category-exclusives marked sold (demo).`);
  const sample = await all(`SELECT zip, category, lead_count, excl_owner FROM territory_units
    WHERE excl_owner IS NOT NULL OR lead_count > 200 ORDER BY excl_owner IS NULL, lead_count DESC LIMIT 8`);
  sample.forEach(s => console.log(`   ${s.zip} ${s.category.padEnd(12)} ${String(s.lead_count).padStart(4)} leads ${s.excl_owner ? '→ SOLD to ' + s.excl_owner : ''}`));
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
