/**
 * Build the OWNER-PORTFOLIO enrichment — "how many other properties does this
 * owner hold?" — a free, high-signal layer derived entirely from data we already
 * have (the 960k-property tax roll). It surfaces tired landlords (sell the whole
 * portfolio), investor capacity, and the entity behind multiple LLC-named parcels.
 *
 * METHOD: properties are grouped by their OWNER MAILING ADDRESS (owner_address).
 * That's how aggregators identify portfolios — every one of an investor's tax
 * bills is mailed to the same office/home, so a shared mailing address groups
 * their holdings even when the owner *names* differ (LLC #1, LLC #2, a trust…).
 * Owner-occupants mail to their own property, so they're a portfolio of 1.
 *
 * A few mailing addresses are servicers / tax-forwarding shops with hundreds of
 * parcels — those are flagged is_institutional (size >= threshold) so the curated
 * list can label them "bulk mailing address" instead of "owner portfolio".
 *
 * One pass over the roll → an owner_portfolio table keyed by account_id, which
 * export_curated.js joins. Re-run after a tax-roll refresh.
 *
 * Usage:
 *   node build_portfolios.js [--inst 25]   (institutional flag threshold)
 */
const path = require('path');
const sqlite3 = require('sqlite3');

const instI = process.argv.indexOf('--inst');
const INSTITUTIONAL = instI !== -1 && process.argv[instI + 1] ? Number(process.argv[instI + 1]) : 25;
const normAddr = (a) => String(a || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const dbPath = process.env.TAX_ROLL_DB_PATH || path.join(__dirname, 'src', 'data', 'tax_roll.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS owner_portfolio (
    account_id TEXT PRIMARY KEY,
    portfolio_key TEXT,
    portfolio_size INTEGER,
    portfolio_value REAL,
    is_institutional INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const groups = new Map(); // mailing-key -> { size, value }
  const rows = [];          // { a: account_id, key }
  let n = 0;

  db.each(
    "SELECT account_id, owner_address, total_value FROM tax_roll WHERE roll_code='R' AND owner_name IS NOT NULL",
    (e, r) => {
      if (e) throw e;
      n++;
      const key = normAddr(r.owner_address);
      if (key.length < 8) { rows.push({ a: r.account_id, key: null }); return; } // blank/junk mailing
      const g = groups.get(key) || { size: 0, value: 0 };
      g.size++; g.value += (r.total_value || 0);
      groups.set(key, g);
      rows.push({ a: r.account_id, key });
    },
    (e) => {
      if (e) throw e;
      console.log(`scanned ${n.toLocaleString()} properties, ${groups.size.toLocaleString()} distinct mailing addresses`);

      db.run('BEGIN');
      const stmt = db.prepare(`INSERT INTO owner_portfolio
        (account_id, portfolio_key, portfolio_size, portfolio_value, is_institutional, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(account_id) DO UPDATE SET
          portfolio_key=excluded.portfolio_key, portfolio_size=excluded.portfolio_size,
          portfolio_value=excluded.portfolio_value, is_institutional=excluded.is_institutional,
          updated_at=CURRENT_TIMESTAMP`);
      for (const { a, key } of rows) {
        if (!key) { stmt.run(a, null, 1, null, 0); continue; }
        const g = groups.get(key);
        stmt.run(a, key, g.size, Math.round(g.value), g.size >= INSTITUTIONAL ? 1 : 0);
      }
      stmt.finalize(() => db.run('COMMIT', () => {
        db.get("SELECT COUNT(*) n FROM owner_portfolio WHERE portfolio_size>=3 AND is_institutional=0", (e1, a) => {
          db.get("SELECT COUNT(*) n FROM owner_portfolio WHERE portfolio_size>=10 AND is_institutional=0", (e2, b) => {
            db.get("SELECT COUNT(*) n FROM owner_portfolio WHERE is_institutional=1", (e3, c) => {
              console.log(`owner_portfolio built (institutional threshold ${INSTITUTIONAL}+):`);
              console.log(`  ${a.n.toLocaleString()} owners hold 3+ properties`);
              console.log(`  ${b.n.toLocaleString()} owners hold 10+ properties`);
              console.log(`  ${c.n.toLocaleString()} parcels at bulk/institutional mailing addresses (flagged)`);
              db.close();
            });
          });
        });
      }));
    }
  );
});
