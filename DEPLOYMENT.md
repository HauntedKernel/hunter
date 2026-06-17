# Hunter — Deployment

How Hunter is delivered: a **static frontend** (served like a lightweight web
app / game — instant global updates) talking to a **Node backend + SQLite DB**
running on a server. It is a **web app, not a download** — and it has to be,
because the data, scraping, and skip-trace metering all live server-side
(see MONETIZATION.md §why-not-download).

```
            hunter.living                      api.hunter.living
        [ Cloudflare Pages ]                 [ your machine / VPS ]
  static React build + /api proxy   -->       Node/Express API (:3001)
  (Vite build, instant updates)               + tax_roll.db (~332MB)
        user browser ──── only talks ─────────  + CAD scraping + skip-trace
                          to hunter.living
```

Only the **frontend** is "lightweight like the game" (~73 KB gzipped). The
backend is not static-hostable (332MB DB + scraping) — it needs a real Node host.
Cloudflare Workers/Pages Functions **cannot** run it.

---

## Frontend — Cloudflare Pages (domain: hunter.living)

Static build; push a new version and every user gets it instantly.

**How the frontend reaches the backend — recommended: the `/api` proxy.**
This repo includes a Pages Function (`functions/api/[[path]].js`) that proxies
`/api/*` to the backend, so the browser only ever talks to `hunter.living`:
no CORS, and the backend URL is a Pages env var (`API_ORIGIN`), not baked into
the JS bundle. With this approach **leave `VITE_API_BASE` unset** — the frontend
calls relative `/api`, which the Function forwards.

### One-time setup (Cloudflare dashboard — needs your account)
1. **Pages → Create project → Connect to Git →** repo `HauntedKernel/hunter`.
2. Build settings: **Build command** `npm run build`, **Output directory** `dist`
   (framework preset: Vite). Deploy.
3. **Settings → Environment variables (Production):**
   `API_ORIGIN = https://api.hunter.living`  (the backend tunnel — see below).
4. **Custom domains → Set up a domain → `hunter.living`** (and optionally
   `www`). DNS is already in your Cloudflare zone, so this is one click.
5. Every push to `main` now auto-builds and deploys.

**Alternative (no proxy):** set `VITE_API_BASE` to the backend URL at build time
and allow the Pages origin in backend `CORS_ORIGINS`. Simpler infra, but exposes
the backend URL and requires CORS. The proxy approach above is preferred.

Local production preview:
```bash
npm run build && npm run preview
```

---

## Backend — your machine now, cheap VPS later

The API + DB run as a normal Node process.

```bash
cd backend && npm install
# data setup (one-time / periodic — see "Data" below)
npm start            # listens on :3001
```

**Env vars** (see `.env.example`):
- `PORT` (default 3001)
- `CORS_ORIGINS` — comma-separated allowed frontend origins, e.g.
  `https://hunter.pages.dev,https://app.hunter.example.com`
- `SKIPTRACE_API_URL/KEY`, `DNC_API_URL/KEY` — optional providers
  (absent ⇒ contact features report "not configured", no data invented)

### Phase 1 — your machine + named Cloudflare Tunnel (≈ $0)
Expose the local backend at the **stable** hostname `api.hunter.living` (unlike
the throwaway quick tunnels used in earlier testing). Run on the machine hosting
the backend:
```bash
cloudflared tunnel login                                  # browser auth (one time)
cloudflared tunnel create hunter-api
cloudflared tunnel route dns hunter-api api.hunter.living
cloudflared tunnel --url http://localhost:3001 run hunter-api
```
Then set the Pages env var `API_ORIGIN = https://api.hunter.living`.
(With the `/api` proxy, no `CORS_ORIGINS` change is needed — the browser is
same-origin. If you use the direct `VITE_API_BASE` approach instead, set
`CORS_ORIGINS=https://hunter.living`.)

### Phase 2 — move backend to a VPS (~$5–15/mo)
When it shouldn't depend on your laptop being on: deploy `backend/` to a small
box (Hetzner / Render / Railway / Fly), keep it behind the same hostname, run
under a process manager (pm2/systemd). Frontend doesn't change.

---

## Data (server-side, not in git — see .gitignore)

Rebuild on the backend host:
```bash
cd backend
node process_full_tax_roll.js     # build tax_roll.db from the county file
node migrate_signal_columns.js    # absentee column + area indexes
# optional signal feeds (each stays inactive until loaded):
node ingest_legal_events.js <foreclosures.csv>   # pre-foreclosure / lis pendens
node ingest_voters.js <voterfile.csv>            # owner age / empty-nester
node ingest_contacts.js <skiptrace.csv>          # phone/email (then DNC-scrub)
```

---

## Update flow

- **Frontend:** push to `main` → Cloudflare Pages rebuilds + deploys → all users
  updated instantly (the game-like superpower you wanted).
- **Backend:** pull + restart the Node process on the host. Data refresh = re-run
  the relevant ingest/processor script.

---

## Cost ladder

| Stage | Frontend | Backend | Monthly |
|---|---|---|---|
| Demo / first users | Pages (free) | your machine + named tunnel | ~$0 (+ ~$10/yr domain) |
| Real traction | Pages (free) | $5–15/mo VPS | ~$5–15 (+ domain) |

No per-user infra cost. The only usage-based cost is skip-trace/DNC, which is
prepaid by the user (MONETIZATION.md).

---

## Local development (recap)

```bash
cd backend && npm start         # API on :3001
npm run dev                     # frontend on https://localhost:5173 (proxies /api)
```
`VITE_API_BASE` unset in dev → relative `/api` → Vite proxy → localhost:3001.
