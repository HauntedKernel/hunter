# Hunter — Handoff / Where We Left Off

*Updated 2026-06-24.*

## TL;DR — pick up here
The product/engine is **done** and **DEPLOYED & LIVE**. Frontend at
**https://hunter.living** (Cloudflare Pages), backend at **https://api.hunter.living**
(Cloudflare tunnel → Node API), `/api` proxied so the browser is same-origin.
Verified live 2026-06-24: site returns HTTP 200 ("Hunter — Off-Market Property
Finder"); `api.hunter.living/health` healthy; a real proxied search returned 130
Highland Park leads with owners/values/scores. **Next action:** optional
hardening — move the backend to a free always-on box (it currently runs off a
non-service process) and load the still-pending real signal feeds (below).

---

## Project state — DONE
- **Engine complete**, all on real Dallas County data (874k properties / 73k delinquent):
  discovery → 7 motivation signals → scoring → CAD enrichment → contacts → campaigns → CSV export.
- **Signals:** delinquent, absentee, elderly (exemption *or* voter age ≥65),
  pre-foreclosure/lis-pendens, empty-nester, **estate/inherited (death signal)**,
  arrest (built but **gated off**). Each has a UI toggle; discovery blends them,
  and the results sidebar has a per-signal **Filter by signal** group with counts.
- **UI:** web-first responsive layout (no more phone frame) — desktop = filter
  sidebar + sortable data table + sticky action bar; collapses to cards on mobile.
- **Repo:** github.com/HauntedKernel/hunter (`main`, clean, synced with origin),
  CHANGELOG `[#001]`–`[#028]`.
- **Docs:** `README` · `STRATEGY` · `MONETIZATION` · `DEPLOYMENT` (all current).
- **Deploy-ready:** static frontend + `/api` proxy Pages Function + configurable
  `VITE_API_BASE`/`CORS_ORIGINS`. `npm run build` verified (~69 KB gzipped).

### Work since the last handoff (2026-06-17 → 2026-06-22, commits after `b51fad4`)
- `ec025e5` **Data-quality pass** — floor delinquent leads at $1,000 owed,
  exclude government/institutional owners (Highland Park 413→44 actionable),
  collapse the no-op single-family/condo/townhome toggles into one honest
  "Residential" type, delete fabricated mock data (`generateAreaAddresses`,
  fake "Estimated Leads").
- `0320033` **Web-first responsive redesign** — new CSS design-system tokens +
  component classes replace the fixed 375×812 phone frame; data-table UI; dropped
  the non-functional "Outreach Settings" tab. Bundle 72→69 KB gzip. Frontend-only.
- `369b573` **Estate / Inherited signal (death signal)** — detects deceased-owner
  records from the tax roll by owner-name pattern (ESTATE OF / LIFE ESTATE /
  HEIRS / ET AL; precise so "REAL ESTATE LLC" doesn't match), ~3,950 Dallas
  properties. Weight 18 (8 in blend); ⚰️ toggle on by default.
- `3688cba` **Determinism + estate-starvation fix + Signals filter** — added
  `account_id` as a stable ORDER BY tiebreaker to every ranked query (identical
  searches were returning different leads under LIMIT on score ties); reserved an
  estate slice (≤30% of limit) so death leads aren't buried by the 60/40
  delinquent blend; new per-signal **Filter by signal** sidebar group with counts.

## Deployment status — LIVE ✅ (verified 2026-06-24)
- **Frontend:** `https://hunter.living` — Cloudflare Pages, custom domain wired,
  HTTP 200. Pushes to `main` auto-build/deploy.
- **Backend:** `https://api.hunter.living` — Cloudflare named tunnel → Node API,
  `/health` healthy, real searches return leads through the `/api` proxy
  (same-origin, no CORS). Note: the live backend wraps responses in
  `{success, data:{…}}`.
- **Domain/DNS:** both `hunter.living` and `api.hunter.living` resolve to
  Cloudflare. ✓
- **Backend host — HARDENED (Oracle Always Free, `170.9.249.210`):** the API runs
  on an Ubuntu Oracle VM as `hunter-api` under **pm2** (pm2-startup enabled + dump
  saved → auto-resurrects on reboot); the **cloudflared** named tunnel runs as a
  **systemd service** (enabled on boot). 5.8 GB RAM + a 2 GB swapfile (added
  2026-06-24, in `/etc/fstab`). Survives reboot/crash. SSH:
  `ssh -i ~/.ssh/hunter_oracle ubuntu@170.9.249.210`.

## NEXT ACTION — core done; remaining is feed expansion + product
1. ~~Deploy~~ ✅ live · ~~Harden the backend~~ ✅ pm2 + cloudflared service + swap.
2. **Pre-foreclosure feed — LIVE (partial, April)** via the new OCR pipeline
   (below). Re-run for the latest month / all cities to expand coverage. Voter
   (empty-nester/age) + skip-trace (contact) feeds still pending.
3. **Monetization/expansion** — only when demand shows (don't pre-build billing).

## Backend deploy (DONE) — reference
Backend lives at `~/hunter` on the Oracle box (`170.9.249.210`):
- **Update:** `git pull && cd backend && npm install && pm2 restart hunter-api`.
  (Restart needed to load new code AND to re-read the DB after an ingest.)
- **DB:** `backend/src/data/tax_roll.db` (~347 MB, scp'd up; absentee column +
  indexes). `cad_cache.db` + a populated `legal_events` live alongside.
- **Tunnel:** cloudflared systemd service → `api.hunter.living` → `localhost:3001`.
- **NOTE (sync):** the box working tree has local edits to `ingest_legal_events.js`
  + an untracked `scrape_foreclosures.js` (scp'd during feed work) that match the
  pending commit. After pushing, run `git fetch && git reset --hard origin/main`
  on the box to sync cleanly.

## Key artifacts
- **SSH public key** (paste into Oracle if recreating the VM):
  `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC+FBEkyy1CBoh8LK5/8TN4tYeGER6Xs1m3aIWGdxqyM hunter-oracle`
- **Private key:** `C:\Users\Carolina\.ssh\hunter_oracle` (never share)
- **Local DB:** `backend/src/data/tax_roll.db` (332 MB, gitignored) — has `is_absentee`
  + indexes; `legal_events` / `voter_demographics` / `contacts` tables exist but are
  EMPTY (verification samples were cleared).
- **Local dev restart** (ephemeral — gone after reboot):
  backend `cd backend && npm start` (:3001) · frontend `npm run dev` (:5173, proxies `/api`).
  The earlier `trycloudflare.com` quick-tunnel URLs are throwaway — don't rely on them.

## Data feeds
- **Pre-foreclosure/lis-pendens → LIVE (partial).** New `backend/scrape_foreclosures.js`
  OCRs the Dallas County Clerk's scanned foreclosure PDFs (needs poppler-utils +
  tesseract-ocr on the box) → CSV → `ingest_legal_events.js`. Matching is
  owner-aware (street+ZIP+owner surname) because the tax roll lacks house numbers.
  To expand/refresh on the box:
  `cd /tmp && node /tmp/scrape_foreclosures.js <Month> "" --dpi 200`
  then `cd ~/hunter/backend && node ingest_legal_events.js --clear && node ingest_legal_events.js /tmp/foreclosures_<Month>.csv && pm2 restart hunter-api`.
  Coverage is partial by design (only notices with an explicit address line; the
  rest use Lot/Block legal descriptions). Worth scheduling monthly (sales are the
  first Tuesday; notices post ~21 days prior). ~1.6 min/small file on the ARM box.
- **Owner age / empty-nester → pending** → `ingest_voters.js` (TX voter file).
- **Phone/email → pending** → `ingest_contacts.js` (paid skip-trace) + DNC keys.

## Open product threads (not blocking)
- **Monetization** (MONETIZATION.md): free unlimited discovery + metered contact
  reveals; **don't build billing or sign a skip-trace vendor until demand shows.**
- **Expansion** (STRATEGY.md): next county — build (per-county ingest) vs. buy (aggregator).
