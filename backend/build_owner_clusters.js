/**
 * Build OWNER CLUSTERS — entity resolution by mailing address — the free
 * "LLC breaker". Every parcel + owner-name variant (the LLCs AND the human) that
 * shares one mailing address is one cluster. For most small investors the
 * individual sitting in the cluster IS the person behind the LLCs, and the cluster
 * lists their whole footprint — no registry data required.
 *
 * Lists EVERYTHING (per Cole): ALL individuals and ALL businesses in the cluster,
 * not a guessed single principal. Plus industry tags inferred from the business
 * names, to give the salesperson approach-context ("lawyer → direct; pet → pets").
 *
 * Registered-agent-service addresses (a law firm / CT Corp / Registered Agents Inc
 * with dozens of UNRELATED entities) are NOT one owner — clusters with too many
 * distinct names are flagged is_institutional and their member lists are withheld,
 * because grouping them would be a false link, not a trimmed one.
 *
 * Keyed by mailing address using the SAME normalization as build_portfolios.js, so
 * owner_cluster joins owner_portfolio.portfolio_key. Re-run after a roll refresh.
 *
 * Usage:  node build_owner_clusters.js [--inst 40]   (max distinct names before
 *         a cluster is treated as a registered-agent / institutional address)
 */
const path = require('path');
const sqlite3 = require('sqlite3');

const instI = process.argv.indexOf('--inst');
const INSTITUTIONAL = instI !== -1 && process.argv[instI + 1] ? Number(process.argv[instI + 1]) : 40;
const normAddr = (a) => String(a || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const BUSINESS_RE = /\b(LLC|L L C|INC|INCORPORATED|CORP|CORPORATION|COMPANY|\bCO\b|LP|LLP|LLLP|LTD|PLLC|PC|PROPERT(?:Y|IES)|HOMES?|INVESTMENTS?|INVESTORS?|REALTY|REAL ESTATE|CAPITAL|HOLDINGS?|GROUP|ENTERPRISES?|VENTURES?|PARTNERS?|MANAGEMENT|ASSOCIATES?|FUND|ASSETS?|EQUITY|RENTALS?|DEVELOPMENT|BANK|CHURCH|MINISTR(?:Y|IES)|ASSN|ASSOCIATION|FOUNDATION|LEASING|HOMEBUYERS?)\b/i;
const ESTATE_RE = /ESTATE OF|\bEST OF\b|LIFE ESTATE|HEIRS|\bET AL\b/i;

// Rough industry inference from a business name → sales-approach context.
const INDUSTRY = [
  [/\bDENTAL|DDS|ORTHODON/, 'Dental'],
  [/\bLAW\b|LEGAL|ATTORNEY|\bESQ\b|COUNSEL/, 'Law/Attorney'],
  [/MEDICAL|CLINIC|\bMD\b|HEALTH|PHYSICIAN|SURG|PHARMAC|DERMA|CARDIO|PEDIATR/, 'Medical'],
  [/\bPET|\bVET\b|VETERIN|ANIMAL|GROOM|\bK9\b|KENNEL/, 'Pet/Veterinary'],
  [/PLUMB|\bHVAC\b|ELECTRIC|ROOFING|CONCRETE|CONSTRUCT|BUILDERS?|CONTRACTOR|REMODEL|FOUNDATION REPAIR|PAINTING|FENCE/, 'Construction/Trades'],
  [/REAL ESTATE|REALTY|PROPERT|\bHOMES?\b|INVESTMENT|CAPITAL|HOLDING|RENTAL|LEASING|REI\b/, 'Real estate / Investor'],
  [/\bAUTO|MOTORS?|\bTIRE|COLLISION|TRANSMISSION|BODY SHOP/, 'Automotive'],
  [/RESTAURANT|\bCAFE|GRILL|\bBBQ\b|CATERING|\bFOOD|KITCHEN|TAQUERIA|PIZZA|BAKERY/, 'Food/Restaurant'],
  [/SALON|BEAUTY|\bHAIR|\bNAIL|\bSPA\b|BARBER|COSMET/, 'Beauty/Salon'],
  [/CHURCH|MINISTR|TEMPLE|MOSQUE|CHAPEL|FELLOWSHIP/, 'Religious org'],
  [/TRUCK|LOGISTIC|TRANSPORT|FREIGHT|HAULING|COURIER/, 'Trucking/Logistics'],
  [/CONSULT/, 'Consulting'],
  [/ACCOUNTING|\bCPA\b|\bTAX\b|BOOKKEEP|FINANCIAL|WEALTH|ADVISOR/, 'Accounting/Finance'],
  [/INSURANCE|\bAGENCY\b/, 'Insurance/Agency'],
  [/CLEANING|JANITORIAL|MAID|MAINTENANCE/, 'Cleaning/Maintenance'],
  [/LANDSCAP|\bLAWN|TREE|IRRIGATION|NURSERY/, 'Landscaping'],
  [/DAYCARE|CHILDCARE|LEARNING|ACADEMY|SCHOOL|MONTESSORI|TUTOR/, 'Education/Childcare'],
  [/\bTECH|SOFTWARE|\bIT\b|DIGITAL|\bMEDIA|MARKETING|DESIGN/, 'Tech/Media'],
  [/TRANSPORT|\bTAXI|RIDE|LIMO/, 'Transport'],
  [/SECURITY|\bGUARD/, 'Security'],
  [/FITNESS|\bGYM\b|YOGA|CROSSFIT|WELLNESS/, 'Fitness/Wellness'],
  [/RETAIL|\bSHOP\b|\bSTORE\b|BOUTIQUE|MART\b/, 'Retail'],
  [/OIL|\bGAS\b|ENERGY|PETROLEUM/, 'Oil/Gas/Energy'],
  [/FARM|RANCH|\bAG\b|AGRICULT|CATTLE/, 'Agriculture'],
];
function industriesOf(name) {
  const n = String(name || '').toUpperCase();
  const out = [];
  for (const [re, tag] of INDUSTRY) if (re.test(n) && !out.includes(tag)) out.push(tag);
  return out;
}

const db = new sqlite3.Database(path.join(__dirname, 'src', 'data', 'tax_roll.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS owner_cluster (
    portfolio_key TEXT PRIMARY KEY,
    member_count INTEGER,
    individuals TEXT,
    businesses TEXT,
    industries TEXT,
    is_institutional INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const clusters = new Map(); // key -> Set(owner_name)
  let n = 0;
  db.each(
    "SELECT owner_name, owner_address FROM tax_roll WHERE roll_code='R' AND owner_name IS NOT NULL",
    (e, r) => {
      if (e) throw e;
      n++;
      const key = normAddr(r.owner_address);
      if (key.length < 8) return;
      if (!clusters.has(key)) clusters.set(key, new Set());
      clusters.get(key).add(String(r.owner_name).trim());
    },
    (e) => {
      if (e) throw e;
      console.log(`scanned ${n.toLocaleString()} parcels, ${clusters.size.toLocaleString()} mailing-address clusters`);
      db.run('BEGIN');
      const stmt = db.prepare(`INSERT INTO owner_cluster
        (portfolio_key, member_count, individuals, businesses, industries, is_institutional, updated_at)
        VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(portfolio_key) DO UPDATE SET
          member_count=excluded.member_count, individuals=excluded.individuals,
          businesses=excluded.businesses, industries=excluded.industries,
          is_institutional=excluded.is_institutional, updated_at=CURRENT_TIMESTAMP`);
      let multi = 0, inst = 0;
      for (const [key, set] of clusters) {
        const names = [...set];
        const memberCount = names.length;
        const institutional = memberCount >= INSTITUTIONAL ? 1 : 0;
        if (institutional) inst++;
        // For registered-agent-service addresses the names aren't one owner — withhold lists.
        if (institutional) { stmt.run(key, memberCount, null, null, null, 1); continue; }
        const individuals = names.filter(nm => !BUSINESS_RE.test(nm) && !ESTATE_RE.test(nm) && !/\bTRUST\b/i.test(nm));
        const businesses = names.filter(nm => BUSINESS_RE.test(nm));
        const industries = [...new Set(businesses.flatMap(industriesOf))];
        if (memberCount > 1) multi++;
        stmt.run(key, memberCount,
          individuals.length ? JSON.stringify(individuals) : null,
          businesses.length ? JSON.stringify(businesses) : null,
          industries.length ? JSON.stringify(industries) : null, 0);
      }
      stmt.finalize(() => db.run('COMMIT', () => {
        db.get("SELECT COUNT(*) n FROM owner_cluster WHERE member_count>1 AND is_institutional=0 AND businesses IS NOT NULL AND individuals IS NOT NULL", (e1, a) => {
          console.log(`owner_cluster built (institutional threshold ${INSTITUTIONAL}+ distinct names):`);
          console.log(`  ${multi.toLocaleString()} multi-name clusters; ${inst.toLocaleString()} flagged institutional (lists withheld)`);
          console.log(`  ${a ? a.n.toLocaleString() : '?'} clusters mix at least one business AND one individual (LLCs broken to a human)`);
          db.close();
        });
      }));
    }
  );
});
