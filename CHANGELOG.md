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
