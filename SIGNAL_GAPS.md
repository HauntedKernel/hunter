# Hunter — Signal & Combination Gap Analysis

*Created 2026-06-29. Audit of which lift-bearing signals and signal-combinations
the live scorer actually captures vs. what the research/backtest say it could.
Companion to `RESEARCH.md` (measured lift) and `STRATEGY.md`. Prioritized for action.*

---

## 0. The question this answers
"Are we including all the signals and combinations of signals that could lead to
lift?" **No.** We capture the strongest *tax-roll-intrinsic* signals and their two
best-measured interactions. There are real gaps in three buckets: (1) signals
**coded but starved** of a data feed, (2) measured-strong **combinations not
explicitly scored**, and (3) lift-bearing signals **never coded**. This doc ranks
the closeable gaps and flags two scoring *miscalibrations* worth a decision.

---

## 1. What's live and earning lift (baseline)

| Signal | Measured lift (RESEARCH §B) | Status |
|---|---:|---|
| Tax-suit pending | **2.45x** | ✅ live (weight 28) |
| Absentee | 1.64x | ✅ live (12) |
| Estate / heirs | 1.60x | ✅ live (18) |
| Delinquent | 1.43x | ✅ live (40) — ⚠️ over-weighted, see §4 |
| Pre-foreclosure (OCR) | — | ✅ live, **partial coverage** |
| Elderly (alone) | 1.00x | ✅ live (6) — modifier only |

**Synergies wired:** `absentee×elderly +14` (3.07x), `estate×absentee +6` (1.87x).

---

## 2. Prioritized gaps (closeable)

Ranked by **(lift potential × ease × cost)**. ✅ = addressed in this pass.

### P0 — Free, code-only, do now
1. ✅ **`delinquent + suit` synergy (2.80x).** Measured interaction, also confirmed
   by the trained model (`delinq_x_suit` OR 1.08). Added as a modest synergy bonus
   (+4) — modest on purpose because the additive weights already reward the two
   components heavily. *Done this pass (a).*
2. ✅ **Tenure as a positive prior (7+ yr TX).** High-confidence literature signal
   (RESEARCH §A). The **ingester already exists** (`ingest_appraisal.js` →
   `appraisal_detail.tenure_years`, from the **FREE** DCAD bulk appraisal file) but
   tenure was **never joined into discovery**, so it scored 0. Wired this pass as a
   `tenure` signal + a `tenure≥30 × elderly` free-and-clear proxy. *Done this pass
   (c) — still needs the free DCAD file ingested on the box to light up.*

### P1 — Free feed, ~an afternoon of build each
3. ✅ **311 code-compliance distress.** Dallas OpenData 311 (`gc4d-8a49`), free SODA
   API, hourly, PDDL public domain. Open code-compliance requests (junk, tall grass,
   substandard structure, etc.) are a distress proxy. Built this pass (b):
   `fetch_311.js` + `ingest_311.js` + `codeCompliance` signal end-to-end.
   ⚠️ **Match-precision caveat:** 311 records carry a full street address *with* a
   house number, but the tax roll's `property_address` has **no house numbers** — so
   account matching is street+ZIP (loose) unless the source carries a parcel id. Same
   wall as the foreclosure feed; recall/precision is capped until we build a DCAD
   situs-address → account crosswalk (future). The feed is wired and safe (loose
   matches are gated behind `ALLOW_LOOSE_MATCH=1`).
4. **Owner-age 60+ band (not just the 65+ exemption).** Median seller is 63–64,
   *below* our over-65 cutoff (RESEARCH §A.4) — we're aimed slightly old. Needs a
   household/age data source (see §3); cheap to score once data exists.
5. **Probate records** to strengthen the existing estate signal. Dallas County
   Probate Courts portal is free/searchable. Feeds `estate` precision.

### P2 — Paid or harder-to-source feeds (machinery already built)
6. **Free-and-clear (no mortgage).** `ingest_liens.js` + `liens` table + `freeAndClear`
   signal + `free-and-clear×elderly` synergy are **all built and wired** — only the
   lien *data* is missing. Free DIY path (`derive_liens_from_deeds.js`) needs Clerk
   deed data; paid path is PropStream. **Tenure (P0 #2) is a free partial proxy**
   (30+ yr owned + over-65 ≈ paid off). *Cost: see §5.*
7. **Divorce / family-law filings.** Top mobility driver; `ingest_divorce_events.js`
   built and wired. Blocked on data: no public online access since 2014; paid county
   bulk subscription or a vendor. *Cost: see §5.*
8. **Empty-nester / household composition.** `emptyNester` signal + `ingest_voters.js`
   built. ⚠️ TX voter file is **illegal** for commercial marketing (Elec. Code
   §18.067) — must use licensed marketing data. *Cost: see §5.*

### P3 — Backlog (flagged, not built)
9. Vacancy (Regrid USPS — paid, marketing-use restriction). Evictions (10 JP courts,
   fragmented). High-equity signal (equity fields already stored from `liens`).

---

## 3. Combinations: what we score vs. what the data shows

| Combination | Measured lift | Scored? |
|---|---:|---|
| absentee + elderly | 3.07x | ✅ +14 synergy |
| delinquent + suit | 2.80x | ✅ +4 synergy *(this pass)* |
| delinquent + absentee + elderly (triple) | **2.68x** | ❌ **intentionally not scored** |
| estate + absentee | 1.87x | ✅ +6 synergy |
| delinquent + absentee | 1.75x | — (additive only) |
| elderly + estate | 1.70x | — (additive only) |
| free-and-clear + elderly | (lit.) | ✅ +8 synergy (awaits feed) |

**Why the triple is deliberately NOT scored:** `delinquent+absentee+elderly` measures
**2.68x — *lower* than `absentee+elderly` alone (3.07x)**. Adding delinquency on top
of that pair *reduces* sell probability. This matches the trained model's headline
finding (§4): raw delinquency is mildly negative once you control for the escalations.
A positive triple bonus would push exactly the wrong way. Documented in the scorer.

---

## 4. ⚠️ Two scoring miscalibrations (need a product decision)

These are not "add a feed" — they're "the current weights disagree with the
measured data," and fixing them shifts existing results (incl. the Lamont land
ranking), so flagging rather than unilaterally changing:

1. ✅ **DONE (2026-06-29, CHANGELOG #059): raw tax-delinquency down-weighted 40 → 22.**
   The trained model gives raw delinquency OR 0.88 — mildly *negative* once
   controlling for suit / amount-owed / absentee; its predictive value lives in its
   escalations. Down-weighted so it stays a meaningful actionability signal without
   dominating. Before/after: a *merely-delinquent* lead now ranks **below** an
   estate+absentee (non-delinquent) lead; suit/absentee-escalated leads hold the top.
   ⏭️ Still inverted vs. the model: **absentee is the strongest predictor (OR 2.05)
   but only weight 12** — a future pass should bump it.
2. **The calibrated `sell_model.json` only uses 8 tax-roll features + 2
   interactions.** It ignores divorce, free-and-clear, empty-nester, pre-foreclosure,
   estate-interactions, and now tenure/311. So the P(sell)% we surface is a **floor**.
   Retraining with the new feeds as inputs is the path to lifting AUC (0.617 today).
   **This IS back-trainable now for the free signals — see §7.**

**Recommended decision:** ✅ delinquency down-weight applied. Next: **back-train the
model with tenure + 311** (both free, point-in-time reconstructable — §7), re-run
`validate_signals.js`, and let the *measured* coefficients set the weights. Do NOT
class-rebalance (RESEARCH §A).

---

## 5. Data-acquisition costs (the paid feeds: divorce, free-and-clear, empty-nester)

*Researched 2026-06-29 (live vendor pricing). "Confirmed" = vendor-published;
"call-required" = no public price.*

| Feed | Cheapest realistic path | Price | Obtainable? |
|---|---|---|---|
| **Free-and-clear / equity** | **PropStream Essentials** — equity/free-and-clear is a built-in filter, county-wide | **$99/mo** ($81/mo billed annually); skip-trace 12¢/contact | ✅ **Yes — recommended buy** |
| **Owner-age / empty-nester** | **DCAD over-65 flag (free)** + per-record age/household append only where needed | **Free** + **$0.02–0.05/record** (DataZapp/DMDataSource/Versium); ~$125 min order | ✅ **Yes — but buy nothing upfront** |
| **Divorce / family-law** | Dallas District Clerk weekly "Civil Index" subscription (Paymentus) | **Unpublished — call (214) 653-7307**; commercial lists quote-only | ⚠️ **Marginal — don't buy yet** |

**Recommendations (from the cost research):**
1. **Free-and-clear → buy PropStream ($99/mo).** It's the only cheap path that hands
   you a ready free-and-clear/equity flag across all Dallas parcels. The "free"
   county sources (DCAD bulk, Clerk deeds portal) **do not carry mortgage/lien data
   in bulk** — DCAD has ownership/value/exemptions only, and the Clerk deeds portal
   is one-document-at-a-time with no bulk export. Our `derive_liens_from_deeds.js`
   DIY path is technically possible but heavily manual; not worth it vs. $99/mo.
   PropStream's free-and-clear export feeds `ingest_liens.js` directly.
2. **Owner-age/empty-nester → start free.** DCAD's over-65 homestead-exemption flag
   (already in our data) is a strong empty-nester proxy at $0. Append age/household
   at 2–5¢/record (DataZapp, DMDataSource, Versium pay-as-you-go ~$125/file) only on
   the parcels that matter — don't bulk-buy. Avoid enterprise vendors (Experian/
   Acxiom/Data Axle) — quote-only, higher minimums, unnecessary at our scale.
3. **Divorce → one phone call before any spend.** No clean small-operator path. The
   only direct source (county "Civil Index" weekly subscription) is **unpriced and
   its post-2014 family-case scope is unconfirmed** — call the District Clerk Records
   office (214) 653-7307 / DCRecords@dallascounty.org to get the actual price and
   confirm divorce-party + property fields *before* committing. Skip commercial
   divorce lists: quote-only, and **<5% of divorces are ever recorded** with the
   county (recording isn't required), so vendor files built on recorder data are thin.

> **⚠️ Relevance to the raw-land product (Lamont deliverable):** divorce,
> free-and-clear, and empty-nester are **home-seller / household life-event** signals
> — they barely apply to **vacant raw land**, which has no household, usually no
> homestead, and a different (often no-) mortgage profile. For land lists the signals
> that matter are **tax-suit / delinquent / estate / multi-lot assemblage** (all
> already live + free). **So: prioritize these three paid feeds for the *residential*
> motivated-seller product, not the land lists.** For land, the cheapest next win is
> the free DCAD tenure file (P0 #2) + the free 311 feed (P1 #3) — both shipped this
> pass — and DCAD lot-dimension/acreage data to fill the known land-size gap.

---

## 7. Back-training the model with the new features (it IS possible)

Earlier I said the new features "can't be retrained until a future snapshot." That
was **wrong for the free signals.** The blocker isn't time — it's getting each
feature's value **as it was at the OLD snapshot date** (point-in-time), so you don't
leak the outcome. For features that are *timestamped historical facts*, that value is
reconstructable today. The model's AUC (0.617) is a floor precisely because we left
these out.

**The backtest spine (already built):** OLD snapshot = 2025-08-25 tax roll
(`tax_roll.db.bak-20250825`, on the box) → NEW = 2026-06-22 → label = owner-name
changed. `scripts/validate_signals.js` + `scripts/train_sell_model.js` already do
this; we just add columns.

| New feature | Point-in-time source | Leakage-safe? | Cost | Status |
|---|---|---|---|---|
| **Tenure** | DCAD **annual** appraisal archives (DataProducts has 2021–2026 ZIPs). Use the **2025** file's deed-transfer date → `tenure_as_of_2025 = 2025 − deed_year`. | ✅ The 2025 file predates the labeled sales, so sold parcels don't show their post-sale deed. (Using *today's* appraisal file WOULD leak — sold parcels show the new owner's deed.) | **Free** | ✅ **Do now** |
| **311 code-compliance** | Socrata 311 (`gc4d-8a49`) carries `created_date` + `closed_date`. Reconstruct "open on 2025-08-25" = created ≤ 2025-08-25 AND (closed null OR > 2025-08-25). | ✅ Pure as-of filter on dates. | **Free** | ✅ **Do now** |
| Free-and-clear | Dated Clerk deed-of-trust + release records as of 2025-08. (PropStream's *current* snapshot would LEAK — sold homes show the new owner's mortgage.) | ⚠️ Needs dated clerk records, not a current snapshot | gated/paid | Blocked on data |
| Divorce | Family-court filings with `filed_date` ≤ 2025-08 | ✅ if acquired | paid/call | Blocked on data |

**Bigger win the archives unlock:** DCAD + tax-roll snapshots exist for **multiple
years (2021–2026)**, so we can build **several** OLD→NEW snapshot pairs (21→22, 22→23,
…), not just one. That's far more labeled sale-events → enough for the **discrete-time
hazard model** RESEARCH §A recommended (and multiple years smooth out one-window
noise). The data genuinely exists; it's a download + join job on the box.

**Concrete next step (free, ~half a day on the box):**
1. Download the **2025 DCAD annual appraisal ZIP** → `node ingest_appraisal.js` against
   a 2025-as-of column; pull **historical 311** with an as-of-2025-08 filter.
2. Add `tenure_as_of`, `code_open_as_of` to `train_sell_model.js` features; retrain;
   read the new ORs + AUC.
3. Re-weight the hand-scorer from the *measured* coefficients (replaces the remaining
   hand-tuning, incl. the absentee under-weight).

---

## 8. Status of this pass
- ✅ (a) `delinquent+suit` synergy added; triple deliberately omitted (documented).
- ✅ (b) 311 code-compliance feed built + wired (precision caveat noted).
- ✅ (c) Tenure signal wired from the existing free DCAD appraisal ingester.
- ✅ Frontend: codeCompliance + tenure toggles; elderly age band 65→60 (CHANGELOG #058).
- ✅ Delinquency down-weight 40→22 applied + before/after verified (CHANGELOG #059).
- ✅ §5 cost numbers researched; §7 back-training path corrected & planned.
- ⏭️ Follow-ups: ingest the free DCAD appraisal file + historical 311 on the box,
  **back-train the model with tenure + 311** (§7), bump absentee weight from the new
  ORs, build the DCAD situs-address crosswalk to sharpen 311/foreclosure matching.
