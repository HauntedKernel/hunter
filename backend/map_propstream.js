/**
 * Map a PropStream export CSV into the CSV shapes Hunter's ingesters accept,
 * resolving each row to a DCAD account_id against tax_roll.db.
 *
 *   - liens CSV    -> ingest_liens.js     (free-and-clear / equity signal)
 *   - contacts CSV -> ingest_contacts.js  (skip-trace phone/email)
 *
 * PropStream column names vary by export template, so headers are matched fuzzily
 * (case/space-insensitive, with aliases). Run it; it prints which columns it found.
 * If something didn't map, paste me your export's header row and I'll add the alias.
 *
 * Account resolution: APN (digits, also zero-padded to 17 = DCAD format) verified
 * against tax_roll; falls back to property address (street+ZIP) + owner name.
 *
 * Usage:
 *   node map_propstream.js <propstream.csv> [--all-clear] [--liens out_liens.csv] [--contacts out_contacts.csv]
 *   # with no --liens/--contacts it auto-emits whichever the data supports.
 *   --all-clear : the export was filtered to "Free & Clear" in PropStream, so mark
 *                 every row free_and_clear=1 (use when there's no mortgage column).
 * Then: node ingest_liens.js out_liens.csv   /   node ingest_contacts.js out_contacts.csv
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return { headers: [], rows };
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const headers = split(lines[0]);
  const keys = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (let i = 1; i < lines.length; i++) {
    const vals = split(lines[i]); const row = {};
    keys.forEach((k, j) => { row[k] = vals[j] || ''; });
    rows.push(row);
  }
  return { headers, keys, rows };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const streetToken = (a) => (String(a || '').toUpperCase().match(/[A-Z]{4,}/g) || []).sort((x, y) => y.length - x.length)[0] || '';
const NAME_STOP = new Set(['AND', 'THE', 'LIFE', 'ESTATE', 'HEIRS', 'TRUST', 'LLC', 'INC', 'COMPANY', 'UNKNOWN']);
const nameTokens = (n) => ([...new Set((String(n || '').toUpperCase().match(/[A-Z]{4,}/g) || []))]).filter(t => !NAME_STOP.has(t));
const number = (v) => { if (v == null || String(v).trim() === '') return null; const n = Number(String(v).replace(/[$,%]/g, '')); return Number.isFinite(n) ? n : null; };
const csvCell = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

// Find the first present key whose normalized header matches any alias (normalized).
function pick(keys, aliases) {
  const al = aliases.map(norm);
  for (const k of keys) if (al.includes(k)) return k;
  // loose contains-match as a fallback
  for (const k of keys) if (al.some(a => k.includes(a))) return k;
  return null;
}

(async () => {
  const args = process.argv.slice(2);
  const inPath = args.find(a => !a.startsWith('--'));
  if (!inPath) { console.error('Provide a PropStream export CSV'); process.exit(1); }
  const allClear = args.includes('--all-clear');
  const flagVal = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
  let liensOut = flagVal('--liens');
  let contactsOut = flagVal('--contacts');

  const { keys, rows } = parseCsv(fs.readFileSync(inPath, 'utf8'));
  console.log(`parsed ${rows.length} PropStream rows`);

  const col = {
    apn: pick(keys, ['apn', 'parcelnumber', 'parcel', 'parcelid', 'account', 'accountnumber']),
    addr: pick(keys, ['propertyaddress', 'address', 'siteaddress', 'propertystreetaddress', 'propertyaddress1']),
    zip: pick(keys, ['propertyzip', 'propertyzipcode', 'zip', 'sitezip', 'zipcode']),
    ownerFull: pick(keys, ['ownername', 'owner1fullname', 'ownerfullname']),
    ownerFirst: pick(keys, ['owner1firstname', 'ownerfirstname', 'firstname']),
    ownerLast: pick(keys, ['owner1lastname', 'ownerlastname', 'lastname']),
    estValue: pick(keys, ['estimatedvalue', 'estvalue', 'avm', 'estimatedmarketvalue', 'marketvalue']),
    estEquity: pick(keys, ['estimatedequity', 'estequity', 'equity']),
    mtgBal: pick(keys, ['openmortgagebalance', 'totalopenlien', 'estimatedopenloansbalance', 'loanbalance', 'totalloanbalance', 'mortgagebalance', 'openloans']),
    mtgDate: pick(keys, ['mortgagerecordingdate', 'lastmortgagedate', 'loanrecordingdate']),
    mtgAmt: pick(keys, ['mortgageamount', 'loanamount', 'lastmortgageamount']),
  };
  const phoneKeys = keys.filter(k => /(phone|mobile|landline|wireless|cell)/.test(k));
  const emailKeys = keys.filter(k => /email/.test(k));
  console.log('detected columns:', JSON.stringify(col));
  console.log('phone columns:', phoneKeys.join(', ') || '(none)', '| email columns:', emailKeys.join(', ') || '(none)');

  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  // Prefer first+last (PropStream's usual shape); fall back to a full-name column.
  const ownerNameOf = (r) => {
    const fl = [col.ownerFirst ? r[col.ownerFirst] : '', col.ownerLast ? r[col.ownerLast] : ''].filter(Boolean).join(' ');
    return fl || (col.ownerFull ? r[col.ownerFull] : '');
  };

  async function resolve(r) {
    // 1) APN -> account_id (digits, and zero-padded to 17 = DCAD format)
    const apn = (col.apn ? r[col.apn] : '').replace(/\D/g, '');
    if (apn) {
      const padded = apn.padStart(17, '0');
      for (const cand of [apn, padded]) {
        const hit = await db.get('SELECT account_id, owner_name FROM tax_roll WHERE account_id = ?', [cand]);
        if (hit) return { id: hit.account_id, owner: hit.owner_name, how: 'apn' };
      }
    }
    // 2) property address (street+ZIP) + owner name
    const addr = col.addr ? r[col.addr] : '';
    const zip = (col.zip ? r[col.zip] : (String(addr).match(/\b(\d{5})\b/) || [])[1] || '').slice(0, 5);
    const tok = streetToken(addr);
    const names = nameTokens(ownerNameOf(r));
    if (tok && zip && names.length) {
      const ownerOr = names.map(() => 'UPPER(owner_name) LIKE ?').join(' OR ');
      const hit = await db.get(
        `SELECT account_id, owner_name FROM tax_roll WHERE UPPER(property_address) LIKE ? AND zip_code LIKE ? AND (${ownerOr}) LIMIT 1`,
        [`%${tok}%`, `${zip}%`, ...names.map(n => `%${n}%`)]
      );
      if (hit) return { id: hit.account_id, owner: hit.owner_name, how: 'address+owner' };
    }
    return null;
  }

  const hasLiens = !!(col.estValue || col.estEquity || col.mtgBal || allClear);
  const hasContacts = phoneKeys.length || emailKeys.length;
  if (!liensOut && hasLiens) liensOut = 'propstream_liens.csv';
  if (!contactsOut && hasContacts) contactsOut = 'propstream_contacts.csv';

  const lienRows = [], contactRows = [];
  const counts = { apn: 0, 'address+owner': 0, unmatched: 0 };
  for (const r of rows) {
    const m = await resolve(r);
    if (!m) { counts.unmatched++; continue; }
    counts[m.how]++;

    if (liensOut) {
      const bal = col.mtgBal ? number(r[col.mtgBal]) : null;
      const val = col.estValue ? number(r[col.estValue]) : null;
      const eq = col.estEquity ? number(r[col.estEquity]) : null;
      let fac = '';
      if (bal != null) fac = bal <= 0 ? 1 : 0;
      else if (allClear) fac = 1;
      else if (eq != null && val) fac = (eq / val >= 0.99) ? 1 : 0;
      lienRows.push([m.id, m.owner, fac, bal != null ? (bal > 0 ? 1 : 0) : '', bal ?? '', val ?? '', eq ?? '',
        col.mtgDate ? r[col.mtgDate] : '', col.mtgAmt ? (number(r[col.mtgAmt]) ?? '') : '', 'propstream']);
    }
    if (contactsOut) {
      const phones = [...new Set(phoneKeys.map(k => String(r[k] || '').replace(/\D/g, '')).filter(p => p.length >= 10))];
      const emails = [...new Set(emailKeys.map(k => String(r[k] || '').trim()).filter(e => e.includes('@')))];
      if (phones.length || emails.length) contactRows.push([m.id, phones.join(';'), emails.join(';'), 'propstream']);
    }
  }

  if (liensOut) {
    const fac = lienRows.filter(r => r[2] === 1).length;
    fs.writeFileSync(liensOut, ['account_id,owner_name,free_and_clear,open_lien_count,mortgage_balance,est_value,est_equity,last_mortgage_date,last_mortgage_amount,source',
      ...lienRows.map(r => r.map(csvCell).join(','))].join('\n') + '\n');
    console.log(`\nliens -> ${liensOut}  (${lienRows.length} rows, ${fac} free-and-clear)`);
    if (!col.mtgBal && !allClear) console.log('  NOTE: no mortgage-balance column found; free_and_clear inferred from equity>=99% (imprecise). If you filtered PropStream to "Free & Clear", re-run with --all-clear.');
    console.log(`  then: node ingest_liens.js ${liensOut}`);
  }
  if (contactsOut) {
    fs.writeFileSync(contactsOut, ['account_id,phones,emails,source', ...contactRows.map(r => r.map(csvCell).join(','))].join('\n') + '\n');
    console.log(`\ncontacts -> ${contactsOut}  (${contactRows.length} rows with a phone/email)`);
    console.log(`  then: node ingest_contacts.js ${contactsOut}`);
  }
  console.log('\nmatch breakdown:', JSON.stringify(counts));
  if (counts.unmatched) console.log(`  ${counts.unmatched} rows could not be matched to a Dallas account (out-of-county, or APN/address format mismatch).`);
  await db.close();
})().catch(e => { console.error('MAP FAILED:', e.message); process.exit(1); });
