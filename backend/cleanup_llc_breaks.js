/*
 * One-off OFFLINE cleanup of llc_breaks against the current (stricter) miner rules —
 * lib/llc_breaker.revalidateStored. Re-scores the STORED candidates (no re-querying, $0),
 * drops junk ("Academy Sports", "Sales Timberlake"), recomputes top/ambiguous, then reverts
 * every owner_enrichment tier='web' promotion and re-promotes only the now-valid ones
 * (single, corroborated by given-name OR Comptroller-officer, non-ambiguous, score>=60).
 *
 * Run on the box from backend/:  node cleanup_llc_breaks.js
 * Env: HUNTER_DB (default src/data/tax_roll.db).
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const { revalidateStored } = require('./lib/llc_breaker');

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');

(async () => {
  const db = new sqlite3.Database(DB);
  const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));
  const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));
  await run('PRAGMA busy_timeout=15000');

  // 1. Revert ALL current web promotions to entity defaults (matches build_owner_enrichment).
  const before = (await all("SELECT COUNT(DISTINCT owner_name) c FROM owner_enrichment WHERE conf_tier='web'"))[0].c;
  await run(`UPDATE owner_enrichment SET embedded_name=NULL, embedded_role=NULL,
      conf_tier=CASE WHEN name_rarity>=0.5 THEN 'high' ELSE 'medium' END,
      conf_score=CASE WHEN name_rarity>=0.5 THEN 78 ELSE 55 END,
      reason=CASE WHEN name_rarity>=0.5 THEN 'distinctive business name → clean Comptroller/registry match'
                  ELSE 'business entity, generic name → registry match needs corroboration' END
      WHERE conf_tier='web'`);

  // 2. Re-validate every llc_breaks row; rewrite cleaned candidates/top; re-promote the valid.
  const rows = await all("SELECT owner_name, candidates_json FROM llc_breaks");
  let promoted = 0, withHint = 0, cleared = 0;
  for (const r of rows) {
    let cands = [];
    try { cands = JSON.parse(r.candidates_json || '[]'); } catch (_) {}
    const rv = revalidateStored(r.owner_name, cands);
    const top = rv.top;
    if (top) withHint++; else if (cands.length) cleared++;
    await run(`UPDATE llc_breaks SET candidates_json=?, top_name=?, top_role=?, top_score=?, ambiguous=? WHERE owner_name=?`,
      [JSON.stringify(rv.candidates), top?.name || null, top?.role || null, top?.score || 0, rv.ambiguous ? 1 : 0, r.owner_name]);
    if (rv.promotable) {
      const src = (top.sources[0] || '').replace(/^https?:\/\//, '').split('/')[0];
      await run(`UPDATE owner_enrichment SET embedded_name=?, embedded_role=?, conf_tier='web',
        conf_score=?, reason=? WHERE owner_name=? AND conf_tier NOT IN ('registry','direct')`,
        [top.name, top.role || 'PRINCIPAL?', Math.min(70, top.score),
         `web hint (source: ${src}) — unverified, confirm before contact`, r.owner_name]);
      promoted++;
    }
  }
  const after = (await all("SELECT COUNT(DISTINCT owner_name) c FROM owner_enrichment WHERE conf_tier='web'"))[0].c;
  console.log(`reverted web promotions: ${before} → 0`);
  console.log(`re-validated ${rows.length} llc_breaks rows: ${withHint} keep a hint, ${cleared} now hint-less (all junk)`);
  console.log(`re-promoted (clean, corroborated): ${promoted}  →  owner_enrichment tier 'web' entities now: ${after}`);
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
