/*
 * ENTITY LINKAGE (free, $0) — crack LLCs that DON'T share a name but DO share a mailing address
 * with an owner we can already name. "Nova Builds LLC" mails to the same address as the operator's
 * named entity → same person. De-noised: only low-cardinality addresses (a shared office / auto-plex
 * / mail-drop links many unrelated owners — skip those), and the co-owner must be a Comptroller-
 * resolved entity or a real person (given name, not a service firm).
 *
 * Writes owner_enrichment tier 'linked' (an INFERENCE, ranked below Comptroller 'registry'/'web' —
 * never overwrites those). The reason names the linkage basis so the agent can verify.
 *
 * Run on the box from backend/:  node link_entities.js [--dry]
 * Env: HUNTER_DB (default src/data/tax_roll.db), MAXK (default 4).
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const { classifyOwner, normalizeName } = require('./lib/entity_resolution');
const { isServiceFirm } = require('./lib/agent_reverse');
const { isGivenName } = require('./lib/llc_breaker');

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const MAXK = Number(process.env.MAXK || 4);
const DRY = process.argv.includes('--dry');

const db = new sqlite3.Database(DB);
const all = (s, p = []) => new Promise((r, j) => db.all(s, p, (e, x) => e ? j(e) : r(x)));
const run = (s, p = []) => new Promise((r, j) => db.run(s, p, e => e ? j(e) : r()));

function normAddr(a) {
  let s = normalizeName(a).replace(/\b(STE|SUITE|UNIT|APT|#|NO|PMB|FL|FLOOR|BLDG|RM)\b.*$/i, '');
  return s.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function isRealPerson(name) {
  if (classifyOwner(name) !== 'person' || isServiceFirm(name)) return false;
  const toks = normalizeName(name).split(' ').filter(t => t.length >= 2);
  if (toks.length < 2 || toks.length > 4) return false;
  return toks.some(t => isGivenName(t));
}

(async () => {
  await run('PRAGMA busy_timeout=15000');
  const enr = await all(`SELECT DISTINCT owner_name, conf_tier, embedded_name FROM owner_enrichment WHERE owner_type='entity'`);
  const resolved = new Map();      // owner_name → person (Comptroller-confident only)
  const protectedTier = new Set(); // don't overwrite these tiers
  for (const e of enr) {
    if (['registry', 'direct', 'web'].includes(e.conf_tier)) protectedTier.add(e.owner_name);
    if (e.conf_tier === 'registry' && e.embedded_name) resolved.set(e.owner_name, e.embedded_name);
  }

  const rows = await all(`SELECT DISTINCT owner_name, owner_address FROM tax_roll
    WHERE is_delinquent=1 AND owner_name IS NOT NULL AND owner_address IS NOT NULL AND TRIM(owner_address)<>''`);
  const byAddr = new Map();
  for (const r of rows) {
    const a = normAddr(r.owner_address);
    if (!a || a.length < 8 || !/\d/.test(a)) continue;
    if (!byAddr.has(a)) byAddr.set(a, []);
    byAddr.get(a).push(r.owner_name);
  }

  const links = [];   // { entity, person, basis }
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.owner_name)) continue; seen.add(r.owner_name);
    if (classifyOwner(r.owner_name) !== 'entity') continue;
    if (resolved.has(r.owner_name) || protectedTier.has(r.owner_name)) continue;
    const a = normAddr(r.owner_address);
    const owners = byAddr.get(a) || [];
    if (owners.length < 2 || owners.length > MAXK) continue;
    const mates = owners.filter(n => n !== r.owner_name);
    let person = null, basis = null;
    for (const m of mates) if (resolved.has(m)) { person = resolved.get(m); basis = `same mailing address as ${m} (→ ${person})`; break; }
    if (!person) for (const m of mates) if (isRealPerson(m)) { person = m; basis = `same mailing address as ${m}`; break; }
    if (person) links.push({ entity: r.owner_name, person, basis });
  }

  console.log(`${DRY ? '[dry] ' : ''}address-linked entities: ${links.length}`);
  links.slice(0, 12).forEach(l => console.log(`   ${l.entity}  →  ${l.person}`));
  if (DRY) { await new Promise(res => db.close(res)); return; }

  let n = 0;
  await run('BEGIN');
  for (const l of links) {
    await run(`UPDATE owner_enrichment SET embedded_name=?, embedded_role='LINKED', conf_tier='linked',
      conf_score=60, reason=? WHERE owner_name=? AND conf_tier NOT IN ('registry','direct','web')`,
      [l.person, `likely owner — ${l.basis}; verify`, l.entity]);
    n++;
  }
  await run('COMMIT');
  const applied = (await all(`SELECT COUNT(DISTINCT owner_name) c FROM owner_enrichment WHERE conf_tier='linked'`))[0].c;
  console.log(`wrote tier 'linked' for ${n} entities (${applied} distinct now linked).`);
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
