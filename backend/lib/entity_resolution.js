/*
 * ENTITY RESOLUTION / OSINT-enrichment backbone (free, in-house — no external API).
 *
 * The idea (see SIGNAL_GAPS / RESEARCH): ~27% of delinquent leads are ENTITY-owned
 * (LLC/Corp/Investments/Trust). Those are gold — Texas puts the people behind them on
 * public record (Comptroller PIR: registered agent + officers), so we can identify a real
 * contact for FREE before ever paying for skip-trace. The hard part is confidence: a
 * distinctive name ("Tapper Investments" → Dino Tapper) resolves cleanly; a common one
 * ("John Smith") invites false matches. This module supplies the confidence logic:
 *
 *   1. classifyOwner()        — ENTITY vs PERSON vs TRUST/ESTATE vs INSTITUTION.
 *   2. significantTokens()    — the identifying tokens (drops generic entity/stop words).
 *   3. rarityFromDF()         — name-rarity from OUR OWN owner corpus (IDF). Distinctive
 *                               names score high; "Smith/Garcia" score low. Free, data-driven.
 *   4. parseEmbeddedContact() — a principal already sitting in the mailing address
 *                               ("DR BYSHINSKI-PRES", "C/O Jane Doe") — a Tier-0 contact, $0.
 *   5. confidenceTier()       — Direct / High / Medium / Low: how reliably we expect to
 *                               resolve a real, reachable contact (= how little skip-trace we need).
 *
 * Pure functions; the DF map is precomputed by build_owner_enrichment.js over the corpus.
 */

// Tokens that MARK an owner as a business entity (presence ⇒ entity) AND are too generic
// to identify it — stripped before computing rarity so "TAPPER" drives the score, not "LLC".
const ENTITY_TOKENS = new Set([
  'LLC', 'L L C', 'LLP', 'LP', 'LTD', 'INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO',
  'COMPANY', 'PA', 'PC', 'PLLC', 'INVESTMENT', 'INVESTMENTS', 'PROPERTY', 'PROPERTIES',
  'HOLDING', 'HOLDINGS', 'GROUP', 'ENTERPRISE', 'ENTERPRISES', 'CAPITAL', 'VENTURE',
  'VENTURES', 'MANAGEMENT', 'MGMT', 'FUND', 'FUNDS', 'PARTNERS', 'PARTNERSHIP', 'ASSOCIATES',
  'EQUITY', 'ASSETS', 'RENTAL', 'RENTALS', 'LEASING', 'DEVELOPMENT', 'DEVELOPERS', 'REALTY',
  'REAL', 'ESTATE', 'HOMES', 'HOME', 'SERVICES', 'SOLUTIONS', 'ACQUISITIONS', 'ACQUISITION',
]);
// Strong markers — if any appears, it's definitely an entity (even alone).
const STRONG_ENTITY = new Set(['LLC', 'LLP', 'LP', 'LTD', 'INC', 'INCORPORATED', 'CORP',
  'CORPORATION', 'COMPANY', 'PLLC', 'PA', 'PC', 'INVESTMENTS', 'PROPERTIES', 'HOLDINGS',
  'ENTERPRISES', 'PARTNERS', 'ASSOCIATES', 'VENTURES']);
const INSTITUTION = /\b(CITY|COUNTY|STATE|FEDERAL|UNITED STATES|\bUSA\b|DEPT|DEPARTMENT|AUTHORITY|DISTRICT|CHURCH|MINISTRIES|MINISTRY|MINISTRIES|UNIVERSITY|COLLEGE|SCHOOL|ACADEMY|HOUSING|HABITAT|FOUNDATION|BANK|MORTGAGE|FANNIE|FREDDIE|FHA|HUD|VETERANS|ASSOCIATION|ASSN|HOA|HOMEOWNERS|CONDOMINIUM|CONDO ASSN|BAPTIST|METHODIST|CATHOLIC|LUTHERAN|PRESBYTERIAN|PENTECOSTAL|EPISCOPAL|EVANGEL|APOSTOLIC|SYNAGOGUE|MOSQUE|ISLAMIC|CHAPEL|CONGREGATION|DIOCESE|TABERNACLE|GOSPEL|WORSHIP|FELLOWSHIP|CEMETERY|NONPROFIT|CHARITY|CHARITABLE|COUNCIL|MUNICIPAL|ISD|REDEVELOPMENT|HEALTH SYSTEM|HOSPITAL|CLINIC)\b/;
const TRUST_RE = /\b(TRUST|TRUSTEE|ESTATE OF|HEIRS|LIFE ESTATE|REVOCABLE|LIVING TRUST|FAMILY TRUST)\b/;
// Person-name connective / honorific / suffix stopwords (not identifying tokens).
const NAME_STOP = new Set(['DE', 'LA', 'EL', 'DEL', 'LOS', 'LAS', 'VAN', 'VON', 'DER', 'AND',
  'OR', 'THE', 'JR', 'SR', 'II', 'III', 'IV', 'MR', 'MRS', 'MS', 'DR', 'ESTATE', 'OF', 'HEIRS',
  'ETAL', 'ET', 'AL', 'LIFE', 'FAMILY', 'REVOCABLE', 'LIVING', 'TRUST', 'TRUSTEE', 'ETUX', 'ETVIR']);
// Generic mailing-address ATTN/C-O targets that are NOT a person.
const GENERIC_ATTN = new Set(['TAX', 'TAXES', 'LEGAL', 'PROPERTY', 'PROPERTIES', 'ACCOUNTING',
  'ACCOUNTS', 'ACCOUNT', 'DEPT', 'DEPARTMENT', 'OFFICE', 'PAYABLE', 'RECEIVABLE', 'BILLING',
  'FINANCE', 'CORPORATE', 'ADMIN', 'MANAGEMENT', 'OWNER', 'RESIDENT', 'CURRENT', 'HOMEOWNER',
  'MORTGAGE', 'ESCROW', 'SERVICING', 'COMPANY', 'CORP', 'LLC', 'INC', 'OPERATIONS', 'ASSET',
  'COLLECTIONS', 'COMPLIANCE', 'CARE', 'HOA', 'ASSOCIATION', 'TENANT', 'LEASING', 'RENTAL']);
// Address structural words — never part of a person's name; mark a generic mailing line.
const LOCATION = new Set(['SUITE', 'STE', 'FLOOR', 'FL', 'BLDG', 'BUILDING', 'UNIT', 'APT',
  'APARTMENT', 'RM', 'ROOM', 'PO', 'BOX', 'PMB', 'NO', 'NUM', 'HWY', 'STREET', 'ST', 'AVE',
  'AVENUE', 'RD', 'ROAD', 'DRIVE', 'LN', 'LANE', 'BLVD', 'PKWY', 'CIR', 'CT', 'WAY', 'PLZ',
  'PLAZA', 'NORTH', 'SOUTH', 'EAST', 'WEST']);
const TITLE = new Set(['DR', 'MR', 'MRS', 'MS', 'MISTER', 'MISS', 'ATTN', 'CO']);

function normalizeName(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9 &/'-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function classifyOwner(name) {
  const n = normalizeName(name);
  if (!n) return 'unknown';
  if (INSTITUTION.test(n)) return 'institution';
  const toks = n.split(' ');
  if (toks.some(t => STRONG_ENTITY.has(t))) return 'entity';
  if (TRUST_RE.test(n)) return 'trust';
  // "NAME + generic-type word" with no person structure → entity (e.g. TAPPER INVESTMENTS).
  if (toks.some(t => ENTITY_TOKENS.has(t))) return 'entity';
  return 'person';
}

// The identifying tokens used for rarity: drop entity-type words, stopwords, single letters.
function significantTokens(name) {
  const n = normalizeName(name).replace(/&/g, ' ');
  return [...new Set(n.split(' '))].filter(t =>
    t.length >= 2 && !ENTITY_TOKENS.has(t) && !NAME_STOP.has(t) && /[A-Z]/.test(t));
}

// rarity 0..1 from the rarest (most identifying) significant token. df = # distinct owners
// containing the token; N = # distinct owners. A hapax → ~1.0; a common surname → low.
function rarityFromDF(tokens, dfMap, N) {
  if (!tokens.length || !N) return 0;
  const maxIDF = Math.log(N);
  let best = 0;
  for (const t of tokens) {
    const df = dfMap[t] || 1;
    const idf = Math.log(N / df);
    if (idf > best) best = idf;
  }
  return Math.max(0, Math.min(1, best / maxIDF));
}

// Pull a principal already embedded in the mailing address. Precision-first: reject generic
// dept lines (ATTN TAX DEPT). Returns { name, role } | null.
function parseEmbeddedContact(addr) {
  const s = normalizeName(addr);
  if (!s) return null;
  const clean = (raw) => {
    let toks = raw.trim().split(/\s+/).filter(Boolean)
      .filter(t => !TITLE.has(t) && !ROLE.has(t) && !/^\d/.test(t) && t.length >= 2);
    // A real person's name carries no dept/location words — strip them; if nothing real
    // remains, it was a generic line (ATTN TAX DEPT / SUITE 650), not a contact.
    toks = toks.filter(t => !GENERIC_ATTN.has(t) && !LOCATION.has(t));
    // need at least one surname-like token (3+ letters) to trust it as a person.
    if (!toks.some(t => /^[A-Z][A-Z'-]{2,}$/.test(t))) return null;
    return toks.slice(0, 3).join(' ');
  };
  let m;
  // 1) NAME-ROLE or NAME ROLE  (e.g. "BYSHINSKI-PRES", "SMITH PRESIDENT")
  m = s.match(/\b([A-Z][A-Z'-]*(?:\s+[A-Z][A-Z'-]*){0,2})[\s-](PRES|PRESIDENT|MGR|MANAGER|MEMBER|MNGM|MNGR|TRUSTEE|OWNER|CEO|CFO|COO|VP|DIRECTOR|PARTNER|PRINCIPAL|AGENT)\b/);
  if (m) { const nm = clean(m[1]); if (nm) return { name: nm, role: m[2] }; }
  // 2) C/O NAME
  m = s.match(/\bC\s*\/?\s*O\s+([A-Z][A-Z'-]*(?:\s+[A-Z][A-Z'-]*){0,2})/);
  if (m) { const nm = clean(m[1]); if (nm) return { name: nm, role: 'C/O' }; }
  // 3) ATTN: NAME
  m = s.match(/\bATTN:?\.?\s+([A-Z][A-Z'-]*(?:\s+[A-Z][A-Z'-]*){0,2})/);
  if (m) { const nm = clean(m[1]); if (nm) return { name: nm, role: 'ATTN' }; }
  return null;
}
const ROLE = new Set(['PRES', 'PRESIDENT', 'MGR', 'MANAGER', 'MEMBER', 'MNGM', 'MNGR', 'TRUSTEE',
  'OWNER', 'CEO', 'CFO', 'COO', 'VP', 'DIRECTOR', 'PARTNER', 'PRINCIPAL', 'AGENT']);

// How reliably we expect to resolve a real, reachable contact — i.e. how little paid
// skip-trace this lead needs. Thresholds tuned on the corpus (see build_owner_enrichment.js).
// Thresholds tuned on the corpus: common surnames cluster ~0.37-0.41, so 0.45 cleanly
// separates "common" from "uncommon". Entities resolve a touch more leniently than persons
// (a business name is uniquely findable in the registry with less rarity than a personal
// name needs on the open web).
function confidenceTier({ type, rarity, embedded }, opts = {}) {
  const ENTITY_HI = opts.entityHi ?? 0.50;
  const PERSON_MED = opts.personMed ?? 0.55;
  const PERSON_LOW = opts.personLow ?? 0.45;
  if (embedded) return { tier: 'direct', score: 92, reason: 'contact name in mailing address (free)' };
  switch (type) {
    case 'institution': return { tier: 'skip', score: 0, reason: 'institution / government — not a sales lead' };
    case 'entity':
      return rarity >= ENTITY_HI
        ? { tier: 'high', score: 78, reason: 'distinctive business name → clean Comptroller/registry match' }
        : { tier: 'medium', score: 55, reason: 'business entity, generic name → registry match needs corroboration' };
    case 'trust':
      return { tier: 'medium', score: 50, reason: 'trust/estate → resolve via trustee/heirs (deed, embedded contact)' };
    case 'person':
      if (rarity >= PERSON_MED) return { tier: 'medium', score: 52, reason: 'distinctive personal name → OSINT may resolve' };
      if (rarity >= PERSON_LOW) return { tier: 'low', score: 32, reason: 'common-ish name → verify before contact' };
      return { tier: 'low', score: 15, reason: 'common name → high false-match risk (skip-trace)' };
    default: return { tier: 'low', score: 10, reason: 'unclassified' };
  }
}

module.exports = {
  normalizeName, classifyOwner, significantTokens, rarityFromDF,
  parseEmbeddedContact, confidenceTier, ENTITY_TOKENS,
};
