# Hunter — Seller-Signal Research & Validation

*Compiled 2026-06-25. Two inputs: (A) a multi-source literature/industry deep-research
pass, and (B) a backtest on our own data. This drives how the MotivationScorer is
weighted and what feeds to add next.*

---

## 0. TL;DR
- Our six signals are all **distress / life-stage states**. The biggest *overlooked*
  levers from the literature are a **financial signal we don't have** (mortgage
  rate lock-in / free-and-clear equity) and **event records** beyond death,
  especially **divorce filings**.
- The most important result is from **our own backtest** (§B): **elderly-alone has
  essentially zero predictive lift (1.00x)**, yet **absentee + elderly together hit
  3.07x**. Interaction effects are real and large — the flat additive score can't
  capture them, so we added explicit synergy bonuses.
- **Tax-suit-pending (2.45x)** is our strongest *single* signal on real data —
  stronger than raw delinquency (1.43x). It's free (already in the tax roll) and
  not yet wired into discovery → highest-value cheap add.
- Recommended trajectory: keep the additive score for now (with synergies), but
  evolve toward a **calibrated survival/hazard model** trained on snapshot diffs.

---

## A. Deep-research findings (literature + industry)

Sources fetched → claims extracted → 3-vote adversarial verification (24 confirmed,
1 refuted). Confidence noted per item.

### Base rate (frames all "lift")
- Only **~2.5% of U.S. homes sold in 2024** (30-yr low; ~4% in normal years) —
  Redfin. Sellers are older / stay longer than ever: **median seller age 63–64**,
  **median tenure 10–11 yr** (NAR 2024/25). Texas turns faster — **~7.5 yr** avg
  tenure at sale (ATTOM Q1'26). *Any signal's value = lift over a ~3–4%/yr base.*

### Ranked NEW signals beyond our current six
1. **Mortgage rate lock-in / free-and-clear status** *(high — FHFA WP24-03).*
   Each 1pt that market rate exceeds the owner's locked rate cuts quarterly sale
   probability **18.1%**; lock-in suppressed ~45–57% of sales in 2023–24.
   **Actionable inversion:** owners with **no mortgage (free-and-clear)** are
   immune to lock-in → free-and-clear + long-tenure + elderly is the cleanest
   "can-sell *and* likely-to" cluster. Needs county deed-of-trust/lien data.
2. **Divorce / separation filings** *(high — Coulter & van Ham 2017; Housing
   Studies 2022).* Among the largest mobility drivers, sustained effect. Public in
   Dallas County district/family court records — ingestible like the foreclosure feed.
3. **Tenure length as a positive prior** *(high — NAR/ATTOM).* Weight **7+ yr for
   Texas** (vs 10+ national). Needs deed/sale date (DCAD).
4. **Owner age band 60+, not just 65+** *(high — NAR).* Median seller is 63–64,
   *below* our over-65 exemption cutoff — our elderly signal is aimed slightly old.
   (The "mobility rises again after 75" idea was **refuted** in verification.)
5. **Job relocation / out-of-area owner** — strong but hard to source; partly
   proxied by our existing absentee signal.

### Highest-value combinations (from literature)
- **Free-and-clear + long tenure + 60+ + empty-nester** = the "natural downsizer."
- **Estate/probate + absentee/out-of-area heir + vacancy** = inherited-and-unwanted.
- **Regime insight** *(high):* in high-rate markets normal sellers go dormant
  (lock-in), so **distress signals gain *relative* lift** — our current focus is
  well-timed.

### Modeling guidance
- Move from additive scoring → **discrete-time survival/hazard model** (owner-month
  pairs; the Opendoor "listing-day" approach). Naive regression is biased (drops
  never-sold owners).
- **Do NOT rebalance classes (SMOTE/over/under-sampling)** *(high — JAMIA 2022,
  replicated through 2025).* At low base rates it wrecks calibration without
  improving discrimination. Train on natural ~3% prevalence + post-hoc calibrate.

### Caveats / honesty
- **Vendor accuracy claims unverified** — SmartZip/Offrs/Catalyze/Likely.AI "X%
  accurate" figures did NOT corroborate; treat as marketing.
- Two mechanism papers are Swiss/Dutch (directionally sound, not US-validated).
- Lock-in magnitude is fading into 2026 as the rate gap narrows.
- NAR self-reported motives under-represent distressed/off-market sellers (our target).

---

## B. Backtest on our own data (the part that's *ours*)

**Method.** Joined the 2025-08-25 tax-roll snapshot to the 2026-06-22 snapshot on
`account_id` (parcel identity is stable; owner changes). **"Sold" proxy = normalized
`owner_name` changed** over the ~10-month gap. Signals are read from the **OLD**
snapshot → a genuine forward prediction. Restricted to real property (`roll_code='R'`).
Script: `backend/scripts/validate_signals.js` (run on the box; both snapshots live
in `backend/src/data/`).

**Population.** 675,101 real-property accounts matched in both snapshots.
**42,322 ownership changes → base rate 6.27% / 10mo (~7.5% annualized).**

> ⚠️ The 6.27% base is **ownership *change*, not arm's-length home sales** — it
> includes transfers, LLC restructuring, gifts, death-transfers, and owner-name
> reformatting. So the absolute rate is inflated vs. the ~3% market-sale rate in
> §A. **Lift (the ratio) is the trustworthy output** — formatting noise inflates
> numerator and denominator alike, so it roughly cancels.

| Signal (from OLD snapshot) | n | sold | rate | **lift** |
|---|---:|---:|---:|---:|
| tax suit pending | 6,763 | 1,039 | 15.4% | **2.45x** |
| absentee | 161,904 | 16,642 | 10.3% | **1.64x** |
| estate / heirs | 3,586 | 359 | 10.0% | **1.60x** |
| delinquent | 23,604 | 2,113 | 9.0% | **1.43x** |
| elderly (over-65) **alone** | 139,551 | 8,791 | 6.3% | **1.00x** |
| high-equity proxy (val≥500k, not delinq) | 643 | 49 | 7.6% | 1.22x |
| **absentee + elderly** | 6,621 | 1,274 | 19.2% | **3.07x** |
| delinquent + suit pending | 3,044 | 534 | 17.5% | **2.80x** |
| delinquent + absentee + elderly | 161 | 27 | 16.8% | 2.68x |
| estate + absentee | 812 | 95 | 11.7% | 1.87x |
| delinquent + absentee | 9,087 | 997 | 11.0% | 1.75x |
| elderly + estate | 1,447 | 154 | 10.6% | 1.70x |
| delinquent + elderly | 2,672 | 205 | 7.7% | 1.22x |

**What this tells us:**
1. **Elderly-alone is a dud (1.00x = exactly base rate).** The over-65 exemption
   flag by itself predicts nothing — but it's a powerful **modifier**: absentee
   rises 1.64x → 3.07x when the owner is also elderly. Age is a prior, not a trigger
   (matches §A). → down-weighted standalone elderly 10→6, added synergy.
2. **Tax-suit-pending (2.45x) > raw delinquency (1.43x).** Escalation matters: a
   *filed suit* is far more predictive than mere arrears. Currently NOT wired into
   discovery — best cheap win (it's already a column: `suit_pending`).
3. **Absentee is the universal amplifier** — solid alone (1.64x, 162k accounts) and
   it lifts everything it touches (elderly, estate, delinquency).
4. **Delinquency is weighted highest (40) but shows the lowest lift of the distress
   signals.** Its value is volume + actionability, but the relative weighting is
   mis-calibrated vs. observed lift. (Left as-is for now; revisit with the hazard model.)
5. **Lifts are modest (1.4–3.1x).** These tilt odds, they don't guarantee. Multi-
   signal targeting is clearly correct: two individually-weak signals (absentee 1.64x
   + elderly 1.00x) compound to 3.07x.

**Caveats:** owner-name-change over-counts true sales; 10-month window; signals from
a single snapshot; `legal_events` (mortgage pre-foreclosure) and voter age/empty-nester
not testable here (absent from the old snapshot). The real fix for an accurate base
rate + clean labels is **arm's-length deed records** (round-2 source research).

---

## C. What changed in the scorer (this pass)
`MotivationScorer` v1.0 → **v1.1** (local, uncommitted):
- `elderlyOwner` weight **10 → 6** (measured 1.00x standalone).
- New **signal-synergy** factor: **absentee×elderly +14** (3.07x), **estate×absentee
  +6** (1.87x). Fires only when components co-occur.
- Smoke-tested: elderly-only 6 pts, absentee+elderly +14, estate+absentee +6.

Still additive + capped at 100; this is an interim calibration, not the hazard model.

---

## D. Next actions (ranked — updated after round-2 source research, §E)
1. ✅ **DONE — `tax suit pending`** (CHANGELOG #036). Was *excluded* from every
   search; now a first-class signal (weight 28), on by default. The free 2.45x win.
2. ✅ **DONE (ingester + signal) — free-and-clear** (CHANGELOG #039).
   `ingest_liens.js` + `liens` table (auto-created) + `freeAndClear` signal across
   discovery/scorer (weight 10, positive modifier) /UI (🏦), plus a free-and-clear ×
   elderly **synergy** (+8, "natural downsizer"). Equity fields stored for a future
   high-equity signal. ⏳ Needs the **lien data feed**: **DCAD bulk files** (free,
   ownership/value/tenure) + **Dallas County Clerk `dallas.tx.publicsearch.us`**
   deeds/DOTs/releases (free to search; derive FAC = no open DOT), OR a one-shot
   **PropStream ($99/mo)** export (its free-and-clear/equity filter → CSV). ⚠️ Verify
   the property-portal ToS before bulk extraction (the *court* portal bans commercial
   use; the property portal's terms are unconfirmed). Load via
   `node ingest_liens.js <file.csv>`.
3. **311 code-compliance signal → cheap, free, easy add.** Dallas OpenData **311
   Service Requests (`gc4d-8a49`)** — hourly, PDDL public-domain, programmatic via
   SODA API; code-compliance request types are a distress signal. (NOT the archived
   `Code Violations` set — stale since Feb 2019.) Mirror the `legal_events` ingester.
4. ⚠️ **Divorce feed — source is harder than hoped (ingester is ready, CHANGELOG
   #037).** Dallas family-court records have **NO public online access** (Texas
   Supreme Court order, eff. 2014; attorneys-only via re:SearchTX). The only
   non-attorney path is the county's **paid "Civil/Family Case Bulk Data
   Subscription"** (Paymentus; price/fields unpublished — must call the District
   Clerk) or a commercial vendor. Decision needed: pursue the paid subscription or
   shelve. `ingest_divorce_events.js` is built and waiting either way.
5. **Probate → strengthens the existing estate signal.** Dallas County probate
   records are searchable online (free non-certified) via the Courts Portal —
   obtainable; can feed `legal_events`/estate enrichment.
6. ❌ **Owner age via the TX voter file — DROP (illegal for our use).** Texas
   Election Code §18.067 makes commercial-marketing use of the statewide voter list
   a **Class A misdemeanor**. Use licensed consumer/marketing data for age/household
   instead, or rely on the (free) over-65 exemption — but recall elderly-alone is
   1.00x, so this is low priority regardless.
7. **Hazard model** — repeated snapshot diffs as labeled training data; calibrate;
   do NOT class-rebalance. Once the lien feed lands, re-run §B to get *measured* lift
   for free-and-clear and re-weight.

## E. Data sources & compliance (round-2 deep research)

Per-signal source map for a small Dallas operation. Cited; "stated" = vendor/marketing
price, not independently audited. Full run: 25 sources → 24 confirmed claims, 1 refuted.

| Signal / need | Best source | Cost | Access | Usable? |
|---|---|---|---|---|
| Ownership / value / **tenure** | **DCAD bulk files** (`dallascad.org/DataProducts.aspx`, 2021-2026 ZIPs, all accounts, comma-delimited + field dict) | **Free** | Direct download | ✅ (deed-date in roll = open Q; else join Clerk deeds) |
| **Free-and-clear / mortgage / liens** | **Dallas County Clerk** `dallas.tx.publicsearch.us` (GovOS/Kofile) — deeds, deeds-of-trust, releases, 1964→ | **Free** to search | Portal (verify ToS for bulk) | ✅ search; ⚠️ bulk ToS unconfirmed |
| ↳ normalized equity (faster) | PropStream / ATTOM / ReportAll | PropStream **$99/mo** | App / API | ✅ non-FCRA |
| **Divorce / family-law** | County **Civil/Family Bulk Data Subscription** (Paymentus) | Paid (unpublished) | Subscription / PIA | ⚠️ no public online access (2014 order); attorneys-only via re:SearchTX |
| **Code-compliance / distress** | Dallas OpenData **311** `gc4d-8a49` | **Free** | SODA API, hourly, PDDL | ✅ programmatic OK |
| Probate / estate | Dallas County Probate Courts Portal | Free (non-certified) | Portal | ✅ |
| **Owner age / household** | TX voter file | — | — | ❌ **illegal** for commercial marketing (Elec. Code §18.067, Class A misd.) → use marketing data |
| Vacancy | Regrid USPS vacancy (Y/N, RDI, date) | Paid (Pro/Team) | Sub / API, ~monthly | ⚠️ Regrid *requests* no direct-mail marketing use |
| Evictions | 10 JP precinct courts | Free | Per-precinct (fragmented) | ⚠️ high effort |
| Contact append (**skip-trace**) | PropStream (~10-12¢/contact, non-FCRA) | per-hit | App / API | ✅ owner outreach only — **not** FCRA decisions |

**Recommended minimal starter stack:** DCAD bulk files **+** Clerk `publicsearch.us`
deeds (→ free-and-clear) **+** a per-hit skip-trace vendor, layered with the free
hourly 311 feed. All low/no cost and obtainable.

**Compliance flags (treat as open legal work — not all individually verified):**
- **Voter file = off-limits** for commercial marketing in TX (§18.067, Class A misd.).
- County **court-records** portal **prohibits commercial use**; the **property/deed**
  portal's terms differ and must be confirmed before any bulk/automated extraction.
- **Skip-trace products are non-FCRA** — fine for owner outreach, never for tenant
  screening / credit / employment decisions.
- **Outreach** must honor **TCPA + national & Texas DNC** (texasnocall.com) for
  calls/texts, **CAN-SPAM** for email, and **DPPA** if any data is DMV-derived.
  Plus TREC/Texas solicitation rules. (Flagged as open work — verify before calling.)
- Vendor/USPS prices drift; the 2014 family-court suspension was still current at
  research time — recheck before relying.

*Round-2 research in flight:* concrete TX/Dallas data **sources** for each signal
above + a compliant **skip-trace / outreach** playbook (FCRA/TCPA/DPPA/CAN-SPAM).
Results will be appended here.
