/**
 * Fetch Dallas 311 CODE-COMPLIANCE requests from the FREE Dallas OpenData SODA API
 * (dataset gc4d-8a49) and write a normalized CSV that ingest_311.js can load.
 *
 * SOURCE (free, hourly, PDDL public domain):
 *   https://www.dallasopendata.com/resource/gc4d-8a49.json  (SODA / Socrata)
 * No API token required for modest volume; set SODA_APP_TOKEN to raise rate limits.
 *
 * What it does:
 *   - pages through the dataset (newest first),
 *   - fuzzily maps columns (Socrata field names drift), so it survives schema
 *     tweaks; if a field can't be found it prints the detected header for you,
 *   - keeps only CODE-COMPLIANCE-type, still-OPEN requests within --months,
 *   - writes request_type,account_id,address,status,opened_date,closed_date,source.
 *
 * Usage:
 *   node fetch_311.js [--months=12] [--out=imports/dallas_311_code.csv] [--max=50000]
 *   then: node ingest_311.js imports/dallas_311_code.csv
 *
 * NOTE: 311 has no parcel/account id, so account_id is left blank — see ingest_311.js
 * for the precision-first address matching (and its ALLOW_LOOSE_MATCH caveat).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DATASET = 'gc4d-8a49';
const HOST = 'www.dallasopendata.com';

// CLI args
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const MONTHS = Number(args.months || 12);
const MAX = Number(args.max || 50000);
const OUT = args.out || path.join('imports', 'dallas_311_code.csv');
const TOKEN = process.env.SODA_APP_TOKEN || '';

// A request is "code compliance" if its department/type/description hits one of
// these. Broad on purpose; tighten if the result is noisy.
const CODE_KEYWORDS = [
  'CODE', 'COMPLIANCE', 'SUBSTANDARD', 'JUNK', 'DEBRIS', 'WEED', 'HIGH GRASS',
  'TALL GRASS', 'OVERGROWN', 'LITTER', 'NUISANCE', 'DILAPIDAT', 'ILLEGAL DUMP',
  'ABANDONED', 'BOARD', 'UNSANITARY', 'PROPERTY MAINTENANCE'
];
const CLOSED_HINTS = ['CLOSED', 'COMPLETE', 'RESOLVED', 'CANCEL', 'DUPLICATE'];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function pick(keys, aliases) {
  const al = aliases.map(norm);
  for (const k of keys) if (al.includes(norm(k))) return k;        // exact
  for (const k of keys) if (al.some(a => norm(k).includes(a))) return k; // contains
  return null;
}

function getJson(urlPath) {
  return new Promise((resolve, reject) => {
    const opts = { host: HOST, path: urlPath, headers: TOKEN ? { 'X-App-Token': TOKEN } : {} };
    https.get(opts, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

(async () => {
  const cutoff = new Date(Date.now() - MONTHS * 30 * 86400000).toISOString().slice(0, 10);
  const PAGE = 5000;
  let offset = 0, col = null, kept = 0, scanned = 0;
  const outRows = [];

  while (scanned < MAX) {
    const qp = `$limit=${PAGE}&$offset=${offset}&$order=:id`;
    const batch = await getJson(`/resource/${DATASET}.json?${qp}`);
    if (!batch.length) break;
    if (!col) {
      const keys = Object.keys(batch[0]);
      col = {
        type: pick(keys, ['servicerequesttype', 'srtype', 'type', 'code', 'description', 'requesttype', 'category']),
        dept: pick(keys, ['department', 'division', 'agency', 'group']),
        status: pick(keys, ['status', 'srstatus', 'casestatus', 'requeststatus']),
        opened: pick(keys, ['createddate', 'opendate', 'srcreatedate', 'datetimeopened', 'startdate', 'reporteddate']),
        closed: pick(keys, ['closeddate', 'datetimeclosed', 'resolutiondate', 'completeddate', 'enddate']),
        address: pick(keys, ['streetaddress', 'incidentaddress', 'address', 'location', 'serviceaddress', 'fulladdress']),
      };
      console.log('detected columns:', JSON.stringify(col));
      console.log('available header:', keys.join(', '));
    }
    for (const r of batch) {
      scanned++;
      const type = col.type ? r[col.type] : '';
      const dept = col.dept ? r[col.dept] : '';
      const hay = `${type} ${dept}`.toUpperCase();
      if (!CODE_KEYWORDS.some(k => hay.includes(k))) continue;
      const status = (col.status ? r[col.status] : '') || '';
      if (CLOSED_HINTS.some(h => status.toUpperCase().includes(h))) continue; // keep OPEN only
      const opened = (col.opened ? r[col.opened] : '') || '';
      if (opened && opened.slice(0, 10) < cutoff) continue;                   // recency window
      outRows.push({
        request_type: type || dept || 'Code Compliance',
        account_id: '',
        address: col.address ? r[col.address] : '',
        status,
        opened_date: opened ? opened.slice(0, 10) : '',
        closed_date: (col.closed ? r[col.closed] : '') ? String(r[col.closed]).slice(0, 10) : '',
        source: 'dallas_311',
      });
      kept++;
    }
    offset += batch.length;
    if (batch.length < PAGE) break;
    process.stdout.write(`\rscanned ${scanned}, kept ${kept}...`);
  }
  process.stdout.write('\n');

  if (!outRows.length) {
    console.error('No code-compliance rows matched. Check the "detected columns" above; if `type`/`dept` is null, paste me the header and I will adjust the aliases.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const header = 'request_type,account_id,address,status,opened_date,closed_date,source';
  const body = outRows.map(r => [r.request_type, r.account_id, r.address, r.status, r.opened_date, r.closed_date, r.source].map(csvCell).join(',')).join('\n');
  fs.writeFileSync(OUT, header + '\n' + body + '\n');
  console.log(`wrote ${outRows.length} code-compliance requests → ${OUT}`);
  console.log(`next: node ingest_311.js ${OUT}`);
})().catch(e => { console.error('FETCH FAILED:', e.message); process.exit(1); });
