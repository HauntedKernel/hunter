# Hunter — Handoff / Where We Left Off

*Updated 2026-06-17.*

## TL;DR — pick up here
The product/engine is **done**. We're **mid-deployment**, blocked on Oracle's
free **A1 ARM capacity** ("out of host capacity"). **Next action:** decide
A1-retry vs. AMD micro (below), create the VM, then run the deploy steps.

---

## Project state — DONE
- **Engine complete**, all on real Dallas County data (874k properties / 73k delinquent):
  discovery → 6 motivation signals → scoring → CAD enrichment → contacts → campaigns → CSV export.
- **Signals:** delinquent, absentee, elderly (exemption *or* voter age ≥65),
  pre-foreclosure/lis-pendens, empty-nester, arrest (built but **gated off**).
  Each has a UI toggle; discovery blends them.
- **Repo:** github.com/HauntedKernel/hunter (`main`), CHANGELOG `[#001]`–`[#024]`.
- **Docs:** `README` · `STRATEGY` · `MONETIZATION` · `DEPLOYMENT` (all current).
- **Deploy-ready:** static frontend + `/api` proxy Pages Function + configurable
  `VITE_API_BASE`/`CORS_ORIGINS`. `npm run build` verified (~73 KB gzipped).

## Deployment status — IN PROGRESS
- **Domain:** `hunter.living` — DNS in Cloudflare, ready.
- **Cloudflare Pages project:** NOT created yet.
- **Backend host:** NOT up yet.
- **Oracle Cloud:** account ✓ · VCN `hunter-vcn` + public subnet (via VCN Wizard) ✓ ·
  SSH key generated ✓. **VM creation BLOCKED:** "out of capacity for
  VM.Standard.A1.Flex" — tried 1 OCPU/6 GB and multiple ADs.
- Note: free A1 cap dropped to **2 OCPU / 12 GB** on 2026-06-15. A2.Flex is **NOT** free.

## NEXT ACTION — pick one
- **(A) Keep retrying A1** at off-peak hours, smallest shape (1 OCPU/6 GB). Free + full power, but it's a capacity lottery.
- **(B) Create `VM.Standard.E2.1.Micro`** (AMD, always-free, basically always available, 1 GB RAM) to get unblocked NOW; add a swapfile. ← recommended to stop spinning and ship today.
- **(C) ~$5/mo Hetzner** if you want reliable immediately.

## Once a VM exists — deploy (full detail in DEPLOYMENT.md → "Phase 2 Oracle")
1. `ssh -i ~/.ssh/hunter_oracle ubuntu@<PUBLIC_IP>`
2. *(if AMD micro)* add ~2 GB swap
3. `sudo apt update && sudo apt install -y nodejs npm git build-essential python3 curl` · `sudo npm i -g pm2`
4. `git clone https://github.com/HauntedKernel/hunter.git` · `cd hunter/backend && npm install`
5. from local: `scp backend/src/data/tax_roll.db ubuntu@<IP>:~/hunter/backend/src/data/` (332 MB, already has the absentee column + indexes — no rebuild)
6. `pm2 start server.js --name hunter-api` · `pm2 save && pm2 startup`
7. cloudflared on the box → tunnel `api.hunter.living` → `localhost:3001` → install as service
8. Cloudflare Pages: connect repo · build `npm run build` → `dist` · env `API_ORIGIN=https://api.hunter.living` · add custom domain `hunter.living`

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
