/**
 * Ingest pre-foreclosure / lis-pendens records into a `legal_events` table in
 * tax_roll.db, matched to tax-roll properties so discovery can use them as a
 * motivation signal (STRATEGY.md §3, roadmap #2 — the strongest signal).
 *
 * These are EVENTS from the Dallas County Clerk, NOT the tax roll:
 *   - Pre-foreclosure = Notice of Substitute Trustee Sale (filed ~21 days before
 *     the first-Tuesday sale; Dallas County posts these monthly).
 *   - Lis pendens = notice of a pending suit affecting title, recorded in the
 *     county's Official Public Records.
 * Get a feed from: Dallas County Clerk foreclosure postings / OPR search, or a
 * REI data vendor. There is no live feed wired yet — this loads a CSV.
 *
 * CSV columns (header required): event_type,account_id,address,owner_name,filed_date,sale_date,source
 *   event_type: "preforeclosure" | "lis_pendens"
 *   account_id: DCAD account id (BEST match key). If absent, we try address.
 *
 * Usage:
 *   node ingest_legal_events.js <file.csv>     load/replace events from CSV
 *   node ingest_legal_events.js --clear        wipe the legal_events table
 */
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { situsKeyFromAddress } = require('./lib/situs');

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return rows;
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = split(lines[0]).map(h => h.toLowerCase());
  for (let i = 1; i < lines.length; i++) {
    const vals = split(lines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h] = vals[j] || ''; });
    rows.push(row);
  }
  return rows;
}

function streetToken(addr) {
  return (String(addr || '').toUpperCase().match(/[A-Z]{4,}/g) || [])
    .sort((a, b) => b.length - a.length)[0] || '';
}

(async () => {
  const dbPath = process.env.HUNTER_DB
    ? path.resolve(process.env.HUNTER_DB)
    : path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS legal_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT,
      event_type TEXT,
      address TEXT,
      owner_name TEXT,
      filed_date TEXT,
      sale_date TEXT,
      source TEXT,
      match_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_legal_events_account ON legal_events(account_id);
  `);

  const arg = process.argv[2];
  if (arg === '--clear') {
    await db.run('DELETE FROM legal_events');
    console.log('legal_events cleared');
    await db.close();
    return;
  }
  if (!arg) { console.error('Provide a CSV path, or --clear'); process.exit(1); }

  const text = await fs.readFile(arg, 'utf8');
  const rows = parseCsv(text);
  console.log(`parsed ${rows.length} rows from ${path.basename(arg)}`);

  // Name tokens (surnames etc.) for owner-aware matching — excludes joiners and
  // estate/legal boilerplate so we match on real name parts.
  const NAME_STOP = new Set(['AND', 'THE', 'LIFE', 'ESTATE', 'HEIRS', 'TRUST', 'LLC', 'INC', 'COMPANY', 'UNKNOWN', 'SPOUSE', 'HUSBAND', 'WIFE']);
  const nameTokens = (name) => ([...new Set((String(name || '').toUpperCase().match(/[A-Z]{4,}/g) || []))])
    .filter(t => !NAME_STOP.has(t));

  // The situs crosswalk (build_situs_xref.py) resolves a clean address line to a parcel
  // via DCAD house numbers — the precise path. Present = use it first; absent = rely on
  // the owner-aware path below.
  const hasXref = !!(await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='situs_xref'"));
  if (!hasXref) console.log('NOTE: situs_xref not found — run build_situs_xref.py for precise address matching.');
  let byAccount = 0, byXref = 0, byAddress = 0, byAddressOwner = 0, unmatched = 0;
  await db.exec('BEGIN');
  for (const r of rows) {
    let accountId = (r.account_id || '').trim();
    let method = 'unmatched';

    if (accountId) {
      const hit = await db.get('SELECT account_id FROM tax_roll WHERE account_id = ?', [accountId]);
      if (hit) { method = 'account_id'; byAccount++; }
      else accountId = ''; // bad id, fall through to address
    }
    // PRECISE: full address line -> parcel via the situs crosswalk (best when the notice
    // carries a real house number + Dallas ZIP; Lot/Block legal descriptions return null).
    if (!accountId && r.address && hasXref) {
      const key = situsKeyFromAddress(r.address);
      if (key) {
        const hit = await db.get('SELECT account_id FROM situs_xref WHERE addr_key = ?', [key]);
        if (hit) { accountId = hit.account_id; method = 'situs_xref'; byXref++; }
      }
    }
    if (!accountId && r.address) {
      const tok = streetToken(r.address);
      const zip = (r.address.match(/\b(\d{5})\b/) || [])[1];
      const names = nameTokens(r.owner_name);
      // The tax roll's property_address has NO house numbers, so street+ZIP
      // alone resolves to an arbitrary house on the street. When the notice
      // gives a grantor name, REQUIRE the owner to match too (precise). Only
      // when no owner name is available do we fall back to street+ZIP.
      let hit = null;
      if (tok && zip && names.length) {
        const ownerOr = names.map(() => 'UPPER(owner_name) LIKE ?').join(' OR ');
        hit = await db.get(
          `SELECT account_id FROM tax_roll WHERE UPPER(property_address) LIKE ? AND zip_code LIKE ? AND (${ownerOr}) LIMIT 1`,
          [`%${tok}%`, `${zip}%`, ...names.map(n => `%${n}%`)]
        );
        if (hit) { accountId = hit.account_id; method = 'address+owner'; byAddressOwner++; }
      }
      if (!hit && tok && !names.length && process.env.ALLOW_LOOSE_MATCH === '1') {
        // No owner name to disambiguate. The tax roll lacks house numbers, so a
        // street+ZIP-only match lands on an ARBITRARY house on the street (often
        // wrong). Off by default — opt in with ALLOW_LOOSE_MATCH=1 only if you
        // accept false positives. Precision-first: otherwise leave unmatched.
        hit = await db.get(
          `SELECT account_id FROM tax_roll WHERE UPPER(property_address) LIKE ? ${zip ? 'AND zip_code LIKE ?' : ''} LIMIT 1`,
          zip ? [`%${tok}%`, `${zip}%`] : [`%${tok}%`]
        );
        if (hit) { accountId = hit.account_id; method = 'address'; byAddress++; }
      }
      if (!hit) unmatched++;
    } else if (!accountId) unmatched++;

    await db.run(
      `INSERT INTO legal_events (account_id, event_type, address, owner_name, filed_date, sale_date, source, match_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId || null, (r.event_type || 'preforeclosure').toLowerCase(), r.address || null,
       r.owner_name || null, r.filed_date || null, r.sale_date || null, r.source || 'csv', method]
    );
  }
  await db.exec('COMMIT');

  console.log(`ingested: ${byAccount} by account_id, ${byXref} by situs crosswalk (precise), ${byAddressOwner} by address+owner, ${byAddress} by address-only, ${unmatched} unmatched`);
  const total = await db.get('SELECT COUNT(*) c FROM legal_events');
  console.log(`legal_events total rows: ${total.c}`);
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
