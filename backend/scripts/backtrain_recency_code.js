/*
 * BACK-TRAIN the sell-probability model with RECENCY + CODE-COMPLIANCE — the two
 * signals the live sell_model.json is blind to (so its lift undersells recent-buyer
 * and 311-neglect leads; see the score-vs-lift divergence in SIGNAL_GAPS §7 / RESEARCH §G).
 *
 * Same snapshot-diff spine as train_sell_model.js: OLD snapshot (2025-08-25) → CURRENT
 * (2026-06-22), label "sold" = normalized owner_name changed. Real property only.
 *
 * NO LEAKAGE — every added feature is reconstructed as it was on the OLD snapshot date:
 *   - RECENT: from a 2025 DCAD annual archive (APPRAISAL_2025_DB), recent = bought within
 *       ~1yr of the as-of date. The 2025 file is used (NOT today's) because today's file
 *       shows a sold parcel's NEW deed → that would be the label leaking in. Binary, not
 *       continuous tenure, because the measured recency lift is nonlinear (spikes <1yr).
 *       A leak diagnostic prints 2024-only vs 2025-only lift; if 2025 (which can include a
 *       few post-snapshot months) spikes vs 2024, restrict with RECENT_FROM=2024.
 *   - CODE_OPEN: a 311 code request OPEN on the as-of date, reconstructed from each record's
 *       own opened/closed dates (CODE_DB, the isolated historical 311 db). Pure as-of filter.
 *
 * SAFE: writes sell_model_backtrained.json (NOT the live model). Promotion steps printed at end.
 *
 * Run on the box from backend/:
 *   CODE_DB=/tmp/hist311.db node scripts/backtrain_recency_code.js [out.json]
 * Env: ASOF=2025-08-25  OLD_DB=...bak-20250825  APPRAISAL_2025_DB=src/data/appraisal_2025.db
 *      CODE_DB=/tmp/hist311.db  RECENT_FROM=<year>  (default ASOF_YEAR-1)
 */
const sqlite3 = require('sqlite3');
const fs = require('fs');

const CUR = process.env.CUR_DB || 'src/data/tax_roll.db';
const OLD = process.env.OLD_DB || 'src/data/tax_roll.db.bak-20250825';
const APR = process.env.APPRAISAL_2025_DB || 'src/data/appraisal_2025.db';
const CODE = process.env.CODE_DB || '';
const ASOF = process.env.ASOF || '2025-08-25';
const ASOF_YEAR = Number(ASOF.slice(0, 4));
// "recent" = bought in [RECENT_FROM, ASOF_YEAR-1]. The as-of YEAR itself is EXCLUDED:
// the 2025 DCAD archive captures deeds at/after the 2025-08-25 snapshot, so deed_year =
// ASOF_YEAR partly encodes the label transfer (leak diagnostic: 2025 = 2.96x vs a clean
// 2024 = 1.48x). Default lookback is 2 years (2023-2024 for an Aug-2025 as-of).
const RECENT_FROM = Number(process.env.RECENT_FROM || (ASOF_YEAR - 2)); // bought >= this year = "recent"
const RECENT_TO = ASOF_YEAR - 1;                                        // exclude the leaky as-of year
const OUT = process.argv[2] || 'src/scoring/sell_model_backtrained.json';

const db = new sqlite3.Database(CUR, sqlite3.OPEN_READONLY);
const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));
const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));

const norm = (c) => `UPPER(REPLACE(REPLACE(REPLACE(TRIM(${c}),'.',''),',',''),'  ',' '))`;
const estateExpr = (c) => `(CASE WHEN ${c} LIKE '%ESTATE OF%' OR ${c} LIKE '%HEIRS%' OR ${c} LIKE '%LIFE ESTATE%' OR ${c} LIKE '% ET AL%' THEN 1 ELSE 0 END)`;

// Live model + recency. code_open measured ~no independent lift (OR≈1.0), so it's OFF
// by default; set WITH_CODE=1 to include it in the diagnostic model.
const WITH_CODE = process.env.WITH_CODE === '1';
const BIN = ['delinq', 'absentee', 'elderly', 'suit', 'estate', 'recent', ...(WITH_CODE ? ['code_open'] : [])];
const CONT = ['dyears', 'logdue', 'logval'];
const INTER = ['absentee_x_elderly', 'delinq_x_suit', 'recent_x_delinq'];
const FEATS = [...BIN, ...CONT, ...INTER];
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
// Raw (pre-standardization) value per feature name — keeps the design matrix in lockstep
// with FEATS no matter which optional features are included.
const FN = {
  delinq: r => r.delinq ? 1 : 0, absentee: r => r.absentee ? 1 : 0, elderly: r => r.elderly ? 1 : 0,
  suit: r => r.suit ? 1 : 0, estate: r => r.estate ? 1 : 0, code_open: r => r.code_open ? 1 : 0,
  recent: r => r.recent, dyears: r => r.dyears || 0,
  logdue: r => Math.log((r.due || 0) + 1), logval: r => Math.log((r.val || 0) + 1),
  absentee_x_elderly: r => (r.absentee ? 1 : 0) * (r.elderly ? 1 : 0),
  delinq_x_suit: r => (r.delinq ? 1 : 0) * (r.suit ? 1 : 0),
  recent_x_delinq: r => r.recent * (r.delinq ? 1 : 0),
};

(async () => {
  await run(`ATTACH DATABASE '${OLD}' AS old`);
  const hasApr = fs.existsSync(APR);
  if (hasApr) await run(`ATTACH DATABASE '${APR}' AS apr`);
  const hasCode = !!CODE && fs.existsSync(CODE);
  if (hasCode) await run(`ATTACH DATABASE '${CODE}' AS code`);

  console.log(`as-of: ${ASOF}   recent = deed_year in [${RECENT_FROM}, ${ASOF_YEAR}]`);
  console.log(`recency source: ${hasApr ? APR : 'ABSENT → recent all-zero'}`);
  console.log(`311 source:     ${hasCode ? CODE : 'ABSENT → code_open all-zero'}`);

  // deed_year (as-of), and code_open as-of filter from the records' own dates.
  const deedSel = hasApr ? `apr.deed_year` : `NULL`;
  const deedJoin = hasApr ? `LEFT JOIN apr.appraisal_detail apr ON apr.account_id = o.account_id` : ``;
  const codeSel = hasCode
    ? `(CASE WHEN EXISTS (SELECT 1 FROM code.code_violations cv WHERE cv.account_id = o.account_id
         AND cv.opened_date IS NOT NULL AND cv.opened_date <> '' AND cv.opened_date <= '${ASOF}'
         AND (cv.closed_date IS NULL OR cv.closed_date = '' OR cv.closed_date > '${ASOF}')) THEN 1 ELSE 0 END)`
    : `0`;

  console.log('\nloading snapshot-diff rows…');
  const rows = await all(`
    SELECT
      (CASE WHEN ${norm('o.owner_name')} <> ${norm('n.owner_name')} THEN 1 ELSE 0 END) AS sold,
      o.is_delinquent AS delinq, o.is_absentee AS absentee, o.over65_exemption AS elderly,
      o.suit_pending AS suit, ${estateExpr('o.owner_name')} AS estate,
      COALESCE(o.delinquent_years,0) AS dyears,
      COALESCE(o.total_amount_due,0) AS due, COALESCE(o.total_value,0) AS val,
      ${deedSel} AS deed_year, ${codeSel} AS code_open
    FROM old.tax_roll o
      JOIN tax_roll n ON n.account_id = o.account_id
      ${deedJoin}
    WHERE o.roll_code='R'
      AND o.owner_name IS NOT NULL AND TRIM(o.owner_name) <> ''
      AND n.owner_name IS NOT NULL AND TRIM(n.owner_name) <> ''
  `);
  db.close();
  console.log(`rows: ${rows.length.toLocaleString()}`);

  // recent flag (and a deed_year-banded view for the leak diagnostic).
  for (const r of rows) {
    const dy = r.deed_year || 0;
    r.recent = (dy >= RECENT_FROM && dy <= RECENT_TO) ? 1 : 0;
  }

  const base = rows.reduce((a, r) => a + (r.sold ? 1 : 0), 0) / rows.length;
  const lift = (pred) => {
    let n = 0, sold = 0;
    for (const r of rows) if (pred(r)) { n++; sold += r.sold ? 1 : 0; }
    const rate = n ? sold / n : 0;
    return { n, sold, rate, lift: base ? rate / base : 0 };
  };
  const liftRows = [
    [`deed_year=${ASOF_YEAR - 1} (safe)`, r => (r.deed_year || 0) === ASOF_YEAR - 1],
    [`deed_year=${ASOF_YEAR} (leak test)`, r => (r.deed_year || 0) === ASOF_YEAR],
    [`recent (${RECENT_FROM}-${RECENT_TO})`, r => r.recent === 1],
    ['recent & delinquent', r => r.recent === 1 && r.delinq],
    ['recent & suit', r => r.recent === 1 && r.suit],
    ['long-held (deed<=2008)', r => (r.deed_year || 9999) <= 2008],
    ['311 open as-of', r => r.code_open === 1],
    ['311 open & delinquent', r => r.code_open === 1 && r.delinq],
    ['311 open & absentee', r => r.code_open === 1 && r.absentee],
  ];
  console.log(`\nbase sold-rate: ${(base * 100).toFixed(2)}%`);
  console.log('univariate lift (leak diagnostic + new features):');
  console.log('  segment                       n         sold     rate     lift');
  for (const [name, pred] of liftRows) {
    const o = lift(pred);
    console.log(`  ${name.padEnd(28)} ${String(o.n).padStart(7)} ${String(o.sold).padStart(8)}  ${(o.rate * 100).toFixed(1).padStart(5)}%  ${o.lift ? o.lift.toFixed(2) + 'x' : '—'}`);
  }

  // ---- Multivariate logistic (same trainer as train_sell_model.js) ----
  const X = new Array(rows.length);
  const Y = new Float64Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    X[i] = FEATS.map(name => FN[name](r));
    Y[i] = r.sold ? 1 : 0;
  }
  const trainIdx = [], testIdx = [];
  for (let i = 0; i < X.length; i++) (i % 5 === 0 ? testIdx : trainIdx).push(i);

  const contCols = FEATS.map((f, i) => CONT.includes(f) ? i : -1).filter(i => i >= 0);
  const mean = {}, std = {};
  for (const c of contCols) {
    let s = 0; for (const i of trainIdx) s += X[i][c];
    const m = s / trainIdx.length;
    let v = 0; for (const i of trainIdx) v += (X[i][c] - m) ** 2;
    const sd = Math.sqrt(v / trainIdx.length) || 1;
    mean[c] = m; std[c] = sd;
    for (let i = 0; i < X.length; i++) X[i][c] = (X[i][c] - m) / sd;
  }

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
  const test = testIdx.map(i => ({ p: predict(i), y: Y[i] })).sort((a, b) => a.p - b.p);
  let rankSumPos = 0, nPos = 0, nNeg = 0;
  for (let k = 0; k < test.length; k++) { if (test[k].y === 1) { rankSumPos += (k + 1); nPos++; } else nNeg++; }
  const auc = (rankSumPos - nPos * (nPos + 1) / 2) / (nPos * nNeg);
  const baseRate = Y.reduce((a, b) => a + b, 0) / Y.length;
  const coefs = FEATS.map((name, f) => ({ feature: name, weight: +w[f].toFixed(4), oddsRatio: +Math.exp(w[f]).toFixed(3) }))
    .sort((a, b) => b.oddsRatio - a.oddsRatio);

  console.log(`\nheld-out AUC: ${auc.toFixed(4)}   (live model = 0.617; beating it is the goal)`);
  console.log('multivariate odds ratios:');
  for (const c of coefs) console.log(`  ${c.feature.padEnd(20)} OR=${String(c.oddsRatio).padStart(6)}  (w=${c.weight})`);

  const model = {
    version: 2, trainedAt: null, window: `${ASOF}..2026-06-22`,
    n: rows.length, baseRate, auc,
    features: FEATS, weights: Array.from(w), bias,
    standardize: { cols: contCols.map(c => FEATS[c]), mean: contCols.map(c => mean[c]), std: contCols.map(c => std[c]) },
    sources: { recency: hasApr ? APR : null, code311: hasCode ? CODE : null, recentFrom: RECENT_FROM },
    note: 'Back-trained with point-in-time recency (deed_year from 2025 DCAD archive, binary) ' +
      '+ 311 open-as-of + recent×delinquent. Forward features from OLD snapshot, no leakage.'
  };
  fs.writeFileSync(OUT, JSON.stringify(model, null, 2));
  console.log(`\nmodel written to ${OUT} (separate from live sell_model.json)`);
  console.log('\nPROMOTE once it beats 0.617 and the ORs are sane:');
  console.log('  1) add recent + code_open (+ recent_x_delinq) to raw{} in SellProbabilityModel.js');
  console.log('  2) pass recencyYears(→recent) + codeCompliance into sellModel.score()');
  console.log('  3) copy this file over src/scoring/sell_model.json');
})().catch(e => { console.error('BACKTRAIN FAILED:', e.message); process.exit(1); });
