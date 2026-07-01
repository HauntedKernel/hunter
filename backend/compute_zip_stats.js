/*
 * Per-ZIP MARKET INTELLIGENCE for the marketplace cards — real signals computed from the roll,
 * the kind a buyer wouldn't know to model. Stored on territory_zips, surfaced as card "insights".
 *
 *   absentee_pct    — share of the ZIP's delinquent owners who live elsewhere (out-of-area landlords).
 *   elderly_pct     — share with an over-65 / disabled exemption (downsizer wave; note TX relocation
 *                     intent starts ~60, below the 65 exemption line — we catch it earlier).
 *   new_distress_pct— share of delinquencies that are brand-new (≤1 yr): a momentum proxy. High =
 *                     fresh distress entering the market (heating up); low = old, stuck (cooling).
 *
 * Run on the box from backend/:  node compute_zip_stats.js
 * Env: HUNTER_DB (default src/data/tax_roll.db).
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');

const db = new sqlite3.Database(DB);
const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));
const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));

(async () => {
  await run('PRAGMA busy_timeout=15000');
  const cols = (await all('PRAGMA table_info(territory_zips)')).map(c => c.name);
  for (const c of ['elderly_pct', 'new_distress_pct'])
    if (!cols.includes(c)) await run(`ALTER TABLE territory_zips ADD COLUMN ${c} REAL`);
  if (!cols.includes('trend')) await run('ALTER TABLE territory_zips ADD COLUMN trend TEXT');

  // Only over the CATALOGUED ZIPs (join territory_zips) so the median is computed on our market.
  const rows = await all(`
    SELECT substr(t.zip_code,1,5) zip,
      100.0*SUM(CASE WHEN t.over65_exemption=1 OR t.disabled_exemption=1 THEN 1 ELSE 0 END)/COUNT(*) elderly,
      100.0*SUM(CASE WHEN t.delinquent_years<=1 THEN 1 ELSE 0 END)/COUNT(*) newd
    FROM tax_roll t JOIN territory_zips z ON z.zip = substr(t.zip_code,1,5)
    WHERE t.is_delinquent=1 AND t.zip_code IS NOT NULL AND length(t.zip_code)>=5
    GROUP BY substr(t.zip_code,1,5)`);

  // Momentum is RELATIVE: a ZIP's fresh-distress share vs the county median. Above → heating up,
  // below → cooling. (Single snapshot can't give an absolute time-trend, so we benchmark to market.)
  const sorted = rows.map(r => r.newd).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  let n = 0;
  await run('BEGIN');
  for (const r of rows) {
    const trend = r.newd >= median + 5 ? 'rising' : r.newd <= median - 5 ? 'cooling' : 'steady';
    await run('UPDATE territory_zips SET elderly_pct=?, new_distress_pct=?, trend=? WHERE zip=?',
      [round1(r.elderly), round1(r.newd), trend, r.zip]);
    n++;
  }
  await run('COMMIT');
  const dist = rows.reduce((m, r) => { const t = r.newd >= median + 5 ? 'rising' : r.newd <= median - 5 ? 'cooling' : 'steady'; m[t] = (m[t] || 0) + 1; return m; }, {});
  console.log(`computed market intelligence for ${n} catalogued ZIPs (median fresh-distress ${round1(median)}%).`);
  console.log(`  trend distribution: ${JSON.stringify(dist)}`);
  const sample = await all('SELECT zip, elderly_pct, new_distress_pct, trend FROM territory_zips WHERE new_distress_pct IS NOT NULL ORDER BY lead_count DESC LIMIT 6');
  sample.forEach(s => console.log(`   ${s.zip}  elderly ${s.elderly_pct}%  fresh-distress ${s.new_distress_pct}%  → ${s.trend}`));
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

function round1(x) { return x == null ? null : Math.round(x * 10) / 10; }
