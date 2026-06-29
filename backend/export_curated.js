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
const NOW_YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const hasFlag = (name) => process.argv.includes(name);
const csvCell = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const jparse = (s) => { try { const v = JSON.parse(s); return v; } catch { return null; } };

(async () => {
  const zipsArg = arg('--zips');
  if (!zipsArg) { console.error('Required: --zips 75216,75208'); process.exit(1); }
  const zips = zipsArg.split(',').map(z => z.trim()).filter(Boolean);
  const limit = Number(arg('--limit', '75'));
  const label = arg('--label', zips.join('-'));
  const exclusive = hasFlag('--exclusive');
  const diffDb = arg('--diff');
  const outPath = arg('--out', `curated_${label.replace(/[^a-z0-9]+/gi, '_')}_${TODAY}${diffDb ? '_NEW' : ''}.csv`);

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
  if (has('owner_portfolio')) { joins.push('LEFT JOIN owner_portfolio op ON op.account_id=t.account_id'); cols.push('op.portfolio_size AS portfolio_size', 'op.portfolio_value AS portfolio_value', 'op.is_institutional AS portfolio_institutional'); }
  if (has('contacts')) {
    joins.push('LEFT JOIN contacts c ON c.account_id=t.account_id');
    cols.push('c.phones AS c_phones', 'c.emails AS c_emails',
      contactCols.has('relatives') ? 'c.relatives AS c_relatives' : "'' AS c_relatives");
  }

  const zipWhere = zips.map(() => 't.zip_code LIKE ?').join(' OR ');
  const zipParams = zips.map(z => z.slice(0, 5) + '%');
  const baseCols = `t.account_id, t.owner_name, t.property_address, t.zip_code, t.owner_address,
    t.is_delinquent, t.is_absentee, t.over65_exemption, t.suit_pending, t.bankruptcy_filed,
    t.delinquent_years, t.total_amount_due, t.total_value`;

  // Motivated universe: any escalation/intent signal present.
  const motivatedWhere = `(t.suit_pending=1 OR t.is_delinquent=1 OR t.is_absentee=1
    ${has('divorce_events') ? 'OR dv.account_id IS NOT NULL' : ''}
    ${has('liens') ? 'OR l.free_and_clear=1' : ''}
    OR t.owner_name LIKE '%ESTATE OF%' OR t.owner_name LIKE '% EST OF%' OR t.owner_name LIKE '%HEIRS%')`;

  const sql = `SELECT ${baseCols}${cols.length ? ',\n    ' + cols.join(',\n    ') : ''}
    FROM tax_roll t
    ${joins.join('\n    ')}
    WHERE t.roll_code='R' AND t.owner_name IS NOT NULL AND (${zipWhere}) AND ${motivatedWhere}`;

  const rows = await db.all(sql, zipParams);
  console.log(`territory ${zips.join(', ')}: ${rows.length} motivated properties`);

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

  const out = [];
  for (const r of rows) {
    if (newlyDistressed && !newlyDistressed(r)) continue;
    const estate = ESTATE_RE.test(r.owner_name || '') ? 1 : 0;
    const elderly = r.over65_exemption ? 1 : 0;
    const longTenure = (r.tenure_years != null && r.tenure_years >= 30) ? 1 : 0;
    const freeClear = r.free_and_clear === 1 ? 1 : 0;

    let prob = null;
    if (model) {
      const sm = model.score({
        delinq: r.is_delinquent, absentee: r.is_absentee, elderly, suit: r.suit_pending, estate,
        dyears: r.delinquent_years || 0, totalAmountDue: r.total_amount_due || 0, totalValue: r.total_value || 0,
      });
      prob = sm ? sm.probability : null;
    }
    // Fallback rank key if no model: weighted signal count.
    const bigPortfolio = (r.portfolio_size || 1) >= 3 && r.portfolio_institutional !== 1;
    const motivation = (r.suit_pending ? 28 : 0) + (r.is_absentee ? 18 : 0) + (estate ? 16 : 0)
      + (r.has_divorce ? 16 : 0) + (r.is_delinquent ? 12 : 0) + (freeClear ? 10 : 0)
      + (longTenure ? 8 : 0) + (elderly ? 6 : 0) + (r.bankruptcy_filed ? 8 : 0)
      + (bigPortfolio ? 8 : 0);

    // Plain-English reasons.
    const signals = [];
    if (r.suit_pending) signals.push('Tax suit pending');
    if (r.is_delinquent) signals.push(`Tax-delinquent${r.delinquent_years ? ` (${r.delinquent_years}y)` : ''}`);
    if (r.bankruptcy_filed) signals.push('Bankruptcy');
    if (r.is_absentee) signals.push('Absentee owner');
    if (estate) signals.push('Estate / heirs');
    if (r.has_divorce) signals.push('Divorce');
    if (freeClear) signals.push('Free & clear');
    if (elderly) signals.push('Senior owner (65+)');
    if (longTenure) signals.push(`Owned ${r.tenure_years}+ yrs`);
    // Portfolio: owner holds multiple properties (tired-landlord / investor cue).
    const portfolioSize = r.portfolio_size || 1;
    const isInstitutional = r.portfolio_institutional === 1;
    if (portfolioSize >= 3 && !isInstitutional) signals.push(`Owns ${portfolioSize} properties`);

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

    out.push({
      account_id: r.account_id,
      prob, motivation,
      sell_prob_pct: prob != null ? (prob * 100).toFixed(1) : '',
      signals: signals.join(' · '),
      owner_name: r.owner_name,
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
      mailing_address: r.owner_address || '',
    });
  }

  // Rank by calibrated P(sell) when available, else the motivation score.
  out.sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0) || b.motivation - a.motivation);
  const top = out.slice(0, limit);
  top.forEach((o, i) => { o.rank = i + 1; });

  const header = ['rank', 'sell_prob_pct', 'signals', 'owner_name', 'property_address', 'zip',
    'est_value', 'equity_status', 'other_properties', 'portfolio_value', 'years_owned', 'years_delinquent', 'amount_due',
    'recommended_contact', 'owner_phones', 'owner_emails', 'family_contact', 'family_phones',
    'mailing_address', 'account_id'];
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
