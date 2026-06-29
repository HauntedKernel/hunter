/*
 * BACK-TRAIN the sell-probability model with the new FREE point-in-time features —
 * tenure and 311 code-compliance — that the live sell_model.json leaves out
 * (SIGNAL_GAPS.md §7). Extends scripts/train_sell_model.js; same snapshot-diff spine:
 *   OLD snapshot (2025-08-25, tax_roll.db.bak-20250825) -> CURRENT (2026-06-22);
 *   label "sold" = normalized owner_name changed. Real property only (roll_code='R').
 *
 * THE WHOLE POINT IS NO LEAKAGE. Each added feature is reconstructed AS IT WAS on
 * the OLD snapshot date, never from today's value:
 *   - TENURE: from a 2025 DCAD annual-appraisal archive loaded into a SEPARATE db
 *       (APPRAISAL_2025_DB, built via `APPRAISAL_DB=... node ingest_appraisal.js`).
 *       tenure_asof_2025 = 2025 - deed_year. Using today's appraisal file would LEAK
 *       (a sold parcel shows the new owner's deed) — that's why a separate archive.
 *   - CODE_OPEN: from the code_violations table (load historical 311 via fetch_311 +
 *       ingest_311), filtered to "open on 2025-08-25" = opened <= date AND
 *       (closed IS NULL OR closed > date). Pure as-of filter on the records' own dates.
 *
 * GRACEFUL: if an archive/feed isn't present yet, that feature is simply all-zero
 * (near-zero weight) and the script still runs — so you can dry-run today and it
 * "lights up" once the free data is loaded. Reports a univariate lift table for the
 * new features (the measured lift we've never had) + the full multivariate model.
 *
 * SAFE: writes to a SEPARATE output (sell_model_backtrained.json) by default — it
 * does NOT overwrite the live model. Promoting it also needs two raw features added
 * to SellProbabilityModel.score() + passed in the scorer (see the note at the end).
 *
 * Run on the box from backend/:
 *   node scripts/backtrain_sell_model.js [out.json]
 * Optional env:
 *   ASOF=2025-08-25                       point-in-time date (matches the OLD snapshot)
 *   OLD_DB=src/data/tax_roll.db.bak-20250825
 *   APPRAISAL_2025_DB=src/data/appraisal_2025.db
 */
const sqlite3 = require('sqlite3');
const fs = require('fs');

const CUR = process.env.CUR_DB || 'src/data/tax_roll.db';
const OLD = process.env.OLD_DB || 'src/data/tax_roll.db.bak-20250825';
const APR = process.env.APPRAISAL_2025_DB || 'src/data/appraisal_2025.db';
const ASOF = process.env.ASOF || '2025-08-25';
const ASOF_YEAR = Number(ASOF.slice(0, 4));
const OUT = process.argv[2] || 'src/scoring/sell_model_backtrained.json';

const db = new sqlite3.Database(CUR, sqlite3.OPEN_READONLY);
const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));
const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));

const norm = (c) => `UPPER(REPLACE(REPLACE(REPLACE(TRIM(${c}),'.',''),',',''),'  ',' '))`;
const estateExpr = (c) => `(CASE WHEN ${c} LIKE '%ESTATE OF%' OR ${c} LIKE '%HEIRS%' OR ${c} LIKE '%LIFE ESTATE%' OR ${c} LIKE '% ET AL%' THEN 1 ELSE 0 END)`;

// Existing features + the two new ones (tenure continuous, code_open binary).
const BIN = ['delinq', 'absentee', 'elderly', 'suit', 'estate', 'code_open'];
const CONT = ['dyears', 'logdue', 'logval', 'tenure'];
const INTER = ['absentee_x_elderly', 'delinq_x_suit'];
const FEATS = [...BIN, ...CONT, ...INTER];

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

(async () => {
  await run(`ATTACH DATABASE '${OLD}' AS old`);

  // Optional point-in-time sources — attach/flag only if present.
  const hasApr = fs.existsSync(APR);
  if (hasApr) await run(`ATTACH DATABASE '${APR}' AS apr`);
  const hasCode = !!(await all("SELECT name FROM sqlite_master WHERE type='table' AND name='code_violations'")).length
    && !!(await all('SELECT 1 FROM code_violations WHERE account_id IS NOT NULL LIMIT 1')).length;

  console.log(`as-of date: ${ASOF}`);
  console.log(`tenure source (2025 appraisal archive): ${hasApr ? APR : 'ABSENT → tenure all-zero (dry run)'}`);
  console.log(`311 source (code_violations, matched):  ${hasCode ? 'present' : 'ABSENT → code_open all-zero (dry run)'}`);

  // Point-in-time joins:
  //  - tenure: 2025 archive deed_year → max(0, ASOF_YEAR - deed_year). Cap at >=0.
  //  - code_open: a code request open as of ASOF (its own opened/closed dates).
  const tenureSel = hasApr
    ? `MAX(0, ${ASOF_YEAR} - COALESCE(apr.deed_year, ${ASOF_YEAR}))`
    : `0`;
  const tenureJoin = hasApr ? `LEFT JOIN apr.appraisal_detail apr ON apr.account_id = o.account_id` : ``;
  const codeSel = hasCode
    ? `(CASE WHEN EXISTS (SELECT 1 FROM code_violations cv WHERE cv.account_id = o.account_id
         AND cv.opened_date IS NOT NULL AND cv.opened_date <= '${ASOF}'
         AND (cv.closed_date IS NULL OR cv.closed_date > '${ASOF}')) THEN 1 ELSE 0 END)`
    : `0`;

  console.log('\nloading snapshot-diff rows…');
  const rows = await all(`
    SELECT
      (CASE WHEN ${norm('o.owner_name')} <> ${norm('n.owner_name')} THEN 1 ELSE 0 END) AS sold,
      o.is_delinquent AS delinq, o.is_absentee AS absentee, o.over65_exemption AS elderly,
      o.suit_pending AS suit, ${estateExpr('o.owner_name')} AS estate,
      COALESCE(o.delinquent_years,0) AS dyears,
      COALESCE(o.total_amount_due,0) AS due, COALESCE(o.total_value,0) AS val,
      ${tenureSel} AS tenure, ${codeSel} AS code_open
    FROM old.tax_roll o
      JOIN tax_roll n ON n.account_id = o.account_id
      ${tenureJoin}
    WHERE o.roll_code='R'
      AND o.owner_name IS NOT NULL AND TRIM(o.owner_name) <> ''
      AND n.owner_name IS NOT NULL AND TRIM(n.owner_name) <> ''
  `);
  db.close();
  console.log(`rows: ${rows.length.toLocaleString()}`);

  // ---- Univariate lift for the new features (the measured lift we've never had) ----
  const base = rows.reduce((a, r) => a + (r.sold ? 1 : 0), 0) / rows.length;
  const lift = (pred) => {
    let n = 0, sold = 0;
    for (const r of rows) if (pred(r)) { n++; sold += r.sold ? 1 : 0; }
    const rate = n ? sold / n : 0;
    return { n, sold, rate, lift: base ? rate / base : 0 };
  };
  const liftRows = [
    ['tenure >= 7 yr', r => r.tenure >= 7],
    ['tenure >= 15 yr', r => r.tenure >= 15],
    ['tenure >= 30 yr', r => r.tenure >= 30],
    ['tenure>=30 & elderly', r => r.tenure >= 30 && r.elderly],
    ['311 open as-of', r => r.code_open === 1],
    ['311 open & delinquent', r => r.code_open === 1 && r.delinq],
  ];
  console.log(`\nbase sold-rate: ${(base * 100).toFixed(2)}%`);
  console.log('univariate lift (new features):');
  console.log('  segment                    n         sold     rate     lift');
  for (const [name, pred] of liftRows) {
    const o = lift(pred);
    console.log(`  ${name.padEnd(24)} ${String(o.n).padStart(8)} ${String(o.sold).padStart(8)}  ${(o.rate * 100).toFixed(1).padStart(5)}%  ${o.lift ? o.lift.toFixed(2) + 'x' : '—'}`);
  }

  // ---- Multivariate logistic model (same trainer as train_sell_model.js) ----
  const X = new Array(rows.length);
  const Y = new Float64Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const b = (v) => v ? 1 : 0;
    const ab = b(r.absentee), el = b(r.elderly), dq = b(r.delinq), su = b(r.suit);
    X[i] = [dq, ab, el, su, b(r.estate), b(r.code_open),
      r.dyears || 0, Math.log((r.due || 0) + 1), Math.log((r.val || 0) + 1), r.tenure || 0,
      ab * el, dq * su];
    Y[i] = r.sold ? 1 : 0;
  }

  const trainIdx = [], testIdx = [];
  for (let i = 0; i < X.length; i++) (i % 5 === 0 ? testIdx : trainIdx).push(i);

  // Standardize continuous features (dyears, logdue, logval, tenure) on TRAIN stats.
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

  console.log(`\nheld-out AUC: ${auc.toFixed(4)}   (live model floor = 0.617; lifting it is the goal)`);
  console.log('multivariate odds ratios (controls for overlap — the NEW rows are tenure/code_open):');
  for (const c of coefs) console.log(`  ${c.feature.padEnd(20)} OR=${String(c.oddsRatio).padStart(6)}  (w=${c.weight})`);

  const model = {
    version: 2, trainedAt: null, window: `${ASOF}..2026-06-22`,
    n: rows.length, baseRate, auc,
    features: FEATS, weights: Array.from(w), bias,
    standardize: { cols: contCols.map(c => FEATS[c]), mean: contCols.map(c => mean[c]), std: contCols.map(c => std[c]) },
    sources: { tenure: hasApr ? APR : null, code311: hasCode },
    note: 'Back-trained with point-in-time tenure (2025 DCAD archive) + 311 open-as-of. ' +
      'Forward features from OLD snapshot, no leakage, no class rebalancing. NOT the live model.'
  };
  fs.writeFileSync(OUT, JSON.stringify(model, null, 2));
  console.log(`\nmodel written to ${OUT} (separate from the live sell_model.json)`);
  if (!hasApr || !hasCode) {
    console.log('\n⚠ DRY RUN — at least one new feature had no data, so its OR is ~1.0 by construction.');
    console.log('  Load the free archives first, then re-run:');
    if (!hasApr) console.log('    APPRAISAL_DB=src/data/appraisal_2025.db node ingest_appraisal.js <2025_DCAD_appraisal.csv>');
    if (!hasCode) console.log('    node fetch_311.js --months=36 && node ingest_311.js imports/dallas_311_code.csv  (ALLOW_LOOSE_MATCH=1 for address fallback)');
  }
  console.log('\nTo PROMOTE this model into production once it beats 0.617:');
  console.log('  1) add `tenure` + `code_open` to the raw{} block in src/scoring/SellProbabilityModel.js');
  console.log('  2) pass tenureYears + codeCompliance into sellModel.score() in MotivationScorer.compileMotivationAnalysis');
  console.log('  3) copy this file over src/scoring/sell_model.json');
})().catch(e => { console.error('BACKTRAIN FAILED:', e.message); process.exit(1); });
