/**
 * Forward officer-lookup WORKLIST — the cheap, money-tight path to "breaking LLCs".
 *
 * Instead of buying the $1,350 SOS bulk file, you only need officer data for the
 * handful of business entities that actually appear on a curated list. This script
 * produces that short, de-duplicated worklist + a ready-to-fill CSV template:
 *   1) run it on a territory (or an existing curated CSV),
 *   2) look each entity up — FREE at the TX Comptroller (current officers from the
 *      annual PIR: comptroller.texas.gov) or ~$1 at SOSDirect,
 *   3) paste officers/agent/phone into the template,
 *   4) node ingest_business_affiliations.js officer_worklist.csv   (attaches them),
 *   5) re-run export_curated.js — every business lead now carries its people.
 *
 * It also pulls in each entity's cluster siblings (other businesses at the same
 * mailing address, from owner_cluster) so one lookup session covers the whole
 * operator. The output CSV's columns match ingest_business_affiliations.js exactly.
 *
 * Usage:
 *   node officer_worklist.js --from curated_OakCliff_2026-06-29.csv   (recommended)
 *   node officer_worklist.js --zips 75216 [--limit 100]
 *   [--out officer_worklist.csv]
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const BUSINESS_RE = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|\bCO\b|LP|LLP|LLLP|LTD|PLLC|PC|PROPERT(?:Y|IES)|HOMES?|INVESTMENTS?|INVESTORS?|REALTY|REAL ESTATE|CAPITAL|HOLDINGS?|GROUP|ENTERPRISES?|VENTURES?|PARTNERS?|MANAGEMENT|ASSOCIATES?|FUND|ASSETS?|EQUITY|RENTALS?|DEVELOPMENT|BANK|CHURCH|MINISTR(?:Y|IES)|ASSN|ASSOCIATION|FOUNDATION|LEASING|HOMEBUYERS?)\b/i;
const ESTATE_RE = /ESTATE OF|\bEST OF\b|LIFE ESTATE|HEIRS|\bET AL\b/i;
const isBusinessName = (n) => BUSINESS_RE.test(n || '') && !ESTATE_RE.test(n || '');

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const csvCell = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const headers = split(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(l => { const v = split(l); const r = {}; headers.forEach((h, j) => r[h] = v[j] || ''); return r; });
}

// entity rawName -> { parcels, siblings:Set }
function bump(map, name, sibs) {
  if (!name) return;
  if (!map.has(name)) map.set(name, { parcels: 0, siblings: new Set() });
  const e = map.get(name);
  e.parcels++;
  (sibs || []).forEach(s => { if (s && s !== name) e.siblings.add(s); });
}

(async () => {
  const from = arg('--from');
  const zipsArg = arg('--zips');
  const out = arg('--out', 'officer_worklist.csv');
  const limit = Number(arg('--limit', '150'));
  const entities = new Map();

  if (from) {
    const rows = parseCsv(fs.readFileSync(from, 'utf8'));
    for (const r of rows) {
      const owner = r.owner_name || '';
      const biz = (r.owner_type && !['Individual', 'Estate'].includes(r.owner_type)) || isBusinessName(owner);
      if (!biz) continue;
      const sibs = (r.other_businesses || '').split(';').map(s => s.trim()).filter(Boolean);
      bump(entities, owner, sibs);
    }
    console.log(`from ${path.basename(from)}: ${entities.size} distinct business entities on the list`);
  } else if (zipsArg) {
    const zips = zipsArg.split(',').map(z => z.trim().slice(0, 5)).filter(Boolean);
    const db = await open({ filename: path.join(__dirname, 'src', 'data', 'tax_roll.db'), driver: sqlite3.Database });
    const present = new Set((await db.all("SELECT name FROM sqlite_master WHERE type='table'")).map(r => r.name));
    const clusterJoin = present.has('owner_cluster') && present.has('owner_portfolio')
      ? 'LEFT JOIN owner_portfolio op ON op.account_id=t.account_id LEFT JOIN owner_cluster oc ON oc.portfolio_key=op.portfolio_key' : '';
    const clusterCol = clusterJoin ? ', oc.businesses AS oc_businesses' : '';
    const zipWhere = zips.map(() => 't.zip_code LIKE ?').join(' OR ');
    const rows = await db.all(
      `SELECT t.owner_name${clusterCol} FROM tax_roll t ${clusterJoin}
       WHERE t.roll_code='R' AND t.owner_name IS NOT NULL AND (${zipWhere})
       AND (t.suit_pending=1 OR t.is_delinquent=1 OR t.is_absentee=1
            OR t.owner_name LIKE '%ESTATE OF%' OR t.owner_name LIKE '% EST OF%')`,
      zips.map(z => z + '%'));
    for (const r of rows) {
      if (!isBusinessName(r.owner_name)) continue;
      let sibs = [];
      try { const b = JSON.parse(r.oc_businesses || '[]'); if (Array.isArray(b)) sibs = b; } catch { /* none */ }
      bump(entities, r.owner_name, sibs);
    }
    await db.close();
    console.log(`territory ${zips.join(', ')}: ${entities.size} distinct business entities among motivated parcels`);
  } else {
    console.error('Provide --from <curated.csv> or --zips <zips>'); process.exit(1);
  }

  // Cluster siblings that aren't themselves owners-on-list still deserve a lookup row.
  for (const [name, e] of [...entities]) {
    for (const s of e.siblings) if (!entities.has(s)) entities.set(s, { parcels: 0, siblings: new Set(), sibOnly: true });
  }

  const ranked = [...entities.entries()]
    .sort((a, b) => b[1].parcels - a[1].parcels || a[0].localeCompare(b[0]))
    .slice(0, limit);

  const header = 'entity_name,entity_type,registered_agent,agent_address,officers,business_address,business_phone,status,file_number,source,note_parcels,note_cluster';
  const body = ranked.map(([name, e]) => [
    name, '', '', '', '', '', '', '', '', '',           // blanks for you to fill from PIR/SOS
    e.sibOnly ? 'cluster sibling' : e.parcels,
    [...e.siblings].join('; '),
  ].map(csvCell).join(','));
  fs.writeFileSync(out, [header, ...body].join('\n') + '\n');

  console.log(`\nworklist -> ${out}  (${ranked.length} entities to look up)`);
  console.log('top entities by parcels on/near the list:');
  for (const [name, e] of ranked.slice(0, 15)) {
    console.log(`  ${e.sibOnly ? '· ' : `${e.parcels}× `}${name}${e.siblings.size ? `   [+${e.siblings.size} cluster sibling(s)]` : ''}`);
  }
  console.log('\nNext:');
  console.log('  1) look each entity up (FREE current officers: comptroller.texas.gov PIR; or $1 SOSDirect)');
  console.log('  2) fill officers / registered_agent / business_phone columns');
  console.log(`  3) node ingest_business_affiliations.js ${out}`);
  console.log('  4) re-run export_curated.js — business leads now carry their people.');
})().catch(e => { console.error('WORKLIST FAILED:', e.message); process.exit(1); });
