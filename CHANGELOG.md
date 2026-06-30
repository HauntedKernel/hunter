# FlashStack Changelog

Tracking numbered changes so they can be reviewed and rolled back (Handoff Rule 5).

## 2026-06-29 — Back-trained recency + 311 into the sell-model (LIVE)

- `[#071]` **Recency folded into the calibrated `sell_model.json`; 311 measured out.**
  The live sell-probability model was blind to recency/pre-foreclosure/code-compliance, so
  its lift *undersold* recent-buyer leads (the score-vs-lift divergence). Back-trained the
  two free, point-in-time-reconstructable signals into the model itself.
  `scripts/backtrain_recency_code.js` + `fetch_311.js` (added `update_date` close-date proxy
  so historical 311 can be reconstructed open-as-of a past date; 33k records back to 2020).
  - **Leak caught & excluded.** The "2025" DCAD archive captures deeds at/after the
    2025-08-25 snapshot, so `deed_year=2025` leaks the label (univariate 2.96x vs a clean
    `deed_year=2024` 1.48x). `recent` now excludes the as-of year → honest **OR 1.20**
    (univariate 1.36x), independent of absentee/delinquency. RESEARCH §G.1.
  - **Code-compliance dropped — measured, not predictive.** Even with deep history (291
    parcels open on the snapshot date), `code_open` multivariate **OR = 1.00**; its 2.18x
    univariate is fully absorbed by absentee/delinquency. The heuristic `codeCompliance`
    score weight (12) stays; the model gains nothing, so it's not a model feature.
  - **Model:** features add `recent` + `recent_x_delinq`. Held-out **AUC 0.617 → 0.619**
    (marginal — absentee OR ~2.04 dominates), but recent-buyer leads now get a deserved
    probability bump + a named "Recent buyer (≤2 yr)" driver. Wired `recent` into
    `SellProbabilityModel.score()` + `MotivationScorer` (live `recent` = tenure ≤ 2yr; no
    leak scoring forward). **Live-verified:** a recent+delinquent absentee lead went
    18.8%/2.99x → 21.8%/3.47x. Old model saved at `sell_model.json.bak-prerecency`.
  - Live `code_violations` left untouched (historical 311 was ingested into an isolated
    `/tmp/hist311.db` for back-training only).

## 2026-06-29 — Foreclosure feed rewired through the crosswalk (LIVE)

- `[#068]`–`[#069]` **Foreclosure notices now match through the situs crosswalk; 25% → 70%.**
  The county foreclosure postings carry an OCR'd street address but no DCAD account id,
  so the old ingester relied on a fuzzy street-token + owner-name match (precise only
  when a grantor name was present). Rewired `ingest_legal_events.js` to resolve the
  address through `situs_xref` FIRST (exact parcel), falling back to owner-aware matching
  only when the crosswalk misses. Shared the key logic in `lib/situs.js`
  (`situsKeyFromAddress`) so 311 and foreclosures normalize addresses identically — it
  handles both the comma-delimited 311 form and the comma-less, sometimes ZIP-less OCR
  foreclosure form (requires a leading house number + Dallas-area ZIP, else returns null).
  - **Result on real data:** 17/24 notices matched (70%, up from 6/24 = 25%), of which
    **16 are precise crosswalk matches** to an exact parcel (vs the prior fuzzy street+owner).
    The 7 unmatched are OCR-corrupted or Lot/Block legal descriptions with no usable ZIP —
    they correctly fall through rather than mis-match an arbitrary house on the street.
  - **Deployed live:** re-ingested into the live DB and restarted the API. Verified a
    crosswalk-matched parcel (Fair Oaks Dr, 75060) surfaces through `api.hunter.living`
    with the `preForeclosure` signal firing (score 35).
  - `[#068]` The crosswalk also rebuilds monthly in `refresh_tax_roll.sh` step 6b from the
    same DCAD download as tenure (non-fatal), so future foreclosure scrapes match through a
    fresh crosswalk automatically. `ingest_legal_events.js` honors `HUNTER_DB` for testing.

## 2026-06-29 — Situs address crosswalk → precise 311 matching (LIVE)

- `[#066]`–`[#067]` **Situs crosswalk built + deployed; 311 now matches at 77% precision.**
  The tax roll has no house numbers, so address-only feeds (311, foreclosures) couldn't
  match a parcel. DCAD's ACCOUNT_INFO does have them — `build_situs_xref.py` turns
  STREET_NUM+FULL_STREET_NAME+ZIP into a `situs_xref(addr_key→account_id)` crosswalk
  (house|zip5|street-core; unique keys only; 649,054 keys). `ingest_311.js` uses it as
  the primary precise matcher (JS `situsKeyFrom311` mirrors the python `situs_key`,
  parity-tested). `fetch_311.js` fixed to filter/sort server-side by created_date.
  - **Result on real data:** 354/459 open code-compliance requests matched precisely
    (77%, vs ~0% before); 294 resolve to live tax-roll parcels.
  - **Deployed live:** crosswalk + 311 loaded into the live DB; the `codeCompliance`
    signal now fires through `api.hunter.living` (verified — e.g. an estate property
    with an open code request surfaces as a neglected-inherited lead).
  - The crosswalk + tenure both rebuild monthly in `refresh_tax_roll.sh` step 6b from
    the same DCAD download (non-fatal). `ingest_311.js` honors `HUNTER_DB` for testing.

## 2026-06-29 — Reverse long-tenure → recency + recency×distress (measured)

- `[#064]` **Wired the recency findings into the scorer (RESEARCH §G).** Acting on the
  back-tested result that long tenure is *negative* and recency is a real signal:
  - **Removed** the long-tenure positive prior (`tenure` weight 8) and the
    long-tenure×elderly synergy (both measured 0.72–0.90x — backwards).
  - **Added `recency`** (weight 14), banded by measured lift: bought <1yr ≈ full
    (2.98x), 1yr → half, 2yr → small, ≥3yr → 0. Replaces `calculateTenureScore` with
    `calculateRecencyScore`; reads the same `appraisal_detail.tenure_years` input.
  - **Added `recency × delinquent` (+12, measured 2.46x) and `recency × tax-suit`
    (+8, 2.16x) synergies** — the "overextended recent buyer," the standout new signal
    (delinquency alone is 1.00x; the interaction is the whole signal).
  - Discovery: `TENURE_RANK` → `RECENCY_RANK` (favours short tenure); signal toggle
    `tenure` → `recency` across backend defaults, the blend/single-query ranking,
    and the frontend (🆕 "Recent Buyer"). 
  - Verified: recency bands 14/7/3/0; long tenure now scores 0 with no synergy;
    recent+delinquent totals 48 vs long-held+delinquent 22; discovery SQL + the
    recency-only edge case run on the live DB; frontend builds (73 KB gzip).
  - ⚠️ Lights up only where `appraisal_detail` (DCAD tenure) is loaded — free via
    `load_dcad_tenure.py`. Live API unchanged until a `pm2 restart` deploys it.

## 2026-06-29 — Back-training script (tenure + 311, leakage-safe)

- `[#060]` **`scripts/backtrain_sell_model.js` — back-train the sell model with the
  free point-in-time features (SIGNAL_GAPS §7).** Extends `train_sell_model.js` on the
  same 2025-08-25 → 2026-06-22 snapshot-diff spine, adding two leakage-safe features:
  - **tenure** as-of-2025 from a SEPARATE 2025 DCAD appraisal archive
    (`tenure = 2025 − deed_year`); using today's appraisal file would leak (sold
    parcels show the new deed), so it reads a dedicated archive db.
  - **code_open** = a 311 request open *on the as-of date* (`opened <= asof AND
    (closed IS NULL OR closed > asof)`) — a pure as-of filter on the records' own dates.
  Reports a **univariate lift table** for the new features (measured lift we've never
  had) plus the full multivariate model (AUC + odds ratios). **Graceful:** runs as a
  dry-run with the feature all-zero if an archive/feed is absent, and prints the exact
  free-data load commands. **Safe:** writes to `sell_model_backtrained.json` (gitignored),
  never the live model; prints the 3 steps to promote it once it beats AUC 0.617.
  - Supporting change: `ingest_appraisal.js` now honors `APPRAISAL_DB=` to load a
    point-in-time archive into a separate db (skips the tax_roll join-rate report there).
  - Validated against synthetic snapshots: as-of tenure join + 311 open-as-of filter
    both reproduce the planted lift; model trains; zero-variance features get OR=1;
    dry-run path detects absent archives and emits load commands.

## 2026-06-29 — Delinquency recalibration + back-training plan

- `[#059]` **Raw tax-delinquency down-weighted 40 → 22 (model reconciliation).**
  The trained model (RESEARCH §F) gives raw delinquency a multivariate OR of 0.88 —
  mildly *negative* once controlling for suit status, amount owed, and absentee — yet
  it was hand-weighted highest (40). Its predictive value lives in its escalations
  (suit, amount, absentee), which are already scored separately. Down-weighted to 22
  so it stays a meaningful actionability signal without dominating the score.
  Before/after on real + archetype leads: a *merely-delinquent* lead now ranks
  **below** an estate+absentee (non-delinquent) lead, while suit/absentee-escalated
  delinquent leads hold the top — the model-aligned ordering. Flagged but NOT yet
  changed: absentee is the model's strongest predictor (OR 2.05) but still only
  weight 12 — bump it after the back-train. `SIGNAL_GAPS.md §4`.
- **`SIGNAL_GAPS.md §7` — back-training the model with the new features IS possible.**
  Corrected the earlier "blocked until a future snapshot" claim: the blocker is
  point-in-time reconstruction, not time. **Tenure** (DCAD annual appraisal archives,
  2021–2026 — use the 2025 file's deed date, leakage-safe) and **311** (Socrata
  created/closed dates → "open as of 2025-08-25") are both **free and back-trainable
  now** against the existing 2025-08→2026-06 labeled snapshot. The multi-year archives
  also enable several snapshot pairs → enough labels for the discrete-time hazard
  model. Free-and-clear/divorce need dated historical records (a current PropStream
  snapshot would leak). Concrete steps in §7.

## 2026-06-29 — Signal-gap audit + three lift fixes

- `[#057]` **Signal/combination gap audit + 3 closeable gaps shipped (`SIGNAL_GAPS.md`).**
  Audited which lift-bearing signals/combinations the live scorer actually captures
  vs. the backtest/research. New `SIGNAL_GAPS.md` ranks every closeable gap and flags
  two scoring miscalibrations (raw-delinquency over-weight; the calibrated model
  ignores the newer feeds → its P(sell) is a floor). Three fixes landed:
  - **(a) `delinquent + suit` synergy (+4)** in `MotivationScorer` — measured 2.80x,
    confirmed by the model's `delinq_x_suit` term. Deliberately did NOT add a
    delinquent+absentee+elderly *triple* bonus: it measures **2.68x, below
    absentee+elderly's 3.07x**, so delinquency *subtracts* from that pair — a positive
    triple would push the wrong way (documented in code + doc).
  - **(b) 311 code-compliance feed** — `fetch_311.js` (free Dallas OpenData SODA API,
    dataset gc4d-8a49, fuzzy column mapping) + `ingest_311.js` → new `code_violations`
    table, wired end-to-end as a `codeCompliance` distress signal (discovery JOIN +
    ranking + scorer weight 12 + UI-ready). ⚠️ Match precision capped by the tax
    roll's missing house numbers (same wall as foreclosures); loose street+ZIP
    matching gated behind `ALLOW_LOOSE_MATCH=1`. Real fix = a DCAD situs-address
    crosswalk (logged).
  - **(c) Tenure prior wired** — the free DCAD appraisal ingester (`ingest_appraisal.js`
    → `appraisal_detail.tenure_years`) existed but was never joined into discovery, so
    tenure scored 0. Added the JOIN + a banded `tenure` signal (weight 8: 7-14/15-29/30+
    yr) + a `30+ yr tenure × elderly` "paid-off downsizer" synergy (a free
    free-and-clear proxy). Lights up once the free DCAD file is ingested on the box.
  - **Cost research (paid feeds):** PropStream **$99/mo** is the cheapest real
    free-and-clear path (county free sources lack bulk mortgage data); owner-age via
    free DCAD over-65 flag + **2–5¢/record** append as needed; divorce has no clean
    priced small-operator path (county subscription is call-required + scope-uncertain;
    commercial lists thin — <5% of divorces are recorded). These are home-seller
    signals — low relevance to the raw-land lists. Full table in `SIGNAL_GAPS.md §5`.
  - Validated: all files syntax-clean; scorer smoke test confirms each new factor +
    the no-triple behavior; discovery SQL runs against the live 540 MB DB (new tables
    auto-create, leads return). Follow-ups: ingest the free DCAD appraisal file on the
    box, re-run `validate_signals.js` + retrain the model with the new features.

## 2026-06-16 — Consolidation, DB-first redesign, public test deploy

- `[#001]` **Consolidated 6 scattered project folders → 1 canonical.**
  Moved `FlashStack`, `flashstack-demo`, `Outreach`, `Outreach2`, `Outreach3`
  into `Desktop/_FlashStack_archive/`. **`FlashStackDemo` is now the single
  source of truth.** Fully reversible (just move folders back).
  Files touched: filesystem only.

- `[#002]` **Fixed area search (was returning 0 for flagship neighborhoods).**
  `backend/src/processors/TaxRollProcessor.js` — `searchDelinquentProperties()`
  filtered by `city LIKE`, but the tax roll files Highland Park / University
  Park under city = `DALLAS`, and stores ZIPs as 9-digit ZIP+4 (`752050000`).
  Added `buildAreaFilter()`: resolves a free-text area to ZIP-prefix matches
  (neighborhood map + bare ZIP) and falls back to a city match. Now returns
  real leads for neighborhoods, ZIPs, and cities. Also sorts by
  `delinquent_amount, delinquent_years`.

- `[#003]` **DB-first discovery (the big efficiency win).**
  `backend/src/services/PropertyIntelligenceService.js` —
  `findDelinquentPropertiesInArea()` used to scrape dallascad.org **per
  property**, sequentially, behind a 3-sec rate limit (~5 min/search, fragile
  regex parsing). Replaced with in-process scoring straight from the tax-roll
  DB via new `buildLeadFromTaxRecord()`. A full area now returns scored leads
  in **~800 ms** with no network calls. CAD enrichment (house number,
  beds/baths/sqft) is deferred and runs **lazily** via the existing
  `POST /api/property/analyze` endpoint only when a single lead is opened.

- `[#004]` **Safety: searches never trigger the 2.8 GB re-download.**
  `backend/src/scrapers/DallasCountyTaxScraper.js` — `ensureTaxRollData()` only
  does a full load when the DB is genuinely empty. Stale data (>7 days) is
  served with a warning; refresh is now an explicit job, not a search side
  effect. Prevents multi-minute hangs.

- `[#005]` **Single-origin frontend + Cloudflare quick tunnel for testing.**
  `vite.config.js` — added `/api` proxy → `http://localhost:3001` and allowed
  `*.trycloudflare.com` hosts. Switched 4 hardcoded `http://localhost:3001`
  calls in `src/` to relative `/api/...` paths. The whole app now serves behind
  one origin so a single `cloudflared` quick tunnel exposes it publicly.

- `[#006]` **Lead-click → lazy CAD enrichment wired in the UI.**
  `src/services/SellerIntelligenceService.js` — added `enrichLeadWithCAD()`
  which calls `POST /api/property/analyze` for a single address.
  `src/components/screens/SellerIntelligenceResultsScreen.jsx` — expanding a
  lead now fetches CAD details once (loading → results / graceful empty/error
  states), shows beds/baths/sqft/year built/full address, and caches the result
  on the lead. `vite.config.js` — ignore `**/backend/**` in the file watcher so
  the scraper's debug-HTML/DB writes no longer trigger page reloads mid-use.
  NOTE: the wiring is complete and works, but the CAD HTML parser frequently
  returns junk (owner = ".aspx", null beds/baths) — a pre-existing scraper issue
  (Handoff G3). The UI degrades gracefully when that happens. Fixing the parser
  is the recommended next step.

- `[#007]` **Fixed the Dallas CAD scraper + HTML parser (G3).** The lazy CAD
  enrichment was returning junk (owner = ".aspx", null values). Three root
  causes, all fixed in `backend/src/scrapers/`:
  1. **Lost session cookie** (`DallasCADScraper.js`) — ASP.NET ties VIEWSTATE to
     the `ASP.NET_SessionId` cookie, but axios didn't persist it, so every POST
     was silently rejected and re-rendered an empty "No Records" form. Now the
     cookie from the initial GET is forwarded on the POST (`extractCookieHeader`,
     no new dependency).
  2. **Wrong/over-specific city filter** (`DallasCADScraper.js`) — searches sent
     a numeric `listCity` code (several of which were wrong), and our tax roll
     files Highland Park etc. under DALLAS while DCAD files them under their own
     city. Now searches use `[ALL]` cities; street number + name is specific
     enough.
  3. **Loose owner regex leaked page chrome** (`HTMLParser.js`) — a
     case-insensitive `/Owner...([A-Z...]+)/i` matched navigation links like
     "SearchOwner.aspx" and captured ".aspx". Tightened the patterns (uppercase
     start, min length, no /i) and added `isValidOwnerName()` to reject URLs /
     file names / markup.
  RESULT: real searches now return verified owner + clean address + market value
  + type (e.g. 4300 Beverly Dr → "BARTHOLOW PETER & VICTORIA M", $6,504,000,
  RESIDENTIAL). Non-existent addresses degrade gracefully to "Unknown Owner".
  REMAINING: beds/baths/sqft/year live on the per-property DETAIL page (a
  further postback into AcctDetailRes.aspx), not the search-results row — so
  those still show "—". Following the detail link is the next enhancement.

- `[#008]` **CAD detail-page enrichment (beds/baths/sqft/year built).** The
  search-results row only carries owner/address/value/type; building
  characteristics live on the per-property detail page. Added
  `DallasCADScraper.fetchPropertyDetailPage(accountId)` (plain GET to
  `AcctDetailRes.aspx?ID=...`, no session needed) and
  `HTMLParser.parseResidentialDetail()` which reads the stable `MainImpRes1_lbl*`
  spans (bedrooms, full/half baths, living area sqft, year built, stories).
  `getPropertyDetails()` now follows that link after the search and merges the
  fields into `property`. Bathrooms = full + ½·half.
  RESULT: a lead lookup now returns the full picture, e.g. 4300 Beverly Dr →
  owner BARTHOLOW, 4 bd / 5 ba / 6,857 sqft / built 2015 / $6,504,000;
  3525 Turtle Creek Blvd → 3 bd / 3 ba / 2,497 sqft / built 1957 / $699,160.
  COST: one extra GET per lead (~3–5s total per lookup with rate limiting) —
  acceptable because enrichment is lazy (only when a lead is opened).

- `[#009]` **Background enrichment of selected leads for export.**
  `src/components/screens/SellerIntelligenceResultsScreen.jsx` — selecting leads
  now kicks off a throttled background queue (`runEnrichmentQueue` + `enrichOne`,
  shared with click-to-expand) that enriches each selected lead with CAD detail
  one at a time. Sequential by design — the scraper is rate-limited, so parallel
  calls would just queue on the backend. A live `leadsRef` mirror + in-flight
  Set + single-runner flag prevent double-enrichment and races; leads selected
  mid-run are picked up. A progress banner shows "Enriching N/M…" → "All M
  enriched". `handleExport` warns if leads are still enriching (export partial or
  wait). `src/services/SellerIntelligenceService.js` — `exportLeads` CSV now
  includes Urgency Score, Amount Owed, Years Delinquent, Beds, Baths, SqFt and
  Year Built, with proper quoting/escaping of values containing commas/quotes.

- `[#010]` **Bulk-enrich endpoint with persistent cache.**
  New `backend/src/cache/CADResultCache.js` — a SQLite-backed (`cad_cache.db`)
  cache of CAD enrichment results keyed by normalized address, 30-day TTL.
  Survives restarts, so repeat selections are instant across sessions.
  New route `POST /api/property/bulk-enrich` (`backend/src/api/propertyIntelligence.js`)
  accepts `{addresses:[...]}` or `{leads:[{address}]}`, serves cache hits
  instantly and scrapes only misses (sequential — the scraper is rate-limited),
  caps at 100/request, returns per-address results + `{cached,fetched,failed}`
  stats. Measured: 2 cold addresses 9.5s → same 2 warm 0.21s (~45×).
  Frontend (`SellerIntelligenceResultsScreen.jsx` + `SellerIntelligenceService.js`)
  — the background selection queue now drains through `bulkEnrichLeads()` in
  chunks of 5 (keeps the progress banner moving while gaining the cache);
  click-to-expand enrichment goes through the same cached endpoint. A
  successful "no CAD match" is cached too, so partial tax-roll addresses aren't
  re-scraped futilely.

- `[#011]` **Stripped & repackaged as "Hunter" — a single-purpose off-market
  seller finder for realtors.** Product decision: do one thing well. Removed the
  entire CMA / lifestyle-discovery thread (Thread A) and rebranded.
  - `src/App.jsx` rewritten: routing now covers only the seller flow
    (dashboard/home → search results → campaign details); Hunter branding +
    "Dallas County" scope chip in the header; dropped analysisMode/share/UserMenu.
  - `SellersDashboardScreen` is the front door ("Find Off-Market Sellers");
    removed its redundant back button.
  - Rebranded `index.html` title/meta and the PWA manifest (vite.config.js) to
    Hunter, green theme.
  - Deleted ~22 orphaned Thread A files (CMA/Discovery/AR/Documents/Customer/
    Share screens, UserMenu, ui/ + gestures/ components, CustomerService,
    ShareSessionService, mockProperties). All preserved in the
    `seller-intelligence-focus` checkpoint commit if ever needed.
  - `src/` is now just: App, main, 3 seller screens, SellerIntelligenceService,
    globals.css.
  Verified end-to-end on the public URL: search (100 leads) + cached enrichment.

- `[#012]` **Campaigns tab wired to real saved searches (removed last mock data).**
  `SellerIntelligenceService` — replaced the three hardcoded demo campaigns with
  localStorage-backed campaign storage (`getCampaigns`/`saveCampaign`/
  `getCampaignById`/`deleteCampaign`, key `hunter_campaigns`). A campaign now
  stores the leads the realtor actually selected + the search params + counts.
  `SellerIntelligenceResultsScreen.handleEnableCampaign` now persists a real
  campaign (lead essentials) instead of just alerting.
  `SellersDashboardScreen` campaign cards show real stats (leads, avg motivation,
  total owed, created date) — dropped the fake contacted/responses/response-rate.
  `CampaignDetailsScreen` rewritten: was entirely mock outreach (contact channels,
  phone/email/responses); now shows the real saved leads with owner/address/
  scores/amount-owed/value/beds-baths-sqft, plus CSV export and delete. No fake
  outreach activity. Verified: save → list → detail → export → delete.

- `[#013]` **Added `STRATEGY.md`** — signal & growth strategy (no code). Reframes
  the product as a multi-signal "candidate" library (events vs. states), catalogs
  public data sources by scrape-ability/scale, covers demographics via the voter
  file, contact-info via skip-tracing, the county-by-county scaling/edge question
  (build vs. buy; moat = signal fusion), a prioritized roadmap, and compliance/
  ethics as product requirements. Flags arrests/legal as a high-risk, gated,
  legal-review-required signal.

- `[#014]` **Added absentee, elderly, and (gated) arrest signals to the motivation
  model.** Generalizes scoring beyond tax delinquency (STRATEGY.md §2/§6).
  - `TaxRollProcessor.formatPropertyResult` now derives `isAbsentee` (owner
    mailing address doesn't reference the property's street — tired landlord /
    out-of-state heir).
  - `MotivationScorer`: new weighted factors `absenteeOwner` (+12),
    `elderlyOwner` (+10, from over-65/disability exemption), and `arrestRecord`
    (+15, recency-weighted) — the last **gated OFF** behind `enableArrestSignal`
    (default false) pending an arrest data feed + legal review. Final score now
    capped at 100 (added weights raise the max).
  - `PropertyIntelligenceService.buildLeadFromTaxRecord` passes the real signals
    (absentee/over-65/disabled from the tax roll; arrest = null).
  - Frontend now shows only factors that actually fired (`points > 0`).
  - Verified on real data: Garland leads now spread 25 / 35 (elderly) / 37
    (absentee), and a 75205 lead hit 47 (delinquent + absentee + elderly).
  - Note: refines RANKING of the delinquent leads we surface. Surfacing
    NON-delinquent absentee/elderly owners as candidates needs the discovery
    query to broaden (a separate step).

- `[#015]` **Broadened discovery to surface non-delinquent absentee & elderly
  owners** (not just tax-delinquent). STRATEGY.md §2.
  - `migrate_signal_columns.js` (one-time): precomputes an `is_absentee` column
    (street-token vs owner mailing address — owner_address has no city/ZIP in
    this data) so absentee can be filtered/ranked in SQL, and adds `zip_code` /
    `city` indexes for fast area queries. Flagged 265,079 absentee properties.
    **Run after any fresh `process_full_tax_roll.js` rebuild.**
  - `TaxRollProcessor.searchCandidatesByArea`: any-signal discovery (delinquent
    OR over-65/disabled OR absentee). Two-bucket blend (default 60% delinquent /
    40% current-but-elderly/absentee, with backfill) so non-delinquent owners
    actually appear instead of being crowded out by delinquents.
  - `formatPropertyResult` now reads stored `is_absentee` and reports honest
    delinquency status (was hardcoded `isDelinquent: true`).
  - `DallasCountyTaxScraper.searchCandidatePropertiesByArea` + service now call
    the broadened search; `buildLeadFromTaxRecord` no longer assumes delinquency.
  - Verified: Lakewood & Highland Park each return 60 delinquent + 40 current
    elderly/absentee candidates (~1s); current owners score 22 (absentee+elderly).
  - NOTE: still ranks delinquents first (higher motivation); the non-delinquent
    candidates appear below them. Signal-type toggles in the UI are a future step.

- `[#016]` **Signal-type toggles in the discovery search.** Realtors choose which
  motivation signals make a property a candidate — Tax Delinquent / Elderly-
  Disabled / Absentee (default all on).
  - `SellersDashboardScreen`: "Motivation Signals" toggle section; passed through
    search params. Validates at least one selected.
  - `SellerIntelligenceService.searchDallasCADLeads`: forwards `signals` in the
    API body.
  - `DallasCountyTaxScraper` + `TaxRollProcessor.searchCandidatesByArea`: honor
    selected signals in BOTH filter and ranking. Only selected signals influence
    ordering, so "elderly only" surfaces current downsizers rather than being
    dominated by a delinquency weight the user didn't pick.
  - Verified (Lakewood): elderly-only → 96/100 current elderly; absentee-only →
    100/100 absentee with 0 delinquent (pure tired-landlords); delinquent-only →
    100 delinquent.

- `[#017]` **Wired property-type checkboxes to `category_code`** (were decorative).
  `TaxRollProcessor.buildPropertyTypeFilter` maps the UI types to Texas SPTD
  state category codes: A = single-family (incl. condo/townhome — not separately
  coded), B = multifamily, C/D/1D = vacant & ag land, F1 = commercial,
  F2 = industrial. Non-real-estate categories (L business personal property,
  J utilities, G minerals, M mobile/tangible) are excluded. Filter applied in
  `searchCandidatesByArea` (all query branches); `propertyTypes` threaded through
  the scraper. Verified (Garland): single-family → individuals; commercial →
  businesses/churches; raw land → vacant municipal lots; multi-family → B.
  NOTE: condo/townhome can't be isolated from single-family (SPTD codes them all
  as A). Default search is single-family only, so results are now residential
  unless other types are checked.

- `[#018]` **Pre-foreclosure / lis-pendens signal (roadmap #2 — strongest signal).**
  These are County Clerk EVENTS, not tax-roll data, so built as a separate
  source (STRATEGY.md §3).
  - New `legal_events` table in tax_roll.db (created at DB init; empty until fed).
  - `ingest_legal_events.js`: CSV-driven ingester (event_type, account_id,
    address, owner_name, filed/sale dates, source). Matches to tax-roll by
    account_id (preferred) or address; `--clear` to wipe.
  - `MotivationScorer.calculatePreForeclosureScore`: new factor, +35 (the top
    weight); lis pendens scored 0.75× a trustee-sale notice.
  - `searchCandidatesByArea`: LEFT JOINs `legal_events` (deduped per account);
    pre-foreclosure is a selectable signal in filter + ranking across both query
    branches; `formatPropertyResult` surfaces it.
  - UI: "Pre-Foreclosure" toggle (listed first — strongest).
  - Verified with a labeled sample fixture: 3 flagged properties surfaced and
    ranked at the top (47 / 35 / 26 — lis pendens correctly lower), and the
    "pre-foreclosure only" toggle returned exactly those 3. Sample then cleared;
    production table is empty and the JOIN is a clean no-op until a real feed
    loads. NO live feed wired yet — needs Dallas County Clerk foreclosure
    postings / OPR (or a vendor) loaded via the ingester.

- `[#019]` **Skip-trace contact info + DNC compliance (roadmap #5).** Turns leads
  into *contactable* leads (STRATEGY.md §5/§7). No public source for phone/email,
  so built as infrastructure + a CSV path; NO contact data is invented.
  - `contacts` table in tax_roll.db (created at init).
  - `ingest_contacts.js`: CSV importer for skip-trace results (account_id, phones,
    emails); phones stored dnc='unknown'.
  - `SkipTraceService`: reads contacts, applies the DNC gate **fail-closed** — a
    phone is `callable` only when DNC-scrubbed and clear; unscrubbed/unknown =
    not callable. Live skip-trace + DNC providers behind env keys
    (SKIPTRACE_/DNC_*), reporting "not configured" when absent (never optimistic).
  - `POST /api/property/contact`: returns DNC-gated contacts + provider status.
  - Frontend: contact section in lead detail (phones with Callable / Do-Not-Call /
    Not-Verified badges, emails) + leads carry `accountId`. CSV export gains
    "Phone (DNC-cleared)" (callable only), "Phones (all, DNC status)", and "Email"
    columns — a do-not-call/unverified number is never presented as callable.
  - Verified with fictional 555-01xx sample: contacts returned, every phone
    non-callable (fail-closed), CSV cleared-column held only the clear number.
    Sample then cleared; production contacts table empty. NO live provider wired.

- `[#020]` **Voter-file demographics: owner age + empty-nester (roadmap #4).**
  The TX voter roll is public and STATEWIDE (one source covers all of Texas),
  but obtained from the SOS (fee/eligibility), so built as infrastructure + a CSV
  path; no demographic data invented (STRATEGY.md §4).
  - `voter_demographics` table in tax_roll.db (created at init).
  - `ingest_voters.js`: per-voter CSV (name, address, birth_year). Matches voters
    to a tax-roll OWNER mailing address (owner-occupants) via house-number +
    street token (owner_address has house numbers; property_address often doesn't).
    Groups by property; derives owner_age (name-matched voter, else oldest),
    household size/ages, and an empty-nester flag (heuristic: owner 48–75, no
    household member under 28, ≤2 voters — kids likely moved out).
  - `MotivationScorer`: new `emptyNester` factor (+12); `elderly` now ALSO fires
    on voter age ≥ 65 (not just the tax exemption).
  - `searchCandidatesByArea`: LEFT JOINs `voter_demographics`; empty-nester is a
    selectable signal in filter + ranking (blend + single branches);
    `formatPropertyResult` surfaces owner_age + empty_nester.
  - UI: "🪺 Empty Nester" toggle.
  - Verified with a labeled sample (address-matched): empty-nester-only returned
    exactly the 2 qualifying owners (62 w/ spouse 60, and 70 solo — the latter
    also elderly-by-age); a 40-yr-old with a 22-yr-old in the home correctly did
    NOT qualify. Sample then cleared; production table empty. NO live feed wired.

- `[#021]` **Added `MONETIZATION.md`** — cost & pricing strategy (no code).
  Distinguishes fixed-cost feeds (tax roll/voter/foreclosure — pay once, serve
  free) from per-lookup costs (skip-trace/DNC — the only paywall surface). Golden
  rule: never bill before payment, trace-once-cache-forever. Model: free
  unlimited discovery + metered contact reveals sold as "unlimited leads" with an
  included allotment (protects margin vs. true-unlimited; beats per-lead framing).
  Cash-flow rules for a bootstrapped founder (prepaid, pay-as-you-go vendor, ship
  free first / don't build billing until demand shows). Notes the existing
  `contacts` cache + `/api/property/contact` are already the single billable
  chokepoint where a balance check would go.

- `[#022]` **Deploy-ready: configurable API base + CORS + `DEPLOYMENT.md`.**
  - `SellerIntelligenceService`: all four API calls now use `API_BASE` from
    `import.meta.env.VITE_API_BASE` (unset in dev → relative `/api` via the Vite
    proxy; set at build time for a static deploy → backend's public URL).
  - `server.js`: CORS origins now extendable via `CORS_ORIGINS` env
    (comma-separated) on top of the localhost defaults.
  - `.env.example`: documents VITE_API_BASE, PORT, CORS_ORIGINS, and the optional
    skip-trace/DNC provider keys.
  - `DEPLOYMENT.md`: static frontend on Cloudflare Pages (instant updates, like
    the game) + Node backend/DB on your machine-via-named-tunnel → cheap VPS;
    why it's a web app not a download; data rebuild steps; cost ladder.
  - Verified: `npm run build` produces a 73 KB-gzipped static bundle with the API
    base baked in; dev proxy path still returns results.

- `[#023]` **Cloudflare Pages deploy setup (hunter.living).**
  - `functions/api/[[path]].js` — Pages Function that proxies `/api/*` to the
    backend (`API_ORIGIN` env var). Browser talks only to hunter.living → no
    CORS, backend URL not baked into the bundle, frontend uses relative `/api`
    (VITE_API_BASE stays unset).
  - `public/_redirects` — SPA fallback (`/* /index.html 200`); the `/api`
    Function takes precedence so it isn't shadowed.
  - `DEPLOYMENT.md` updated with the concrete hunter.living click-through (connect
    repo, build `npm run build` → `dist`, set `API_ORIGIN`, add custom domain) and
    the `api.hunter.living` named-tunnel commands.
  - Verified `npm run build` emits `dist/_redirects` and the bundle. The Pages
    project creation, env var, custom domain, and `cloudflared tunnel login` are
    interactive Cloudflare-account steps (can't be done headlessly).

- `[#024]` **DEPLOYMENT.md: Oracle Cloud Always Free backend path ($0 always-on).**
  Replaced the "cheap VPS later" stub with a full walkthrough — provision an
  Always Free Ampere A1 (ARM, up to 4 cores/24GB, free forever, runs Node +
  332MB SQLite + scraping), install Node/pm2, clone the repo, `scp` the prebuilt
  `tax_roll.db` up (no rebuild needed), run the backend under pm2, and run the
  `api.hunter.living` named tunnel from the box as a service (so nothing but SSH
  is exposed). Cost ladder updated: always-on backend = $0. (Namecheap has no
  free VPS — only a 1-month shared-hosting trial, which can't run the Node backend.)

## 2026-06-22 — Data quality, web-first redesign, estate signal

- `[#025]` **Data-quality pass: floor junk leads, fix property-type filter, drop
  mock data.** `TaxRollProcessor.searchCandidatesByArea` — floor delinquent
  results at $1,000 owed and exclude government/institutional owners
  (city/county/ISD/state/housing authority); Highland Park 413 → 44 actionable
  leads, trivial $0.08 / "CITY OF" rows gone. Floor applies only to delinquent
  rows so elderly/absentee signals still surface. Property-type filter: the
  single-family/condo/townhome toggles all mapped to the same TX category code
  (did nothing) — collapsed to one honest "Residential" option (category A);
  Residential/Commercial/Multi-Family now differ. Removed fabricated data: dead
  `generateAreaAddresses()` (fake MOCKINGBIRD LN list), the fake "Estimated
  Leads" number (45 × types/3), renamed misleading mock vars, softened copy.

- `[#026]` **Web-first responsive redesign — remove phone frame, add data-table
  UI.** New CSS design system (`globals.css`): design tokens + responsive
  component classes (app-shell, app-bar, results-layout, leads-table, action-bar)
  replacing the fixed 375×812 phone frame + fake status bar. `App.jsx`: full-width
  web shell with a sticky app bar (keeps state-based nav). Results: desktop =
  filter sidebar + sortable data table + sticky action bar; collapses to cards on
  mobile. All logic preserved (lazy/bulk CAD enrichment, sort/filter, multi-select,
  save campaign, CSV export, DNC-gated contacts). Dropped the non-functional
  "Outreach Settings" tab; folded name + save into the action bar. Dashboard +
  Campaign Details rebuilt as responsive web layouts. Bundle 72 → 68.7 KB gzip;
  frontend deploy only (backend unchanged).

- `[#027]` **Estate / Inherited motivation signal (death signal).** When an owner
  dies the property usually sells (heirs offload, surviving spouses downsize).
  Detects deceased-owner records straight from the tax roll by owner-name pattern
  (ESTATE OF / LIFE ESTATE / HEIRS / ET AL) — ~3,950 Dallas County properties;
  patterns precise so "REAL ESTATE LLC" firms don't match.
  - `TaxRollProcessor.searchCandidatesByArea`: ESTATE condition wired into the ALL
    default, blend logic, and single-signal query (ranked weight 14, 8 in blend).
  - `formatPropertyResult`: derive + expose `isEstate` from owner_name.
  - `PropertyIntelligenceService.buildLeadFromTaxRecord`: pass estate signal.
  - `MotivationScorer`: estate weight 18, context flag, `calculateEstateScore`
    ("Estate / inherited — owner deceased, held by estate or heirs", severity high).
  - Dashboard: "⚰️ Estate / Inherited" signal toggle (on by default).

- `[#028]` **Fix non-deterministic results + estate starvation; add Signals
  filter.** Two bugs surfaced once Estate shipped. (1) Identical searches returned
  slightly different leads — discovery ORDER BY clauses had no stable tiebreaker,
  so SQLite returned different rows under LIMIT when scores tied. Added
  `account_id` as a final tiebreaker to every ranked query (delinquent,
  non-delinquent, single-signal). (2) Estate leads were starved in blended
  searches — the 60/40 delinquent split + balance-size ranking buried them
  (Highland Park: 18 estate, only 2 surfaced). Added a reserved estate slice (up
  to 30% of the limit, deduped) whenever the estate signal is selected, so death
  leads are always represented. Frontend: new "Filter by signal" group in the
  results sidebar (per-signal counts) — click ⚰️ Estate to isolate death leads,
  or any other signal.

## 2026-06-24 — Estate UI polish, backend hardening, real pre-foreclosure feed

- `[#029]` **Estate signal UI polish.** `SellerIntelligenceResultsScreen.jsx` —
  the results "Signals" column showed the first 3 factors *regardless of points*
  (so zero-point factors like "Tax Burden Ratio" could display); now it shows
  only signals that actually fired (`points > 0`), prioritized by intent (estate
  ⚰️, pre-foreclosure ⚖️ first) with a `+N` overflow. Distinct badges
  (`.badge-estate` violet, `.badge-foreclosure` red) + a violet left-accent on
  estate rows (`.lead-row--estate`). Lead detail lists only contributing factors.
  `SellersDashboardScreen.jsx` — estate moved from last → 2nd (after
  pre-foreclosure), both tagged "Strong". `globals.css` — new badge/row styles.

- `[#030]` **Real pre-foreclosure feed via OCR (free public Dallas data).** The
  county posts foreclosure notices ONLY as scanned-image PDFs (JBIG2, no text
  layer) grouped by city/month — no list/CSV. New `backend/scrape_foreclosures.js`
  downloads them, rasterizes (pdftoppm) + OCRs (tesseract) each page, and parses
  out `Property Address` + grantor + sale date → the `ingest_legal_events.js` CSV
  (deps: poppler-utils, tesseract-ocr; writes incrementally). Coverage is partial
  by design: only notices with an explicit address line are emitted (the rest use
  Lot/Block legal descriptions that can't match the tax roll).
  - `ingest_legal_events.js`: **owner-aware precise matching.** The tax roll's
    `property_address` has NO house numbers, so street+ZIP alone resolves to an
    arbitrary house on the street (verified: matched the wrong owners). Now when a
    notice has a grantor name, matching REQUIRES street + ZIP + owner surname;
    the imprecise street-only fallback is gated off by default
    (`ALLOW_LOOSE_MATCH=1` to opt in).
  - Verified live on real April data: pre-foreclosure searches return exactly the
    matched properties with the 35-pt factor (e.g. FLORES/CALLE BELLA DR;
    SHAW/VIDA CT scores 45 — pre-foreclosure stacked with estate).
  - Infra: backend host hardened with a 2 GB swapfile; pm2-startup +
    cloudflared-on-boot confirmed (survives reboot).

- `[#031]` **Automated monthly pre-foreclosure refresh.** New
  `backend/refresh_foreclosures.sh` (installed as a box cron, `0 3 7 * *` UTC)
  scrapes a rolling 4-month window (absorbs the county's posting lag), combines,
  and reloads `legal_events`. Fail-safe: skips the reload when the scrape yields 0
  records, so a county-site outage/lag can't wipe the live feed. Logs to
  `~/hunter/foreclosure_cron.log`; runnable manually for ad-hoc refreshes.

- `[#032]` **Refreshed the tax-roll snapshot to current data (2026-06-22 TRW).**
  Rebuilt `tax_roll.db` from the current weekly Dallas County TRW export (was a
  stale 2025-08 snapshot): 960,321 properties / 85,268 delinquent / 303,948
  absentee (delinquency is now current — the old data predated the 2025 tax-year
  delinquency date). Built in isolation and swapped atomically; old DB kept as
  `tax_roll.db.bak-20250825`. `process_full_tax_roll.js` no longer hardcodes the
  data filename — it takes an optional path arg or auto-picks the newest
  `flat404.*` in `src/data` (the TRW file ID changes each release).
  - FINDING: a fresher snapshot does NOT lift the foreclosure match rate (6 vs 7
    on the same notices) — foreclosed owners change hands, so current ownership
    *reduces* grantor-name matches on past foreclosures. The win is current
    delinquency/absentee data for the core signals, not foreclosure recall.

## 2026-06-25 — Seller-signal research, on-data backtest, scorer recalibration

- `[#033]` **Snapshot-diff signal backtest (validation on our own data).** New
  `backend/scripts/validate_signals.js` joins the 2025-08-25 and 2026-06-22
  tax-roll snapshots on `account_id` and treats a changed normalized `owner_name`
  as a "sold" event (~10-mo window); signals are read from the OLD snapshot so it's
  a genuine forward prediction. On 675,101 matched real-property accounts (base
  ownership-change rate 6.27%/10mo) it measured per-signal **lift**: tax-suit-pending
  2.45x, absentee 1.64x, estate 1.60x, delinquent 1.43x, **elderly-alone 1.00x
  (no lift)**, and **absentee+elderly 3.07x**, delinquent+suit 2.80x, estate+absentee
  1.87x. Full method + caveats + table in `RESEARCH.md` §B. (Backtest only; no
  product behavior change.)
- `[#034]` **MotivationScorer v1.0 → v1.1: empirical recalibration.**
  `backend/src/scoring/MotivationScorer.js` — down-weighted standalone
  `elderlyOwner` 10 → 6 (measured 1.00x standalone), and added a new
  **signal-synergy** factor capturing interaction the additive model couldn't:
  **absentee×elderly +14** (3.07x) and **estate×absentee +6** (1.87x), firing only
  when the components co-occur. Smoke-tested. Interim calibration — the longer-term
  plan (RESEARCH.md §D) is a calibrated survival/hazard model trained on snapshot
  diffs (and explicitly NOT class-rebalanced).
- `[#035]` **Added `RESEARCH.md`** — consolidated seller-motivation research: the
  multi-source literature/industry deep-research pass (new predictive factors —
  mortgage rate lock-in / free-and-clear, divorce filings, tenure/age priors;
  modeling guidance; vendor-claim caveats) plus the on-data backtest and the
  resulting next-actions (wire tax-suit-pending; round-2 source research in flight).

- `[#036]` **Tax-suit-pending wired as a first-class signal (the free 2.45x win).**
  `suit_pending` (county has filed to foreclose for unpaid taxes) was the strongest
  single signal in the backtest but discovery was *excluding* it
  (`AND suit_pending = 0` on every query — ~10k Dallas properties invisible).
  `TaxRollProcessor.searchCandidatesByArea` — resolved `signals` before `baseWhere`
  and made the suit exclusion conditional (only filtered out when the `taxSuit`
  signal is off; bankruptcy still always excluded); added `TAXSUIT` condition +
  high-weight ranking in the blend and single-query branches; `formatPropertyResult`
  now exposes `isTaxSuit`. `PropertyIntelligenceService` passes `signals.taxSuit`.
  `MotivationScorer` gained a `taxSuit` factor (weight 28). Frontend: 🏛️ "Tax Suit
  Pending" discovery toggle (strong) + results badge + "Filter by signal" entry.
  Verified on real data: taxSuit-only returns 20/20 suit properties; with it off
  they're excluded; default search now surfaces them. `taxSuit` is on by default.

- `[#037]` **Divorce-filing signal + ingester (roadmap: life-event triggers).**
  Divorce/separation is among the largest residential mobility drivers (RESEARCH.md
  §A). New `backend/ingest_divorce_events.js` loads Dallas County District Clerk
  family-law filings into a `divorce_events` table, matched to tax-roll owners.
  Matching is precision-first: account_id → address+name → name-only requiring ≥2
  name tokens of a single party and preferring the homestead (the marital
  residence), since filings name people and rarely carry a property address
  (`ALLOW_LOOSE_MATCH=1` permits 1-token names). `divorce_events` is created in
  `initializeDatabase()` so discovery's LEFT JOIN always resolves (empty until a
  feed loads — there is no live source yet; round-2 research is finding it). Wired
  through discovery (`DIVORCE` condition + ranking + `has_divorce`), the scorer
  (`divorce` factor, weight 16 — conservative, not yet backtested on our data), and
  the frontend (💔 toggle + badge + filter). `backend/divorce_events.sample.csv`
  documents the expected CSV. Verified end-to-end: name + account_id matching,
  discovery surfacing, and scoring all confirmed on the local snapshot.

- `[#038]` **Round-2 data-source research → RESEARCH.md §E (sources + compliance).**
  Cited source map for each signal (25 sources → 24 confirmed). Key results that
  reshape the roadmap: **free-and-clear/lien is free + obtainable** (DCAD bulk files
  + County Clerk `dallas.tx.publicsearch.us` deeds) → promoted to the #1 build; the
  free hourly **311 dataset** (`gc4d-8a49`) is a cheap code-compliance distress
  signal; **divorce records have no public online access** (TX Supreme Court 2014
  order; attorneys-only) — the ingester (#037) needs the county's paid bulk
  subscription or a vendor, so its source note was corrected; **the TX voter file is
  illegal for commercial marketing** (Election Code §18.067, Class A misdemeanor) →
  age/household must come from licensed marketing data, dropped as a near-term feed.
  Compliance flags (TCPA/DNC/CAN-SPAM/DPPA, non-FCRA skip-trace, deed-portal ToS)
  documented as open legal work. Recommended minimal stack: DCAD + Clerk deeds +
  per-hit skip-trace + 311.

- `[#039]` **Free-and-clear (lien) signal + ingester (the #1 round-2 build).**
  Mortgage rate lock-in is the best-quantified sale suppressor; the inversion is that
  a **free-and-clear** owner (no open mortgage) faces no lock-in and is more sellable,
  especially long-tenure/elderly (RESEARCH.md §A). New `backend/ingest_liens.js`
  loads a lien feed into a `liens` table (auto-created in `initializeDatabase()`),
  matched account_id → address+owner. `free_and_clear` is taken from the source or
  derived (`open_lien_count == 0` / `mortgage_balance <= 0`); equity fields are stored
  for a future high-equity signal. Wired through discovery (`FREECLEAR` condition +
  ranking, `free_and_clear`/`equity_pct` in results), the scorer (`freeAndClear`
  factor weight 10 — a positive *modifier*, not a distress trigger — plus a
  free-and-clear × elderly **synergy** +8 "natural downsizer"), and the frontend (🏦
  toggle + badge + filter). Feed PENDING (no native lien data): DCAD bulk + Clerk
  deeds, or a PropStream export; `backend/liens.sample.csv` documents the CSV.
  Verified end-to-end on the local snapshot (account match, derived FAC, discovery,
  synergy scoring). The `liens` join is a column-scoped subquery to avoid an
  `owner_name` ambiguity with the tax roll.

- `[#040]` **Deed → free-and-clear derivation engine (DIY lien reconstruction).**
  New `backend/derive_liens_from_deeds.js` reconstructs open-lien status from raw
  Dallas County Clerk deed records (deeds-of-trust + releases) and emits the
  `liens.csv` that `ingest_liens.js` consumes — the free path to the free-and-clear
  signal (vs. paying PropStream). Model: for every property in the deed extract,
  `free_and_clear = (open/unreleased deed-of-trust count == 0)`, which handles cash
  buyers (deed, no DOT), paid-off mortgages (DOT + release), and open mortgages.
  Releases pair to DOTs by `related_instrument` link, falling back to greedy
  owner+property+date pairing. Instruments match to DCAD accounts via property
  street+ZIP + either party name (name-only fallback). `backend/deeds.sample.csv`
  documents the GovOS/Kofile-style input. Verified end-to-end on real local
  accounts across all four scenarios (link-release, date-release, open, cash) →
  derive → ingest → discovery surfaced exactly the 3 free-and-clear owners.
  ⚠️ Still needs the actual deed data: the Clerk portal (dallas.tx.publicsearch.us)
  is ToS-gated for bulk, so acquisition is per-property pulls / a bulk license /
  PIA — the engine is ready for whatever extract you obtain. Completeness caveat:
  a free-and-clear assertion is only as complete as the deed extract for that property.

- `[#042]` **Phase 2: calibrated sell-probability wired into scoring + UI (the moat,
  visible).** New `backend/src/scoring/SellProbabilityModel.js` loads `sell_model.json`
  (#041) and turns a property's signals into a calibrated **P(sell)** + a per-feature
  contribution breakdown (the "why"), loading defensively (omits the probability if
  the model file is absent). `MotivationScorer` computes it and attaches
  `sellProbability`/`sellProbabilityPct`/`sellProbabilityLift`/`sellProbabilityDrivers`
  to every analysis; `buildLeadFromTaxRecord` now passes `total_amount_due` so the
  model feature matches training; the API formatter + frontend service carry the
  fields through. Results UI: the lead table now **leads with "Sell prob" %** (the
  hero metric, coloured by lift, raw score kept as a tooltip), default-sorts by
  probability, and the detail panel shows a **"Likelihood to sell"** block (%, lift
  vs area average, top drivers). Verified end-to-end: probability flows from model →
  scorer → discovery lead → UI, and it **re-ranks** leads vs the raw score (e.g. an
  absentee lead scored 37 shows P(sell) 19.9% and outranks a delinquent+suit lead
  scored 53 at 12.2% — the calibrated ranking the raw score gets wrong). Note: raw
  tax-delinquency never appears as a positive driver (its learned weight is negative).

- `[#043]` **PropStream export → Hunter mapper (`backend/map_propstream.js`).** Turns
  a PropStream list/skip-trace export into the CSVs our ingesters accept — `liens.csv`
  (free-and-clear/equity → `ingest_liens.js`) and `contacts.csv` (phone/email →
  `ingest_contacts.js`) — from one file. Fuzzy-matches PropStream's varying column
  headers (APN, owner first/last, address, est value/equity, mortgage balance, phone*,
  email*), resolves each row to a DCAD `account_id` (APN digits / zero-padded-to-17,
  else property street+ZIP + owner-name fallback), and derives `free_and_clear` from
  the mortgage balance, a `--all-clear` flag (when the export was filtered to "Free &
  Clear"), or equity≥99%. Verified end-to-end (APN match + address fallback → ingest →
  discovery surfaces the free-and-clear lead). Enables the PropStream 7-day trial to
  light up the free-and-clear signal + contacts. (Use a targeted working set, not a
  county dump — PropStream licenses *access*, not the data; see RESEARCH.md §E.)

## 2026-06-27 — Curated-list product, free DCAD tenure path, estate-detection fix

- `[#044]` **PropStream mapper tuned to real headers + `--divorce` output
  (`backend/map_propstream.js`).** After seeing an actual PropStream export, mapped
  its true columns: open-loan COUNT (`Total Open Loans`) as the cleanest
  free-and-clear cue (0 loans = free & clear), LTV fallback, exact
  `Est. Remaining balance of Open Loans` balance column, and owner-2 names. New
  `--divorce [out.csv]` flag emits a `divorce_events` CSV (for the Divorce list).
  Validated end-to-end on the real Divorce export: 33 rows, 100% APN match, 18
  free-and-clear + 33 divorce_events ingested locally. (0 contacts — that export
  was NOT skip-traced; phone/email columns empty. Skip-trace BEFORE exporting.)

- `[#045]` **Free DCAD tenure ingester (`backend/ingest_appraisal.js`).** `tax_roll.db`
  is the tax-COLLECTIONS roll — it has no deed date / sale date / year-built. The
  FREE DCAD bulk appraisal file (dallascad.org/dataproducts.aspx, no export caps)
  carries all three and joins on `account_id`. Ingester fuzzy-detects columns,
  normalizes account to padStart-17, computes `tenure_years`, writes
  `appraisal_detail` (auto-created), and reports the free-and-clear PROXY supply
  (owned 30+ yrs, and those that are also over-65 = high-confidence paid-off).
  Tenure = strongest mobility predictor in the literature, and a FREE
  free-and-clear proxy at full 960k scale. (Precise deed reconstruction stays
  per-property: Clerk deeds are search-only on publicsearch.us, no free bulk.)

- `[#046]` **Curated-list export — the buyer-ready deliverable
  (`backend/export_curated.js`).** Buyers asked for a curated list, not a login.
  Picks a territory (`--zips`), scores every motivated property with the
  calibrated P(sell) model, dedupes, ranks, and emits ONE clean CSV: rank,
  sell-prob %, plain-English signals, key facts (value/equity/tenure/amount due),
  owner + family contacts, recommended-contact, mailing address. `--diff <old.db>`
  = MONTHLY territory diff (only sellers who NEWLY entered distress vs a prior
  snapshot) — the recurring deliverable behind a $500/mo EXCLUSIVE territory.
  ELDERLY → FAMILY: when owner is 65+, surfaces the likely adult-child contact and
  flags "reach the family, not the senior" (more effective + sidesteps
  elder-solicitation risk). `ingest_contacts.js` gains an optional `relatives`
  JSON column (structured kin from BatchData/IDI-style skip-trace) to feed it.
  Verified on 75216 (3,514 motivated → ranked sheet).

- `[#047]` **Estate-detection fix — was missing 176% of estates
  (`TaxRollProcessor.js`).** The DCAD roll abbreviates "ESTATE OF" as **"EST OF"**,
  which the estate regex + SQL filter didn't match. County-wide the app detected
  3,592 estates when there are **9,930** (+6,338). Added `% EST OF%` (leading
  space blocks BEST/WEST OF — verified zero false positives; all extras are real
  "…EST OF &" estates) to the ESTATE SQL filter and `\bEST OF\b` to the `isEstate`
  regex. Estate is a 1.6x signal — this nearly triples its supply. (Model wasn't
  retrained on the corrected feature yet; do so when the next feed lands.)

- `[#048]` **Marketing landing page — sells the leads + doubles as a portfolio piece
  (`src/components/screens/LandingScreen.jsx`).** New front door at `/` (App.jsx
  routes `home`/`landing` → LandingScreen; the tool moved behind an "Open tool"
  button). Sections: hero (outcome promise), **live sample** (pulls REAL ranked
  output from the API for 75216 but MASKS owner names — proves it works without
  doxxing distressed owners or giving leads away), filtered-list-vs-ranked-
  probability comparison, "how it works" (the resume layer: 960k-property engine,
  model validated on 675k sales, stacked signals, DNC-compliant contacts),
  founder pricing ($200 list / $500 exclusive + first-month guarantee), and a
  "built solo end-to-end" section (data eng + applied ML + product). Integrity
  guardrail: NO fabricated contact/close-rate stats — only provable claims
  (validated-on-675k, 2.45×/3.07× measured lift) + proof-by-demo + risk reversal.
  Styling added to globals.css (`.lp-*`, responsive). Build green.

- `[#049]` **Owner-portfolio enrichment — free, from data we already have
  (`backend/build_portfolios.js` → `owner_portfolio` table).** Answers "how many
  other properties does this owner hold?" by grouping the 960k roll on OWNER
  MAILING ADDRESS (industry-standard portfolio key — groups an investor's holdings
  even across different LLC names; owner-occupants = portfolio of 1). One pass over
  the roll; bulk/servicer mailing addresses (≥25 parcels) flagged is_institutional
  so they're labeled "bulk mailing addr" not an owner portfolio. Found 61,370
  owners with 3+ properties, 15,766 with 10+. Wired into `export_curated.js`: adds
  `other_properties` + `portfolio_value` columns, an "Owns N properties" signal
  chip (tired-landlord / investor cue), and a small motivation bump. Zero data
  cost — pure leverage on the existing DB. Re-run after a tax-roll refresh.

- `[#050]` **Business-affiliations enrichment — the "human behind the LLC"
  (`backend/ingest_business_affiliations.js` + `export_curated.js`).** Three parts:
  (1) FREE owner-type classification from owner_name (Individual / LLC / Corp /
  LP·Ltd / Trust / Business / Estate) → `owner_type` column + a "LLC-owned" signal
  chip (investor cue). (2) FREE likely-principal heuristic: if exactly one
  individual shares a business's mailing address (via owner_portfolio), surface
  them as "possible principal (shares mailing addr)" — excludes other businesses,
  estates, trusts. (3) Ready-for-feed ingester: loads a TX business registry CSV
  (Comptroller Open Data / SOSDirect bulk / OpenCorporates — provider-agnostic
  fuzzy headers) → `business_affiliations` table, matched entity-name→owner_name
  with entity-suffix-stripped normalization; adds registered agent / officers /
  business phone → `business_contact` column. 19,752 distinct business owner-names
  in the roll. Validated end-to-end (sample registry matched, all columns flow).
  `business_affiliations.sample.csv` shows the input. CHANGELOG #050.

- `[#051]` **Owner-cluster entity resolution + industry tags — the free "LLC
  breaker" (`backend/build_owner_clusters.js` → `owner_cluster` table).** Groups
  every parcel + owner-name variant sharing a mailing address into one cluster
  (same normalization as owner_portfolio, so it joins on portfolio_key). For 3,800
  clusters a business AND an individual share the address — the human behind the
  LLC, free, no registry. Per Cole, lists EVERYTHING: ALL individuals + ALL
  businesses in the cluster (no single-principal guess; replaced the old
  likely_principal heuristic). Infers industry tags from business names
  (Dental/Law/Pet/Construction/Real-estate/…) for sales-approach context.
  Registered-agent-service addresses (≥40 distinct names) flagged institutional,
  lists withheld (false grouping, not trimmed). Wired into `export_curated.js`:
  new columns `industries`, `people_behind`, `other_businesses`, `cluster_size`;
  `business_contact` now lists agent + all officers + phone. Verified: RJC CUSTOM
  BUILDERS LLC → the two Guel individuals + their 4 other businesses + industries.

- `[#052]` **Forward officer-lookup worklist — the money-tight LLC-break path
  (`backend/officer_worklist.js`).** Instead of the $1,350 SOS bulk file, generate
  the short list of business entities that actually appear on a curated list (or a
  territory) → look up only those (FREE current officers at the TX Comptroller PIR,
  or $1/SOSDirect) → paste into the emitted template → `ingest_business_affiliations.js`.
  Pulls in cluster siblings (other businesses at the same mailing address) so one
  lookup session covers the whole operator; ranks by parcel count. Output columns
  match the ingester exactly (+ ignored note_parcels/note_cluster helper cols).
  Modes: `--from <curated.csv>` (recommended) or `--zips`. Round-trip verified:
  filled template → ingest → officers land in the right column. Worklist outputs
  gitignored (hold officer data once filled).

- `[#053]` **Framing brief + research pack — the free "PI layer"
  (`export_curated.js`).** Two new columns on every curated lead, both synthesized
  from data we already own (public records + our signals — no scraping, no cost):
  (1) `framing_brief` — a plain-English APPROACH note for the salesperson
  (WHO / SITUATION / APPROACH), e.g. "Corp-owned by a real-estate investor (…),
  managing ~3 properties. Situation: tax suit. Approach: B2B — talk numbers, lead
  with a clean cash offer." Adapts by owner type (investor/professional/estate/
  senior), pressures (suit/divorce/free-and-clear), and routes to family/heirs
  where relevant. (2) `research_links` — pre-built, DISAMBIGUATED OSINT entry
  points (Google with name+business+Dallas, news, business reviews, SOS entity,
  obituary for estates, and industry-scoped license lookups — bar/medical/TREC via
  site: queries). Manual review only — keeps platform-scraping (ToS/CFAA) and deep
  personal profiling out; outreach framing only, never eligibility decisions. The
  paid V2 (search API + Claude auto-composite, on-demand per top lead) fills this
  frame later. Verified across business/estate/elderly/suit lead types.

- `[#054]` **Weekly tax-roll auto-refresh + enrichment rebuild
  (`backend/refresh_tax_roll.sh`).** Fully automates what was a manual weekly chore:
  discovers the current TRW zip on the county page (filename changes weekly; excludes
  the sample file), downloads it, and rebuilds the roll. FAIL-SAFE like the
  foreclosure refresh: builds into a COPY of the live DB (preserving the divorce/
  liens/foreclosure/contacts feed tables — a from-scratch rebuild would wipe them),
  validates row count (≥700k), then ATOMICALLY swaps and `pm2 restart`s. Any failure
  before the swap leaves the live DB + feeds untouched. Also rebuilds
  owner_portfolio + owner_cluster on the fresh data each run. `--dry-run` does
  everything except the swap (safe end-to-end test). New env override
  `TAX_ROLL_DB_PATH` (in TaxRollProcessor + build_portfolios + build_owner_clusters)
  lets the build target the copy. Cron: `0 3 * * 2` (Tuesdays, TRW posts Monday).
  Joins the existing monthly foreclosure-refresh cron — the box now self-updates.

- `[#055]` **Land-list mode (`export_curated.js --land`) — first paid-client
  deliverable.** New `--land` flag retargets the curated exporter from "motivated
  sellers" to "vacant land": universe becomes SPTB category `C*` (C11 vacant
  residential lot, C12 vacant commercial, etc.), spanning roll_code R **and** C
  (motivated lists are R-only). Excludes owners that won't sell raw land to a
  developer (CITY OF / COUNTY / ISD / STATE OF / HOUSING AUTH / DART / SCHOOL DIST /
  REDEVELOPMENT / community colleges). Adds a `land_type` column (decoded subtype)
  in place of `sell_prob_pct` (P(sell) is home-oriented, meaningless for raw lots),
  and ranks by motivation score then lot value. **Reuses the full enrichment stack
  unchanged** — owner type, portfolio, owner-cluster (LLC→human), framing brief,
  research links, contacts. Flags the known limitation: tax roll has no lot-size/
  acreage field (buyer pulls dimensions per parcel from DCAD). First use: 75214/
  75218/75206 land for realtor Lee Lamont's developer (958 parcels in territory →
  top 150 delivered). Outputs gitignored (`backend/land_*.csv`).

- `[#056]` **Land deliverable reworked → owner-grouped, res/com split, formatted
  .xlsx (client feedback on #055).** Six changes from the Lamont call:
  (1) **Show P(sell)% + lift-vs-baseline** per owner (baseline 6.3%/yr from the
  trained model; `SellProbabilityModel.score()` already returned `.lift`, now
  surfaced). (2) **Dropped absentee from the land ranking** — it's ~universal on
  vacant land (408/512 residential lots) so it's noise, not signal; the real
  signals are tax-suit / delinquent / estate / **multi-lot ownership (assemblage)**.
  (3) **Group by owner, sublist their parcels** — one row per owner with a
  `Properties` cell listing each lot (full address — parcel # — value — type);
  surfaces assemblage plays (512 res lots → 350 owners). (4) **Split residential
  (C11/C1) vs commercial (C12/13/14)** into two separate workbooks. (5) **Output
  is now a formatted `.xlsx`** (new dep: `exceljs`) — pre-set column widths,
  wrap only on long-text columns, frozen header, auto-filter — so the buyer never
  resizes/wraps on open (CSV can't carry formatting). (6) **Full address + parcel
  number** — strips the DCAD area-code suffix and composes street/city/state/zip;
  since 957/958 lots have no street number, the Parcel/Account # is flagged as the
  real locator. Distressed owners ranked first (Priority column). No `--limit` cap
  in land mode (full inventory delivered; buyer filters in Excel — answers "why
  150?"). Outputs gitignored (`backend/land_*.xlsx`).

### Flagged for prior-art / patent review (Handoff Rule 6)
- New `calculateUrgencyScore()` (0–100): weights balance size, years behind,
  absentee ownership (no homestead exemption), and foreclosure risk. Used as
  the ranking tiebreaker because `MotivationScorer` clusters most 1–2yr
  delinquencies at the same score. Candidate refinement: fold urgency factors
  into the main motivation model so the score differentiates better.

## How to run (canonical)

```bash
# 1. Backend  (port 3001, serves the 874k-row tax_roll.db)
cd FlashStackDemo/backend && npm start

# 2. Frontend (port 5173, proxies /api -> 3001)
cd FlashStackDemo && npm run dev

# 3. Public test URL (optional)
cloudflared tunnel --url https://localhost:5173 --no-tls-verify
# -> prints a https://<random>.trycloudflare.com URL
```

**Data status:** real Dallas County tax roll, 874,824 properties /
73,157 delinquent. Snapshot dated 2025-08-25. Property addresses from the tax
roll lack house numbers (e.g. "BEVERLY DR, TH") — CAD enrichment fills those in
on demand. Discovery, scoring, owner names, amounts, values, and exemptions are
all real.
