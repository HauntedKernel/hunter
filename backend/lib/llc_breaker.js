/*
 * LLC-BREAKER (open-web leg) — mine person hints behind an entity from SEARCH-RESULT SNIPPETS.
 *
 * For the LLCs the Comptroller couldn't resolve (agent-service shells, holding companies), a
 * plain web search still surfaces the principal in the result snippets. This module turns those
 * snippets into CANDIDATE contacts with a confidence score and — critically, per our privacy
 * posture (Scope B) — a SOURCE URL for every hint. Output is treated as a low-confidence HINT,
 * never asserted as fact: we expose it, cite where it came from, and let the agent verify.
 *
 * The miner is PURE (snippets in → hints out) so it self-tests offline; resolveByWeb() wires it
 * to lib/serp.js. Corroboration raises confidence: a candidate surname that also appears in the
 * entity name ("Faucher" in "Faucher Holdings" → "Madison Faucher"), or that matches a
 * Comptroller officer/agent we already cached, is far more trustworthy than a lone snippet.
 */
const { normalizeName, classifyOwner, significantTokens } = require('./entity_resolution');

// Title-case person name: 2-3 words, optional middle initial. Snippets preserve case, unlike
// our uppercase owner data — exploit that to find "Dino Tapper", "Madison Faucher".
const NAME_RX = /\b([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+){1,2})\b/g;
// Role cues that, near a name, mean "this is the principal".
const ROLE_CUE = /\b(owner|owned by|principal|president|founder|managing member|manager|member|partner|registered agent|agent for|CEO|CFO|director|proprietor|operated by|run by)\b/i;
// Title-case tokens that look like names but aren't (places / business words / boilerplate).
const NON_NAME = new Set(['Dallas', 'Texas', 'Fort', 'Worth', 'Arlington', 'Garland', 'Plano',
  'North', 'South', 'East', 'West', 'United', 'States', 'America', 'County', 'City', 'Real',
  'Estate', 'Investments', 'Investment', 'Holdings', 'Holding', 'Group', 'Company', 'Properties',
  'Property', 'Capital', 'Ventures', 'Partners', 'Management', 'Services', 'Solutions', 'Board',
  'Member', 'Owner', 'President', 'Manager', 'Limited', 'Liability', 'Corporation', 'Profile',
  'Business', 'Contact', 'Reviews', 'Read', 'Get', 'Information', 'Search', 'Home', 'Single',
  'Family', 'Residential', 'Building', 'Project', 'License', 'Sign', 'Texas', 'New', 'Get',
  // role words & PDF/boilerplate noise that surface as title-case "names"
  'Partner', 'Founding', 'Principal', 'Proprietor', 'Founder', 'Managing', 'Registered',
  'Agent', 'Reply', 'Label', 'Systems', 'Leasing', 'Automated', 'Retail', 'Prime', 'Enterprises',
  // common business / brand / web-noise tokens that pair with a surname to fake a "name"
  'Sports', 'Careers', 'Career', 'Medical', 'Care', 'Insurance', 'Financial', 'Title', 'Tax',
  'Taxes', 'Construction', 'Automotive', 'Auto', 'Motors', 'Motor', 'Industrial', 'Industries',
  'Restaurant', 'Restaurants', 'Discount', 'Stores', 'Store', 'Shuttle', 'Trophies', 'Dance',
  'Galleries', 'Gallery', 'Legacy', 'Premium', 'Select', 'Total', 'National', 'American', 'Southern',
  'Northern', 'Black', 'Diamond', 'Build', 'Equip', 'Thrive', 'Forward', 'Moving', 'Integrity',
  'Creditor', 'Appellee', 'Appellant', 'Plaintiff', 'Defendant', 'Tractor', 'Pain', 'Consultants',
  'Consultant', 'Energy', 'Staffing', 'Risk', 'Mana', 'Sate', 'Sales', 'Marketing', 'Wireless',
  'Telecom', 'Pharmacy', 'Laboratories', 'Toxicology', 'Wayfair', 'Amazon', 'Academy', 'Papa',
  'Street', 'Avenue', 'Road', 'Drive', 'Lane', 'Suite', 'Office', 'Offices', 'Customer', 'Support',
  'Apartments', 'Apartment', 'Rentals', 'Realty', 'Mortgage', 'Bank', 'Trust', 'Fund', 'Equity',
  'Development', 'Developers', 'Acquisitions', 'Trucking', 'Logistics', 'Transport', 'Express']);

// Common given names — the discriminator for PROMOTION. "Tom Cusick" (Tom ∈ names) is a real
// principal; "Sales Timberlake" / "Academy Sports" are not. A multicultural common-name set
// (incl. Hispanic & South-Asian, reflecting Dallas owners). Names NOT here can still surface as
// HINTS, just never auto-asserted as the contact — precision over recall on promotion.
const FIRST_NAMES = new Set(['James','John','Robert','Michael','William','David','Richard','Joseph',
  'Thomas','Charles','Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul',
  'Andrew','Joshua','Kenneth','Kevin','Brian','George','Timothy','Ronald','Edward','Jason','Jeffrey',
  'Ryan','Jacob','Gary','Nicholas','Eric','Jonathan','Stephen','Larry','Justin','Scott','Brandon',
  'Benjamin','Samuel','Gregory','Frank','Alexander','Raymond','Patrick','Jack','Dennis','Jerry',
  'Tyler','Aaron','Jose','Adam','Henry','Nathan','Douglas','Zachary','Peter','Kyle','Walter','Ethan',
  'Jeremy','Harold','Keith','Christian','Roger','Noah','Gerald','Carl','Terry','Sean','Austin','Arthur',
  'Lawrence','Jesse','Dylan','Bryan','Joe','Jordan','Billy','Bruce','Albert','Willie','Gabriel','Logan',
  'Alan','Juan','Wayne','Roy','Ralph','Randy','Eugene','Vincent','Russell','Louis','Philip','Bobby',
  'Johnny','Bradley','Clay','Cary','Dan','Tom','Tim','Jim','Bob','Bill','Rick','Mike','Dave','Steve',
  'Ken','Ron','Don','Ed','Greg','Jeff','Chris','Matt','Nick','Tony','Pedro','Rogelio','Rolando','Rodney',
  'Barrett','Mary','Patricia','Jennifer','Linda','Elizabeth','Barbara','Susan','Jessica','Sarah','Karen',
  'Lisa','Nancy','Betty','Margaret','Sandra','Ashley','Kimberly','Emily','Donna','Michelle','Carol',
  'Amanda','Dorothy','Melissa','Deborah','Stephanie','Rebecca','Sharon','Laura','Cynthia','Angela',
  'Maria','Carmen','Rosa','Ana','Luis','Carlos','Jorge','Miguel','Manuel','Roberto','Francisco','Javier',
  'Ricardo','Eduardo','Sergio','Hector','Raul','Alberto','Arturo','Salim','Sanjeev','Sharjeel','Rohan',
  'Prathap','Viswanath','Rajesh','Anil','Sunil','Vijay','Amit','Ravi','Suresh','Mohammed','Ahmed','Ali',
  'Hassan','Omar','Yusuf','Ibrahim','Angela','Phuc','Minh','Hung','Tuan','Nguyen','Dino','Lee','Madison']);
function isGivenName(tok) { return FIRST_NAMES.has(tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase()); }

// Court / litigation aggregators — a hit here is a bonus distress signal, not a contact.
const COURT_HOSTS = /(unicourt|trellis\.law|courtlistener|casetext|pacermonitor|justia|docketbird|plainsite)/i;

function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

function looksLikePerson(name) {
  const toks = name.split(/\s+/).filter(Boolean);
  if (toks.length < 2 || toks.length > 3) return false;
  // every alphabetic token must not be a known non-name word
  if (toks.some(t => NON_NAME.has(t))) return false;
  return classifyOwner(name) === 'person';
}

// Mine one batch of search results for an entity. Pure. Returns:
//   { candidates:[{name, role, score, sources:[url], signals:[...]}], phones:[], litigation:[url], ambiguous }
function mineSnippets(entityName, ownerAddr, results, { officerNames = [] } = {}) {
  const entityTokens = new Set(significantTokens(entityName));               // e.g. {FAUCHER}
  const officerKeys = new Set(officerNames.map(n => normalizeName(n)));
  const cand = new Map();   // normalizedName → {name, roles:Set, score, sources:Set, signals:Set}
  const phones = new Set();
  const litigation = new Set();

  for (const r of results || []) {
    const text = `${r.title || ''} — ${r.snippet || ''}`;
    const host = hostOf(r.url || '');
    if (COURT_HOSTS.test(host) || COURT_HOSTS.test(text)) litigation.add(r.url || host);
    for (const m of text.matchAll(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g)) phones.add(m[0].trim());

    for (const m of text.matchAll(NAME_RX)) {
      const name = m[1].trim();
      if (!looksLikePerson(name)) continue;
      const norm = normalizeName(name);
      const nameTokens = new Set(significantTokens(name));
      // Reject the ENTITY NAME echoed back as a "person" ("Redbox Automated Retail",
      // "One Prime") — a real principal contributes a personal-name token the company name
      // doesn't have. If every candidate token is already in the entity name, it's the
      // company restated, not a person behind it.
      const newTokens = [...nameTokens].filter(t => !entityTokens.has(t));
      if (nameTokens.size > 0 && newTokens.length === 0) continue;
      // proximity: is a role cue within ~40 chars of this name mention?
      const at = m.index;
      const window = text.slice(Math.max(0, at - 45), at + name.length + 45);
      const hasRole = ROLE_CUE.test(window);
      const roleM = window.match(ROLE_CUE);
      const sharesEntityToken = [...nameTokens].some(t => entityTokens.has(t));
      const matchesOfficer = officerKeys.has(norm);
      // Only keep names that have SOME tie to the entity — a role cue, a shared surname, or a
      // Comptroller officer match. A bare name in a snippet is noise.
      if (!hasRole && !sharesEntityToken && !matchesOfficer) continue;

      // A real principal's non-company token is a GIVEN NAME ("Tom" in "Tom Cusick"). Junk like
      // "Sales Timberlake" / "Academy Sports" has no given name → never trusted enough to assert.
      const hasGivenName = newTokens.some(t => isGivenName(t));

      let e = cand.get(norm);
      if (!e) { e = { name, roles: new Set(), score: 0, sources: new Set(), signals: new Set() }; cand.set(norm, e); }
      e.sources.add(r.url || host);
      if (roleM) e.roles.add(roleM[0].toUpperCase());
      if (hasRole) e.signals.add('role-cue');
      if (sharesEntityToken) e.signals.add('surname-in-entity');
      if (matchesOfficer) e.signals.add('matches-comptroller-officer');
      if (hasGivenName) e.signals.add('given-name');
    }
  }

  // Score each candidate. Corroboration compounds; a lone role-cue snippet stays low.
  const candidates = [...cand.values()].map(e => {
    let s = 0;
    if (e.signals.has('surname-in-entity')) s += 38;
    if (e.signals.has('matches-comptroller-officer')) s += 30;
    if (e.signals.has('role-cue')) s += 34;
    if (e.sources.size >= 2) s += 16;                          // multiple independent pages agree
    return {
      name: e.name,
      role: [...e.roles][0] || null,
      score: Math.min(90, s),
      sources: [...e.sources].slice(0, 4),
      signals: [...e.signals],
    };
  }).filter(c => c.score >= 40).sort((a, b) => b.score - a.score);

  // Ambiguous if the top two are close and distinct people (e.g. Faucher: Madison vs Mark vs
  // Justin) — surface all as hints but don't promote one to "the contact".
  const ambiguous = candidates.length >= 2 && (candidates[0].score - candidates[1].score) < 18;

  return { candidates, phones: [...phones].slice(0, 4), litigation: [...litigation].slice(0, 4), ambiguous };
}

// Build the search query for an entity (name + locality hint from the mailing ZIP/city).
function buildQuery(entityName, ownerAddr) {
  const cityZip = (String(ownerAddr || '').match(/\b(7\d{4})\b/) || [])[1] || '';
  return `"${entityName}" Dallas Texas owner principal ${cityZip}`.trim();
}

// resolveByWeb — async: search the open web, mine the snippets. Returns the mine result plus
// the query and raw result count for auditing. Caller (break_llcs.js) decides what to persist.
async function resolveByWeb(serp, entityName, ownerAddr, { officerNames = [], count = 10 } = {}) {
  if (!serp.available()) return { configured: false, candidates: [], phones: [], litigation: [], ambiguous: false };
  const query = buildQuery(entityName, ownerAddr);
  let results = [];
  try { results = await serp.search(query, { count }); } catch (e) { return { configured: true, error: e.message, candidates: [], phones: [], litigation: [], ambiguous: false }; }
  const mined = mineSnippets(entityName, ownerAddr, results, { officerNames });
  return { configured: true, query, resultCount: results.length, ...mined };
}

// Promotion bar (shared by the live path and offline cleanup): only ASSERT a web contact when
// it's a single, non-ambiguous, strong hit corroborated either by a Comptroller officer match OR
// by BOTH a shared surname AND a real given name. "Tom Cusick" ⇐ "Thomas Cusick Custom Homes"
// promotes; "Sales Timberlake" / "Academy Sports" never do.
function isPromotable(top, ambiguous) {
  if (!top || ambiguous || (top.score || 0) < 60) return false;
  const sig = top.signals || [];
  return sig.includes('matches-comptroller-officer') ||
    (sig.includes('surname-in-entity') && sig.includes('given-name'));
}

// Re-score STORED candidates (llc_breaks.candidates_json) against the current, stricter rules —
// lets us clean up past mining runs offline (no re-querying). Recomputes surname/given-name
// signals from the candidate name vs the entity name; keeps role-cue / officer-match as recorded.
function revalidateStored(entityName, storedCandidates) {
  const entityTokens = new Set(significantTokens(entityName));
  const cleaned = (storedCandidates || []).map(c => {
    if (!c || !c.name || !looksLikePerson(c.name)) return null;
    const nameTokens = new Set(significantTokens(c.name));
    const newTokens = [...nameTokens].filter(t => !entityTokens.has(t));
    if (nameTokens.size > 0 && newTokens.length === 0) return null;          // entity-name echo
    const sig = new Set((c.signals || []).filter(s => s === 'role-cue' || s === 'matches-comptroller-officer'));
    if ([...nameTokens].some(t => entityTokens.has(t))) sig.add('surname-in-entity');
    if (newTokens.some(t => isGivenName(t))) sig.add('given-name');
    let s = 0;
    if (sig.has('surname-in-entity')) s += 38;
    if (sig.has('matches-comptroller-officer')) s += 30;
    if (sig.has('role-cue')) s += 34;
    if ((c.sources || []).length >= 2) s += 16;
    return { ...c, signals: [...sig], score: Math.min(90, s) };
  }).filter(Boolean).filter(c => c.score >= 40).sort((a, b) => b.score - a.score);
  const ambiguous = cleaned.length >= 2 && (cleaned[0].score - cleaned[1].score) < 18;
  const top = cleaned[0] || null;
  return { candidates: cleaned, top, ambiguous, promotable: isPromotable(top, ambiguous) };
}

module.exports = { mineSnippets, buildQuery, resolveByWeb, looksLikePerson, isGivenName, isPromotable, revalidateStored };
