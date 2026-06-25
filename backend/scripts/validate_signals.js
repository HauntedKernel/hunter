/*
 * Snapshot-diff signal validation.
 * OLD snapshot (2025-08-25) -> CURRENT (2026-06-22), ~10 months.
 * "Sold" proxy = normalized owner_name changed for the same account_id.
 * Signals are read from the OLD snapshot => a genuine forward prediction.
 * Restricted to real property (roll_code='R').
 *
 * Run on the box from backend/ so `sqlite3` resolves and the two snapshots are
 * present in src/data/:
 *   cd ~/hunter/backend && node scripts/validate_signals.js
 * Requires src/data/tax_roll.db (current) AND a prior snapshot at the OLD path.
 * Results + interpretation are written up in RESEARCH.md §B.
 */
const sqlite3 = require('sqlite3');
const CUR = 'src/data/tax_roll.db';
const OLD = 'src/data/tax_roll.db.bak-20250825';

const db = new sqlite3.Database(CUR, sqlite3.OPEN_READONLY);
const get = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const all = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
const run = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, (e) => e ? rej(e) : res()));

// normalized owner-name expression for a given alias
const norm = (c) => `UPPER(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(${c}),'.',''),',',''),'  ',' '),'  ',' '))`;
const estateExpr = (c) =>
  `(CASE WHEN ${c} LIKE '%ESTATE OF%' OR ${c} LIKE '%HEIRS%' OR ${c} LIKE '%LIFE ESTATE%' OR ${c} LIKE '% ET AL%' THEN 1 ELSE 0 END)`;

(async () => {
  await run(`ATTACH DATABASE '${OLD}' AS old`);

  // roll_code distribution (current)
  const rc = await all(`SELECT roll_code, COUNT(*) c FROM tax_roll GROUP BY roll_code ORDER BY c DESC`);
  console.log('roll_code dist (current):', rc.map(r => `${r.roll_code}=${r.c}`).join('  '));

  // Build the joined view once
  await run(`
    CREATE TEMP TABLE j AS
    SELECT
      o.account_id AS id,
      o.is_delinquent AS delinq,
      o.is_absentee  AS absentee,
      o.over65_exemption AS eld,
      o.suit_pending AS suit,
      o.total_amount_due AS due,
      o.total_value AS val,
      ${estateExpr('o.owner_name')} AS estate,
      (CASE WHEN ${norm('o.owner_name')} <> ${norm('n.owner_name')} THEN 1 ELSE 0 END) AS sold
    FROM old.tax_roll o
    JOIN tax_roll n ON n.account_id = o.account_id
    WHERE o.roll_code = 'R'
      AND o.owner_name IS NOT NULL AND TRIM(o.owner_name) <> ''
      AND n.owner_name IS NOT NULL AND TRIM(n.owner_name) <> ''
  `);

  const tot = await get(`SELECT COUNT(*) n, SUM(sold) s FROM j`);
  const base = tot.s / tot.n;
  console.log(`\nMatched real-property accounts in both snapshots: ${tot.n.toLocaleString()}`);
  console.log(`Sold (owner changed) ~10mo: ${tot.s.toLocaleString()}  => base rate ${(base*100).toFixed(2)}%  (annualized ~${(base*1.2*100).toFixed(2)}%)\n`);

  const signals = [
    ['delinquent',        'delinq=1'],
    ['absentee',          'absentee=1'],
    ['elderly (over65)',  'eld=1'],
    ['estate/heirs',      'estate=1'],
    ['tax suit pending',  'suit=1'],
    ['high-equity proxy (val>=500k, not delinq)', 'val>=500000 AND delinq=0'],
    ['-- combos --',      null],
    ['delinquent + absentee',        'delinq=1 AND absentee=1'],
    ['delinquent + elderly',         'delinq=1 AND eld=1'],
    ['absentee + elderly',           'absentee=1 AND eld=1'],
    ['estate + absentee',            'estate=1 AND absentee=1'],
    ['delinquent + suit pending',    'delinq=1 AND suit=1'],
    ['elderly + estate',             'eld=1 AND estate=1'],
    ['delinquent + absentee + elderly', 'delinq=1 AND absentee=1 AND eld=1'],
  ];

  const rows = [];
  for (const [label, cond] of signals) {
    if (cond === null) { rows.push({ label }); continue; }
    const r = await get(`SELECT COUNT(*) n, SUM(sold) s FROM j WHERE ${cond}`);
    const n = r.n || 0, s = r.s || 0;
    const rate = n ? s / n : 0;
    rows.push({ label, n, s, rate, lift: base ? rate / base : 0 });
  }

  const pad = (x, w) => String(x).padEnd(w);
  const padL = (x, w) => String(x).padStart(w);
  console.log(pad('signal (from OLD snapshot)', 44), padL('n', 10), padL('sold', 8), padL('rate%', 8), padL('lift', 7));
  console.log('-'.repeat(80));
  for (const r of rows) {
    if (r.n === undefined) { console.log(r.label); continue; }
    console.log(
      pad(r.label, 44),
      padL(r.n.toLocaleString(), 10),
      padL(r.s.toLocaleString(), 8),
      padL((r.rate * 100).toFixed(2), 8),
      padL(r.lift.toFixed(2) + 'x', 7)
    );
  }

  db.close();
})().catch(e => { console.error(e); process.exit(1); });
