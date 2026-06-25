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
- **Caveat — backend host:** the API process is NOT yet a managed service /
  always-on box (uptime/footprint differ from the local :3001 dev process, so
  it's running off some non-service process). If that host/process dies, the API
  drops. Hardening = Phase 2 below (move to a free always-on box + pm2 + tunnel
  as a service).

## NEXT ACTION — optional hardening (deployment itself is done)
1. **Make the backend durable** — move it to a free always-on box (Phase 2) or at
   minimum run the tunnel + Node under a service manager so it survives reboot.
2. **Load real signal feeds** (still empty — signals stay inactive until fed):
   pre-foreclosure/lis-pendens, voter demographics, skip-trace contacts (below).
3. **Monetization/expansion** — only when demand shows (don't pre-build billing).

## Phase 2 (optional hardening) — move backend to a free always-on box
Get the backend onto a managed always-on host. Full detail in DEPLOYMENT.md → "Phase 2 Oracle":
1. `ssh -i ~/.ssh/hunter_oracle ubuntu@<PUBLIC_IP>`
2. *(if AMD micro)* add ~2 GB swap
3. `sudo apt update && sudo apt install -y nodejs npm git build-essential python3 curl` · `sudo npm i -g pm2`
4. `git clone https://github.com/HauntedKernel/hunter.git` · `cd hunter/backend && npm install`
5. from local: `scp backend/src/data/tax_roll.db ubuntu@<IP>:~/hunter/backend/src/data/` (347 MB, already has the absentee column + indexes — no rebuild)
6. `pm2 start server.js --name hunter-api` · `pm2 save && pm2 startup`
7. cloudflared on the box → tunnel `api.hunter.living` → `localhost:3001` → install as service (re-point the same DNS route off the laptop)
- VM options if pursuing Oracle: **(A)** retry A1 off-peak (free, full power, capacity lottery); **(B)** `VM.Standard.E2.1.Micro` AMD always-free + swapfile (available now, cramped 1 GB); **(C)** ~$5/mo Hetzner for reliable.

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

## Still-pending data feeds (optional; signals stay inactive until loaded)
- Pre-foreclosure/lis-pendens → `ingest_legal_events.js` (Dallas County Clerk feed)
- Owner age / empty-nester → `ingest_voters.js` (TX voter file)
- Phone/email → `ingest_contacts.js` (paid skip-trace vendor) + DNC provider env keys

## Open product threads (not blocking)
- **Monetization** (MONETIZATION.md): free unlimited discovery + metered contact
  reveals; **don't build billing or sign a skip-trace vendor until demand shows.**
- **Expansion** (STRATEGY.md): next county — build (per-county ingest) vs. buy (aggregator).
