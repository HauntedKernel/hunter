/*
 * Build the owner_enrichment table — the free, in-house OSINT backbone (lib/entity_resolution.js).
 * For each delinquent lead: classify the owner (entity/person/trust/institution), score
 * name-rarity from OUR OWN owner corpus (IDF — distinctive names high, "Smith" low), pull any
 * principal already embedded in the mailing address, and assign a confidence tier (Direct/
 * High/Medium/Low) = how reliably we can resolve a real contact for free (vs needing skip-trace).
 *
 * Two passes:
 *   1. document-frequency of identifying tokens over ALL distinct owner_names (the rarity corpus);
 *   2. enrich the delinquent set and write owner_enrichment.
 *
 * Run on the box from backend/:  node build_owner_enrichment.js
 * Env: HUNTER_DB (default src/data/tax_roll.db),  SCOPE=delinquent|all (default delinquent).
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const er = require('./lib/entity_resolution');

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const SCOPE = process.env.SCOPE || 'delinquent';
const db = new sqlite3.Database(DB);
const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));
const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));

(async () => {
  console.log(`DB: ${DB}  scope: ${SCOPE}`);

  // ---- Pass 1: rarity corpus (DF over DISTINCT owners) ----
  console.log('pass 1: building name-rarity corpus from distinct owners…');
  const owners = await all("SELECT DISTINCT owner_name FROM tax_roll WHERE owner_name IS NOT NULL AND TRIM(owner_name) <> ''");
  const df = Object.create(null);
  for (const { owner_name } of owners) {
    for (const t of er.significantTokens(owner_name)) df[t] = (df[t] || 0) + 1;
  }
  const N = owners.length;
  console.log(`  distinct owners (N): ${N.toLocaleString()};  distinct tokens: ${Object.keys(df).length.toLocaleString()}`);

  // Validation probe — where do known names land? (sanity-check the rarity scale)
  const probe = (name) => {
    const toks = er.significantTokens(name);
    const r = er.rarityFromDF(toks, df, N);
    const dfs = toks.map(t => `${t}=${df[t] || 0}`).join(',');
    console.log(`    ${name.padEnd(26)} rarity ${r.toFixed(2)}  [${dfs}]`);
  };
  console.log('  rarity probes (common surnames should be LOW, distinctive HIGH):');
  ['SMITH', 'JOHNSON', 'WILLIAMS', 'GARCIA', 'JOSE GARCIA', 'TAPPER INVESTMENTS LLC',
    'NITILO CORP', 'DALLAS PROPERTIES LLC', 'JOSE DE JESUS PINTOR'].forEach(probe);

  // ---- Pass 2: enrich + write ----
  await run('DROP TABLE IF EXISTS owner_enrichment');
  await run(`CREATE TABLE owner_enrichment (
    account_id TEXT PRIMARY KEY, owner_name TEXT, owner_type TEXT, name_rarity REAL,
    embedded_name TEXT, embedded_role TEXT, conf_tier TEXT, conf_score INTEGER, reason TEXT
  )`);
  const where = SCOPE === 'all' ? '1=1' : 'is_delinquent = 1';
  const leads = await all(`SELECT account_id, owner_name, owner_address FROM tax_roll
    WHERE ${where} AND owner_name IS NOT NULL AND TRIM(owner_name) <> ''`);
  console.log(`\npass 2: enriching ${leads.length.toLocaleString()} leads (${SCOPE})…`);

  const tierCount = {}, typeCount = {};
  let embedded = 0;
  await run('BEGIN');
  const stmt = db.prepare(`INSERT OR REPLACE INTO owner_enrichment
    (account_id, owner_name, owner_type, name_rarity, embedded_name, embedded_role, conf_tier, conf_score, reason)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const r of leads) {
    const type = er.classifyOwner(r.owner_name);
    const toks = er.significantTokens(r.owner_name);
    const rarity = er.rarityFromDF(toks, df, N);
    const emb = er.parseEmbeddedContact(r.owner_address);
    const conf = er.confidenceTier({ type, rarity, embedded: !!emb });
    if (emb) embedded++;
    tierCount[conf.tier] = (tierCount[conf.tier] || 0) + 1;
    typeCount[type] = (typeCount[type] || 0) + 1;
    stmt.run(r.account_id, r.owner_name, type, +rarity.toFixed(3),
      emb ? emb.name : null, emb ? emb.role : null, conf.tier, conf.score, conf.reason);
  }
  await new Promise((res, rej) => stmt.finalize(e => e ? rej(e) : res()));
  await run('COMMIT');

  // ---- Report ----
  const pct = (n) => `${(100 * n / leads.length).toFixed(1)}%`;
  console.log('\nowner type distribution:');
  for (const [k, v] of Object.entries(typeCount).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(12)} ${String(v).padStart(7)}  ${pct(v)}`);
  console.log('\nCONFIDENCE TIER distribution (free-resolvability):');
  const order = ['direct', 'high', 'medium', 'low', 'skip'];
  for (const t of order) if (tierCount[t]) console.log(`  ${t.padEnd(8)} ${String(tierCount[t]).padStart(7)}  ${pct(tierCount[t])}`);
  console.log(`\n  embedded contact found in mailing address: ${embedded.toLocaleString()} (${pct(embedded)})`);
  const freeResolvable = (tierCount.direct || 0) + (tierCount.high || 0);
  const skipTraceResidual = (tierCount.low || 0);
  console.log(`  → free-resolvable now (direct + high): ${freeResolvable.toLocaleString()} (${pct(freeResolvable)})`);
  console.log(`  → skip-trace residual (low tier only):  ${skipTraceResidual.toLocaleString()} (${pct(skipTraceResidual)})`);

  console.log('\nsample leads by tier:');
  for (const t of order) {
    const rows = await all(`SELECT owner_name, owner_type, name_rarity, embedded_name, embedded_role
      FROM owner_enrichment WHERE conf_tier=? LIMIT 4`, [t]);
    if (!rows.length) continue;
    console.log(`  [${t}]`);
    for (const r of rows) {
      const c = r.embedded_name ? ` → ${r.embedded_role}: ${r.embedded_name}` : '';
      console.log(`     ${(r.owner_name || '').slice(0, 34).padEnd(34)} ${r.owner_type.padEnd(11)} r=${r.name_rarity}${c}`);
    }
  }
  await new Promise(res => db.close(res));
  console.log('\ndone. table: owner_enrichment');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
