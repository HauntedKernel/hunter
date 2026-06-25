/*
 * Train a CALIBRATED sell-probability model on snapshot diffs — the analytics moat
 * (STRATEGY.md §0). Turns the hand-weighted 0-100 MotivationScorer into a learned,
 * calibrated P(owner sells within the snapshot window), and reports an honest
 * held-out AUC + calibration so we know whether the score actually discriminates.
 *
 * Labels come from the same snapshot diff as validate_signals.js: OLD snapshot
 * (2025-08-25) -> CURRENT (2026-06-22); "sold" = normalized owner_name changed.
 * Features are read from the OLD snapshot (a true forward prediction). Real
 * property only (roll_code='R').
 *
 * Plain logistic regression (batch gradient descent + L2), no ML deps. We do NOT
 * class-rebalance (RESEARCH.md §A: SMOTE wrecks calibration at low base rates) —
 * we train on the natural prevalence so the output probability is meaningful.
 *
 * Run on the box from backend/ (both snapshots in src/data/):
 *   node scripts/train_sell_model.js [out.json]
 */
const sqlite3 = require('sqlite3');
const fs = require('fs');
const CUR = 'src/data/tax_roll.db';
const OLD = 'src/data/tax_roll.db.bak-20250825';
const OUT = process.argv[2] || 'src/scoring/sell_model.json';

const db = new sqlite3.Database(CUR, sqlite3.OPEN_READONLY);
const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));
const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));

const norm = (c) => `UPPER(REPLACE(REPLACE(REPLACE(TRIM(${c}),'.',''),',',''),'  ',' '))`;
const estateExpr = (c) => `(CASE WHEN ${c} LIKE '%ESTATE OF%' OR ${c} LIKE '%HEIRS%' OR ${c} LIKE '%LIFE ESTATE%' OR ${c} LIKE '% ET AL%' THEN 1 ELSE 0 END)`;

// Feature names in fixed order. Binaries first, then standardized continuous, then
// interactions. (Interactions are what the additive model can't represent.)
const BIN = ['delinq', 'absentee', 'elderly', 'suit', 'estate'];
const CONT = ['dyears', 'logdue', 'logval'];
const INTER = ['absentee_x_elderly', 'delinq_x_suit'];
const FEATS = [...BIN, ...CONT, ...INTER];

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

(async () => {
  await run(`ATTACH DATABASE '${OLD}' AS old`);
  console.log('loading snapshot-diff rows…');
  const rows = await all(`
    SELECT
      (CASE WHEN ${norm('o.owner_name')} <> ${norm('n.owner_name')} THEN 1 ELSE 0 END) AS sold,
      o.is_delinquent AS delinq, o.is_absentee AS absentee, o.over65_exemption AS elderly,
      o.suit_pending AS suit, ${estateExpr('o.owner_name')} AS estate,
      COALESCE(o.delinquent_years,0) AS dyears,
      COALESCE(o.total_amount_due,0) AS due, COALESCE(o.total_value,0) AS val
    FROM old.tax_roll o JOIN tax_roll n ON n.account_id = o.account_id
    WHERE o.roll_code='R'
      AND o.owner_name IS NOT NULL AND TRIM(o.owner_name) <> ''
      AND n.owner_name IS NOT NULL AND TRIM(n.owner_name) <> ''
  `);
  db.close();
  console.log(`rows: ${rows.length.toLocaleString()}`);

  // Build raw feature rows.
  const X = new Array(rows.length);
  const Y = new Float64Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const b = (v) => v ? 1 : 0;
    const dyears = r.dyears || 0;
    const logdue = Math.log((r.due || 0) + 1);
    const logval = Math.log((r.val || 0) + 1);
    const ab = b(r.absentee), el = b(r.elderly), dq = b(r.delinq), su = b(r.suit);
    X[i] = [dq, ab, el, su, b(r.estate), dyears, logdue, logval, ab * el, dq * su];
    Y[i] = r.sold ? 1 : 0;
  }

  // Train/test split: every 5th row -> test (deterministic, ~80/20).
  const trainIdx = [], testIdx = [];
  for (let i = 0; i < X.length; i++) (i % 5 === 0 ? testIdx : trainIdx).push(i);

  // Standardize continuous features (cols 5,6,7) using TRAIN stats only.
  const contCols = [5, 6, 7];
  const mean = {}, std = {};
  for (const c of contCols) {
    let s = 0; for (const i of trainIdx) s += X[i][c];
    const m = s / trainIdx.length;
    let v = 0; for (const i of trainIdx) v += (X[i][c] - m) ** 2;
    const sd = Math.sqrt(v / trainIdx.length) || 1;
    mean[c] = m; std[c] = sd;
    for (let i = 0; i < X.length; i++) X[i][c] = (X[i][c] - m) / sd;
  }

  // Logistic regression — batch gradient descent + L2.
  const F = FEATS.length;
  let w = new Float64Array(F), bias = 0;
  const lr = 0.5, lambda = 1e-4, ITERS = 600;
  const nTr = trainIdx.length;
  for (let it = 0; it < ITERS; it++) {
    const gw = new Float64Array(F); let gb = 0;
    for (const i of trainIdx) {
      const xi = X[i];
      let z = bias; for (let f = 0; f < F; f++) z += w[f] * xi[f];
      const err = sigmoid(z) - Y[i];
      for (let f = 0; f < F; f++) gw[f] += err * xi[f];
      gb += err;
    }
    for (let f = 0; f < F; f++) w[f] -= lr * (gw[f] / nTr + lambda * w[f]);
    bias -= lr * (gb / nTr);
  }

  const predict = (i) => { let z = bias; for (let f = 0; f < F; f++) z += w[f] * X[i][f]; return sigmoid(z); };

  // Held-out AUC (Mann–Whitney).
  const test = testIdx.map(i => ({ p: predict(i), y: Y[i] })).sort((a, b) => a.p - b.p);
  let rankSumPos = 0, nPos = 0, nNeg = 0;
  for (let k = 0; k < test.length; k++) { if (test[k].y === 1) { rankSumPos += (k + 1); nPos++; } else nNeg++; }
  const auc = (rankSumPos - nPos * (nPos + 1) / 2) / (nPos * nNeg);

  // Calibration: deciles of predicted prob on the test set.
  const decBins = Array.from({ length: 10 }, () => ({ sp: 0, sy: 0, n: 0 }));
  for (let k = 0; k < test.length; k++) {
    const d = Math.min(9, Math.floor(k / test.length * 10));
    decBins[d].sp += test[k].p; decBins[d].sy += test[k].y; decBins[d].n++;
  }

  const baseRate = Y.reduce((a, b) => a + b, 0) / Y.length;
  // Odds ratios: exp(weight). For standardized continuous it's per-1-SD; for binaries
  // it's the on/off odds ratio.
  const coefs = FEATS.map((name, f) => ({ feature: name, weight: +w[f].toFixed(4), oddsRatio: +Math.exp(w[f]).toFixed(3) }))
    .sort((a, b) => b.oddsRatio - a.oddsRatio);

  console.log(`\nbase rate (sold): ${(baseRate * 100).toFixed(2)}%   train: ${nTr.toLocaleString()}  test: ${testIdx.length.toLocaleString()}`);
  console.log(`held-out AUC: ${auc.toFixed(4)}   (0.5 = coin flip, 1.0 = perfect)\n`);
  console.log('learned odds ratios (multivariate — controls for signal overlap):');
  for (const c of coefs) console.log(`  ${c.feature.padEnd(20)} OR=${String(c.oddsRatio).padStart(6)}  (w=${c.weight})`);
  console.log('\ncalibration (test deciles): predicted vs actual sold-rate');
  decBins.forEach((d, i) => console.log(`  d${i + 1}: pred ${(d.sp / d.n * 100).toFixed(1)}%  actual ${(d.sy / d.n * 100).toFixed(1)}%  (n=${d.n})`));

  const model = {
    version: 1, trainedAt: null, window: '2025-08-25..2026-06-22',
    n: rows.length, baseRate, auc,
    features: FEATS, weights: Array.from(w), bias,
    standardize: { cols: contCols.map(c => FEATS[c]), mean: contCols.map(c => mean[c]), std: contCols.map(c => std[c]) },
    note: 'Logistic regression on snapshot-diff labels; owner-name-change proxy for sale. Forward features from OLD snapshot. No class rebalancing.'
  };
  fs.writeFileSync(OUT, JSON.stringify(model, null, 2));
  console.log(`\nmodel written to ${OUT}`);
})().catch(e => { console.error('TRAIN FAILED:', e.message); process.exit(1); });
