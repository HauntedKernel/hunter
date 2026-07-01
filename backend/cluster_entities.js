/*
 * CLUSTER / GRAPH LINKER (free, $0) — crack opaque shells by CLUSTERING. A single shell
 * ("1601 AKARD ST LLC") reveals nothing, but shells cluster: shared mailing address, shared
 * Comptroller registered-agent/officer. If ANY member of a cluster resolves to a person (name-
 * match, address-link, a person-named co-member, or the agent), propagate that person to the
 * cluster's still-unresolved entities.
 *
 * Union-Find over three edge types, with hard safety rails against giant false clusters:
 *   - shared mailing address, LOW-cardinality only (≤ADDR_MAX distinct owners — not an office/mall)
 *   - shared registered-agent PERSON, LOW-degree only (≤AGENT_MAX entities — not a pro filing agent)
 *   - shared OFFICER person, same degree cap
 * A cluster only propagates when it resolves to EXACTLY ONE person and stays small (≤CLUSTER_MAX).
 *
 * Writes owner_enrichment tier 'cluster' (peer of 'linked', below registry/web; never overwrites
 * them) with a verifiable reason. Run on the box from backend/:  node cluster_entities.js [--dry]
 * Env: HUNTER_DB, ADDR_MAX(4), AGENT_MAX(5), CLUSTER_MAX(12).
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const { classifyOwner, normalizeName } = require('./lib/entity_resolution');
const { isServiceFirm, personKey } = require('./lib/agent_reverse');
const { isGivenName } = require('./lib/llc_breaker');

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const ADDR_MAX = Number(process.env.ADDR_MAX || 4);
const AGENT_MAX = Number(process.env.AGENT_MAX || 5);
const CLUSTER_MAX = Number(process.env.CLUSTER_MAX || 12);
const DRY = process.argv.includes('--dry');

const db = new sqlite3.Database(DB);
const all = (s, p = []) => new Promise((r, j) => db.all(s, p, (e, x) => e ? j(e) : r(x)));
const run = (s, p = []) => new Promise((r, j) => db.run(s, p, e => e ? j(e) : r()));

function normAddr(a) {
  let s = normalizeName(a).replace(/\b(STE|SUITE|UNIT|APT|#|NO|PMB|FL|FLOOR|BLDG|RM)\b.*$/i, '');
  return s.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function isRealPerson(name) {
  if (!name || classifyOwner(name) !== 'person' || isServiceFirm(name)) return false;
  const toks = normalizeName(name).split(' ').filter(t => t.length >= 2);
  return toks.length >= 2 && toks.length <= 4 && toks.some(t => isGivenName(t));
}

class UF {
  constructor() { this.p = new Map(); }
  find(x) { if (!this.p.has(x)) this.p.set(x, x); let r = x; while (this.p.get(r) !== r) r = this.p.get(r); while (this.p.get(x) !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; } return r; }
  union(a, b) { this.p.set(this.find(a), this.find(b)); }
}

(async () => {
  await run('PRAGMA busy_timeout=15000');

  // Already-known people (anchors) + tiers we must not overwrite.
  const enr = await all(`SELECT DISTINCT owner_name, conf_tier, embedded_name FROM owner_enrichment WHERE owner_type='entity'`);
  const resolvedPerson = new Map();   // owner_name → person (already cracked → anchors the cluster)
  const cracked = new Set();          // don't re-crack these
  for (const e of enr) {
    if (['registry', 'direct', 'web', 'linked'].includes(e.conf_tier)) cracked.add(e.owner_name);
    if (['registry', 'linked', 'web'].includes(e.conf_tier) && e.embedded_name) resolvedPerson.set(e.owner_name, e.embedded_name);
  }

  const rows = await all(`SELECT DISTINCT owner_name, owner_address FROM tax_roll
    WHERE is_delinquent=1 AND owner_name IS NOT NULL AND owner_address IS NOT NULL AND TRIM(owner_address)<>''`);
  const reg = await all(`SELECT query_name, registered_agent, agent_is_person, officers_json FROM entity_registry`);

  const uf = new UF();
  const personNode = new Map();   // virtual node id → person display name (agent/officer anchors)

  // Edge 1 — shared low-cardinality mailing address
  const byAddr = new Map();
  for (const r of rows) { const a = normAddr(r.owner_address); if (!a || a.length < 8 || !/\d/.test(a)) continue; (byAddr.get(a) || byAddr.set(a, []).get(a)).push(r.owner_name); }
  for (const [, owners] of byAddr) {
    const uniq = [...new Set(owners)];
    if (uniq.length < 2 || uniq.length > ADDR_MAX) continue;
    for (let i = 1; i < uniq.length; i++) uf.union(uniq[0], uniq[i]);
  }

  // Edges 2 & 3 — shared registered-agent / officer PERSON, with a degree cap (skip pro agents)
  const agentDeg = new Map(), officerDeg = new Map();
  for (const g of reg) {
    if (g.registered_agent && g.agent_is_person && isRealPerson(g.registered_agent)) agentDeg.set(personKey(g.registered_agent), (agentDeg.get(personKey(g.registered_agent)) || 0) + 1);
    try { for (const o of JSON.parse(g.officers_json || '[]')) if (isRealPerson(o.name)) officerDeg.set(personKey(o.name), (officerDeg.get(personKey(o.name)) || 0) + 1); } catch (_) {}
  }
  for (const g of reg) {
    if (g.registered_agent && g.agent_is_person && isRealPerson(g.registered_agent)) {
      const k = personKey(g.registered_agent);
      if (agentDeg.get(k) <= AGENT_MAX) { const vn = 'AGENT:' + k; personNode.set(vn, g.registered_agent); uf.union(g.query_name, vn); }
    }
    try { for (const o of JSON.parse(g.officers_json || '[]')) if (isRealPerson(o.name)) { const k = personKey(o.name); if (officerDeg.get(k) <= AGENT_MAX) { const vn = 'OFF:' + k; personNode.set(vn, o.name); uf.union(g.query_name, vn); } } } catch (_) {}
  }

  // Assemble components
  const comp = new Map();   // root → { members:Set, persons:Map(personKey→name) }
  const get = (root) => comp.get(root) || comp.set(root, { members: new Set(), persons: new Map() }).get(root);
  // Anchor must be a genuine PERSON — reject LLC/service embedded_names that leaked upstream.
  const addPerson = (root, name) => { if (name && classifyOwner(name) === 'person' && !isServiceFirm(name)) get(root).persons.set(personKey(name), name); };
  for (const r of rows) {
    if (classifyOwner(r.owner_name) !== 'entity' && !isRealPerson(r.owner_name)) continue;
    const root = uf.find(r.owner_name);
    get(root).members.add(r.owner_name);
    if (resolvedPerson.has(r.owner_name)) addPerson(root, resolvedPerson.get(r.owner_name));
    else if (isRealPerson(r.owner_name)) addPerson(root, r.owner_name);
  }
  for (const [vn, name] of personNode) addPerson(uf.find(vn), name);

  // Propagate: cluster with exactly ONE person + small → assign to unresolved entity members
  const links = [];
  for (const [, c] of comp) {
    if (c.persons.size !== 1) continue;
    if (c.members.size > CLUSTER_MAX) continue;
    const person = [...c.persons.values()][0];
    for (const m of c.members) {
      if (cracked.has(m)) continue;
      if (classifyOwner(m) !== 'entity') continue;
      if (personKey(m).includes(personKey(person))) continue;   // it IS basically that person
      links.push({ entity: m, person, size: c.members.size });
    }
  }

  console.log(`${DRY ? '[dry] ' : ''}cluster-linked entities: ${links.length}  (edges: addr≤${ADDR_MAX}, agent/officer≤${AGENT_MAX} deg, cluster≤${CLUSTER_MAX})`);
  links.slice(0, 15).forEach(l => console.log(`   ${(l.entity || '').slice(0, 36).padEnd(37)} →  ${l.person}   [cluster of ${l.size}]`));
  if (DRY) { await new Promise(res => db.close(res)); return; }

  let n = 0;
  await run('BEGIN');
  for (const l of links) {
    await run(`UPDATE owner_enrichment SET embedded_name=?, embedded_role='CLUSTER', conf_tier='cluster',
      conf_score=56, reason=? WHERE owner_name=? AND conf_tier NOT IN ('registry','direct','web','linked')`,
      [l.person, `likely owner — ownership cluster (shared address / agent / officer) → ${l.person}; verify`, l.entity]);
    n++;
  }
  await run('COMMIT');
  const applied = (await all(`SELECT COUNT(DISTINCT owner_name) c FROM owner_enrichment WHERE conf_tier='cluster'`))[0].c;
  console.log(`wrote tier 'cluster' for ${n} entities (${applied} distinct now cluster-linked).`);
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
