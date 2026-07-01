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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS territory_units (
      zip TEXT, category TEXT, lead_count INTEGER, excl_price INTEGER, excl_owner TEXT, excl_since TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (zip, category));
      CREATE TABLE IF NOT EXISTS territory_orders (
      id TEXT PRIMARY KEY, zip TEXT, category TEXT, tier TEXT, customer_name TEXT, customer_email TEXT,
      amount INTEGER, stripe_session TEXT, stripe_subscription TEXT, status TEXT,
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

// POST /api/catalog/checkout  { tier, zip, category?, email, name }  → Stripe Checkout URL
router.post('/checkout', async (req, res) => {
  try {
    const s = stripe();
    if (!s) return res.status(501).json({ success: false, error: 'Payments not configured (set STRIPE_SECRET_KEY).' });
    const { tier, zip, category, email, name } = req.body || {};
    if (!PRICING[tier]) return res.status(400).json({ success: false, error: 'bad tier' });
    if (tier === 'category' && !category) return res.status(400).json({ success: false, error: 'category required' });
    const d = await db();
    const avail = await checkAvailable(d, tier, String(zip).slice(0, 5), category);
    if (!avail.ok) return res.status(409).json({ success: false, error: `not available (${avail.reason})` });
    const p = PRICING[tier];
    const label = tier === 'category'
      ? `Exclusive ${category[0].toUpperCase() + category.slice(1)} — ${zip}`
      : `${p.label} — ${zip}`;
    const session = await s.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd', unit_amount: p.amount * 100, recurring: { interval: 'month' },
          product_data: { name: label, metadata: { zip: String(zip), category: category || '', tier } },
        },
      }],
      customer_email: email || undefined,
      metadata: { tier, zip: String(zip), category: category || '', name: name || '' },
      success_url: SUCCESS_URL, cancel_url: CANCEL_URL,
      subscription_data: { metadata: { tier, zip: String(zip), category: category || '' } },
    });
    res.json({ success: true, url: session.url, id: session.id });
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
      const m = event.data.object.metadata || {};
      await fulfil(await db(), {
        tier: m.tier, zip: m.zip, category: m.category, name: m.name,
        email: event.data.object.customer_email,
        session: event.data.object.id, subscription: event.data.object.subscription,
        amount: event.data.object.amount_total,
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
    await fulfil(d, {
      tier: m.tier, zip: m.zip, category: m.category, name: m.name,
      email: session.customer_details?.email || session.customer_email,
      session: session.id, subscription: session.subscription, amount: session.amount_total,
    });
    res.json({ success: true, paid: true, tier: m.tier, category: m.category || null, zip: await loadZip(d, m.zip) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Apply a completed purchase to the inventory (the ratchet: category-exclusive removes that
// category from shared + blocks the ZIP-wide exclusive; ZIP-exclusive locks the whole ZIP).
async function fulfil(d, o) {
  const now = new Date().toISOString().slice(0, 10);
  const owner = o.name || o.email || 'New subscriber';
  if (o.tier === 'category') {
    await d.run(`UPDATE territory_units SET excl_owner=?, excl_since=? WHERE zip=? AND category=? AND excl_owner IS NULL`,
      [owner, now, o.zip, o.category]);
  } else if (o.tier === 'zip') {
    await d.run(`UPDATE territory_zips SET zip_excl_owner=?, zip_excl_since=? WHERE zip=? AND zip_excl_owner IS NULL`,
      [owner, now, o.zip]);
  } else if (o.tier === 'shared') {
    await d.run(`UPDATE territory_zips SET shared_count=MIN(shared_cap, shared_count+1) WHERE zip=?`, [o.zip]);
  }
  await d.run(`INSERT OR REPLACE INTO territory_orders
    (id, zip, category, tier, customer_name, customer_email, amount, stripe_session, stripe_subscription, status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [o.session || ('ord_' + now + '_' + o.zip), o.zip, o.category || null, o.tier, o.name || null,
     o.email || null, o.amount || null, o.session || null, o.subscription || null, 'active']);
}

module.exports = router;
