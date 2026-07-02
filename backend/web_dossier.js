/*
 * WEB DOSSIER — multi-hop cross-reference resolver. Given a seed entity ("NOVA BUILDS LLC"),
 * follow the web thread: entity → principal → their OTHER holding companies → co-principals →
 * contacts, building an operator dossier with PEOPLE, ENTITIES, CONTACTS, CONTEXT/PI, and a
 * synthesized MOTIVATION READ (why they'd sell NOW). Mines search-result titles + snippets
 * (aggregators gate pages but leak the graph in snippets).
 *
 * Anti-drift: entities are expanded only when they're the OPERATOR's (found while searching a
 * PERSON, or sharing a name token with a known principal) — never a random entity off an
 * aggregator's directory page. People are filtered against place/company/brand names.
 *
 * Run on the box:  SERP_PROVIDER=brave SERP_API_KEY=<key> node web_dossier.js "NOVA BUILDS LLC"
 * Env: HUNTER_DB, MAX_SEARCHES (25), SERP_RATE_MS (1200), LOCALITY ("Dallas TX"), THIS_YEAR (2026).
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const serp = require('./lib/serp');
const { classifyOwner, normalizeName, significantTokens } = require('./lib/entity_resolution');
const { looksLikePerson, isGivenName } = require('./lib/llc_breaker');
const { isServiceFirm } = require('./lib/agent_reverse');

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const MAX_SEARCHES = Number(process.env.MAX_SEARCHES || 25);
const RATE_MS = Number(process.env.SERP_RATE_MS || 1200);
const LOCALITY = process.env.LOCALITY || 'Dallas TX';
const THIS_YEAR = Number(process.env.THIS_YEAR || 2026);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const ROLE = /\b(owner|owned by|principal|president|founder|co-?founder|managing member|manager|member|partner|CEO|CFO|director|proprietor|developer|investor|operator|builder|realtor|broker)\b/i;
const ENTITY_RX = /\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'-]*){0,4}\s+(?:LLC|L\.L\.C\.?|INC\b|INCORPORATED|LP\b|L\.P\.?|LTD|CORP))\b/g;
const PHONE_RX = /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g;
const fmtPhone = (s) => { const d = s.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : s.trim(); };
const EMAIL_RX = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const LENDER_RX = /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2}\s+(?:Capital|Funds?|Lending|Fund|Financial))\b/g;
const AGG = /(linkedin|elementix|sfranalytics|buildzoom|bizapedia|rocketreach|dnb\.com|opencorporates|zoominfo|searchpeoplefree|cobaltintelligence|city-data|houzz|corporationwiki|bizprofile|b2bhint|apollo|leadzoom|easyleadz)/i;
// tokens that mean a "Title Case name" is really a place or a company, not a person
const STATES = new Set(['TX', 'CA', 'NY', 'FL', 'GA', 'AZ', 'NV', 'CO', 'WA', 'OR', 'OK', 'LA', 'NM', 'TN', 'NC', 'SC', 'VA', 'OH', 'IL', 'MI', 'PA', 'MA', 'MD', 'MO', 'IN', 'WI', 'MN', 'AL', 'KY', 'AR', 'MS', 'KS', 'UT', 'IA', 'NE']);
const PLACES = new Set(['Dallas', 'Houston', 'Fort', 'Worth', 'Arlington', 'Garland', 'Plano', 'Irving', 'Benbrook', 'Campo', 'Richmond', 'Fulshear', 'Austin', 'Texas', 'Frisco', 'Denton', 'Mesquite', 'Carrollton', 'Lewisville']);
const COMPANYISH = new Set(['Analytics', 'Advisors', 'Advisor', 'Builds', 'Build', 'Homes', 'Home', 'Group', 'Capital', 'Solutions', 'Properties', 'Property', 'Investments', 'Investment', 'Realty', 'Ventures', 'Holdings', 'Partners', 'Development', 'Construction', 'Services', 'Analytics', 'Broadstreet', 'Nova', 'Company', 'Enterprises', 'Management', 'Fund', 'Funds', 'Reit']);
const COMPETENCY = ['custom home', 'home builder', 'homebuilder', 'developer', 'flipper', 'fix and flip', 'buy and hold', 'buy-and-hold', 'landlord', 'rental', 'wholesaler', 'general contractor', 'remodel', 'renovation', 'demolition', 'new construction', 'multifamily'];

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const eKey = (n) => normalizeName(n).replace(/\b(L L C|LLC|INC|LP|LTD|CORP|CO|INCORPORATED)\b/g, '').replace(/\s+/g, ' ').trim();
const pKey = (n) => normalizeName(n).split(' ').filter(t => t.length >= 2).sort().join(' ');

function isProperPerson(name) {
  if (!looksLikePerson(name)) return false;
  const toks = name.split(/\s+/).filter(Boolean);
  for (const t of toks) {
    if (STATES.has(t.toUpperCase())) return false;
    if (PLACES.has(t) || COMPANYISH.has(t)) return false;
  }
  return true;
}

function peopleFrom(title, snippet) {
  const out = [];
  const add = (name, role) => { if (isProperPerson(name)) out.push({ name: name.trim().replace(/\s+/g, ' '), role: role || null, given: significantTokens(name).some(isGivenName) }); };
  for (const seg of title.split(/\s+[-|–—]\s+/)) { const m = seg.trim().match(/^([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,2})$/); if (m) { const r = title.match(ROLE); add(m[1], r ? r[0] : null); } }
  const text = `${title} — ${snippet}`; let m;
  const rx1 = /\b(?:owned by|run by|owner[:\s]+|principal[:\s]+|founded by|led by|developer[:\s]+|by)\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,2})/g;
  while ((m = rx1.exec(text))) add(m[1], 'principal');
  const rx2 = /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,2})(?:,|\s+is|\s+—)?\s+(?:is\s+)?(?:the\s+)?(owner|principal|developer|investor|founder|managing member|president|realtor|broker)\b/g;
  while ((m = rx2.exec(text))) add(m[1], m[2]);
  return out;
}
function entitiesFrom(text) {
  const out = new Set(); let m; ENTITY_RX.lastIndex = 0;
  while ((m = ENTITY_RX.exec(text))) { const e = m[1].trim(); if (eKey(e).length >= 2 && !isServiceFirm(e) && classifyOwner(e) === 'entity') out.add(e); }
  return [...out];
}

(async () => {
  const seed = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ').trim();
  const JSON_OUT = process.argv.includes('--json');
  if (!seed) { console.error('usage: node web_dossier.js "ENTITY NAME" [--json]'); process.exit(1); }
  if (!serp.available()) { if (JSON_OUT) console.log(JSON.stringify({ error: 'SERP_API_KEY not set' })); else console.error('SERP_API_KEY not set'); process.exit(JSON_OUT ? 0 : 1); }
  const db = new sqlite3.Database(DB);
  const all = (s, p = []) => new Promise((r, j) => db.all(s, p, (e, x) => e ? j(e) : r(x)));

  const people = new Map();     // pKey → {name, roles:Set, sources:Set, given}
  const entities = new Map();   // eKey → {name, sources:Set, operator:bool, inRoll, owed}
  const contacts = { phones: new Map(), emails: new Map(), sites: new Map() };
  const ctx = { tenure: new Set(), competency: new Set(), volume: new Set(), lenders: new Set() };
  const anchorTokens = new Set();   // significant tokens of known principals (e.g. MALIACHI)
  const visited = new Set();
  const frontier = [];
  // Multiple query angles per node — thorough beats thrifty (a few cents per extra contact/context).
  const queriesFor = (term, kind) => kind === 'person'
    ? [`"${term}" ${LOCALITY} real estate`, `"${term}" ${LOCALITY} LLC holding company owner`, `"${term}" contact phone email`]
    : [`"${term}" ${LOCALITY} owner principal`, `"${term}" registered agent manager president member`, `"${term}" ${LOCALITY}`];
  const enqueue = (term, kind) => {
    const key = kind === 'person' ? 'P:' + pKey(term) : 'E:' + eKey(term);
    if (!key || visited.has(key)) return; visited.add(key);
    for (const q of queriesFor(term, kind)) frontier.push({ q, term, kind });
  };
  entities.set(eKey(seed), { name: seed, sources: new Set(), operator: true, inRoll: false, owed: 0 });
  enqueue(seed, 'entity');

  let searches = 0;
  while (frontier.length && searches < MAX_SEARCHES) {
    const { q, term, kind } = frontier.shift();
    let results = [];
    try { results = await serp.search(q, { count: 15 }); } catch (e) { process.stderr.write(`  err: ${e.message}\n`); }
    searches++;
    process.stderr.write(`  [${searches}/${MAX_SEARCHES}] ${kind} «${q}» → ${results.length}\n`);

    for (const r of results) {
      const title = r.title || '', snip = r.snippet || '', host = hostOf(r.url || '');
      const text = `${title} — ${snip}`;
      // people — always registered; expand (search next) if a proper person
      for (const p of peopleFrom(title, snip)) {
        const k = pKey(p.name); if (!k) continue;
        let e = people.get(k); if (!e) { e = { name: p.name, roles: new Set(), sources: new Set(), given: p.given, verified: false }; people.set(k, e); }
        if (p.role) e.roles.add(p.role); e.sources.add(host); e.given = e.given || p.given;
        significantTokens(p.name).forEach(t => anchorTokens.add(t));
        // expand a person if they have a real first name OR a stated role (catches non-Western
        // given names like "Kashetu Usman" when they're named as owner/principal/agent)
        if (p.given || p.role) enqueue(p.name, 'person');
      }
      // entities — expand ONLY if operator-linked (found via a person search, or token-shared
      // with a known principal). Otherwise list as peripheral (no expand → no aggregator drift).
      for (const en of entitiesFrom(text)) {
        const k = eKey(en); if (!k || k === eKey(term)) continue;
        const tokens = significantTokens(en);
        const operatorLinked = kind === 'person' || tokens.some(t => anchorTokens.has(t));
        let e = entities.get(k);
        if (!e) { e = { name: en, sources: new Set(), operator: operatorLinked, inRoll: false, owed: 0 }; entities.set(k, e); }
        e.operator = e.operator || operatorLinked; e.sources.add(host);
        if (operatorLinked) enqueue(en, 'entity');
      }
      // contacts — prefer official (non-aggregator) hosts
      const official = host && !AGG.test(host);
      for (const m of snip.matchAll(PHONE_RX)) { const ph = fmtPhone(m[0]); if (/^\(\d{3}\)/.test(ph)) contacts.phones.set(ph, host); }
      for (const m of text.matchAll(EMAIL_RX)) if (!/\.(png|jpg|gif|svg)$/i.test(m[0]) && !/example\./.test(m[0])) contacts.emails.set(m[0].toLowerCase(), host);
      if (official && /\.(com|net|io|co|build|homes)$/.test(host) && !/gov|dallas|texas\.gov/i.test(host)) contacts.sites.set(host, r.url);
      // context (skip aggregator mega-totals)
      let m;
      if ((m = text.match(/\b(?:since|incorporated|founded|established|est\.?)\s+(?:\w+\s+)?((?:19|20)\d{2})\b/i))) ctx.tenure.add(`since ${m[1]}`);
      if ((m = text.match(/\b((?:19|20)\d{2})\s*[-–—]\s*((?:19|20)\d{2})\b/))) ctx.tenure.add(`${m[1]}–${m[2]}`);
      for (const c of COMPETENCY) if (text.toLowerCase().includes(c)) ctx.competency.add(c);
      for (const mm of text.matchAll(/\$[\d][\d.,]*\s*(?:M\b|million|K\b)?/g)) { const v = mm[0]; const num = parseFloat(v.replace(/[^\d.]/g, '')); if (!(/[\d.]{10,}/.test(v)) && num > 0) ctx.volume.add(v.trim()); }
      for (const mm of text.matchAll(/\b(\d{1,3})\s+(?:properties|homes|units|acquisitions|mortgages)\b/gi)) ctx.volume.add(mm[0].trim());
      LENDER_RX.lastIndex = 0; let l;
      while ((l = LENDER_RX.exec(text))) { const nm = l[1].trim(); if (!/real estate|holding|investments?|properties|nova|maliachi/i.test(nm)) ctx.lenders.add(nm); }
    }
    await sleep(RATE_MS);
  }

  // cross-reference operator entities against our OWN data: the delinquent roll (is it a lead?)
  // and the Comptroller registry (its officers/agent — a free, authoritative co-principal source).
  const addReg = (name, role) => {
    if (!name || !isProperPerson(name)) return;
    const k = pKey(name); let e = people.get(k);
    if (!e) { e = { name, roles: new Set(), sources: new Set(), given: significantTokens(name).some(isGivenName), verified: true }; people.set(k, e); }
    e.verified = true; e.sources.add('TX Comptroller'); if (role) e.roles.add(role);
  };
  const hasReg = (await all("SELECT name FROM sqlite_master WHERE type='table' AND name='entity_registry'")).length;
  for (const [k, e] of entities) {
    if (!e.operator) continue;
    const rows = await all(`SELECT SUM(COALESCE(delinquent_amount,0)) owed, COUNT(*) n FROM tax_roll
      WHERE is_delinquent=1 AND REPLACE(REPLACE(REPLACE(UPPER(owner_name),' LLC',''),' INC',''),' LP','') LIKE ?`, [`%${k}%`]);
    if (rows[0] && rows[0].n > 0) { e.inRoll = true; e.owed = rows[0].owed || 0; }
    if (hasReg) {
      const regs = await all(`SELECT contact_name, registered_agent, officers_json FROM entity_registry
        WHERE REPLACE(REPLACE(REPLACE(UPPER(query_name),' LLC',''),' INC',''),' LP','') LIKE ?`, [`%${k}%`]);
      for (const g of regs) {
        addReg(g.contact_name, 'contact'); addReg(g.registered_agent, 'reg agent');
        try { for (const o of JSON.parse(g.officers_json || '[]')) addReg(o.name, o.title || 'officer'); } catch (_) {}
      }
    }
  }
  await new Promise(res => db.close(res));

  // ---- Motivation read ----
  const topPerson = [...people.values()].filter(p => p.given || p.verified).sort((a, b) => (b.verified - a.verified) || (b.sources.size - a.sources.size))[0];
  const opEnts = [...entities.values()].filter(e => e.operator);
  const rollEnts = opEnts.filter(e => e.inRoll);
  const seedOwed = entities.get(eKey(seed))?.owed || 0;
  const recentT = [...ctx.tenure].filter(t => { const y = +(t.match(/((?:19|20)\d{2})/) || [])[1]; return y && y >= THIS_YEAR - 4; });
  const capitalHeavy = [...ctx.competency].filter(c => /custom home|new construction|developer|multifamily/.test(c));

  const bits = [];
  if (topPerson) bits.push(`${topPerson.name} runs ${opEnts.length} linked entit${opEnts.length === 1 ? 'y' : 'ies'}`);
  if (recentT.length && capitalHeavy.length) bits.push(`recently expanded into capital-heavy work (${capitalHeavy.join('/')}, ${recentT.join(', ')})`);
  else if (capitalHeavy.length) bits.push(`capital-heavy focus (${capitalHeavy.join('/')})`);
  if (ctx.lenders.size) bits.push(`levered via ${[...ctx.lenders].slice(0, 3).join(', ')}`);
  if (seedOwed) bits.push(`this property (${seed}) is $${Math.round(seedOwed).toLocaleString()} delinquent`);
  const angle = (seedOwed && (recentT.length || capitalHeavy.length))
    ? 'Likely over-extended on newer/capital-heavy projects; this delinquent parcel is a candidate to liquidate for cash. Strong motivated-seller angle.' : null;

  // ---- Structured dossier (for the API / --json) ----
  const dossier = {
    seed, searches,
    principals: [...people.values()].filter(p => p.given || p.verified).sort((a, b) => (b.verified - a.verified) || (b.sources.size - a.sources.size))
      .map(p => ({ name: p.name, verified: !!p.verified, roles: [...p.roles], sources: [...p.sources] })),
    maybePeople: [...people.values()].filter(p => !p.given && !p.verified).map(p => p.name),
    entities: opEnts.sort((a, b) => (b.inRoll - a.inRoll) || (b.owed - a.owed)).map(e => ({ name: e.name, inRoll: !!e.inRoll, owed: Math.round(e.owed || 0), sources: [...e.sources] })),
    contacts: {
      phones: [...contacts.phones].map(([value, source]) => ({ value, source })),
      emails: [...contacts.emails].map(([value, source]) => ({ value, source })),
      sites: [...contacts.sites].map(([v]) => v).slice(0, 6),
    },
    context: { tenure: [...ctx.tenure], competency: [...ctx.competency], lenders: [...ctx.lenders], volume: [...ctx.volume].slice(0, 10) },
    motivation: { summary: bits.join('; '), angle },
  };
  if (JSON_OUT) { console.log(JSON.stringify(dossier)); return; }

  // ---- Report ----
  const S = (set) => [...set].join(', ');
  console.log(`\n══════════ WEB DOSSIER: ${seed} ══════════`);
  console.log(`(${searches} searches)\n`);
  console.log('PRINCIPAL(S):');
  [...people.values()].filter(p => p.given || p.verified).sort((a, b) => (b.verified - a.verified) || (b.sources.size - a.sources.size))
    .forEach(p => console.log(`  • ${p.name}${p.verified ? ' ✓' : ''} — ${S(p.roles) || 'role?'}   [${S(p.sources)}]`));
  const maybe = [...people.values()].filter(p => !p.given && !p.verified);
  if (maybe.length) console.log('  (unconfirmed given-name: ' + maybe.map(p => p.name).join(', ') + ')');
  console.log('\nOPERATOR ENTITIES (★ = in our delinquent roll):');
  opEnts.sort((a, b) => (b.inRoll - a.inRoll) || (b.owed - a.owed))
    .forEach(e => console.log(`  ${e.inRoll ? '★' : ' '} ${e.name}${e.owed ? `  ($${Math.round(e.owed).toLocaleString()} owed)` : ''}   [${S(e.sources)}]`));
  console.log('\nCONTACTS:');
  [...contacts.phones].slice(0, 6).forEach(([v, s]) => console.log(`  ☎ ${v}   [${s}]`));
  [...contacts.emails].slice(0, 6).forEach(([v, s]) => console.log(`  ✉ ${v}   [${s}]`));
  [...contacts.sites].slice(0, 5).forEach(([v]) => console.log(`  🌐 ${v}`));
  console.log('\nCONTEXT / PI:');
  if (ctx.tenure.size) console.log(`  tenure:     ${S(ctx.tenure)}`);
  if (ctx.competency.size) console.log(`  competency: ${S(ctx.competency)}`);
  if (ctx.lenders.size) console.log(`  lenders:    ${S(ctx.lenders)}`);
  if (ctx.volume.size) console.log(`  volume:     ${[...ctx.volume].slice(0, 10).join(', ')}`);
  console.log('\nMOTIVATION READ (hypothesis — verify):');
  if (bits.length) { console.log('  ' + bits.join('; ') + '.'); if (angle) console.log('  → ' + angle); }
  else console.log('  (insufficient signal)');
  console.log('');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
