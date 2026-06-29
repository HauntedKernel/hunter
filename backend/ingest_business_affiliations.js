/**
 * Ingest a BUSINESS-ENTITY registry and link entities to the business-owned
 * properties in the tax roll — the "human behind the LLC" layer. When a parcel's
 * owner is "ABC PROPERTIES LLC", this attaches the registered agent / officers /
 * business contact so the lead becomes reachable through a real person, and flags
 * the owner as an operating business (investor capacity).
 *
 * SOURCE (free-ish, provider-agnostic):
 *   - Texas Comptroller Open Data Portal (comptroller.texas.gov/transparency/open-data)
 *     — active-franchise / entity files include entity name + registered agent + address.
 *   - Comptroller Public Information Report (PIR) — officers / directors / agent.
 *   - SOSDirect bulk order ($) or OpenCorporates / CompanyData API ($/lookup).
 * Obtain whichever you can; headers are fuzzy-matched. This script does NOT scrape.
 *
 * MATCHING: entity name -> owner_name, both normalized by stripping entity-type
 * suffixes (LLC/INC/CORP/LP/LTD…) and punctuation, so "ABC PROPERTIES, L.L.C."
 * matches the roll's "ABC PROPERTIES LLC". Only owners that look like a business
 * are indexed, so individuals aren't mis-linked. One entity can own many parcels —
 * each matched parcel gets a row.
 *
 * CSV columns (header required, order-independent; only entity_name is required):
 *   entity_name, entity_type, registered_agent, agent_address, officers,
 *   business_address, business_phone, status, file_number, source
 *   - officers: free text or semicolon-separated names.
 *
 * Writes table business_affiliations(account_id PK, …), joined by export_curated.js.
 *
 * Usage:
 *   node ingest_business_affiliations.js <registry.csv>
 *   node ingest_business_affiliations.js --clear
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// An owner_name that looks like an operating business / entity (not a person).
const BUSINESS_RE = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|\bCO\b|LP|LLP|LLLP|LTD|PLLC|PC|PROPERT(?:Y|IES)|HOMES?|INVESTMENTS?|INVESTORS?|REALTY|REAL ESTATE|CAPITAL|HOLDINGS?|GROUP|ENTERPRISES?|VENTURES?|PARTNERS?|MANAGEMENT|ASSOCIATES?|FUND|ASSETS?|EQUITY|RENTALS?|DEVELOPMENT|BANK|CHURCH|MINISTR(?:Y|IES)|ASSN|ASSOCIATION|FOUNDATION|LEASING|HOMEBUYERS?)\b/i;

// Normalize entity/owner for matching: drop entity-type suffixes + punctuation.
const SUFFIX_RE = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|LLP|LLLP|LTD|PLLC|PC|THE)\b/g;
const normEntity = (s) => String(s || '').toUpperCase().replace(/[.,&]/g, ' ').replace(SUFFIX_RE, ' ').replace(/[^A-Z0-9]/g, '');

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return { keys: [], rows: [] };
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const keys = split(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = split(lines[i]); const row = {};
    keys.forEach((k, j) => { row[k] = vals[j] || ''; });
    rows.push(row);
  }
  return { keys, rows };
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function pick(keys, aliases) {
  const al = aliases.map(norm);
  for (const k of keys) if (al.includes(k)) return k;
  for (const k of keys) if (al.some(a => k.includes(a))) return k;
  return null;
}

(async () => {
  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS business_affiliations (
    account_id TEXT PRIMARY KEY,
    entity_name TEXT, entity_type TEXT, registered_agent TEXT, agent_address TEXT,
    officers TEXT, business_address TEXT, business_phone TEXT, status TEXT,
    file_number TEXT, source TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const arg = process.argv[2];
  if (arg === '--clear') { await db.run('DELETE FROM business_affiliations'); console.log('business_affiliations cleared'); await db.close(); return; }
  if (!arg) { console.error('Provide a registry CSV path, or --clear'); process.exit(1); }

  // Index business-owned parcels by normalized owner name (one pass).
  console.log('indexing business-owned parcels…');
  const byName = new Map(); // normEntity -> [account_id]
  const owners = await db.all("SELECT account_id, owner_name FROM tax_roll WHERE roll_code='R' AND owner_name IS NOT NULL");
  for (const o of owners) {
    if (!BUSINESS_RE.test(o.owner_name)) continue;
    const k = normEntity(o.owner_name);
    if (k.length < 4) continue;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(o.account_id);
  }
  console.log(`  ${byName.size.toLocaleString()} distinct business owner-names across ${owners.length.toLocaleString()} parcels`);

  const { keys, rows } = parseCsv(fs.readFileSync(arg, 'utf8'));
  const col = {
    name: pick(keys, ['entityname', 'entity', 'businessname', 'name', 'taxpayername', 'companyname', 'legalname']),
    type: pick(keys, ['entitytype', 'type', 'organizationtype', 'filingtype']),
    agent: pick(keys, ['registeredagent', 'agentname', 'agent', 'raname']),
    agentAddr: pick(keys, ['agentaddress', 'registeredagentaddress', 'raaddress']),
    officers: pick(keys, ['officers', 'directors', 'members', 'managers', 'officersdirectors', 'principals']),
    bizAddr: pick(keys, ['businessaddress', 'mailingaddress', 'address', 'principaladdress']),
    phone: pick(keys, ['phone', 'businessphone', 'telephone']),
    status: pick(keys, ['status', 'entitystatus', 'taxstatus']),
    file: pick(keys, ['filenumber', 'fileno', 'sosfilenumber', 'entitynumber', 'taxid']),
  };
  console.log(`registry: ${rows.length.toLocaleString()} rows`);
  console.log('detected columns:', JSON.stringify(col));
  if (!col.name) { console.error('No entity-name column found — paste me the header row.'); process.exit(1); }

  await db.exec('BEGIN');
  const stmt = await db.prepare(`INSERT INTO business_affiliations
    (account_id, entity_name, entity_type, registered_agent, agent_address, officers, business_address, business_phone, status, file_number, source, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(account_id) DO UPDATE SET
      entity_name=excluded.entity_name, entity_type=excluded.entity_type,
      registered_agent=excluded.registered_agent, agent_address=excluded.agent_address,
      officers=excluded.officers, business_address=excluded.business_address,
      business_phone=excluded.business_phone, status=excluded.status,
      file_number=excluded.file_number, source=excluded.source, updated_at=CURRENT_TIMESTAMP`);

  let matchedRows = 0, matchedParcels = 0;
  for (const r of rows) {
    const k = normEntity(r[col.name]);
    if (k.length < 4) continue;
    const accounts = byName.get(k);
    if (!accounts) continue;
    matchedRows++;
    for (const acct of accounts) {
      await stmt.run(acct, r[col.name],
        col.type ? r[col.type] : null, col.agent ? r[col.agent] : null, col.agentAddr ? r[col.agentAddr] : null,
        col.officers ? r[col.officers] : null, col.bizAddr ? r[col.bizAddr] : null, col.phone ? r[col.phone] : null,
        col.status ? r[col.status] : null, col.file ? r[col.file] : null, r[col.source] || 'registry');
      matchedParcels++;
    }
  }
  await stmt.finalize();
  await db.exec('COMMIT');
  console.log(`\nmatched ${matchedRows.toLocaleString()} registry entities to ${matchedParcels.toLocaleString()} parcels`);
  if (!matchedRows) console.log('  0 matches — check that entity names align with how the roll names business owners.');
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
