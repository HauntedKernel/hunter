/**
 * Build the BUYER-READY CURATED LIST — the actual product Hunter sells.
 *
 * Buyers asked for a curated list, not a login (memory: flashstack-product-focus).
 * This is that deliverable: pick a territory (ZIPs), score every property with the
 * calibrated P(sell) model + the motivation signals, dedupe, rank, and emit ONE
 * clean CSV a buyer can work straight away — ranked, with plain-English reasons,
 * key facts, and contacts (owner + family).
 *
 * Two modes:
 *   (default)  full territory list — the top N motivated sellers in the ZIPs.
 *   --diff <old.db>  MONTHLY territory diff — only sellers who NEWLY entered
 *                    distress since the prior snapshot (new tax suit, newly
 *                    delinquent, or more delinquent years). This is the recurring
 *                    deliverable that makes a $500/mo EXCLUSIVE territory a
 *                    subscription with fresh inventory, not a one-time list.
 *
 * ELDERLY -> FAMILY CONTACT: when the owner is 65+, the senior often isn't the
 * decision-maker, and soliciting an elderly parent is both less effective and a
 * reputational/elder-abuse risk. If skip-trace relatives are on file, the sheet
 * surfaces the likely adult-child contact and flags "reach the family, not the
 * senior." (Relatives come from a skip-trace provider that returns structured
 * kin; see ingest_contacts.js `relatives`.)
 *
 * Usage:
 *   node export_curated.js --zips 75216,75208 [--limit 75] [--label "Oak Cliff"]
 *                          [--exclusive] [--diff src/data/tax_roll.db.bak-20250825]
 *                          [--out path.csv]
 *
 * COMPLIANCE: phones are stored DNC-unknown (fail-closed). The list is for the
 * buyer's own compliant outreach — they remain responsible for DNC/TCPA scrubbing
 * before calling. The sheet labels phones as un-scrubbed.
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

// Tax roll abbreviates "ESTATE OF" as "EST OF" — \b before EST avoids BEST/WEST OF.
const ESTATE_RE = /ESTATE OF|\bEST OF\b|LIFE ESTATE|HEIRS|\bET AL\b/i;
const CHILD_RE = /child|son|daughter|jr|junior/i;
// An owner_name that looks like an operating business / entity (not a person).
const BUSINESS_RE = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|\bCO\b|LP|LLP|LLLP|LTD|PLLC|PC|PROPERT(?:Y|IES)|HOMES?|INVESTMENTS?|INVESTORS?|REALTY|REAL ESTATE|CAPITAL|HOLDINGS?|GROUP|ENTERPRISES?|VENTURES?|PARTNERS?|MANAGEMENT|ASSOCIATES?|FUND|ASSETS?|EQUITY|RENTALS?|DEVELOPMENT|BANK|CHURCH|MINISTR(?:Y|IES)|ASSN|ASSOCIATION|FOUNDATION|LEASING|HOMEBUYERS?)\b/i;
function ownerType(name) {
  const n = String(name || '').toUpperCase();
  if (ESTATE_RE.test(n)) return 'Estate';
  if (/\b(LLC|L L C|PLLC)\b/.test(n)) return 'LLC';
  if (/\b(INC|INCORPORATED|CORP|CORPORATION)\b/.test(n)) return 'Corp';
  if (/\b(LP|LLP|LLLP|LTD)\b/.test(n)) return 'LP/Ltd';
  if (/\bTRUST\b/.test(n)) return 'Trust';
  if (BUSINESS_RE.test(n)) return 'Business';
  return 'Individual';
}

const cleanEstateName = (n) => String(n || '').replace(/\b(EST OF|ESTATE OF|LIFE ESTATE|HEIRS|ET AL|ETAL)\b/gi, '').replace(/&.*/, '').trim();

// A plain-English APPROACH note for the salesperson, synthesized from what we
// already know (public records + our signals). Outreach framing, not a profile.
function framingBrief(f) {
  const ind = f.industries || [];
  const role = ind.includes('Law/Attorney') ? 'an attorney'
    : (ind.includes('Medical') || ind.includes('Dental')) ? 'a medical professional'
    : ind.includes('Construction/Trades') ? 'a builder/contractor'
    : ind.includes('Accounting/Finance') ? 'a finance professional'
    : ind.includes('Real estate / Investor') ? 'a real-estate investor'
    : ind.length ? `a ${ind[0].toLowerCase()} business owner` : 'a business owner';
  const parts = [];
  if (f.estate) parts.push('Estate/inherited — the heirs are the decision-makers.');
  else if (f.isBiz) {
    let s = `${f.oType}-owned by ${role}`;
    const ppl = (f.peopleBehind || []).slice(0, 3);
    if (ppl.length) s += ` (${ppl.join(', ')})`;
    if (f.portfolioSize >= 3) s += `, managing ~${f.portfolioSize} properties`;
    parts.push(s + '.');
  } else if (f.elderly) parts.push(`Senior owner${f.longTenure >= 30 ? `, owned ${f.longTenure}+ yrs (likely downsizing)` : ''}.`);
  else if (f.absentee) parts.push('Out-of-area / absentee owner.');
  else parts.push('Owner-occupant.');

  const sit = [];
  if (f.suit) sit.push('active tax-foreclosure suit (time pressure)');
  else if (f.delinqYears) sit.push(`${f.delinqYears}y behind on taxes`);
  if (f.divorce) sit.push('divorce in process');
  if (f.bankruptcy) sit.push('bankruptcy filed');
  if (f.freeClear) sit.push('owns free & clear (flexible on price/terms)');
  if (sit.length) parts.push('Situation: ' + sit.join('; ') + '.');

  const ap = [];
  if (f.isBiz && /investor|builder|contractor/.test(role)) ap.push('B2B — talk numbers, lead with a clean cash offer; they know the process');
  else if (f.isBiz && /attorney|medical|finance/.test(role)) ap.push('time-poor professional — be concise and direct');
  if (f.estate || f.elderly || f.family) ap.push('low-pressure and patient; involve the family/heirs — reach the decision-maker');
  if (f.suit) ap.push('emphasize speed and certainty of close, no fees');
  else if (f.freeClear) ap.push("they don't need to sell — sell convenience/certainty, not desperation");
  if (!ap.length) ap.push('build rapport; understand their timeline');
  parts.push('Approach: ' + ap.join('; ') + '.');
  return parts.join(' ');
}

// Pre-built, disambiguated research links (manual OSINT entry points — no scraping).
function researchPack(f) {
  const q = (s) => `https://www.google.com/search?q=${encodeURIComponent(s)}`;
  const news = (s) => `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(s)}`;
  const name = f.ownerName || '';
  const ind = f.industries || [];
  const person = f.person || (!f.isBiz ? name : '');
  const links = [];
  if (f.isBiz) {
    links.push(`Web: ${q(`"${name}" Dallas TX`)}`);
    if (f.person) links.push(`Principal: ${q(`"${f.person}" "${name}" Dallas`)}`);
    links.push(`Reviews: ${q(`${name} Dallas reviews`)}`);
    links.push(`Entity: ${q(`"${name}" Texas Secretary of State`)}`);
  } else {
    const ctx = f.contextBiz ? ` "${f.contextBiz}"` : '';
    links.push(`Web: ${q(`"${name}"${ctx} Dallas TX`)}`);
    links.push(`News: ${news(`"${name}" Dallas`)}`);
  }
  if (f.estate) links.push(`Obituary: ${q(`"${cleanEstateName(name)}" obituary Dallas`)}`);
  if (person && ind.includes('Law/Attorney')) links.push(`Bar: ${q(`"${person}" site:texasbar.com`)}`);
  if (person && (ind.includes('Medical') || ind.includes('Dental'))) links.push(`Med board: ${q(`"${person}" site:profile.tmb.state.tx.us`)}`);
  if (person && ind.includes('Real estate / Investor')) links.push(`TREC: ${q(`"${person}" site:trec.texas.gov`)}`);
  return links.join(' | ');
}
const NOW_YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const hasFlag = (name) => process.argv.includes(name);
const csvCell = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const jparse = (s) => { try { const v = JSON.parse(s); return v; } catch { return null; } };

// Land deliverable is a formatted .xlsx (not CSV) so the buyer never has to resize/wrap:
// column widths are pre-set, long-text columns pre-wrapped, header frozen + auto-filtered.
const LAND_COLS = [
  { header: 'Rank', key: 'rank', width: 6 },
  { header: 'Priority', key: 'priority', width: 12 },
  { header: 'Owner', key: 'owner_name', width: 30 },
  { header: 'Type', key: 'owner_type', width: 11 },
  { header: 'Lots', key: 'lots', width: 6 },
  { header: 'Total value', key: 'total_value', width: 14, numFmt: '$#,##0' },
  { header: 'Sell prob %', key: 'sell_prob_pct', width: 11 },
  { header: 'Lift vs avg', key: 'lift', width: 11 },
  { header: 'Signals', key: 'signals', width: 30, wrap: true },
  { header: 'Properties (address — parcel # — value)', key: 'properties', width: 54, wrap: true },
  { header: 'Framing brief', key: 'framing_brief', width: 50, wrap: true },
  { header: 'Industries', key: 'industries', width: 18 },
  { header: 'Other props (countywide)', key: 'other_properties', width: 16 },
  { header: 'Recommended contact', key: 'recommended_contact', width: 22 },
  { header: 'Owner phones', key: 'owner_phones', width: 16 },
  { header: 'Owner emails', key: 'owner_emails', width: 22 },
  { header: 'Family contact', key: 'family_contact', width: 20 },
  { header: 'Family phones', key: 'family_phones', width: 16 },
  { header: 'Business contact', key: 'business_contact', width: 28, wrap: true },
  { header: 'People behind LLC', key: 'people_behind', width: 28, wrap: true },
  { header: 'Other businesses', key: 'other_businesses', width: 28, wrap: true },
  { header: 'Research links', key: 'research_links', width: 44, wrap: true },
  { header: 'Mailing address', key: 'mailing_address', width: 26 },
];

async function writeLandWorkbook(records, filePath, sheetName) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = LAND_COLS.map(c => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  LAND_COLS.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.alignment = { vertical: 'top', wrapText: !!c.wrap };
    if (c.numFmt) col.numFmt = c.numFmt;
  });
  records.forEach(r => ws.addRow(r));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: LAND_COLS.length } };
  await wb.xlsx.writeFile(filePath);
}

(async () => {
  const zipsArg = arg('--zips');
  if (!zipsArg) { console.error('Required: --zips 75216,75208'); process.exit(1); }
  const zips = zipsArg.split(',').map(z => z.trim()).filter(Boolean);
  const limit = Number(arg('--limit', '75'));
  const label = arg('--label', zips.join('-'));
  const exclusive = hasFlag('--exclusive');
  const diffDb = arg('--diff');
  const landMode = hasFlag('--land');   // vacant-land inventory instead of motivated sellers
  const outPath = arg('--out', `${landMode ? 'land' : 'curated'}_${label.replace(/[^a-z0-9]+/gi, '_')}_${TODAY}${diffDb ? '_NEW' : ''}.csv`);

  const dbPath = path.join(__dirname, 'src', 'data', 'tax_roll.db');
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  // Only join tables that actually exist (liens/divorce/appraisal/contacts are
  // built lazily by their ingesters).
  const present = new Set((await db.all(
    "SELECT name FROM sqlite_master WHERE type='table'")).map(r => r.name));
  const has = (t) => present.has(t);

  const colsOf = async (t) => has(t) ? new Set((await db.all(`PRAGMA table_info(${t})`)).map(c => c.name)) : new Set();
  const contactCols = await colsOf('contacts');

  const joins = [], cols = [];
  if (has('liens')) { joins.push('LEFT JOIN (SELECT account_id, free_and_clear, equity_pct FROM liens) l ON l.account_id=t.account_id'); cols.push('l.free_and_clear AS free_and_clear', 'l.equity_pct AS equity_pct'); }
  if (has('divorce_events')) { joins.push('LEFT JOIN (SELECT DISTINCT account_id FROM divorce_events) dv ON dv.account_id=t.account_id'); cols.push('dv.account_id AS has_divorce'); }
  if (has('appraisal_detail')) { joins.push('LEFT JOIN appraisal_detail ap ON ap.account_id=t.account_id'); cols.push('ap.tenure_years AS tenure_years', 'ap.year_built AS year_built'); }
  if (has('owner_portfolio')) { joins.push('LEFT JOIN owner_portfolio op ON op.account_id=t.account_id'); cols.push('op.portfolio_size AS portfolio_size', 'op.portfolio_value AS portfolio_value', 'op.is_institutional AS portfolio_institutional', 'op.portfolio_key AS portfolio_key'); }
  if (has('business_affiliations')) { joins.push('LEFT JOIN business_affiliations ba ON ba.account_id=t.account_id'); cols.push('ba.registered_agent AS ba_agent', 'ba.officers AS ba_officers', 'ba.business_phone AS ba_phone', 'ba.entity_type AS ba_type', 'ba.status AS ba_status'); }
  if (has('owner_cluster') && has('owner_portfolio')) { joins.push('LEFT JOIN owner_cluster oc ON oc.portfolio_key = op.portfolio_key'); cols.push('oc.individuals AS oc_individuals', 'oc.businesses AS oc_businesses', 'oc.industries AS oc_industries', 'oc.member_count AS oc_members', 'oc.is_institutional AS oc_institutional'); }
  if (has('contacts')) {
    joins.push('LEFT JOIN contacts c ON c.account_id=t.account_id');
    cols.push('c.phones AS c_phones', 'c.emails AS c_emails',
      contactCols.has('relatives') ? 'c.relatives AS c_relatives' : "'' AS c_relatives");
  }

  const zipWhere = zips.map(() => 't.zip_code LIKE ?').join(' OR ');
  const zipParams = zips.map(z => z.slice(0, 5) + '%');
  const baseCols = `t.account_id, t.owner_name, t.property_address, t.zip_code, t.owner_address,
    t.is_delinquent, t.is_absentee, t.over65_exemption, t.suit_pending, t.bankruptcy_filed,
    t.delinquent_years, t.total_amount_due, t.total_value, t.category_code,
    t.parcel_number, t.city, t.state`;

  // Motivated universe: any escalation/intent signal present.
  const motivatedWhere = `(t.suit_pending=1 OR t.is_delinquent=1 OR t.is_absentee=1
    ${has('divorce_events') ? 'OR dv.account_id IS NOT NULL' : ''}
    ${has('liens') ? 'OR l.free_and_clear=1' : ''}
    OR t.owner_name LIKE '%ESTATE OF%' OR t.owner_name LIKE '% EST OF%' OR t.owner_name LIKE '%HEIRS%')`;

  // Land universe: vacant land (SPTB category C*), minus owners that won't sell to a developer
  // (government, schools, transit, housing authorities — they don't sell raw land for profit).
  const GOV_EXCLUDE = `AND t.owner_name NOT LIKE 'CITY OF %' AND t.owner_name NOT LIKE '%ISD%'
    AND t.owner_name NOT LIKE 'COUNTY OF %' AND t.owner_name NOT LIKE '%DALLAS COUNTY%'
    AND t.owner_name NOT LIKE 'STATE OF %' AND t.owner_name NOT LIKE '%HOUSING AUTH%'
    AND t.owner_name NOT LIKE 'UNITED STATES%' AND t.owner_name NOT LIKE '%DART%'
    AND t.owner_name NOT LIKE '%REDEVELOPMENT%' AND t.owner_name NOT LIKE 'DEPARTMENT OF %'
    AND t.owner_name NOT LIKE '%SCHOOL DIST%' AND t.owner_name NOT LIKE '%COMMUNITY COLLEGE%'`;
  const landWhere = `t.category_code LIKE 'C%' ${GOV_EXCLUDE}`;

  // Land lists span roll_code R (residential lots) AND C (commercial vacant); motivated lists are R.
  const rollFilter = landMode ? '' : "t.roll_code='R' AND ";
  const universeWhere = landMode ? landWhere : motivatedWhere;
  const sql = `SELECT ${baseCols}${cols.length ? ',\n    ' + cols.join(',\n    ') : ''}
    FROM tax_roll t
    ${joins.join('\n    ')}
    WHERE ${rollFilter}t.owner_name IS NOT NULL AND (${zipWhere}) AND ${universeWhere}`;

  const rows = await db.all(sql, zipParams);
  console.log(`territory ${zips.join(', ')}: ${rows.length} ${landMode ? 'vacant-land parcels' : 'motivated properties'}`);

  // Diff mode: keep only properties NEWLY in distress vs an older snapshot.
  let newlyDistressed = null;
  if (diffDb) {
    const oldAbs = path.isAbsolute(diffDb) ? diffDb : path.join(__dirname, diffDb);
    if (!fs.existsSync(oldAbs)) { console.error(`--diff snapshot not found: ${oldAbs}`); process.exit(1); }
    await db.exec(`ATTACH DATABASE '${oldAbs.replace(/'/g, "''")}' AS old`);
    const prior = new Map((await db.all(
      `SELECT account_id, suit_pending, is_delinquent, delinquent_years FROM old.tax_roll`))
      .map(r => [r.account_id, r]));
    newlyDistressed = (r) => {
      const o = prior.get(r.account_id);
      if (!o) return true; // newly appearing parcel
      return (r.suit_pending && !o.suit_pending)
        || (r.is_delinquent && !o.is_delinquent)
        || ((r.delinquent_years || 0) > (o.delinquent_years || 0));
    };
    console.log(`diff vs ${path.basename(oldAbs)}: filtering to newly-distressed since that snapshot`);
  }

  // Score with the calibrated P(sell) model (fall back to a motivation count).
  let model = null;
  try { const M = require('./src/scoring/SellProbabilityModel'); model = new M(path.join(__dirname, 'src', 'scoring', 'sell_model.json')); if (!model.available) model = null; } catch { model = null; }

  // SPTB vacant-land subtype decode (for the land-list "land_type" column).
  const LAND_TYPE = { C1: 'Vacant residential lot', C11: 'Vacant residential lot', C12: 'Vacant commercial lot',
    C13: 'Vacant lot', C14: 'Vacant lot', C2: 'Vacant commercial lot', C3: 'Vacant lot', C4: 'Vacant lot' };

  const out = [];
  for (const r of rows) {
    if (newlyDistressed && !newlyDistressed(r)) continue;
    const estate = ESTATE_RE.test(r.owner_name || '') ? 1 : 0;
    const elderly = r.over65_exemption ? 1 : 0;
    const longTenure = (r.tenure_years != null && r.tenure_years >= 30) ? 1 : 0;
    const freeClear = r.free_and_clear === 1 ? 1 : 0;

    let prob = null, lift = null;
    if (model) {
      const sm = model.score({
        delinq: r.is_delinquent, absentee: r.is_absentee, elderly, suit: r.suit_pending, estate,
        dyears: r.delinquent_years || 0, totalAmountDue: r.total_amount_due || 0, totalValue: r.total_value || 0,
      });
      prob = sm ? sm.probability : null;
      lift = sm ? sm.lift : null;
    }
    // Fallback rank key if no model: weighted signal count.
    const bigPortfolio = (r.portfolio_size || 1) >= 3 && r.portfolio_institutional !== 1;
    // NOTE: absentee is ~universal on vacant land (nobody lives on an empty lot), so it
    // carries no signal there — drop it from the land motivation score. Distress (suit/
    // delinquent/estate) and multi-lot ownership (assemblage potential) are what matter.
    const motivation = (r.suit_pending ? 28 : 0) + (landMode ? 0 : (r.is_absentee ? 18 : 0)) + (estate ? 16 : 0)
      + (r.has_divorce ? 16 : 0) + (r.is_delinquent ? 12 : 0) + (freeClear ? 10 : 0)
      + (longTenure ? 8 : 0) + (elderly ? 6 : 0) + (r.bankruptcy_filed ? 8 : 0)
      + (bigPortfolio ? 8 : 0);

    // Plain-English reasons.
    const signals = [];
    if (r.suit_pending) signals.push('Tax suit pending');
    if (r.is_delinquent) signals.push(`Tax-delinquent${r.delinquent_years ? ` (${r.delinquent_years}y)` : ''}`);
    if (r.bankruptcy_filed) signals.push('Bankruptcy');
    if (r.is_absentee && !landMode) signals.push('Absentee owner'); // absentee is noise on vacant land
    if (estate) signals.push('Estate / heirs');
    if (r.has_divorce) signals.push('Divorce');
    if (freeClear) signals.push('Free & clear');
    if (elderly) signals.push('Senior owner (65+)');
    if (longTenure) signals.push(`Owned ${r.tenure_years}+ yrs`);
    // Portfolio: owner holds multiple properties (tired-landlord / investor cue).
    const portfolioSize = r.portfolio_size || 1;
    const isInstitutional = r.portfolio_institutional === 1;
    if (portfolioSize >= 3 && !isInstitutional) signals.push(`Owns ${portfolioSize} properties`);
    // Business affiliation: who really owns/decides on a business-held parcel.
    const oType = ownerType(r.owner_name);
    const isBiz = oType !== 'Individual' && oType !== 'Estate';
    if (isBiz) signals.push(`${oType}-owned`);
    // Registry contact: list ALL of it (agent + every officer + phone), no guessing.
    const businessContact = [
      r.ba_agent ? `Agent: ${r.ba_agent}` : '',
      r.ba_officers ? `Officers: ${r.ba_officers}` : '',
      r.ba_phone ? `Tel: ${r.ba_phone}` : '',
    ].filter(Boolean).join(' | ');

    // Owner cluster (entity resolution by mailing address) — list ALL members.
    const clusterInst = r.oc_institutional === 1;
    const clusterIndividuals = clusterInst ? [] : (jparse(r.oc_individuals) || []);
    const clusterBusinesses = clusterInst ? [] : (jparse(r.oc_businesses) || []);
    const clusterIndustries = clusterInst ? [] : (jparse(r.oc_industries) || []);
    // Everyone individual at the mailing address = candidate humans behind the LLC(s).
    const peopleBehind = clusterIndividuals.join('; ');
    // Every OTHER business at the same address (the owner's other entities).
    const otherBizList = clusterBusinesses.filter(b => b !== r.owner_name);
    const otherBusinesses = otherBizList.join('; ');

    // Contacts: owner phones/emails + family (for elderly).
    const ownerPhones = (jparse(r.c_phones) || []).map(p => (p && p.number) || p).filter(Boolean);
    const ownerEmails = jparse(r.c_emails) || [];
    const relatives = jparse(r.c_relatives) || [];
    // Prefer a relative explicitly tagged as a child; else any relative on file.
    const child = relatives.find(x => x && CHILD_RE.test(`${x.relationship || ''} ${x.name || ''}`)) || relatives[0] || null;
    const familyPhones = child ? (child.phones || []) : [];
    const recommendedContact = (elderly && child)
      ? 'FAMILY — owner is 65+; reach the family, not the senior'
      : 'Owner';

    const equityStatus = freeClear ? 'Free & clear'
      : (r.equity_pct != null && r.equity_pct !== '' ? `${Math.round(Number(r.equity_pct) * (Number(r.equity_pct) <= 1 ? 100 : 1))}% equity` : '');

    // Framing brief (approach note) + research pack (disambiguated OSINT links).
    const brief = framingBrief({
      oType, isBiz, industries: clusterIndustries, peopleBehind: clusterIndividuals,
      portfolioSize, suit: r.suit_pending, delinqYears: r.delinquent_years, absentee: r.is_absentee,
      estate, divorce: r.has_divorce, freeClear, elderly, longTenure: r.tenure_years || 0,
      bankruptcy: r.bankruptcy_filed, family: recommendedContact.startsWith('FAMILY'),
    });
    const research = researchPack({
      ownerName: r.owner_name, isBiz, estate, industries: clusterIndustries,
      person: clusterIndividuals[0] || (isBiz ? '' : r.owner_name),
      contextBiz: !isBiz ? (otherBizList[0] || '') : '',
    });

    const landType = landMode ? (LAND_TYPE[(r.category_code || '').trim()] || 'Vacant land') : '';
    // Clean "full" address: strip the trailing ", XX" DCAD area code from the situs street,
    // then compose street + city + state + 5-digit zip. Vacant lots usually have no street #.
    const zip5 = String(r.zip_code || '').replace(/\D/g, '').slice(0, 5);
    const street = String(r.property_address || '').replace(/,\s*[A-Z]{2}\s*$/, '').trim();
    const fullAddress = landMode
      ? [street || '(no situs street # — vacant lot)', r.city, `${r.state || 'TX'} ${zip5}`.trim()].filter(Boolean).join(', ')
      : '';

    out.push({
      account_id: r.account_id,
      parcel_number: r.parcel_number || '',
      category_code: (r.category_code || '').trim(),
      prob, motivation,
      total_value_num: r.total_value || 0,
      full_address: fullAddress,
      sell_prob_pct: prob != null ? (prob * 100).toFixed(1) : '',
      lift_vs_baseline: lift != null ? `${lift.toFixed(1)}x` : '',
      land_type: landType,
      signals: signals.join(' · '),
      framing_brief: brief,
      owner_name: r.owner_name,
      owner_type: oType,
      industries: clusterIndustries.join(', '),
      property_address: r.property_address,
      zip: String(r.zip_code).slice(0, 5),
      est_value: r.total_value ? Math.round(r.total_value) : '',
      equity_status: equityStatus,
      other_properties: portfolioSize > 1 ? portfolioSize - 1 + (isInstitutional ? ' (bulk mailing addr)' : '') : '',
      portfolio_value: (portfolioSize > 1 && r.portfolio_value && !isInstitutional) ? Math.round(r.portfolio_value) : '',
      years_owned: r.tenure_years ?? '',
      years_delinquent: r.delinquent_years || '',
      amount_due: r.total_amount_due ? Math.round(r.total_amount_due) : '',
      recommended_contact: recommendedContact,
      owner_phones: ownerPhones.join(' / '),
      owner_emails: (Array.isArray(ownerEmails) ? ownerEmails : []).join(' / '),
      family_contact: child ? `${child.name || ''}${child.relationship ? ` (${child.relationship})` : ''}` : '',
      family_phones: familyPhones.join(' / '),
      business_contact: businessContact,
      people_behind: peopleBehind,
      other_businesses: otherBusinesses,
      research_links: research,
      cluster_size: r.oc_members && r.oc_members > 1 ? r.oc_members + (clusterInst ? ' (bulk/agent addr)' : '') : '',
      mailing_address: r.owner_address || '',
    });
  }

  // ===== LAND deliverable: group parcels by owner, split residential vs commercial, write .xlsx =====
  if (landMode) {
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const RES = new Set(['C11', 'C1']);                  // C11/C1 = vacant residential; rest = commercial/other
    const DISTRESS_RE = /suit pending|Tax-delinquent|Estate|Bankruptcy|Free & clear|Divorce/i;

    const groupByOwner = (parcels) => {
      const m = new Map();
      for (const p of parcels) { const k = norm(p.owner_name); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
      const recs = [];
      for (const lots of m.values()) {
        // Lead parcel (best signal) supplies the owner-level enrichment; lots become the sublist.
        lots.sort((a, b) => b.motivation - a.motivation || (b.prob ?? 0) - (a.prob ?? 0) || b.total_value_num - a.total_value_num);
        const lead = lots[0];
        const totalValue = lots.reduce((s, x) => s + (x.total_value_num || 0), 0);
        const bestProb = lots.reduce((mx, x) => Math.max(mx, x.prob ?? 0), 0);
        const bestLift = lots.reduce((mx, x) => Math.max(mx, x.lift_vs_baseline ? parseFloat(x.lift_vs_baseline) : 0), 0);
        const signals = [...new Set(lots.flatMap(x => String(x.signals || '').split(' · ')).filter(Boolean))];
        const hasDistress = lots.some(x => DISTRESS_RE.test(x.signals || ''));
        const properties = lots.map(x =>
          `${x.full_address}  —  Parcel ${x.parcel_number || x.account_id}  —  ${x.total_value_num ? '$' + Math.round(x.total_value_num).toLocaleString() : 'n/a'} (${x.land_type})`
        ).join('\n');
        recs.push({
          _mot: lead.motivation, _prob: bestProb, _val: totalValue, _distress: hasDistress ? 1 : 0,
          priority: hasDistress ? 'Distressed' : 'Standard',
          owner_name: lead.owner_name, owner_type: lead.owner_type, lots: lots.length,
          total_value: totalValue || null,
          sell_prob_pct: bestProb ? +(bestProb * 100).toFixed(1) : '',
          lift: bestLift ? bestLift.toFixed(1) + 'x' : '',
          signals: signals.join(' · '),
          properties,
          framing_brief: lead.framing_brief, industries: lead.industries,
          other_properties: lead.other_properties, recommended_contact: lead.recommended_contact,
          owner_phones: lead.owner_phones, owner_emails: lead.owner_emails,
          family_contact: lead.family_contact, family_phones: lead.family_phones,
          business_contact: lead.business_contact, people_behind: lead.people_behind,
          other_businesses: lead.other_businesses, research_links: lead.research_links,
          mailing_address: lead.mailing_address,
        });
      }
      // Rank: distressed owners first, then signal strength, then assemblage/portfolio value.
      recs.sort((a, b) => b._distress - a._distress || b._mot - a._mot || b._prob - a._prob || b._val - a._val);
      recs.forEach((r, i) => { r.rank = i + 1; });
      return recs;
    };

    const resParcels = out.filter(p => RES.has(p.category_code));
    const comParcels = out.filter(p => !RES.has(p.category_code));
    const resRecs = groupByOwner(resParcels);
    const comRecs = groupByOwner(comParcels);
    const base = `land_${label.replace(/[^a-z0-9]+/gi, '_')}_${TODAY}`;
    const resPath = path.join(__dirname, `${base}_RESIDENTIAL.xlsx`);
    const comPath = path.join(__dirname, `${base}_COMMERCIAL.xlsx`);
    await writeLandWorkbook(resRecs, resPath, 'Residential land');
    await writeLandWorkbook(comRecs, comPath, 'Commercial land');

    const basePct = model && model.baseRate ? (model.baseRate * 100).toFixed(1) : '~6';
    console.log(`\n${exclusive ? 'EXCLUSIVE ' : ''}LAND lists (owner-grouped, ranked) — territory ${zips.join(', ')}:`);
    console.log(`  RESIDENTIAL -> ${resPath}`);
    console.log(`     ${resRecs.length} owners / ${resParcels.length} lots; ${resRecs.filter(r => r._distress).length} distressed owners ranked first`);
    console.log(`  COMMERCIAL  -> ${comPath}`);
    console.log(`     ${comRecs.length} owners / ${comParcels.length} lots; ${comRecs.filter(r => r._distress).length} distressed owners ranked first`);
    console.log(`  P(sell)% + lift shown per owner (baseline ${basePct}%/yr). Model is residential-trained; for land the hard signals are tax-suit / delinquent / estate / multi-lot.`);
    console.log('  NOTE: vacant lots rarely carry a street # — the Parcel/Account number is the locator (title/DCAD). No lot-size field exists in the roll.');
    console.log('  COMPLIANCE: any phones are NOT DNC-scrubbed — buyer must scrub before calling.');
    if (diffDb) await db.exec('DETACH DATABASE old');
    await db.close();
    return;
  }

  // Rank by calibrated P(sell) when available, else the motivation score.
  out.sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0) || b.motivation - a.motivation);
  const top = out.slice(0, limit);
  top.forEach((o, i) => { o.rank = i + 1; });

  const header = ['rank', 'sell_prob_pct', 'signals', 'framing_brief', 'owner_name', 'owner_type', 'industries', 'property_address', 'zip',
    'est_value', 'equity_status', 'other_properties', 'portfolio_value', 'cluster_size', 'years_owned', 'years_delinquent', 'amount_due',
    'recommended_contact', 'owner_phones', 'owner_emails', 'family_contact', 'family_phones',
    'business_contact', 'people_behind', 'other_businesses', 'research_links', 'mailing_address', 'account_id'];
  const body = top.map(o => header.map(h => csvCell(o[h] ?? '')).join(','));
  fs.writeFileSync(outPath, [header.join(','), ...body].join('\n') + '\n');

  const withContacts = top.filter(o => o.owner_phones || o.family_phones).length;
  const elderlyFamily = top.filter(o => o.recommended_contact.startsWith('FAMILY')).length;
  console.log(`\n${exclusive ? 'EXCLUSIVE ' : ''}curated list -> ${outPath}`);
  console.log(`  ${top.length} leads${diffDb ? ' (NEW this period)' : ''}, ranked by ${model ? 'P(sell)' : 'motivation score'}`);
  console.log(`  ${withContacts} have a phone on file; ${elderlyFamily} elderly leads routed to a family contact`);
  if (!withContacts) console.log('  NOTE: no contacts yet — skip-trace a PropStream pull, map_propstream.js, ingest_contacts.js, then re-run.');
  console.log('  COMPLIANCE: phones are NOT DNC-scrubbed — buyer must scrub before calling.');
  if (diffDb) await db.exec('DETACH DATABASE old');
  await db.close();
})().catch(e => { console.error('EXPORT FAILED:', e.message); process.exit(1); });
