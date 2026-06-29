#!/usr/bin/env python3
# Is short tenure (recency) a REAL off-market seller signal, or just flipper/entity churn?
# Test: fine tenure bands, OVERALL vs an owner-occupied-INDIVIDUAL subset (homestead=1,
# non-entity owner). If short-tenure lift survives the clean subset it's a real life-event
# signal; if it collapses it was flippers/LLC churn (not a findable off-market lead).
import sqlite3, re
con = sqlite3.connect("src/data/tax_roll.db")
con.execute("ATTACH 'src/data/tax_roll.db.bak-20250825' AS old")
con.execute("ATTACH 'src/data/appraisal_2025.db' AS apr")

# Entity test: owner name looks like a company/trust/estate (not a person).
ENTITY = re.compile(r"\b(LLC|L L C|INC|LP|LTD|CORP|COMPANY|CO|TRUST|EST|ESTATE|HEIRS|HOMES|PROPERT|INVEST|CAPITAL|REALTY|HOLDING|GROUP|PARTNERS|FUND|ENTERPRISE|MANAGEMENT|ASSET|VENTURE|RENTAL|EQUITY|BANK|ASSN|CHURCH|CITY OF|COUNTY|AUTHORITY)\b")
def is_entity(name): return bool(ENTITY.search((name or "").upper()))
def normn(s): return re.sub(r"\s+"," ",re.sub(r"[.,]","",(s or "").upper())).strip()

rows = con.execute("""
  SELECT o.owner_name AS oold, n.owner_name AS onew, o.homestead_exemption AS hs,
         (2025 - apr.deed_year) AS tenure
  FROM old.tax_roll o JOIN tax_roll n ON n.account_id=o.account_id
  LEFT JOIN apr.appraisal_detail apr ON apr.account_id=o.account_id
  WHERE o.roll_code='R' AND o.owner_name IS NOT NULL AND TRIM(o.owner_name)<>''
    AND n.owner_name IS NOT NULL AND TRIM(n.owner_name)<>''
""").fetchall()

def band(t):
    if t is None: return "unknown"
    if t < 1: return "0-1"
    if t < 2: return "1-2"
    if t < 3: return "2-3"
    if t < 5: return "3-5"
    if t < 7: return "5-7"
    if t < 10: return "7-10"
    if t < 15: return "10-15"
    if t < 30: return "15-30"
    return "30+"
ORDER = ["0-1","1-2","2-3","3-5","5-7","7-10","10-15","15-30","30+","unknown"]

def tab(rows, title):
    from collections import defaultdict
    n=defaultdict(int); s=defaultdict(int)
    tot=len(rows); totsold=0
    for oold,onew,hs,ten in rows:
        sold = 1 if normn(oold)!=normn(onew) else 0
        b=band(ten); n[b]+=1; s[b]+=sold; totsold+=sold
    base = totsold/tot if tot else 0
    print(f"\n{title}  (n={tot:,}, base sold-rate={base*100:.2f}%)")
    print("  band     n          sold     rate     lift")
    for b in ORDER:
        if not n[b]: continue
        rate=s[b]/n[b]; lift=rate/base if base else 0
        print(f"  {b:7} {n[b]:9,} {s[b]:8,}  {rate*100:5.1f}%  {lift:.2f}x")

# 1) overall
tab(rows, "ALL real property")
# 2) owner-occupied individuals only (strip entities + require homestead)
clean=[r for r in rows if r[2]==1 and not is_entity(r[0])]
tab(clean, "OWNER-OCCUPIED INDIVIDUALS (homestead=1, non-entity)")
# 3) among 0-2yr 'sold', how many were ENTITY old-owners (flipper/LLC indicator)?
short=[r for r in rows if r[3] is not None and r[3]<2]
short_sold=[r for r in short if normn(r[0])!=normn(r[1])]
ent=sum(1 for r in short_sold if is_entity(r[0]))
print(f"\nFlipper check: of {len(short_sold):,} SOLD with <2yr tenure, {ent:,} ({ent/max(len(short_sold),1)*100:.0f}%) had an ENTITY (LLC/investor/trust) old-owner.")
# 4) of clean short-tenure sold, where did they go? new owner entity share
cshort_sold=[r for r in clean if r[3] is not None and r[3]<3 and normn(r[0])!=normn(r[1])]
cent_new=sum(1 for r in cshort_sold if is_entity(r[1]))
print(f"Clean individuals, <3yr tenure, sold: {len(cshort_sold):,}; of those {cent_new:,} ({cent_new/max(len(cshort_sold),1)*100:.0f}%) sold TO an entity (investor buyer).")
con.close()
