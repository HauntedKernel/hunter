/*
 * MEASURE HOLD-TIME (tenure) as a sell signal — segmented by OWNER TYPE (person vs entity), and
 * the "stuck flip" interaction (an entity held PAST its normal flip window + delinquent). Same
 * leakage-safe snapshot-diff spine as backtrain_recency_code.js: sold = owner_name changed
 * OLD(2025-08-25)→CURRENT; tenure = ASOF_YEAR − deed_year (2025 DCAD archive). The as-of-YEAR
 * deed band is a LEAK (the archive captures the sale's new deed) → flagged + excluded from reads.
 *
 * Read-only. Run on the box from backend/:  node scripts/measure_holdtime.js
 * Env: OLD_DB, APPRAISAL_2025_DB, ASOF (2025-08-25).
 */
const sqlite3 = require('sqlite3');
const { classifyOwner } = require('../lib/entity_resolution');

const CUR = process.env.CUR_DB || 'src/data/tax_roll.db';
const OLD = process.env.OLD_DB || 'src/data/tax_roll.db.bak-20250825';
const APR = process.env.APPRAISAL_2025_DB || 'src/data/appraisal_2025.db';
const ASOF_YEAR = Number((process.env.ASOF || '2025-08-25').slice(0, 4));

const db = new sqlite3.Database(CUR, sqlite3.OPEN_READONLY);
const run = (s) => new Promise((res, rej) => db.run(s, [], e => e ? rej(e) : res()));
const all = (s) => new Promise((res, rej) => db.all(s, [], (e, r) => e ? rej(e) : res(r)));
const norm = (c) => `UPPER(REPLACE(REPLACE(REPLACE(TRIM(${c}),'.',''),',',''),'  ',' '))`;

// deed_year → tenure band label (excludes the leaky as-of year)
function band(dy) {
  if (!dy) return null;
  if (dy >= ASOF_YEAR) return `~0yr (${ASOF_YEAR}+ · LEAK)`;
  const t = ASOF_YEAR - dy;
  if (t <= 1) return '1  · <1-1yr';
  if (t <= 3) return '2  · 2-3yr';
  if (t <= 6) return '3  · 4-6yr';
  if (t <= 12) return '4  · 7-12yr';
  if (t <= 20) return '5  · 13-20yr';
  return '6  · 20yr+';
}

(async () => {
  await run(`ATTACH DATABASE '${OLD}' AS old`);
  await run(`ATTACH DATABASE '${APR}' AS apr`);
  console.log('loading snapshot-diff rows (real property, both snapshots)…');
  const rows = await all(`
    SELECT (CASE WHEN ${norm('o.owner_name')} <> ${norm('n.owner_name')} THEN 1 ELSE 0 END) AS sold,
      o.owner_name AS oname, o.is_delinquent AS delinq, o.suit_pending AS suit, o.is_absentee AS absentee,
      apr.deed_year AS deed_year
    FROM old.tax_roll o JOIN tax_roll n ON n.account_id = o.account_id
      LEFT JOIN apr.appraisal_detail apr ON apr.account_id = o.account_id
    WHERE o.roll_code='R' AND o.owner_name IS NOT NULL AND TRIM(o.owner_name)<>''
      AND n.owner_name IS NOT NULL AND TRIM(n.owner_name)<>''`);
  db.close();

  for (const r of rows) { r.type = classifyOwner(r.oname); r.band = band(r.deed_year); }
  const base = rows.reduce((a, r) => a + r.sold, 0) / rows.length;
  console.log(`rows: ${rows.length.toLocaleString()}   base sold-rate: ${(base * 100).toFixed(2)}%\n`);

  const seg = (pred) => { let n = 0, s = 0; for (const r of rows) if (pred(r)) { n++; s += r.sold; } return { n, s, rate: n ? s / n : 0, lift: (n && base) ? (s / n) / base : 0 }; };
  const line = (label, o) => console.log(`  ${label.padEnd(30)} ${String(o.n).padStart(8)} ${String(o.s).padStart(7)}  ${(o.rate * 100).toFixed(1).padStart(5)}%  ${o.lift ? o.lift.toFixed(2) + 'x' : '—'}`);
  const BANDS = ['1  · <1-1yr', '2  · 2-3yr', '3  · 4-6yr', '4  · 7-12yr', '5  · 13-20yr', '6  · 20yr+', `~0yr (${ASOF_YEAR}+ · LEAK)`];

  for (const ty of ['person', 'entity']) {
    console.log(`── ${ty.toUpperCase()} owners — tenure ladder ──`);
    console.log('  band                                n    sold   rate   lift');
    for (const b of BANDS) line(b, seg(r => r.type === ty && r.band === b));
    console.log('');
  }

  console.log('── THE "STUCK FLIP": entity owners × tenure × delinquency ──');
  console.log('  segment                             n    sold   rate   lift');
  line('entity · fresh (<=1yr)', seg(r => r.type === 'entity' && r.band === '1  · <1-1yr'));
  line('entity · 2-3yr (past flip)', seg(r => r.type === 'entity' && r.band === '2  · 2-3yr'));
  line('entity · 2-3yr & DELINQUENT', seg(r => r.type === 'entity' && r.band === '2  · 2-3yr' && r.delinq));
  line('entity · 4-6yr', seg(r => r.type === 'entity' && r.band === '3  · 4-6yr'));
  line('entity · 4-6yr & DELINQUENT', seg(r => r.type === 'entity' && r.band === '3  · 4-6yr' && r.delinq));
  line('entity · 2-6yr & delinq & suit', seg(r => r.type === 'entity' && (r.band === '2  · 2-3yr' || r.band === '3  · 4-6yr') && r.delinq && r.suit));
  console.log('');
  console.log('── reference ──');
  line('all delinquent', seg(r => r.delinq));
  line('person · long-held (13yr+)', seg(r => r.type === 'person' && (r.band === '5  · 13-20yr' || r.band === '6  · 20yr+')));
  line('entity (all, w/ deed_year)', seg(r => r.type === 'entity' && r.band && !r.band.includes('LEAK')));
  line('person (all, w/ deed_year)', seg(r => r.type === 'person' && r.band && !r.band.includes('LEAK')));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
