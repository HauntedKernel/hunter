#!/usr/bin/env python3
# Decisive test: are short-tenure "sales" REAL arm's-length resales, or post-purchase
# PAPERWORK (spouse added, title->trust, name correction)? If the NEW owner shares a
# surname token with the OLD owner, it's almost certainly paperwork/family, not a sale.
import sqlite3, re
con = sqlite3.connect("src/data/tax_roll.db")
con.execute("ATTACH 'src/data/tax_roll.db.bak-20250825' AS old")
con.execute("ATTACH 'src/data/appraisal_2025.db' AS apr")
ENTITY = re.compile(r"\b(LLC|L L C|INC|LP|LTD|CORP|COMPANY|TRUST|EST|ESTATE|HEIRS|HOMES|PROPERT|INVEST|CAPITAL|REALTY|HOLDING|GROUP|PARTNERS|FUND|ENTERPRISE|MANAGEMENT|ASSET|VENTURE|RENTAL|EQUITY)\b")
STOP = {"AND","THE","TRUST","ESTATE","HEIRS","LIVING","FAMILY","REVOCABLE","TRUSTEE","ETAL","ET","AL","LIFE","JOINT","JT","TEN","WROS"}
def toks(name):
    return {t for t in re.findall(r"[A-Z]{4,}", (name or "").upper()) if t not in STOP}
def is_entity(n): return bool(ENTITY.search((n or "").upper()))

rows = con.execute("""
  SELECT o.owner_name oold, n.owner_name onew, o.homestead_exemption hs, (2025-apr.deed_year) tenure
  FROM old.tax_roll o JOIN tax_roll n ON n.account_id=o.account_id
  LEFT JOIN apr.appraisal_detail apr ON apr.account_id=o.account_id
  WHERE o.roll_code='R' AND o.owner_name IS NOT NULL AND n.owner_name IS NOT NULL
    AND TRIM(o.owner_name)<>'' AND TRIM(n.owner_name)<>''
""").fetchall()

def analyze(label, pred):
    overlap=distinct=0
    for oold,onew,hs,ten in rows:
        if not pred(oold,onew,hs,ten): continue
        if re.sub(r"\s+"," ",re.sub(r"[.,]","",oold.upper())).strip()==re.sub(r"\s+"," ",re.sub(r"[.,]","",onew.upper())).strip():
            continue  # not changed
        ot, nt = toks(oold), toks(onew)
        if ot and nt and (ot & nt): overlap+=1   # shares a surname token -> paperwork/family
        else: distinct+=1                         # fully different -> likely real sale
    tot=overlap+distinct
    if not tot: print(f"{label}: no sold rows"); return
    print(f"{label}: {tot:,} owner-name changes | shares-name(paperwork/family) {overlap:,} ({overlap/tot*100:.0f}%) | fully-distinct(real sale) {distinct:,} ({distinct/tot*100:.0f}%)")

print("Among OWNER-OCCUPIED INDIVIDUALS (homestead=1, non-entity old owner):")
analyze("  0-1yr tenure", lambda o,n,hs,t: hs==1 and not is_entity(o) and t is not None and t<1)
analyze("  1-2yr tenure", lambda o,n,hs,t: hs==1 and not is_entity(o) and t is not None and 1<=t<2)
analyze("  2-3yr tenure", lambda o,n,hs,t: hs==1 and not is_entity(o) and t is not None and 2<=t<3)
analyze("  10-30yr tenure (baseline)", lambda o,n,hs,t: hs==1 and not is_entity(o) and t is not None and 10<=t<30)
print("\nFor comparison, ESTATE owners (a known-good motivated signal):")
analyze("  estate/heirs old owner", lambda o,n,hs,t: bool(re.search(r"ESTATE|HEIRS|EST OF| ET AL", (o or '').upper())))
con.close()
