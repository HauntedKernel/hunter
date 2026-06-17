# 🎯 Hunter — Off-Market Property Finder

**Hunter helps realtors find off-market properties before they list**, by scoring
**seller motivation** from public records. It surfaces financially distressed
owners (tax-delinquent properties) in **Dallas County**, ranks them by how likely
they are to sell, and enriches each lead with full property detail for outreach.

> One job, done well: find motivated off-market sellers. (Formerly "FlashStack" —
> the CMA/discovery features were removed to focus on this single product.)

## How it works

1. **Search an area** — type a Dallas County neighborhood, city, or ZIP
   (e.g. *Highland Park*, *Lakewood*, *75205*).
2. **Get ranked leads** — instantly pulled from the full Dallas County tax roll
   (874k properties, ~73k delinquent), scored by a multi-factor **motivation**
   model and an **urgency** score (balance owed, years behind, absentee owner,
   foreclosure risk).
3. **Enrich on demand** — open a lead (or select several) to pull live Dallas CAD
   detail: verified owner, full street address, market value, beds/baths/sqft,
   year built. Results are cached, so repeat lookups are instant.
4. **Export** — download selected leads as a CSV (owner, address, value,
   beds/baths/sqft/year built, amount owed, scores) for your outreach workflow.

## Architecture

- **Frontend** — React + Vite (mobile-first). Single-purpose UI:
  dashboard/search → ranked results → lead detail → CSV export.
- **Backend** — Express API (`backend/`, port 3001):
  - `POST /api/property/delinquent` — area search over the tax roll (DB-first, ~800ms)
  - `POST /api/property/analyze` — single-property CAD enrichment
  - `POST /api/property/bulk-enrich` — batch enrichment with a persistent SQLite cache
- **Data** — the Dallas County bulk tax roll processed into SQLite
  (`tax_roll.db`), plus live scraping of dallascad.org for per-property detail.

## Running locally

```bash
# Backend (port 3001) — serves the tax-roll DB + CAD scraper
cd backend && npm install && npm start

# Frontend (port 5173) — proxies /api to the backend
npm install && npm run dev

# Public test URL (optional)
cloudflared tunnel --url https://localhost:5173 --no-tls-verify
```

**Data note:** the tax roll (~3 GB raw) and the SQLite DBs are gitignored.
Rebuild the DB locally with `backend/process_full_tax_roll.js`, then run
`backend/migrate_signal_columns.js` to add the absentee column + area indexes.
Pre-foreclosure / lis-pendens are a separate County Clerk feed — load a CSV with
`backend/ingest_legal_events.js <file.csv>` (the signal stays inactive until then).

## Scope & roadmap

- **Now:** Dallas County, tax-delinquency motivation signal.
- **Possible next signals:** absentee/out-of-county owners, very long ownership,
  probate, code violations, high tax-burden ratio.
- **Possible expansion:** additional Texas counties (each has its own CAD + tax
  roll format).

See `CHANGELOG.md` for detailed change history.
