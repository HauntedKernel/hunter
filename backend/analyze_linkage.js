/*
 * SIZING: how many unresolved delinquent ENTITY owners could be cracked for FREE by linking on a
 * shared MAILING ADDRESS with an owner we can already name (a person, or a Comptroller-resolved
 * entity). This is the "Nova Builds LLC shares an address with the owner's named entity" play.
 * Read-only analysis — no writes.
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const { classifyOwner, normalizeName } = require('./lib/entity_resolution');
const { isServiceFirm } = require('./lib/agent_reverse');
const { isGivenName } = require('./lib/llc_breaker');
const MAXK = 4;   // addresses shared by more than this = office/strip-mall/mail-drop → not one owner

// A co-owner we'd actually trust as "the person": real given name, not a service firm, 2-3 tokens.
function isRealPerson(name) {
  if (classifyOwner(name) !== 'person' || isServiceFirm(name)) return false;
  const toks = normalizeName(name).split(' ').filter(t => t.length >= 2);
  if (toks.length < 2 || toks.length > 4) return false;
  return toks.some(t => isGivenName(t));
}

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const db = new sqlite3.Database(DB);
const all = (s, p = []) => new Promise((r, j) => db.all(s, p, (e, x) => e ? j(e) : r(x)));

// Normalize a mailing address for matching (drop unit/suite noise, punctuation, casing).
function normAddr(a) {
  let s = normalizeName(a).replace(/\b(STE|SUITE|UNIT|APT|#|NO|PMB|FL|FLOOR|BLDG|RM)\b.*$/i, '');
  return s.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

(async () => {
  // resolved: owner_name → person (Comptroller registry writeback lives in owner_enrichment).
  const enr = await all(`SELECT DISTINCT owner_name, conf_tier, embedded_name FROM owner_enrichment WHERE owner_type='entity'`);
  const resolvedName = new Map();   // owner_name → person
  for (const e of enr) if (e.conf_tier === 'registry' && e.embedded_name) resolvedName.set(e.owner_name, e.embedded_name);

  // distinct delinquent owners + their mailing address
  const rows = await all(`SELECT DISTINCT owner_name, owner_address FROM tax_roll
    WHERE is_delinquent=1 AND owner_name IS NOT NULL AND owner_address IS NOT NULL AND TRIM(owner_address)<>''`);

  const byAddr = new Map();
  for (const r of rows) {
    const a = normAddr(r.owner_address);
    if (!a || a.length < 8) continue;                 // skip junk / too-generic
    if (!byAddr.has(a)) byAddr.set(a, []);
    byAddr.get(a).push(r.owner_name);
  }

  let entities = 0, unresolved = 0, crackable = 0;
  const examples = [];
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.owner_name)) continue; seen.add(r.owner_name);
    if (classifyOwner(r.owner_name) !== 'entity') continue;
    entities++;
    if (resolvedName.has(r.owner_name)) continue;     // already resolved by Comptroller
    unresolved++;
    const a = normAddr(r.owner_address);
    const owners = byAddr.get(a) || [];
    if (owners.length > MAXK) continue;                    // shared building / mail-drop — skip
    const mates = owners.filter(n => n !== r.owner_name);
    // a co-address owner we can name: prefer a Comptroller-resolved entity, else a real person
    let who = null, via = null;
    for (const m of mates) if (resolvedName.has(m)) { who = resolvedName.get(m) + ` (via ${m})`; via = 'resolved entity, same addr'; break; }
    if (!who) for (const m of mates) if (isRealPerson(m)) { who = m; via = 'person, same addr'; break; }
    if (who) {
      crackable++;
      if (examples.length < 15) examples.push(`${r.owner_name}  →  ${who}   [${via}]`);
    }
  }

  console.log(`distinct delinquent ENTITY owners:        ${entities.toLocaleString()}`);
  console.log(`  …still unresolved (no Comptroller name): ${unresolved.toLocaleString()}`);
  console.log(`  …crackable via SHARED MAILING ADDRESS:   ${crackable.toLocaleString()}  (${(100 * crackable / Math.max(1, unresolved)).toFixed(1)}% of unresolved)`);
  console.log(`\nexamples:`);
  examples.forEach(e => console.log('   ' + e));
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
