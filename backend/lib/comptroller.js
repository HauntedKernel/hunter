/*
 * Texas Comptroller — Franchise Tax Account Status (FTAS) resolver. Tier-1 of the OSINT
 * ladder (RESEARCH / SIGNAL_GAPS): turn a distinctive ENTITY owner ("Tapper Investments
 * LLC") into the people on public record behind it — registered agent, officers, status —
 * for FREE, before paying for skip-trace.
 *
 * Official public API (free, self-service key — register for an x-api-key at
 * https://data-secure.comptroller.texas.gov/main/my-profile?section=developer):
 *   GET .../public-data/v1/public/franchise-tax-list?name=<NAME>   → search (list)
 *   GET .../public-data/v1/public/franchise-tax/<taxpayerId>       → detail + officerInfo[]
 *   header: x-api-key: <TX_CPA_API_KEY>
 *
 * GATED + GRACEFUL: with no key, available() is false and callers no-op (like the skip-trace
 * stub) — ships now, lights up when the key is set. Field names verified against the official
 * OpenAPI schema (FranchiseAccountWithOfficers / FranchiseAccountOfficer).
 */
const https = require('https');
const { normalizeName, classifyOwner, significantTokens } = require('./entity_resolution');

const HOST = 'api.comptroller.texas.gov';
const BASE = '/public-data/v1/public/franchise-tax';
const SEARCH = `${BASE}-list`;     // GET ?name= | ?taxpayerId= | ?fileNumber=  → FTAS search (list)
const DETAIL = BASE;               // GET /{id}  → franchise account + officerInfo[] (detail)
const KEY = process.env.TX_CPA_API_KEY || '';

function available() { return !!KEY; }

function httpGet(pathWithQuery) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: HOST, path: pathWithQuery, method: 'GET',
      headers: { 'x-api-key': KEY, 'Accept': 'application/json' } }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error(`bad JSON: ${buf.slice(0, 120)}`)); }
        } else if (res.statusCode === 404) {
          resolve(null);                                  // no such entity
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 160)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

// Pick a value from an object trying several likely key spellings (the API's exact field
// names aren't documented publicly; confirm with --debug).
function pick(obj, ...keys) {
  if (!obj) return null;
  for (const k of keys) {
    for (const cand of [k, k.toLowerCase(), k.toUpperCase()]) {
      if (obj[cand] != null && obj[cand] !== '') return obj[cand];
    }
  }
  return null;
}

// Join the API's split address fields (e.g. mailingAddress{Street,City,State,Zip}).
function joinAddr(r, prefix) {
  const parts = [pick(r, prefix + 'Street'), pick(r, prefix + 'City'), pick(r, prefix + 'State'), pick(r, prefix + 'Zip')].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// Normalize one FTAS record into our shape. Field names verified against the official
// OpenAPI schema (FranchiseAccountWithOfficers / FranchiseAccountOfficer). The list
// endpoint omits officerInfo; the /{id} detail endpoint includes it.
function extractRecord(r) {
  if (!r) return null;
  const officersRaw = r.officerInfo || r.officers || [];
  const officers = (Array.isArray(officersRaw) ? officersRaw : []).map(o => ({
    name: pick(o, 'AGNT_NM', 'name'),
    title: pick(o, 'AGNT_TITL_TX', 'title'),
  })).filter(o => o.name);
  const agentName = pick(r, 'registeredAgentName');
  return {
    taxpayerId: pick(r, 'taxpayerId', 'taxpayerNumber'),
    entityName: pick(r, 'name', 'taxpayerName'),
    status: pick(r, 'rightToTransactTX', 'status'),                 // "ACTIVE" / "NOT ACTIVE" etc.
    registeredAgent: agentName ? {
      name: agentName,
      address: joinAddr(r, 'registeredOfficeAddress'),
      isLikelyPrincipal: classifyOwner(agentName) === 'person',     // a person agent ≈ the owner; a service ≠
    } : null,
    officers,
    mailingAddress: joinAddr(r, 'mailingAddress'),
    sosFileNumber: pick(r, 'sosFileNumber'),
  };
}

async function searchByName(name) {
  if (!available()) return [];
  const data = await httpGet(`${SEARCH}?name=${encodeURIComponent(name)}`);
  // Responses are wrapped: { success, data: [...] } (list) — handle array/object/data shapes.
  const arr = Array.isArray(data) ? data : (data?.data || data?.results || (data ? [data] : []));
  return (Array.isArray(arr) ? arr : []).map(extractRecord).filter(r => r && r.entityName);
}

// Choose the best candidate for OUR entity using the same confidence philosophy as the
// backbone: exact-ish name match + active status + address corroboration ⇒ high confidence;
// multiple equally-plausible matches ⇒ ambiguous (don't assert). Pure function — testable
// without the network. Returns { record, matchConfidence, ambiguous, reason } | null.
function pickBestMatch(ourName, ourAddr, candidates) {
  if (!candidates || !candidates.length) return null;
  const target = normalizeName(ourName);
  const ourZip = (String(ourAddr || '').match(/\b(7\d{4})\b/) || [])[1];
  const ourTokens = new Set(significantTokens(ourName));
  const scored = candidates.map(c => {
    const cn = normalizeName(c.entityName);
    let s = 0; const why = [];
    if (cn === target) { s += 60; why.push('exact name'); }
    else {
      const ct = new Set(significantTokens(c.entityName));
      const overlap = [...ourTokens].filter(t => ct.has(t)).length;
      const union = new Set([...ourTokens, ...ct]).size || 1;
      const jac = overlap / union;
      s += Math.round(jac * 45); if (jac >= 0.5) why.push('name overlap');
    }
    const st = String(c.status || '').toUpperCase();   // e.g. "ACTIVE" vs "FRANCHISE TAX INVOLUNTARILY ENDED"
    const active = st.includes('ACTIVE') && !st.includes('NOT ACTIVE') && !st.includes('INACTIVE') && !st.includes('ENDED') && !st.includes('FORFEIT');
    if (active) { s += 15; why.push('active'); }
    const cZip = (String(c.mailingAddress || c.registeredAgent?.address || '').match(/\b(7\d{4})\b/) || [])[1];
    if (ourZip && cZip && ourZip === cZip) { s += 25; why.push('zip match'); }
    // A distinctive name with exactly ONE hit in the registry is the entity — no
    // collision to disambiguate (the list endpoint omits status/zip, so credit this
    // so a sole exact match clears the detail-fetch threshold).
    if (cn === target && candidates.length === 1) { s += 25; why.push('sole exact match'); }
    return { record: c, score: s, why };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];
  // Ambiguous if the top two are close AND neither is an exact+corroborated match.
  const ambiguous = runnerUp && (best.score - runnerUp.score) < 20 && best.score < 80;
  return {
    record: best.record,
    matchConfidence: Math.max(0, Math.min(100, best.score)),
    ambiguous: !!ambiguous,
    reason: best.why.join(' + ') || 'weak match',
  };
}

async function getById(id) {
  if (!available() || !id) return null;
  const data = await httpGet(`${DETAIL}/${encodeURIComponent(id)}`);
  return extractRecord(data?.data || data);                          // detail is wrapped too
}

async function resolveEntity(ownerName, ownerAddr) {
  if (!available()) return { configured: false };
  const candidates = await searchByName(ownerName);
  const match = pickBestMatch(ownerName, ownerAddr, candidates);
  // The list endpoint omits officers; for a confident, non-ambiguous match fetch the
  // /{id} detail to pull officerInfo[] (the actual people).
  if (match && match.record?.taxpayerId && !match.ambiguous && match.matchConfidence >= 70) {
    try { const detail = await getById(match.record.taxpayerId); if (detail) match.record = detail; } catch (_) { /* keep list record */ }
  }
  return { configured: true, candidates: candidates.length, match };
}

module.exports = { available, searchByName, getById, extractRecord, pickBestMatch, resolveEntity };
