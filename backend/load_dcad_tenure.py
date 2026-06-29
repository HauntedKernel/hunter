#!/usr/bin/env python3
# Stream a DCAD certified ACCOUNT_INFO.CSV and load account + deed-year + as-of tenure
# into an appraisal_detail table (memory-safe; native csv handles quoting). Used by
# scripts/backtrain_sell_model.js for LEAKAGE-SAFE tenure: load each YEAR's own file so
# deed dates are as-of that year (today's file would show a sold parcel's NEW deed).
#
#   python3 load_dcad_tenure.py <ACCOUNT_INFO.csv> <out.db> <asof_year>
#
# (Node's load_dcad_tenure.js misbehaved on the 334 MB file in the box's runtime; this
# python loader is the canonical big-file path — python3 ships on the box.)
import csv, sys, sqlite3, re

inp, dbp, asof = sys.argv[1], sys.argv[2], int(sys.argv[3])
con = sqlite3.connect(dbp)
con.execute("""CREATE TABLE IF NOT EXISTS appraisal_detail(
  account_id TEXT PRIMARY KEY, deed_transfer_date TEXT, deed_year INTEGER,
  tenure_years INTEGER, year_built INTEGER)""")
con.execute("PRAGMA journal_mode=WAL"); con.execute("PRAGMA synchronous=OFF")

def norm_acct(v):
    d = re.sub(r"\D", "", v or "")
    return None if not d else (d[-17:] if len(d) >= 17 else d.zfill(17))
def year_of(v):
    m = re.search(r"(19|20)\d{2}", v or "")
    if m:
        y = int(m.group(0))
        return y if 1850 <= y <= asof + 1 else None
    return None

with open(inp, newline="", encoding="utf-8", errors="replace") as f:
    r = csv.reader(f)
    h = [c.strip().upper() for c in next(r)]
    ai = h.index("ACCOUNT_NUM"); di = h.index("DEED_TXFR_DATE")
    n = wd = 0; batch = []
    for row in r:
        if len(row) <= max(ai, di): continue
        acct = norm_acct(row[ai])
        if not acct: continue
        dy = year_of(row[di])
        ten = max(0, asof - dy) if dy is not None else None
        if dy is not None: wd += 1
        batch.append((acct, row[di] or None, dy, ten))
        n += 1
        if len(batch) >= 20000:
            con.executemany("INSERT OR REPLACE INTO appraisal_detail(account_id,deed_transfer_date,deed_year,tenure_years) VALUES(?,?,?,?)", batch); batch = []
    if batch:
        con.executemany("INSERT OR REPLACE INTO appraisal_detail(account_id,deed_transfer_date,deed_year,tenure_years) VALUES(?,?,?,?)", batch)
con.commit()
tot = con.execute("SELECT COUNT(*) FROM appraisal_detail").fetchone()[0]
l30 = con.execute("SELECT COUNT(*) FROM appraisal_detail WHERE tenure_years>=30").fetchone()[0]
print(f"scanned {n}, with deed {wd}; appraisal_detail total {tot} ({l30} owned 30+ yrs as-of {asof})")
con.close()
