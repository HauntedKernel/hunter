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

  // Start a Stripe Checkout for a tier. Returns { url } to redirect to, or throws with the
  // server's reason (e.g. 501 when payments aren't configured yet, 409 if just-sold).
  async checkout({ tier, zip, category, email, name }) {
    const res = await fetch(`${API_BASE}/api/catalog/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, zip, category, email, name }),
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
};

export default CatalogService;
