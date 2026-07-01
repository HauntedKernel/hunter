/*
 * Registered-agent / officer REVERSE index — the free, ToS-clean leg of the LLC-breaker.
 * The Comptroller resolver (resolve_entities.js) already cached, per distinctive LLC, the
 * registered agent + officers (entity_registry). Inverting that map answers the question a
 * realtor actually cares about: "this person — what ELSE do they own?" One delinquent LLC is
 * a lead; a person standing behind four delinquent LLCs is a motivated multi-property seller.
 *
 * Pure functions over the cached rows — no network, no new API spend. Build the index once
 * from entity_registry, then look up by the resolved contact person.
 */
const { normalizeName, classifyOwner } = require('./entity_resolution');

// Registered-agent SERVICE firms that classifyOwner() misses because their names carry no
// LLC/INC/entity token (e.g. "ASSURED BOOKKEEPING & TAX", "JANE DOE CPA"). These act as the
// agent-of-record for many unrelated LLCs, so counting them as a "person behind N entities"
// is noise — they're a mail drop, not an owner. Suppress from portfolios. Precision-first:
// every token here is one that effectively never appears in a real personal name.
const SERVICE_FIRM = /\b(BOOKKEEPING|ACCOUNTING|ACCOUNTANTS?|CPA|TAX|TAXES|REGISTERED AGENTS?|AGENT SERVICES?|INCORPORAT|INCORPORATIONS?|COMPLIANCE|PARALEGAL|PARACORP|COGENCY|ATTORNEY|LAW (OFFICE|FIRM|GROUP|OFFICES)|LEGAL|NOTARY|FINANCIAL|INSURANCE|ESCROW|TITLE CO|REGISTERED|NATIONWIDE|STATUTORY)\b/;
function isServiceFirm(name) { return SERVICE_FIRM.test(normalizeName(name)); }

// A stable key for a person across spelling/spacing noise (kept simple: normalized + sorted
// significant tokens so "DINO TAPPER" and "TAPPER DINO" collapse, "DINO J TAPPER" stays near).
function personKey(name) {
  const toks = normalizeName(name).split(' ').filter(t => t.length >= 2);
  return toks.slice().sort().join(' ');
}

// indexByPerson(rows) → Map personKey → { name, count, entities:[{entity, role, taxpayerId, status}] }
// rows: entity_registry records { query_name, matched_name, contact_name, contact_role,
//        taxpayer_id, status, ambiguous, match_confidence }. Only confident, person contacts
// build a portfolio (an agent-service or holding-co officer is not "the owner").
function indexByPerson(rows, { minConfidence = 70 } = {}) {
  const idx = new Map();
  for (const r of rows || []) {
    const name = r.contact_name;
    if (!name) continue;
    if (r.ambiguous) continue;
    if ((r.match_confidence || 0) < minConfidence) continue;
    if (classifyOwner(name) !== 'person') continue;           // skip service/holding-co officers
    if (isServiceFirm(name)) continue;                        // skip registered-agent service firms
    const key = personKey(name);
    if (!key) continue;
    let e = idx.get(key);
    if (!e) { e = { name, count: 0, entities: [] }; idx.set(key, e); }
    e.entities.push({
      entity: r.matched_name || r.query_name,
      role: r.contact_role || null,
      taxpayerId: r.taxpayer_id || null,
      status: r.status || null,
    });
    e.count = e.entities.length;
  }
  return idx;
}

// People who stand behind 2+ entities — the multi-property sellers worth surfacing first.
function portfolios(idx, { min = 2 } = {}) {
  return [...idx.values()].filter(e => e.count >= min).sort((a, b) => b.count - a.count);
}

module.exports = { personKey, indexByPerson, portfolios, isServiceFirm };
