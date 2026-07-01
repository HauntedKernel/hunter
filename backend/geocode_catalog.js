/*
 * Geocode catalogued ZIPs → centroids for the marketplace MAP. The tax roll has no coordinates,
 * so we fetch each ZIP's centroid from the free zippopotam.us API (no key) and cache lat/lng on
 * territory_zips. One-time / idempotent — only fills ZIPs still missing coords.
 *
 * Run on the box from backend/:  node geocode_catalog.js
 * Env: HUNTER_DB (default src/data/tax_roll.db), RATE_MS (default 150).
 */
const path = require('path');
const https = require('https');
const sqlite3 = require('sqlite3');

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const RATE_MS = Number(process.env.RATE_MS || 150);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function fetchZip(zip) {
  return new Promise((resolve) => {
    https.get(`https://api.zippopotam.us/us/${zip}`, (res) => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          const j = JSON.parse(b);
          const places = j.places || [];
          if (!places.length) return resolve(null);
          // Average the ZIP's places for a stable centroid.
          const lat = places.reduce((s, p) => s + parseFloat(p.latitude), 0) / places.length;
          const lng = places.reduce((s, p) => s + parseFloat(p.longitude), 0) / places.length;
          resolve({ lat, lng });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const db = new sqlite3.Database(DB);
const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));
const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));

(async () => {
  await run('PRAGMA busy_timeout=15000');
  // Add lat/lng columns if missing (CREATE IF NOT EXISTS won't alter an existing table).
  const cols = (await all('PRAGMA table_info(territory_zips)')).map(c => c.name);
  if (!cols.includes('lat')) await run('ALTER TABLE territory_zips ADD COLUMN lat REAL');
  if (!cols.includes('lng')) await run('ALTER TABLE territory_zips ADD COLUMN lng REAL');

  const todo = await all('SELECT zip FROM territory_zips WHERE lat IS NULL ORDER BY zip');
  console.log(`geocoding ${todo.length} ZIPs (rate ${RATE_MS}ms)…`);
  let ok = 0, miss = 0;
  for (let i = 0; i < todo.length; i++) {
    const r = await fetchZip(todo[i].zip);
    if (r) { await run('UPDATE territory_zips SET lat=?, lng=? WHERE zip=?', [r.lat, r.lng, todo[i].zip]); ok++; }
    else miss++;
    if (i % 25 === 24) console.log(`  …${i + 1}/${todo.length} (ok ${ok}, miss ${miss})`);
    await sleep(RATE_MS);
  }
  const have = (await all('SELECT COUNT(*) c FROM territory_zips WHERE lat IS NOT NULL'))[0].c;
  console.log(`done: geocoded ${ok}, missed ${miss}; ${have} ZIPs now have coords.`);
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
