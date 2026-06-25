# FlashStack Changelog

Tracking numbered changes so they can be reviewed and rolled back (Handoff Rule 5).

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
