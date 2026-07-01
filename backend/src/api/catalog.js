/*
 * TERRITORY CATALOG API — the marketplace inventory + checkout for the page.
 * Read endpoints are always live (availability derived from territory_zips / territory_units,
 * seeded by seed_catalog.js). Checkout/webhook are GATED on STRIPE_SECRET_KEY + the `stripe`
 * module, so this ships now and the payment flow lights up once keys are set.
 *
 * Model (decided 2026-06-30): unit of exclusivity = (ZIP × category). Category exclusive $799/mo,
 * ZIP-wide exclusive $1,899/mo, shared territory $249/mo (capped 3). Ratchet: selling a category
 * exclusive removes that category from the shared list + blocks the ZIP-wide exclusive.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const router = express.Router();
router.use(cors());

const PRICING = {
  shared: { amount: 249, label: 'Shared Territory' },
  category: { amount: 799, label: 'Exclusive Category' },
  zip: { amount: 1899, label: 'Exclusive ZIP' },
};
const SUCCESS_URL = (process.env.CHECKOUT_SUCCESS_URL || 'https://hunter.living/?purchase=success')
  + '&session_id={CHECKOUT_SESSION_ID}';
const CANCEL_URL = process.env.CHECKOUT_CANCEL_URL || 'https://hunter.living/?purchase=cancelled';

let _db = null;
async function db() {
  if (!_db) {
    _db = await open({ filename: path.join(__dirname, '..', 'data', 'tax_roll.db'), driver: sqlite3.Database });
    await _db.exec('PRAGMA busy_timeout=15000');
    await _db.exec(`CREATE TABLE IF NOT EXISTS territory_zips (
      zip TEXT PRIMARY KEY, lead_count INTEGER, shared_price INTEGER, shared_cap INTEGER,
      shared_count INTEGER DEFAULT 0, zip_excl_price INTEGER, zip_excl_owner TEXT, zip_excl_since TEXT,
      lat REAL, lng REAL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS territory_units (
      zip TEXT, category TEXT, lead_count INTEGER, excl_price INTEGER, excl_owner TEXT, excl_since TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (zip, category));
      CREATE TABLE IF NOT EXISTS territory_orders (
      id TEXT PRIMARY KEY, zip TEXT, category TEXT, tier TEXT, customer_name TEXT, customer_email TEXT,
      amount INTEGER, stripe_session TEXT, stripe_subscription TEXT, status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT, zip TEXT, category TEXT, tier TEXT, name TEXT, email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS region_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, region TEXT, name TEXT, email TEXT, note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  }
  return _db;
}

// Lazy Stripe — absent module/key ⇒ payments gated off (read endpoints still work).
let _stripe;
function stripe() {
  if (_stripe !== undefined) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) { _stripe = null; return _stripe; }
  try { _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); }
  catch { _stripe = null; }
  return _stripe;
}
function stripeConfigured() { return !!stripe(); }

// Shape one ZIP's availability from its zip row + category unit rows.
function shapeZip(z, units) {
  const anyCategorySold = units.some(u => u.excl_owner);
  const zipTaken = !!z.zip_excl_owner;
  const categories = units.map(u => ({
    category: u.category,
    leadCount: u.lead_count,
    exclusive: {
      price: u.excl_price,
      status: u.excl_owner ? 'sold' : (zipTaken ? 'unavailable' : 'available'),
      owner: u.excl_owner || null,
      since: u.excl_since || null,
    },
  }));
  return {
    zip: z.zip,
    leadCount: z.lead_count,
    lat: z.lat ?? null,
    lng: z.lng ?? null,
    // Per-ZIP market intelligence (compute_zip_stats.js). trend = fresh-distress vs county median.
    insights: (z.new_distress_pct != null) ? {
      elderly: z.elderly_pct ?? null,
      freshDistress: z.new_distress_pct ?? null,
      trend: z.trend ?? null,
    } : null,
    shared: {
      price: z.shared_price, cap: z.shared_cap, count: z.shared_count,
      status: zipTaken ? 'unavailable' : (z.shared_count >= z.shared_cap ? 'full' : 'available'),
      seatsLeft: Math.max(0, z.shared_cap - z.shared_count),
    },
    zipExclusive: {
      price: z.zip_excl_price,
      // ZIP-wide exclusive is only sellable if the whole ZIP is free (no category taken).
      status: zipTaken ? 'sold' : (anyCategorySold ? 'unavailable' : 'available'),
      owner: z.zip_excl_owner || null, since: z.zip_excl_since || null,
    },
    categories,
  };
}

async function loadZip(d, zip) {
  const z = await d.get('SELECT * FROM territory_zips WHERE zip=?', [zip]);
  if (!z) return null;
  const units = await d.all('SELECT * FROM territory_units WHERE zip=? ORDER BY lead_count DESC', [zip]);
  return shapeZip(z, units);
}

// GET /api/catalog/zips  → all ZIPs with availability summary (optionally ?category=land&status=available)
router.get('/zips', async (req, res) => {
  try {
    const d = await db();
    const zrows = await d.all('SELECT * FROM territory_zips ORDER BY lead_count DESC');
    const urows = await d.all('SELECT * FROM territory_units');
    const byZip = new Map();
    for (const u of urows) { if (!byZip.has(u.zip)) byZip.set(u.zip, []); byZip.get(u.zip).push(u); }
    let zips = zrows.map(z => shapeZip(z, byZip.get(z.zip) || []));
    const { category, status } = req.query;
    if (category) zips = zips.filter(z => z.categories.some(c => c.category === category));
    if (status) zips = zips.filter(z => z.categories.some(c => c.exclusive.status === status) || z.shared.status === status);
    const totals = {
      zips: zips.length,
      soldExclusives: zips.reduce((n, z) => n + z.categories.filter(c => c.exclusive.status === 'sold').length, 0),
      totalLeads: zips.reduce((n, z) => n + z.leadCount, 0),
    };
    res.json({ success: true, totals, zips, paymentsEnabled: stripeConfigured() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/catalog/zip/:zip  → one ZIP's detail
router.get('/zip/:zip', async (req, res) => {
  try {
    const z = await loadZip(await db(), String(req.params.zip).slice(0, 5));
    if (!z) return res.status(404).json({ success: false, error: 'ZIP not in catalog' });
    res.json({ success: true, zip: z, paymentsEnabled: stripeConfigured() });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/catalog/waitlist  { zip, category?, tier?, name?, email }  → join the waitlist for a
// claimed/full territory. No payment — we notify when it frees up.
router.post('/waitlist', async (req, res) => {
  try {
    const { zip, category, tier, name, email } = req.body || {};
    if (!email || !zip) return res.status(400).json({ success: false, error: 'zip and email required' });
    const d = await db();
    await d.run(`INSERT INTO waitlist (zip, category, tier, name, email) VALUES (?,?,?,?,?)`,
      [String(zip).slice(0, 5), category || null, tier || null, name || null, email]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/catalog/region-request  { region, name?, email, note? }  → request a market we don't
// serve yet (outside Dallas County).
router.post('/region-request', async (req, res) => {
  try {
    const { region, name, email, note } = req.body || {};
    if (!email || !region) return res.status(400).json({ success: false, error: 'region and email required' });
    const d = await db();
    await d.run(`INSERT INTO region_requests (region, name, email, note) VALUES (?,?,?,?)`,
      [String(region).slice(0, 200), name || null, email, String(note || '').slice(0, 1000)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Validate a purchase is still available (server-side truth — never trust the client tile).
async function checkAvailable(d, tier, zip, category) {
  const z = await loadZip(d, zip);
  if (!z) return { ok: false, reason: 'unknown ZIP' };
  if (tier === 'shared') return { ok: z.shared.status === 'available', reason: z.shared.status, zipShape: z };
  if (tier === 'zip') return { ok: z.zipExclusive.status === 'available', reason: z.zipExclusive.status, zipShape: z };
  if (tier === 'category') {
    const c = z.categories.find(x => x.category === category);
    if (!c) return { ok: false, reason: 'category not in ZIP' };
    return { ok: c.exclusive.status === 'available', reason: c.exclusive.status, zipShape: z };
  }
  return { ok: false, reason: 'unknown tier' };
}

// Portfolio (multi-territory) discount ladder — premium-safe, hard-capped at 20% so exclusivity
// never reads as a clearance sale. Applied as a recurring Stripe coupon (rides every month).
function bundleDiscountPct(n) { return n >= 4 ? 20 : n === 3 ? 15 : n === 2 ? 10 : 0; }
async function ensureCoupon(s, pct) {
  const id = `bundle_${pct}`;
  try { return (await s.coupons.retrieve(id)).id; }
  catch {
    try { return (await s.coupons.create({ id, percent_off: pct, duration: 'forever', name: `Portfolio ${pct}% off` })).id; }
    catch { return null; }
  }
}
function itemLabel(it) {
  return it.tier === 'category'
    ? `Exclusive ${it.category[0].toUpperCase() + it.category.slice(1)} — ${it.zip}`
    : `${PRICING[it.tier].label} — ${it.zip}`;
}

// POST /api/catalog/checkout  { items:[{tier,zip,category?}], email, name }  (also accepts a single
// {tier,zip,category}). Validates every item is still available, then one subscription Checkout
// with all line items + the portfolio discount. → { url, discountPct }
router.post('/checkout', async (req, res) => {
  try {
    const s = stripe();
    if (!s) return res.status(501).json({ success: false, error: 'Payments not configured (set STRIPE_SECRET_KEY).' });
    const body = req.body || {};
    const raw = Array.isArray(body.items) && body.items.length ? body.items
      : (body.tier ? [{ tier: body.tier, zip: body.zip, category: body.category }] : []);
    const { email, name } = body;
    if (!raw.length) return res.status(400).json({ success: false, error: 'no items' });
    if (raw.length > 8) return res.status(400).json({ success: false, error: 'max 8 territories per order' });
    const d = await db();
    const items = [];
    for (const it of raw) {
      if (!PRICING[it.tier]) return res.status(400).json({ success: false, error: `bad tier ${it.tier}` });
      if (it.tier === 'category' && !it.category) return res.status(400).json({ success: false, error: 'category required' });
      const zip = String(it.zip).slice(0, 5);
      const avail = await checkAvailable(d, it.tier, zip, it.category);
      if (!avail.ok) return res.status(409).json({ success: false, error: `${itemLabel({ ...it, zip })} not available (${avail.reason})` });
      items.push({ tier: it.tier, zip, category: it.category || '' });
    }
    const line_items = items.map(it => ({
      quantity: 1,
      price_data: {
        currency: 'usd', unit_amount: PRICING[it.tier].amount * 100, recurring: { interval: 'month' },
        product_data: { name: itemLabel(it), metadata: { zip: it.zip, category: it.category, tier: it.tier } },
      },
    }));
    const pct = bundleDiscountPct(items.length);
    const discounts = [];
    if (pct > 0) { const cid = await ensureCoupon(s, pct); if (cid) discounts.push({ coupon: cid }); }
    const itemsJson = JSON.stringify(items.map(it => ({ t: it.tier, z: it.zip, c: it.category })));
    const session = await s.checkout.sessions.create({
      mode: 'subscription', line_items, discounts,
      customer_email: email || undefined,
      metadata: { items: itemsJson, name: name || '' },
      subscription_data: { metadata: { items: itemsJson } },
      success_url: SUCCESS_URL, cancel_url: CANCEL_URL,
    });
    res.json({ success: true, url: session.url, id: session.id, discountPct: pct });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/catalog/webhook  → Stripe events (raw body mounted in server.js). Marks inventory sold.
router.post('/webhook', async (req, res) => {
  const s = stripe();
  if (!s) return res.status(501).send('stripe not configured');
  let event = req.body;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (secret) {
    try { event = s.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret); }
    catch (e) { return res.status(400).send(`sig error: ${e.message}`); }
  } else if (Buffer.isBuffer(req.body)) {
    try { event = JSON.parse(req.body.toString()); } catch { return res.status(400).send('bad json'); }
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const obj = event.data.object; const m = obj.metadata || {};
      await fulfilOrder(await db(), {
        items: parseItems(m), name: m.name, email: obj.customer_email,
        session: obj.id, subscription: obj.subscription, amount: obj.amount_total,
      });
    }
    res.json({ received: true });
  } catch (e) { res.status(500).send(e.message); }
});

// GET /api/catalog/confirm?session_id=…  → when the buyer returns from Checkout, verify the
// session is paid and fulfil the inventory (flips the tile to Sold). Idempotent. This makes the
// demo work without a pre-registered Stripe webhook; the /webhook route still handles production.
router.get('/confirm', async (req, res) => {
  try {
    const s = stripe();
    if (!s) return res.status(501).json({ success: false, error: 'stripe not configured' });
    const id = req.query.session_id;
    if (!id) return res.status(400).json({ success: false, error: 'session_id required' });
    const session = await s.checkout.sessions.retrieve(id);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paid) return res.json({ success: true, paid: false, status: session.status });
    const m = session.metadata || {};
    const d = await db();
    const affected = await fulfilOrder(d, {
      items: parseItems(m), name: m.name,
      email: session.customer_details?.email || session.customer_email,
      session: session.id, subscription: session.subscription, amount: session.amount_total,
    });
    const zips = await Promise.all(affected.map(z => loadZip(d, z)));
    res.json({ success: true, paid: true, count: affected.length, zips, zip: zips[0] || null });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Apply ONE line item to the inventory (the ratchet: category-exclusive removes that category from
// shared + blocks the ZIP-wide exclusive; ZIP-exclusive locks the whole ZIP; shared adds a seat).
async function fulfilOne(d, tier, zip, category, owner) {
  const now = new Date().toISOString().slice(0, 10);
  if (tier === 'category') {
    await d.run(`UPDATE territory_units SET excl_owner=?, excl_since=? WHERE zip=? AND category=? AND excl_owner IS NULL`,
      [owner, now, zip, category]);
  } else if (tier === 'zip') {
    await d.run(`UPDATE territory_zips SET zip_excl_owner=?, zip_excl_since=? WHERE zip=? AND zip_excl_owner IS NULL`,
      [owner, now, zip]);
  } else if (tier === 'shared') {
    await d.run(`UPDATE territory_zips SET shared_count=MIN(shared_cap, shared_count+1) WHERE zip=?`, [zip]);
  }
}

// Fulfil a whole order (1+ items). Idempotent per (session,index). Returns the affected ZIPs.
async function fulfilOrder(d, o) {
  const owner = o.name || o.email || 'New subscriber';
  const items = o.items || [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await fulfilOne(d, it.t, it.z, it.c, owner);
    await d.run(`INSERT OR REPLACE INTO territory_orders
      (id, zip, category, tier, customer_name, customer_email, amount, stripe_session, stripe_subscription, status)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [(o.session || 'ord') + ':' + i, it.z, it.c || null, it.t, o.name || null,
       o.email || null, o.amount || null, o.session || null, o.subscription || null, 'active']);
  }
  return [...new Set(items.map(i => i.z))];
}

function parseItems(m) { try { return JSON.parse(m.items || '[]'); } catch { return []; } }

module.exports = router;
