/*
 * Pluggable web-search provider — the "open web" leg of the LLC-breaker (lib/llc_breaker.js).
 * The county assumed-name index is paywalled/scrape-resistant, but a plain search surfaces the
 * person behind an LLC right in the result snippets (verified: "Tapper Investments" → "owned by
 * Dino Tapper", "Faucher Holdings" → "Madison Faucher is the Board Member"). We mine SNIPPETS
 * only — never the gated page bodies — so this stays a normal search-API consumer.
 *
 * GATED + GRACEFUL (same pattern as comptroller.js): with no key available() is false and the
 * breaker no-ops. Provider is swappable via env so we don't marry one vendor:
 *   SERP_PROVIDER=brave   SERP_API_KEY=...   (Brave Search API — has a free tier)
 *   SERP_PROVIDER=serper  SERP_API_KEY=...   (serper.dev — cheap google)
 * Returns a normalized [{ title, url, snippet }] regardless of provider.
 */
const https = require('https');

const PROVIDER = (process.env.SERP_PROVIDER || 'brave').toLowerCase();
const KEY = process.env.SERP_API_KEY || '';

function available() { return !!KEY; }

function request({ host, path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, path, method, headers }, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error(`bad JSON: ${buf.slice(0, 120)}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 160)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

async function braveSearch(q, count) {
  const path = `/res/v1/web/search?q=${encodeURIComponent(q)}&count=${count}&country=us`;
  const data = await request({
    host: 'api.search.brave.com', path,
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': KEY },
  });
  const items = data?.web?.results || [];
  return items.map(r => ({ title: r.title || '', url: r.url || '', snippet: r.description || '' }));
}

async function serperSearch(q, count) {
  const body = JSON.stringify({ q, num: count, gl: 'us' });
  const data = await request({
    host: 'google.serper.dev', path: '/search', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-API-KEY': KEY },
    body,
  });
  const items = data?.organic || [];
  return items.map(r => ({ title: r.title || '', url: r.link || '', snippet: r.snippet || '' }));
}

// search(query) → [{ title, url, snippet }]  (empty when unconfigured or on error — caller decides).
async function search(query, { count = 10 } = {}) {
  if (!available()) return [];
  if (PROVIDER === 'serper') return serperSearch(query, count);
  return braveSearch(query, count);
}

module.exports = { available, search, PROVIDER };
