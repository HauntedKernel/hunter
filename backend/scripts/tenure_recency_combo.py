#!/usr/bin/env python3
# Does recency SHARPEN with distress? "Bought recently AND already behind" = overextended
# owner forced to sell = the highest-intent off-market lead. Clean owner-occupied indivs.
import sqlite3, re
con = sqlite3.connect("src/data/tax_roll.db")
con.execute("ATTACH 'src/data/tax_roll.db.bak-20250825' AS old")
con.execute("ATTACH 'src/data/appraisal_2025.db' AS apr")
ENTITY = re.compile(r"\b(LLC|L L C|INC|LP|LTD|CORP|COMPANY|TRUST|EST|ESTATE|HEIRS|HOMES|PROPERT|INVEST|CAPITAL|REALTY|HOLDING|GROUP|PARTNERS|FUND|MANAGEMENT|ASSET|VENTURE|RENTAL|EQUITY)\b")
def is_entity(n): return bool(ENTITY.search((n or "").upper()))
def normn(s): return re.sub(r"\s+"," ",re.sub(r"[.,]","",(s or "").upper())).strip()
rows = con.execute("""
  SELECT o.owner_name oold, n.owner_name onew, o.homestead_exemption hs, (2025-apr.deed_year) tenure,
         o.is_delinquent dq, o.suit_pending suit, o.is_absentee ab
  FROM old.tax_roll o JOIN tax_roll n ON n.account_id=o.account_id
  LEFT JOIN apr.appraisal_detail apr ON apr.account_id=o.account_id
  WHERE o.roll_code='R' AND o.owner_name IS NOT NULL AND n.owner_name IS NOT NULL
    AND TRIM(o.owner_name)<>'' AND TRIM(n.owner_name)<>''
""").fetchall()
base = sum(1 for r in rows if normn(r[0])!=normn(r[1]))/len(rows)
print(f"overall base sold-rate {base*100:.2f}% (n={len(rows):,})\n")
def seg(label, pred):
    sub=[r for r in rows if pred(r)]
    if not sub: print(f"  {label:38} n=0"); return
    sold=sum(1 for r in sub if normn(r[0])!=normn(r[1]))
    rate=sold/len(sub)
    print(f"  {label:38} n={len(sub):7,}  sold={sold:6,}  rate={rate*100:5.1f}%  lift={rate/base:.2f}x")
recent=lambda r: r[3] is not None and r[3]<2
print("Clean owner-occupied individuals (homestead=1, non-entity):")
clean=lambda r: r[2]==1 and not is_entity(r[0])
seg("recent (<2yr)",                 lambda r: clean(r) and recent(r))
seg("recent + delinquent",           lambda r: clean(r) and recent(r) and r[4]==1)
seg("recent + tax-suit",             lambda r: clean(r) and recent(r) and r[5]==1)
seg("delinquent (any tenure)",       lambda r: clean(r) and r[4]==1)
seg("NOT recent (>=2yr) + delinquent",lambda r: clean(r) and (r[3] is not None and r[3]>=2) and r[4]==1)
print("\nAll owners (incl. absentee/entities):")
seg("recent + absentee",             lambda r: recent(r) and r[6]==1)
seg("recent + delinquent",           lambda r: recent(r) and r[4]==1)
con.close()
