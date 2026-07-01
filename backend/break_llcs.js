/*
 * LLC-BREAKER batch — layered, free-first. Two legs:
 *
 *   LEG 1 (always, $0, ToS-clean): invert the cached Comptroller agent/officer data
 *     (entity_registry) into a person→entities portfolio (lib/agent_reverse.js) and persist
 *     entity_portfolio. Surfaces multi-property sellers ("this person is behind 4 delinquent LLCs").
 *
 *   LEG 2 (gated on SERP_API_KEY): for distinctive entities the Comptroller did NOT resolve
 *     (agent-service shells / holding cos), mine the open web's search snippets for the
 *     principal (lib/llc_breaker.js + lib/serp.js). Every hit is stored as a SOURCED, low-
 *     confidence HINT (tier 'web') — never asserted; cite the source, let the agent verify.
 *
 * Run on the box from backend/:
 *   node break_llcs.js --selftest                 # offline miner test (no key/network)
 *   node break_llcs.js                            # leg 1 only if no SERP key; +leg 2 if set
 *   SERP_PROVIDER=brave SERP_API_KEY=... node break_llcs.js --limit=200
 * Env: HUNTER_DB, SERP_PROVIDER, SERP_API_KEY, SERP_RATE_MS (default 1200), ALL_ENTITIES=1.
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const serp = require('./lib/serp');
const breaker = require('./lib/llc_breaker');
const reverse = require('./lib/agent_reverse');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- offline self-test of the snippet miner (grounded in REAL search output) ----
function selftest() {
  const tapper = breaker.mineSnippets('TAPPER INVESTMENTS LLC', '2626 COLE AVE DALLAS 75204', [
    { title: 'Dino Tapper - Real Estate Investor in Dallas-Fort Worth, TX', url: 'https://elementix.ai/investors/tx/dino-tapper', snippet: 'Dino Tapper is a real estate investor in Dallas-Fort Worth, TX.' },
    { title: 'Tapper Investments | Dallas TX | BuildZoom', url: 'https://www.buildzoom.com/contractor/tapper-investments-llc', snippet: 'Tapper Investments LLC is located at 2626 Cole Ave, Dallas, TX and is owned by Dino Tapper. Call 202-256-8822.' },
    { title: 'DINO TAPPER vs ABDULLAH OZDEMIR', url: 'https://trellis.law/doc/244986462/plaintiffs', snippet: "Plaintiffs Dino Tapper, Tapper Investments LLC's first amended petition." },
  ]);
  const faucher = breaker.mineSnippets('FAUCHER HOLDINGS GROUP', '5931 GREENVILLE AVE DALLAS 75206', [
    { title: 'FAUCHER REAL ESTATE LLC — Real Estate Investor', url: 'https://sfranalytics.com/investors/tx/faucher-real-estate-llc-tx', snippet: 'Faucher Real Estate LLC is a flipper real estate investor in Dallas-Fort Worth.' },
    { title: 'Faucher Holdings Group Information', url: 'https://rocketreach.co/faucher-holdings-group-profile', snippet: 'Madison Faucher is the Board Member of Faucher Holdings Group, based in Dallas, Texas.' },
    { title: 'Mark S. Faucher - Owner TFG, LLC | LinkedIn', url: 'https://www.linkedin.com/in/mark-s-faucher', snippet: 'Mark S. Faucher - Owner TFG, LLC. Dallas, Texas.' },
  ]);
  const checks = [
    ['Tapper top candidate is Dino Tapper', faucher && tapper.candidates[0]?.name === 'Dino Tapper'],
    ['Tapper is NOT ambiguous (one clear person)', tapper.ambiguous === false],
    ['Tapper captured phone', tapper.phones.length >= 1],
    ['Tapper captured litigation (trellis)', tapper.litigation.length >= 1],
    ['Tapper top hit is corroborated by surname-in-entity', tapper.candidates[0]?.signals.includes('surname-in-entity')],
    ['Faucher surfaces 2+ Faucher candidates', faucher.candidates.filter(c => /faucher/i.test(c.name)).length >= 2],
    ['Faucher is flagged ambiguous (do not assert one)', faucher.ambiguous === true],
  ];
  let pass = 0;
  for (const [label, ok] of checks) { pass += ok ? 1 : 0; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`); }
  console.log(`\nminer self-test: ${pass}/${checks.length} passed`);
  if (pass < checks.length) {
    console.log('\n  Tapper candidates:', JSON.stringify(tapper.candidates, null, 2));
    console.log('  Faucher candidates:', JSON.stringify(faucher.candidates, null, 2));
  }
  process.exit(pass === checks.length ? 0 : 1);
}
if (args.selftest) selftest();

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const LIMIT = Number(args.limit || 200);
const RATE_MS = Number(process.env.SERP_RATE_MS || 1200);
const WRITEBACK = !args['no-writeback'];

(async () => {
  const db = new sqlite3.Database(DB);
  const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));
  const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));
  // Live DB: don't fight the running API / Comptroller batch for the write lock — wait it out.
  await run('PRAGMA busy_timeout=15000');

  // ---- LEG 1: reverse portfolio from cached Comptroller data (free, always) ----
  const hasReg = (await all("SELECT name FROM sqlite_master WHERE type='table' AND name='entity_registry'")).length;
  if (hasReg) {
    const rows = await all(`SELECT query_name, matched_name, contact_name, contact_role, taxpayer_id,
      status, ambiguous, match_confidence FROM entity_registry`);
    const idx = reverse.indexByPerson(rows);
    const ports = reverse.portfolios(idx, { min: 2 });
    await run(`CREATE TABLE IF NOT EXISTS entity_portfolio (
      person_key TEXT PRIMARY KEY, name TEXT, entity_count INTEGER, entities_json TEXT,
      built_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    await run('DELETE FROM entity_portfolio');
    await run('BEGIN');
    const ps = db.prepare('INSERT OR REPLACE INTO entity_portfolio (person_key, name, entity_count, entities_json) VALUES (?,?,?,?)');
    for (const [key, e] of idx) ps.run(key, e.name, e.count, JSON.stringify(e.entities));
    await new Promise((res, rej) => ps.finalize(err => err ? rej(err) : res()));
    await run('COMMIT');
    console.log(`LEG 1 (reverse portfolio): ${idx.size} people indexed from entity_registry; ${ports.length} own 2+ entities.`);
    for (const e of ports.slice(0, 8)) console.log(`   ${e.name.padEnd(26)} ${e.count} entities  [${e.entities.map(x => x.entity).slice(0, 3).join('; ')}${e.count > 3 ? ' …' : ''}]`);
  } else {
    console.log('LEG 1: entity_registry not found — run resolve_entities.js first (Comptroller). Skipping portfolio.');
  }

  // ---- LEG 2: open-web breaker for UNRESOLVED distinctive entities (gated) ----
  // --preview needs no key (it only reads the queue), so let it through the gate.
  if (!serp.available() && !args.preview) {
    console.log(`\nLEG 2 (web breaker): SERP_API_KEY not set — OFF (no-op).`);
    console.log('  Enable a cheap search provider, then re-run:');
    console.log('    Brave (free tier):  https://brave.com/search/api/   → SERP_PROVIDER=brave  SERP_API_KEY=<token>');
    console.log('    Serper (cheap):     https://serper.dev/             → SERP_PROVIDER=serper SERP_API_KEY=<token>');
    await new Promise(res => db.close(res));
    return;
  }

  await run(`CREATE TABLE IF NOT EXISTS llc_breaks (
    owner_name TEXT PRIMARY KEY, query TEXT, candidates_json TEXT, phones_json TEXT,
    litigation_json TEXT, ambiguous INTEGER, top_name TEXT, top_role TEXT, top_score INTEGER,
    resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  const delqFilter = process.env.ALL_ENTITIES === '1' ? '' : 'AND t.is_delinquent = 1';
  const VALUE_MIN = Number(process.env.VALUE_MIN || 0);
  const VALUE_MAX = Number(process.env.VALUE_MAX || 40000);   // above this ≈ big commercial, not a realtor prospect
  // Realtor's market only: residential + land (Dallas CAD category A/B res, C/D/E land). Excludes
  // pure commercial/industrial (F) + business personal property (L) — where the miner wastes spend
  // on national corps that never crack to a person. Override with QUEUE_CATS.
  const QUEUE_CATS = (process.env.QUEUE_CATS || 'A,B,C,D,E').split(',').map(c => `'${c.trim()}'`).join(',');
  const catFilter = `AND substr(COALESCE(t.category_code,''),1,1) IN (${QUEUE_CATS})`;
  // TARGETED QUEUE: distinctive residential/land entities still unresolved (registry/web/linked are
  // already cracked), ranked by DOLLARS OWED within the prospect value band. Resumable; cap via --limit.
  const targets = await all(`
    SELECT oe.owner_name, MIN(t.owner_address) AS owner_address, COUNT(*) AS parcels,
           SUM(COALESCE(t.delinquent_amount,0)) AS owed,
           (SELECT officers_json FROM entity_registry e WHERE e.query_name = oe.owner_name) AS officers_json
    FROM owner_enrichment oe JOIN tax_roll t ON t.account_id = oe.account_id
    WHERE oe.owner_type='entity' AND oe.conf_tier IN ('high','medium') ${delqFilter} ${catFilter}
      AND oe.owner_name NOT IN (SELECT owner_name FROM llc_breaks)
    GROUP BY oe.owner_name HAVING owed >= ${VALUE_MIN} AND owed <= ${VALUE_MAX}
    ORDER BY owed DESC LIMIT ?`, [LIMIT]);

  // Preview the queue (no searches, no key needed) so spend can be authorized deliberately.
  if (args.preview) {
    const totalOwed = targets.reduce((s, t) => s + (t.owed || 0), 0);
    console.log(`\nQUEUE PREVIEW — top ${targets.length} unresolved entities by dollars owed (VALUE_MIN ${VALUE_MIN}):`);
    console.log(`  would run ${targets.length} searches; total owed across them $${Math.round(totalOwed).toLocaleString()}`);
    targets.slice(0, 20).forEach((t, i) => console.log(`   ${String(i + 1).padStart(3)}. ${(t.owner_name || '').slice(0, 38).padEnd(39)} $${Math.round(t.owed || 0).toLocaleString().padStart(9)}  (${t.parcels} parcels)`));
    if (targets.length > 20) console.log(`   … +${targets.length - 20} more`);
    await new Promise(res => db.close(res));
    return;
  }
  console.log(`\nLEG 2 (web breaker via ${serp.PROVIDER}): ${targets.length} unresolved entities by value, rate ${RATE_MS}ms…`);

  let mined = 0, withHint = 0, promoted = 0, ambiguous = 0, errors = 0;
  for (let i = 0; i < targets.length; i++) {
    const { owner_name, owner_address, officers_json } = targets[i];
    let officerNames = [];
    try { officerNames = (JSON.parse(officers_json || '[]') || []).map(o => o.name).filter(Boolean); } catch (_) {}
    try {
      const res = await breaker.resolveByWeb(serp, owner_name, owner_address, { officerNames });
      const top = res.candidates[0] || null;
      await run(`INSERT OR REPLACE INTO llc_breaks
        (owner_name, query, candidates_json, phones_json, litigation_json, ambiguous, top_name, top_role, top_score)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [owner_name, res.query || null, JSON.stringify(res.candidates || []), JSON.stringify(res.phones || []),
         JSON.stringify(res.litigation || []), res.ambiguous ? 1 : 0,
         top?.name || null, top?.role || null, top?.score || 0]);
      mined++;
      if (res.ambiguous) ambiguous++;
      if (top) withHint++;
      // Promote to owner_enrichment ONLY a single, corroborated, non-ambiguous, strong hit —
      // and only as tier 'web' (strictly below Comptroller 'registry'/'direct'). Never overwrite
      // a better tier. Sourced + verify-flagged in the reason, per the privacy posture. The
      // promotion bar (given-name OR officer-match) lives in lib/llc_breaker.isPromotable so the
      // live path and the offline re-validation agree.
      if (WRITEBACK && breaker.isPromotable(top, res.ambiguous)) {
        const src = (top.sources[0] || '').replace(/^https?:\/\//, '').split('/')[0];
        await run(`UPDATE owner_enrichment SET embedded_name=?, embedded_role=?, conf_tier='web',
          conf_score=?, reason=? WHERE owner_name=? AND conf_tier NOT IN ('registry','direct')`,
          [top.name, top.role || 'PRINCIPAL?', Math.min(70, top.score),
           `web hint (source: ${src}) — unverified, confirm before contact`, owner_name]);
        promoted++;
      }
    } catch (e) { errors++; if (errors <= 3) console.log(`  err ${owner_name}: ${e.message}`); }
    if (i % 20 === 19) console.log(`  …${i + 1}/${targets.length} (hints ${withHint}, promoted ${promoted}, ambiguous ${ambiguous}, err ${errors})`);
    await sleep(RATE_MS);
  }
  console.log(`\ndone: mined ${mined}, with-hint ${withHint}, promoted-to-web ${promoted}, ambiguous ${ambiguous}, errors ${errors}`);
  console.log("cache: llc_breaks (sourced hints) + owner_enrichment tier 'web' for corroborated promotions.");
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
