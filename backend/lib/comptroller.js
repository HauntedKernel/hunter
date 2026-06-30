/*
 * Texas Comptroller — Franchise Tax Account Status (FTAS) resolver. Tier-1 of the OSINT
 * ladder (RESEARCH / SIGNAL_GAPS): turn a distinctive ENTITY owner ("Tapper Investments
 * LLC") into the people on public record behind it — registered agent, officers, status —
 * for FREE, before paying for skip-trace.
 *
 * Official public API (free, but key-gated — register for an x-api-key at
 * https://api-doc.comptroller.texas.gov/public-data/):
 *   GET https://api.comptroller.texas.gov/public-data/v1/public/franchise-tax?name=<NAME>
 *   GET https://api.comptroller.texas.gov/public-data/v1/public/franchise-tax/<taxpayerId>
 *   header: x-api-key: <TX_CPA_API_KEY>
 *
 * GATED + GRACEFUL: with no key, available() is false and callers no-op (like the skip-trace
 * stub) — ships now, lights up when the key is set. The response field mapping is defensive
 * (tries camel/snake/Title variants); run resolve_entities.js --debug once with a real key to
 * confirm the exact field names, then tighten extractRecord() if needed.
 */
const https = require('https');
const { normalizeName, classifyOwner, significantTokens } = require('./entity_resolution');

const HOST = 'api.comptroller.texas.gov';
const BASE = '/public-data/v1/public/franchise-tax';
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

// Normalize one FTAS record into our shape (defensive across field-name variants).
function extractRecord(r) {
  const officersRaw = pick(r, 'officersDirectors', 'officers', 'officersAndDirectors', 'directors', 'management') || [];
  const officers = (Array.isArray(officersRaw) ? officersRaw : []).map(o => ({
    name: pick(o, 'name', 'officerName', 'fullName', 'personName'),
    title: pick(o, 'title', 'role', 'officerTitle', 'position'),
  })).filter(o => o.name);
  const agentName = pick(r, 'registeredAgentName', 'registeredAgent', 'agentName', 'raName');
  return {
    taxpayerId: pick(r, 'taxpayerNumber', 'taxpayerId', 'taxpayerNbr', 'id'),
    entityName: pick(r, 'taxpayerName', 'name', 'entityName', 'legalName', 'businessName'),
    status: pick(r, 'rightToTransactBusiness', 'status', 'taxpayerStatus', 'accountStatus', 'rightToTransact'),
    registeredAgent: agentName ? {
      name: agentName,
      address: pick(r, 'registeredOfficeAddress', 'registeredAgentAddress', 'agentAddress', 'raAddress'),
      isLikelyPrincipal: classifyOwner(agentName) === 'person',   // a person agent ≈ the owner; a service ≠
    } : null,
    officers,
    mailingAddress: pick(r, 'mailingAddress', 'address', 'taxpayerAddress'),
    sosFileNumber: pick(r, 'sosFileNumber', 'fileNumber', 'sosNbr'),
  };
}

async function searchByName(name) {
  if (!available()) return [];
  const data = await httpGet(`${BASE}?name=${encodeURIComponent(name)}`);
  // Response may be an array, or { results: [...] } / { data: [...] } — handle all.
  const arr = Array.isArray(data) ? data : (data?.results || data?.data || (data ? [data] : []));
  return arr.map(extractRecord).filter(r => r.entityName);
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
    const active = /ACTIVE|RIGHT TO TRANSACT|FRANCHISE/i.test(String(c.status || '')) && !/NOT ACTIVE|FORFEIT|INACTIVE/i.test(String(c.status || ''));
    if (active) { s += 15; why.push('active'); }
    const cZip = (String(c.mailingAddress || c.registeredAgent?.address || '').match(/\b(7\d{4})\b/) || [])[1];
    if (ourZip && cZip && ourZip === cZip) { s += 25; why.push('zip match'); }
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

async function resolveEntity(ownerName, ownerAddr) {
  if (!available()) return { configured: false };
  const candidates = await searchByName(ownerName);
  const match = pickBestMatch(ownerName, ownerAddr, candidates);
  return { configured: true, candidates: candidates.length, match };
}

module.exports = { available, searchByName, getById: (id) => httpGet(`${BASE}/${encodeURIComponent(id)}`).then(extractRecord), extractRecord, pickBestMatch, resolveEntity };
