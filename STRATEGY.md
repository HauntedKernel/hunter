# Hunter — Signal & Growth Strategy

*Living strategy doc. Last updated 2026-06-16. Owner: Cole.*
*This is a thinking document — not a build spec. Nothing here is implemented unless it's in `CHANGELOG.md`.*

---

## 1. The reframe: we are building a *signal library*, not a tax-delinquency tool

Today a "candidate" = tax-delinquent. The real product is bigger:

> **A candidate is any property whose owner a public signal says is likely to sell.**

Tax delinquency is one signal. The architecture we already have —
`per-property feature → motivation score → ranked list` — is the right shape to
plug *many* signals into. The job is: find signals, gather them
county/city-wide, quantify them, and fuse them into one ranked pipeline.

**Events vs. States** — a useful split:
- **Events** — something just happened (foreclosure filing, probate, arrest,
  divorce). High urgency, *time-decaying* — a 2-week-old lis pendens is hotter
  than a 2-year-old one.
- **States** — a standing condition (long ownership, absentee, elderly, high
  equity). Lower urgency, always-on. Best used to *rank within* an event, or as
  a slow-burn list.

The strongest candidates sit at the **intersection**: e.g. *elderly + long
ownership + probate just filed.*

---

## 2. Signals we already have but don't score yet (free wins)

The Dallas tax roll already contains columns we ingest but don't use:

| Signal | Column(s) we already have | Indicates |
|---|---|---|
| **Elderly / disabled owner** | `over65_exemption`, `disabled_exemption` | Downsizer, estate, aging-in-place → sale or death |
| **Absentee owner** | `owner_address` ≠ `property_address` | Tired landlord, out-of-state heir — high motivation |
| **Long ownership** | (in scoring already) | Equity-rich, life-stage transitions |
| **High tax burden** | `tax_amount` / `total_value` | Cost pressure |

**Action:** light these up first — zero new data, immediate new candidate types.

---

## 3. New public signals, by source & how well they scale

Our hard constraint: most of this data is administered **county-by-county**, so
"easy to scrape" and "easy to scale" are different axes.

### Easy — city/county open-data portals (Socrata/ArcGIS, often bulk)
| Signal | Why it's a seller signal |
|---|---|
| Code violations / nuisance liens | Can't or won't maintain → sell |
| Building permits (stalled, or none in decades) | Distress or deferred maintenance |
| Vacant property registry | Vacant = motivated, usually absentee |
| Demolition / condemnation orders | Forced disposition |
| Short-term-rental permits | Owners exposed to STR crackdowns |

### Medium — county clerk / recorder & courts (online search, sometimes bulk)
| Signal | Strength |
|---|---|
| **Pre-foreclosure / lis pendens / notice of default** | ★ Strongest "about to sell or lose it" signal |
| **Probate filings** | ★ Inherited property — heirs overwhelmingly sell, often off-market |
| **Divorce filings** | Asset division forces a sale |
| **Eviction filings (TX Justice of the Peace courts)** | Landlord fatigue → tired-landlord seller |
| Mechanic's / IRS / state tax liens | Financial pressure |
| **Arrest / jail bookings / new criminal cases** | Legal-defense & bail costs, incarceration, relocation → see §6 (high-risk) |

### Harder, but they scale *statewide* (not county-by-county)
| Source | Unlocks |
|---|---|
| **TX voter file** (one statewide purchase from the SOS) | **Owner age (birth year), household members & their ages** — elderly, empty-nester, kids-aged-out |
| **Secretary of State business filings** | De-anonymize LLC-owned property → principals / registered agent |
| Obituaries (Legacy.com, funeral homes) | Death-in-household, pre-probate |

---

## 4. Demographics: age & family status

The **voter file is the unlock.** In Texas the roll is public and includes name,
address, and birth year, and shows *who else is registered at the address*:
- **Elderly owner** — also confirmable via the over-65 exemption we already hold.
- **Empty nester / kids graduated** — children registered at the address who then
  re-register elsewhere (~18–22, often a college town). A real, derivable
  "downsizer" signal.
- **Household shrinking/growing** over time.

Deprioritize "just had kids": birth records are restricted in most states, and
new parents are usually *buyers*, not off-market sellers. The high-value family
signals are **death, divorce, and empty-nesting** — all detectable.

Anything deeper (income, exact # of kids) only comes from **data brokers**
(Experian/Acxiom-type household files) — a buy, not a scrape.

---

## 5. Contact information — the hard part

Public records reliably yield **owner name + mailing address** → which already
supports **direct mail** (the staple of off-market outreach). They almost never
contain **phone/email.**

Paths to phone/email:
- **Skip-tracing / data-append APIs** (industry standard): TLOxp, IDI/LexisNexis,
  BatchSkipTracing, REISkip, PropStream, Skip Genie. ~$0.05–0.25/record bulk.
  **Call these only on leads a realtor selects** (not the whole county) — fits our
  existing enrich-on-select / bulk-enrich-with-cache pattern exactly.
- **LLC owners** → Secretary of State principals/registered agent.
- **Reverse-lookup APIs** (Whitepages Pro) — lower hit rate.

**Compliance is a product requirement, not a footnote** (see §7).

---

## 6. Arrests / legal events — high value, highest risk

**Mechanism:** an arrest can force a sale — legal-defense and bail costs create an
urgent cash need; incarceration means the owner can't hold or maintain the
property; family may liquidate.

**Sources (county-level, event-based, time-sensitive):** sheriff jail booking
logs / inmate rosters (often daily, public), arrest blotters, newly-filed
criminal court cases, bail-bond filings.

**This is the most sensitive signal in the entire library. Do not ship it
without legal review and explicit guardrails:**
- **Arrest ≠ guilt.** Presumption of innocence; many arrests never lead to charges.
- **Bias / fair-housing exposure.** Arrest data carries well-documented racial and
  socioeconomic skew. Targeting on it risks **disparate-impact** liability under
  fair-housing law and is an obvious discrimination vector.
- **Reputational toxicity.** "App that targets the homes of people who just got
  arrested" is the worst possible headline — worse than elderly/distressed.
- **Expungement / sealing.** Records can be legally erased; using stale arrest
  data can itself be unlawful in some states.

**Recommendation:** keep it on the roadmap as **opt-in, gated, and legally
reviewed** — not in the default score. If used at all, prefer *conviction/forced-
sale court outcomes* over raw arrests, and document the compliance basis. Treat
this as a "requires counsel sign-off" feature.

---

## 7. Compliance & ethics — as real product requirements

Our best candidates skew **elderly + financially distressed** — exactly the cohort
with the most legal and reputational sensitivity. A *compliant* tool is also a
*more adoptable* tool (brokerages won't touch a liability). Bake these in:

- **DNC scrubbing** before any call — federal + state registries. Fines are per-call.
- **TCPA** — texting/auto-dialing rules; severe statutory damages.
- **CAN-SPAM** — email outreach rules.
- **Elder-protection statutes** — targeting elderly owners carries elder-financial-
  abuse exposure in some states.
- **Fair housing / disparate impact** — be able to defend *why* each signal is used.
- **Positioning** — fair-offer / win-win framing, not "predatory." (This is partly
  why the name moved off "Predator.")

Guardrails should be enforced in-product (e.g. can't export a phone list without a
DNC scrub), not left to the user.

---

## 8. The scaling / "edge" question

The tension: property, tax, court, and code data are administered **county-by-
county** (254 counties in TX), so a pure-scraping moat is built one county at a time.

Three lenses:
1. **Build (per-county ingesters)** — slow, linear, cheap, defensible. Prioritize
   big metros (Harris/Houston, Tarrant, Bexar, Travis, Collin — a handful covers
   most of TX transaction volume). **Lean on bulk files** (like Dallas `flat404`),
   not page-scraping — far more scalable per county.
2. **Buy (national aggregators)** — ATTOM, CoreLogic, Regrid, DataTree, PropStream
   have *already* aggregated county data nationally. Instant coverage, but
   commoditized (competitors buy the same rows) and per-record cost.
3. **The honest realization:** at scale, **raw data stops being the edge** —
   aggregators have it. **Our durable moat is signal fusion + the motivation
   model** (delinquency + probate + code + absentee + owner-age scored together,
   nobody else does), plus realtor UX and speed. Scraping is the bootstrap; the
   analytics is the moat.

**Suggested hybrid:** prioritize signals that are **statewide or nationally
licensable** (voter file, SOS, aggregator feeds) so coverage scales without 254
scrapers — and hand-build deep county ingestion only where *fresh, exclusive*
event signals (live pre-foreclosure, probate, code) beat the aggregators on speed.

---

## 9. Scoring model: how to fuse it

- Every property becomes a **feature vector** (one entry per signal).
- A candidate is surfaced if **any** signal crosses threshold — not just delinquency.
- **Events** carry a **time-decay** (hot when fresh); **states** are steady multipliers.
- Each signal has a **confidence/coverage** weight (some counties expose probate
  online, some don't) so scores are comparable across areas.
- Output: a single ranked **motivation score** + the **"why"** (which signals fired)
  — the explanation is itself a selling point for realtors.

This generalizes the current `MotivationScorer` from one input (tax) to many.

---

## 10. Prioritized roadmap

| # | Add | Type | Status |
|---|---|---|---|
| 1 | Absentee-owner + over-65 scoring | state | ✅ **Done** [#014] — scored factors (absentee +12, elderly +10) |
| 2 | Pre-foreclosure / lis pendens | event | ⚙️ **Built, feed-pending** [#018] — `legal_events` table + scoring (+35, lis pendens 0.75×) + UI toggle, all working. Needs a County Clerk foreclosure/lis-pendens feed loaded via `ingest_legal_events.js` (CSV). Table empty until then. |
| 3 | Probate / inherited property | event | Huge off-market category |
| 4 | Voter-file join (owner age, empty-nester) | state, statewide | Unlocks demographics; scales |
| 5 | Skip-trace append (on selected leads) + DNC scrub | contact | Turns leads into *contactable* leads — the thing realtors pay for |
| — | Arrests / legal | event | ⚙️ **Wired but GATED OFF** [#014] — scoring factor exists (+15, recency-weighted); needs an arrest data feed + legal review to enable (`enableArrestSignal`). See §6. |

This sequence moves the product from "a list of distressed properties" to "a
contactable, ranked, multi-signal seller pipeline" — a categorically more
valuable thing.

---

## 11. Open questions

- Build vs. buy the first non-Dallas county — which metro, and via bulk file or aggregator?
- Where does the voter-file join live (ingest once statewide vs. per-lead lookup)?
- Skip-trace vendor selection + cost model (per-lead vs. subscription).
- Minimum compliance layer before *any* outreach feature ships.
- Is the arrests signal worth the risk at all, or does it stay permanently parked?
