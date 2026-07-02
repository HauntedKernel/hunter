/*
 * BACK-TRAIN owner-type-segmented HOLD-TIME into the sell model, and report AUC vs the current
 * feature set. Same leakage-safe snapshot-diff spine as backtrain_recency_code.js (sold = owner
 * changed OLD 2025-08-25 → CURRENT; deed_year from the 2025 DCAD archive; as-of-year deed EXCLUDED).
 *
 * New features (owner type reconstructed from the OLD owner_name — leakage-safe):
 *   is_entity            — owner is an LLC/Corp/LP (base sell-rate ~2x a person's)
 *   entity_fresh         — entity bought ≤1yr ago (deed = ASOF_YEAR-1): flipper churn (~3.7x)
 *   entity_mid           — entity held 2-6yr (deed ASOF_YEAR-6..ASOF_YEAR-2): past the flip window
 *   entity_mid_x_delinq  — the "STUCK FLIP": past window AND delinquent — forced sale (~2.8-4.2x)
 * Person tenure stays negative via the existing `recent` term + the entity terms carrying the lift.
 *
 * Read-only (writes only the diagnostic json if OUT given). Run on the box from backend/:
 *   node scripts/backtrain_holdtime.js [out.json]
 */
const sqlite3 = require('sqlite3');
const fs = require('fs');
const { classifyOwner } = require('../lib/entity_resolution');

const CUR = process.env.CUR_DB || 'src/data/tax_roll.db';
const OLD = process.env.OLD_DB || 'src/data/tax_roll.db.bak-20250825';
const APR = process.env.APPRAISAL_2025_DB || 'src/data/appraisal_2025.db';
const ASOF_YEAR = Number((process.env.ASOF || '2025-08-25').slice(0, 4));
const RECENT_FROM = ASOF_YEAR - 2, RECENT_TO = ASOF_YEAR - 1;   // clean recent window (excl. as-of yr)
const OUT = process.argv[2] || null;

const db = new sqlite3.Database(CUR, sqlite3.OPEN_READONLY);
const run = (s) => new Promise((res, rej) => db.run(s, [], e => e ? rej(e) : res()));
const all = (s) => new Promise((res, rej) => db.all(s, [], (e, r) => e ? rej(e) : res(r)));
const norm = (c) => `UPPER(REPLACE(REPLACE(REPLACE(TRIM(${c}),'.',''),',',''),'  ',' '))`;
const estate = (c) => `(CASE WHEN ${c} LIKE '%ESTATE OF%' OR ${c} LIKE '%HEIRS%' OR ${c} LIKE '%LIFE ESTATE%' OR ${c} LIKE '% ET AL%' THEN 1 ELSE 0 END)`;
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// Feature functions (raw). Base set mirrors backtrain_recency_code.js; hold-time adds the rest.
const FN = {
  delinq: r => r.delinq ? 1 : 0, absentee: r => r.absentee ? 1 : 0, elderly: r => r.elderly ? 1 : 0,
  suit: r => r.suit ? 1 : 0, estate: r => r.estate ? 1 : 0,
  recent: r => r.recent, dyears: r => r.dyears || 0,
  logdue: r => Math.log((r.due || 0) + 1), logval: r => Math.log((r.val || 0) + 1),
  absentee_x_elderly: r => (r.absentee ? 1 : 0) * (r.elderly ? 1 : 0),
  delinq_x_suit: r => (r.delinq ? 1 : 0) * (r.suit ? 1 : 0),
  recent_x_delinq: r => r.recent * (r.delinq ? 1 : 0),
  // hold-time (owner-type-segmented)
  is_entity: r => r.is_entity,
  entity_fresh: r => r.is_entity && r.deed_year === ASOF_YEAR - 1 ? 1 : 0,
  entity_mid: r => r.is_entity && r.deed_year >= ASOF_YEAR - 6 && r.deed_year <= ASOF_YEAR - 2 ? 1 : 0,
  entity_mid_x_delinq: r => (r.is_entity && r.deed_year >= ASOF_YEAR - 6 && r.deed_year <= ASOF_YEAR - 2 && r.delinq) ? 1 : 0,
};
const BASE = ['delinq', 'absentee', 'elderly', 'suit', 'estate', 'recent', 'dyears', 'logdue', 'logval', 'absentee_x_elderly', 'delinq_x_suit', 'recent_x_delinq'];
const HOLD = ['is_entity', 'entity_fresh', 'entity_mid', 'entity_mid_x_delinq'];
const CONT = ['dyears', 'logdue', 'logval'];

function trainAndAuc(rows, FEATS) {
  const F = FEATS.length;
  const X = rows.map(r => FEATS.map(f => FN[f](r)));
  const Y = rows.map(r => r.sold ? 1 : 0);
  const trainIdx = [], testIdx = [];
  for (let i = 0; i < X.length; i++) (i % 5 === 0 ? testIdx : trainIdx).push(i);
  const contCols = FEATS.map((f, i) => CONT.includes(f) ? i : -1).filter(i => i >= 0);
  const mean = {}, std = {};
  for (const c of contCols) {
    let s = 0; for (const i of trainIdx) s += X[i][c]; const m = s / trainIdx.length;
    let v = 0; for (const i of trainIdx) v += (X[i][c] - m) ** 2; const sd = Math.sqrt(v / trainIdx.length) || 1;
    mean[c] = m; std[c] = sd; for (let i = 0; i < X.length; i++) X[i][c] = (X[i][c] - m) / sd;
  }
  let w = new Float64Array(F), bias = 0; const lr = 0.5, lambda = 1e-4, ITERS = 600, nTr = trainIdx.length;
  for (let it = 0; it < ITERS; it++) {
    const gw = new Float64Array(F); let gb = 0;
    for (const i of trainIdx) { const xi = X[i]; let z = bias; for (let f = 0; f < F; f++) z += w[f] * xi[f]; const err = sigmoid(z) - Y[i]; for (let f = 0; f < F; f++) gw[f] += err * xi[f]; gb += err; }
    for (let f = 0; f < F; f++) w[f] -= lr * (gw[f] / nTr + lambda * w[f]); bias -= lr * (gb / nTr);
  }
  const pred = (i) => { let z = bias; for (let f = 0; f < F; f++) z += w[f] * X[i][f]; return sigmoid(z); };
  const test = testIdx.map(i => ({ p: pred(i), y: Y[i] })).sort((a, b) => a.p - b.p);
  let rs = 0, nP = 0, nN = 0; for (let k = 0; k < test.length; k++) { if (test[k].y === 1) { rs += k + 1; nP++; } else nN++; }
  const auc = (rs - nP * (nP + 1) / 2) / (nP * nN);
  const ors = FEATS.map((f, i) => ({ feature: f, or: +Math.exp(w[i]).toFixed(3), w: +w[i].toFixed(4) }));
  return { auc, ors, w, bias, mean, std, contCols, FEATS };
}

(async () => {
  await run(`ATTACH DATABASE '${OLD}' AS old`); await run(`ATTACH DATABASE '${APR}' AS apr`);
  console.log('loading snapshot-diff rows…');
  const rows = await all(`
    SELECT (CASE WHEN ${norm('o.owner_name')} <> ${norm('n.owner_name')} THEN 1 ELSE 0 END) AS sold,
      o.owner_name AS oname, o.is_delinquent AS delinq, o.is_absentee AS absentee, o.over65_exemption AS elderly,
      o.suit_pending AS suit, ${estate('o.owner_name')} AS estate, COALESCE(o.delinquent_years,0) AS dyears,
      COALESCE(o.total_amount_due,0) AS due, COALESCE(o.total_value,0) AS val, apr.deed_year AS deed_year
    FROM old.tax_roll o JOIN tax_roll n ON n.account_id = o.account_id
      LEFT JOIN apr.appraisal_detail apr ON apr.account_id = o.account_id
    WHERE o.roll_code='R' AND o.owner_name IS NOT NULL AND TRIM(o.owner_name)<>'' AND n.owner_name IS NOT NULL AND TRIM(n.owner_name)<>''`);
  db.close();
  for (const r of rows) {
    r.is_entity = classifyOwner(r.oname) === 'entity' ? 1 : 0;
    const dy = r.deed_year || 0; r.recent = (dy >= RECENT_FROM && dy <= RECENT_TO) ? 1 : 0;
  }
  const base = rows.reduce((a, r) => a + r.sold, 0) / rows.length;
  console.log(`rows: ${rows.length.toLocaleString()}  base sold-rate: ${(base * 100).toFixed(2)}%\n`);

  const b = trainAndAuc(rows, BASE);
  const h = trainAndAuc(rows, [...BASE, ...HOLD]);
  console.log(`BASELINE (current features)        AUC = ${b.auc.toFixed(4)}`);
  console.log(`+ owner-type HOLD-TIME             AUC = ${h.auc.toFixed(4)}   (Δ ${((h.auc - b.auc) >= 0 ? '+' : '') + (h.auc - b.auc).toFixed(4)})`);
  console.log(`  (live model baseline = 0.617)\n`);
  console.log('hold-time feature odds ratios (in the full model):');
  for (const f of HOLD) { const o = h.ors.find(x => x.feature === f); console.log(`  ${f.padEnd(22)} OR=${String(o.or).padStart(6)}  (w=${o.w})`); }
  console.log('\ntop features overall:');
  for (const o of h.ors.slice().sort((a, b2) => b2.or - a.or).slice(0, 8)) console.log(`  ${o.feature.padEnd(22)} OR=${o.or}`);

  if (OUT) {
    const model = { version: 3, window: `${ASOF_YEAR}-08-25..2026-06-22`, n: rows.length, baseRate: base, auc: h.auc,
      features: h.FEATS, weights: Array.from(h.w), bias: h.bias,
      standardize: { cols: h.contCols.map(c => h.FEATS[c]), mean: h.contCols.map(c => h.mean[c]), std: h.contCols.map(c => h.std[c]) },
      note: 'Owner-type-segmented hold-time (is_entity, entity_fresh, entity_mid, entity_mid_x_delinq) + base. Leakage-safe.' };
    fs.writeFileSync(OUT, JSON.stringify(model, null, 2));
    console.log(`\nwrote ${OUT} (diagnostic — not the live model).`);
  }
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
