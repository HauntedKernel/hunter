/*
 * Resolve distinctive ENTITY owners to their Comptroller-registered people (registered
 * agent / officers / status) and cache them — Tier-1 of the OSINT ladder (lib/comptroller.js).
 * Upgrades owner_enrichment so a resolved lead's `contact` block carries a real name.
 *
 * Targets the high-confidence entity slice (owner_type='entity', conf_tier in high/direct):
 * distinctive names resolve cleanly; we deliberately skip generic ones (false-match risk).
 *
 * Run on the box from backend/ (needs a free key — register at
 *   https://api-doc.comptroller.texas.gov/public-data/  then  export TX_CPA_API_KEY=...):
 *   node resolve_entities.js [--limit=300] [--debug] [--no-writeback]
 *   node resolve_entities.js --selftest          # validate the matcher offline (no key/network)
 * Env: HUNTER_DB (default src/data/tax_roll.db), TX_CPA_API_KEY, RATE_MS (default 800).
 */
const path = require('path');
const sqlite3 = require('sqlite3');
const cpa = require('./lib/comptroller');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- offline self-test of the matcher (no key, no network) ----
function selftest() {
  const cases = [
    { our: 'TAPPER INVESTMENTS LLC', addr: '123 MAIN ST DALLAS 75201',
      cands: [
        { entityName: 'TAPPER INVESTMENTS LLC', status: 'ACTIVE', mailingAddress: 'STE 5, 123 MAIN ST DALLAS TX 75201', registeredAgent: { name: 'DINO TAPPER' } },
        { entityName: 'TAPPER HOLDINGS INC', status: 'ACTIVE', mailingAddress: 'HOUSTON TX 77002' },
      ], expect: 'TAPPER INVESTMENTS LLC', expectAmbig: false },
    { our: 'SUMMIT HOMES LLC', addr: '5 ELM AVE DALLAS 75204',
      cands: [   // same name, both active, neither at our ZIP → genuinely ambiguous, don't assert
        { entityName: 'SUMMIT HOMES LLC', status: 'ACTIVE', mailingAddress: 'HOUSTON TX 77002' },
        { entityName: 'SUMMIT HOMES LLC', status: 'ACTIVE', mailingAddress: 'AUSTIN TX 78701' },
      ], expect: 'SUMMIT HOMES LLC', expectAmbig: true },
    { our: 'NITILO CORP', addr: '14785 PRESTON RD 75254', cands: [], expect: null },
  ];
  let pass = 0;
  for (const c of cases) {
    const m = cpa.pickBestMatch(c.our, c.addr, c.cands);
    const got = m ? m.record.entityName : null;
    const ok = got === c.expect && (c.expectAmbig == null || !m || m.ambiguous === c.expectAmbig);
    pass += ok ? 1 : 0;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${c.our}  → ${got}${m ? ` (conf ${m.matchConfidence}, ambiguous=${m.ambiguous}, ${m.reason})` : ''}`);
  }
  console.log(`\nmatcher self-test: ${pass}/${cases.length} passed`);
  process.exit(pass === cases.length ? 0 : 1);
}
if (args.selftest) selftest();

const DB = process.env.HUNTER_DB || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const LIMIT = Number(args.limit || 300);
const RATE_MS = Number(process.env.RATE_MS || 800);
const WRITEBACK = !args['no-writeback'];

(async () => {
  if (!cpa.available()) {
    console.log('TX_CPA_API_KEY not set — Comptroller resolver is OFF (no-op).');
    console.log('Get a FREE key: https://api-doc.comptroller.texas.gov/public-data/  → then:');
    console.log('  export TX_CPA_API_KEY=<key> && node resolve_entities.js --limit=50 --debug');
    process.exit(0);
  }
  const db = new sqlite3.Database(DB);
  const all = (s, p = []) => new Promise((res, rej) => db.all(s, p, (e, r) => e ? rej(e) : res(r)));
  const run = (s, p = []) => new Promise((res, rej) => db.run(s, p, e => e ? rej(e) : res()));

  await run(`CREATE TABLE IF NOT EXISTS entity_registry (
    owner_key TEXT PRIMARY KEY, query_name TEXT, matched_name TEXT, taxpayer_id TEXT, status TEXT,
    registered_agent TEXT, agent_is_person INTEGER, officers_json TEXT, match_confidence INTEGER,
    ambiguous INTEGER, resolved_at DATETIME DEFAULT CURRENT_TIMESTAMP, source TEXT)`);

  // Distinctive entity owners not yet resolved (one row per distinct owner name).
  const targets = await all(`
    SELECT oe.owner_name, MIN(t.owner_address) AS owner_address, COUNT(*) AS parcels
    FROM owner_enrichment oe JOIN tax_roll t ON t.account_id = oe.account_id
    WHERE oe.owner_type='entity' AND oe.conf_tier IN ('high','direct')
      AND oe.owner_name NOT IN (SELECT query_name FROM entity_registry)
    GROUP BY oe.owner_name ORDER BY parcels DESC LIMIT ?`, [LIMIT]);
  console.log(`resolving ${targets.length} distinctive entity owners (rate ${RATE_MS}ms)…`);

  let resolved = 0, withContact = 0, ambiguous = 0, errors = 0;
  for (let i = 0; i < targets.length; i++) {
    const { owner_name, owner_address } = targets[i];
    try {
      const cands = await cpa.searchByName(owner_name);
      if (args.debug && i === 0) console.log('DEBUG first raw extract:', JSON.stringify(cands.slice(0, 2), null, 2));
      const m = cpa.pickBestMatch(owner_name, owner_address, cands);
      const rec = m?.record;
      const agent = rec?.registeredAgent;
      const officerName = rec?.officers?.[0]?.name;
      const contactName = (agent?.isLikelyPrincipal ? agent.name : null) || officerName || null;
      const contactRole = (agent?.isLikelyPrincipal ? 'REG AGENT' : null) || (officerName ? (rec.officers[0].title || 'OFFICER') : null);
      await run(`INSERT OR REPLACE INTO entity_registry
        (owner_key, query_name, matched_name, taxpayer_id, status, registered_agent, agent_is_person, officers_json, match_confidence, ambiguous, source)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [owner_name, owner_name, rec?.entityName || null, rec?.taxpayerId || null, rec?.status || null,
         agent?.name || null, agent?.isLikelyPrincipal ? 1 : 0, JSON.stringify(rec?.officers || []),
         m?.matchConfidence || 0, m?.ambiguous ? 1 : 0, 'tx_comptroller']);
      resolved++;
      if (m?.ambiguous) ambiguous++;
      // Upgrade owner_enrichment with the resolved contact (confident, non-ambiguous only).
      if (WRITEBACK && contactName && !m.ambiguous && m.matchConfidence >= 70) {
        await run(`UPDATE owner_enrichment SET embedded_name=?, embedded_role=?, conf_tier='registry',
          conf_score=?, reason=? WHERE owner_name=?`,
          [contactName, contactRole, Math.max(85, m.matchConfidence),
           `resolved via TX Comptroller${rec.status ? ' (' + rec.status + ')' : ''}`, owner_name]);
        withContact++;
      }
    } catch (e) { errors++; if (errors <= 3) console.log(`  err ${owner_name}: ${e.message}`); }
    if (i % 25 === 24) console.log(`  …${i + 1}/${targets.length} (contacts ${withContact}, ambiguous ${ambiguous}, err ${errors})`);
    await sleep(RATE_MS);
  }
  console.log(`\ndone: resolved ${resolved}, upgraded-with-contact ${withContact}, ambiguous ${ambiguous}, errors ${errors}`);
  console.log('cache: entity_registry; owner_enrichment upgraded to tier "registry" for confident matches.');
  await new Promise(res => db.close(res));
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
