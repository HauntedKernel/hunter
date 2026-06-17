/**
 * Ingest the Texas voter file to derive owner-age and empty-nester signals
 * (STRATEGY.md §4). The voter roll is public and STATEWIDE (one source covers
 * all of Texas) — obtained from the TX Secretary of State / counties (fee +
 * eligibility); there is no anonymous public download, so this loads a CSV.
 *
 * Per-voter CSV (header required): name,address,birth_year[,account_id]
 *   - birth_year: 4-digit year (age = currentYear - birth_year)
 *   - account_id: optional DCAD account; if absent we match the voter's
 *     residence address to a tax-roll OWNER mailing address (owner-occupants),
 *     since tax-roll *property* addresses often lack a house number.
 *
 * For each matched property we store: owner_age, household_size, youngest/oldest
 * voter age, and an empty_nester flag (heuristic — see below).
 *
 * Usage:  node ingest_voters.js <file.csv>   |   node ingest_voters.js --clear
 */
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const CURRENT_YEAR = new Date().getFullYear();

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = split(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(l => { const v = split(l); const r = {}; headers.forEach((h, j) => r[h] = v[j] || ''); return r; });
}

// Match key: leading house number + longest street token. Matches a voter's
// "4300 BEVERLY DR, DALLAS TX" to a tax-roll owner_address "4300 BEVERLY RD".
function matchKey(addr) {
  const a = String(addr || '').toUpperCase();
  const num = (a.match(/^\s*(\d+)/) || [])[1] || '';
  const tok = (a.match(/[A-Z]{4,}/g) || []).sort((x, y) => y.length - x.length)[0] || '';
  return num && tok ? `${num} ${tok}` : '';
}

// Tax-roll owner_name is "LAST FIRST"; voter files are usually "FIRST LAST".
// Surname = the tax roll's first token; we then check if a voter's name contains it.
const surname = (name) => String(name || '').toUpperCase().replace(/[^A-Z ]/g, ' ').trim().split(/\s+/)[0] || '';
const nameTokens = (name) => String(name || '').toUpperCase().replace(/[^A-Z ]/g, ' ').trim().split(/\s+/).filter(Boolean);

(async () => {
  const db = await open({ filename: path.join(__dirname, 'src', 'data', 'tax_roll.db'), driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS voter_demographics (
      account_id TEXT PRIMARY KEY,
      owner_age INTEGER,
      household_size INTEGER,
      youngest_age INTEGER,
      oldest_age INTEGER,
      empty_nester INTEGER DEFAULT 0,
      source TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (process.argv[2] === '--clear') {
    await db.run('DELETE FROM voter_demographics');
    console.log('voter_demographics cleared');
    await db.close();
    return;
  }
  const file = process.argv[2];
  if (!file) { console.error('Provide a CSV path, or --clear'); process.exit(1); }

  const rows = parseCsv(await fs.readFile(file, 'utf8'));
  console.log(`parsed ${rows.length} voter rows`);

  // Build owner_address match index once (owner-occupant residence -> account).
  console.log('indexing tax-roll owner addresses...');
  const ownerRows = await db.all('SELECT account_id, owner_address, owner_name FROM tax_roll');
  const keyToAccount = new Map();
  const accountOwnerLast = new Map();
  for (const r of ownerRows) {
    const k = matchKey(r.owner_address);
    if (k && !keyToAccount.has(k)) keyToAccount.set(k, r.account_id);
    accountOwnerLast.set(r.account_id, surname(r.owner_name));
  }

  // Group voters by matched property.
  const byAccount = new Map();
  let matchedVoters = 0;
  for (const v of rows) {
    let acct = (v.account_id || '').trim();
    if (!acct) acct = keyToAccount.get(matchKey(v.address)) || '';
    if (!acct) continue;
    const yr = parseInt(v.birth_year, 10);
    const age = yr > 1900 && yr <= CURRENT_YEAR ? CURRENT_YEAR - yr : null;
    if (!byAccount.has(acct)) byAccount.set(acct, []);
    byAccount.get(acct).push({ name: v.name, age });
    matchedVoters++;
  }

  await db.exec('BEGIN');
  let stored = 0, emptyNesters = 0;
  for (const [acct, voters] of byAccount) {
    const ages = voters.map(v => v.age).filter(a => a !== null && a >= 18 && a <= 110);
    if (!ages.length) continue;
    const youngest = Math.min(...ages);
    const oldest = Math.max(...ages);
    // Owner age: the voter whose last name matches the tax-roll owner; else oldest.
    const ownerLast = accountOwnerLast.get(acct);
    const ownerVoter = voters.find(v => v.age && ownerLast && nameTokens(v.name).includes(ownerLast));
    const ownerAge = ownerVoter ? ownerVoter.age : oldest;
    // Empty-nester (heuristic / proxy): owner is mid-life to senior, the current
    // household has no young adults, and it's a small household — i.e. kids have
    // likely moved out. Single voter-file snapshots can't prove this; it's a lead.
    const emptyNester = (ownerAge >= 48 && ownerAge <= 75 && youngest >= 28 && voters.length <= 2) ? 1 : 0;
    if (emptyNester) emptyNesters++;
    await db.run(
      `INSERT INTO voter_demographics (account_id, owner_age, household_size, youngest_age, oldest_age, empty_nester, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET owner_age=excluded.owner_age, household_size=excluded.household_size,
         youngest_age=excluded.youngest_age, oldest_age=excluded.oldest_age, empty_nester=excluded.empty_nester,
         source=excluded.source, updated_at=CURRENT_TIMESTAMP`,
      [acct, ownerAge, voters.length, youngest, oldest, emptyNester, 'voter_file']
    );
    stored++;
  }
  await db.exec('COMMIT');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_voter_empty_nester ON voter_demographics(empty_nester)');

  console.log(`matched ${matchedVoters} voters to ${byAccount.size} properties; stored ${stored} (${emptyNesters} empty-nester)`);
  await db.close();
})().catch(e => { console.error('INGEST FAILED:', e.message); process.exit(1); });
