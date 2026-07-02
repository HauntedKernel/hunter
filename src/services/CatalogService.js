// Territory-catalog API client — availability grid + checkout for the marketplace page.
// Mirrors SellerIntelligenceService's API_BASE convention (relative in dev via Vite proxy;
// VITE_API_BASE in production Cloudflare Pages build).
const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

const CatalogService = {
  // All ZIPs with availability summary. Optional { category, status } filters.
  async getZips(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.category) qs.set('category', filters.category);
    if (filters.status) qs.set('status', filters.status);
    const res = await fetch(`${API_BASE}/api/catalog/zips${qs.toString() ? '?' + qs : ''}`);
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    return res.json();
  },

  // One ZIP's detail.
  async getZip(zip) {
    const res = await fetch(`${API_BASE}/api/catalog/zip/${encodeURIComponent(zip)}`);
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    return res.json();
  },

  // Start a Stripe Checkout. Pass { items:[{tier,zip,category}], name, email } for a portfolio,
  // or a single { tier, zip, category }. Returns { url, discountPct }, or throws the server reason
  // (501 when payments aren't configured, 409 if a territory was just claimed).
  async checkout({ items, tier, zip, category, email, name, term }) {
    const res = await fetch(`${API_BASE}/api/catalog/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, tier, zip, category, email, name, term }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `checkout ${res.status}`);
    return data; // { success, url, id }
  },

  // After returning from Stripe Checkout, confirm + fulfil by session id (flips tile to Sold).
  async confirm(sessionId) {
    const res = await fetch(`${API_BASE}/api/catalog/confirm?session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `confirm ${res.status}`);
    return data; // { success, paid, tier, category, zip }
  },

  // Join the waitlist for a claimed/full territory.
  async joinWaitlist({ zip, category, tier, name, email }) {
    const res = await fetch(`${API_BASE}/api/catalog/waitlist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zip, category, tier, name, email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `waitlist ${res.status}`);
    return data;
  },

  // Deep multi-hop web dossier for an entity-owned lead (principal, portfolio, contacts, context,
  // motivation). Takes ~20s server-side; results are cached 24h.
  async dossier(entity) {
    const res = await fetch(`${API_BASE}/api/catalog/dossier`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `dossier ${res.status}`);
    return data; // { success, cached, dossier }
  },

  // Request a market we don't serve yet.
  async requestRegion({ region, name, email, note }) {
    const res = await fetch(`${API_BASE}/api/catalog/region-request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region, name, email, note }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `region-request ${res.status}`);
    return data;
  },
};

export default CatalogService;
