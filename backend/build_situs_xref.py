#!/usr/bin/env python3
# Build the SITUS ADDRESS CROSSWALK: a (house|zip5|street-core) -> account_id map from
# the DCAD ACCOUNT_INFO.CSV. This is what lets address-only feeds (311 code-compliance,
# foreclosure notices) match to a PARCEL precisely — the tax roll has no house numbers,
# but DCAD does (STREET_NUM + FULL_STREET_NAME + PROPERTY_ZIPCODE + ACCOUNT_NUM).
#
# Key normalization MUST match ingest_311.js exactly (parity-tested) — see situsKey().
# Only UNIQUE keys are kept: an addr_key that maps to >1 account (condos/units) is
# dropped (precision-first; 311 addresses rarely carry a clean unit).
#
#   python3 build_situs_xref.py <ACCOUNT_INFO.csv> <out.db>
#
# Writes situs_xref(addr_key TEXT PRIMARY KEY, account_id TEXT).
import csv, sys, sqlite3, re

inp, dbp = sys.argv[1], sys.argv[2]

# --- canonical address normalization (mirror of ingest_311.js situsKey) ---
DIR = {"N", "S", "E", "W", "NE", "NW", "SE", "SW", "NORTH", "SOUTH", "EAST", "WEST"}
SUF = {"ST", "STREET", "AVE", "AV", "AVENUE", "DR", "DRIVE", "LN", "LANE", "RD", "ROAD",
       "BLVD", "BL", "CT", "COURT", "PL", "PLACE", "WAY", "CIR", "CIRCLE", "TER", "TERR",
       "TERRACE", "TRL", "TRAIL", "PKWY", "PARKWAY", "CV", "COVE", "PT", "POINT", "HWY",
       "HIGHWAY", "LOOP", "PASS", "PATH", "RUN", "ROW", "XING", "CROSSING", "SQ", "PLZ",
       "PLAZA", "EXPY", "EXPWY", "FWY"}

def street_core(name):
    toks = re.sub(r"[^A-Z0-9 ]", " ", (name or "").upper()).split()
    if toks and toks[0] in DIR: toks = toks[1:]
    if toks and toks[-1] in SUF: toks = toks[:-1]
    return " ".join(toks)

def situs_key(house_field, zip_field, name):
    hm = re.match(r"\s*0*(\d+)", house_field or "")
    house = hm.group(1) if hm else ""
    zm = re.search(r"(\d{5})", zip_field or "")
    zp = zm.group(1) if zm else ""
    core = street_core(name)
    return f"{house}|{zp}|{core}" if (house and zp and core) else None

con = sqlite3.connect(dbp)
con.execute("PRAGMA busy_timeout=60000")
con.execute("DROP TABLE IF EXISTS situs_stage")
con.execute("CREATE TABLE situs_stage(addr_key TEXT, account_id TEXT)")

def norm_acct(v):
    d = re.sub(r"\D", "", v or "")
    return None if not d else (d[-17:] if len(d) >= 17 else d.zfill(17))

with open(inp, newline="", encoding="utf-8", errors="replace") as f:
    r = csv.reader(f)
    h = [c.strip().upper() for c in next(r)]
    ai = h.index("ACCOUNT_NUM"); sn = h.index("STREET_NUM")
    fs = h.index("FULL_STREET_NAME"); pz = h.index("PROPERTY_ZIPCODE")
    n = keyed = 0; batch = []
    for row in r:
        if len(row) <= max(ai, sn, fs, pz): continue
        acct = norm_acct(row[ai])
        if not acct: continue
        k = situs_key(row[sn], row[pz], row[fs])
        n += 1
        if not k: continue
        batch.append((k, acct)); keyed += 1
        if len(batch) >= 20000:
            con.executemany("INSERT INTO situs_stage VALUES(?,?)", batch); batch = []
    if batch:
        con.executemany("INSERT INTO situs_stage VALUES(?,?)", batch)
con.commit()

# Keep only unambiguous keys (one distinct account).
con.execute("DROP TABLE IF EXISTS situs_xref")
con.execute("""CREATE TABLE situs_xref AS
  SELECT addr_key, MIN(account_id) AS account_id
  FROM situs_stage GROUP BY addr_key HAVING COUNT(DISTINCT account_id)=1""")
con.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_situs_xref_key ON situs_xref(addr_key)")
total_keys = con.execute("SELECT COUNT(DISTINCT addr_key) FROM situs_stage").fetchone()[0]
uniq = con.execute("SELECT COUNT(*) FROM situs_xref").fetchone()[0]
con.execute("DROP TABLE situs_stage")
con.commit()
print(f"scanned {n} accounts; {keyed} keyed; {total_keys} distinct keys; situs_xref={uniq} unique (dropped {total_keys-uniq} ambiguous/units)")
con.close()
