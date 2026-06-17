# Hunter — Deployment

How Hunter is delivered: a **static frontend** (served like a lightweight web
app / game — instant global updates) talking to a **Node backend + SQLite DB**
running on a server. It is a **web app, not a download** — and it has to be,
because the data, scraping, and skip-trace metering all live server-side
(see MONETIZATION.md §why-not-download).

```
[ Cloudflare Pages ]                 [ your server / VPS ]
  static React build      HTTPS  -->  Node/Express API (:3001)
  (Vite build output)                 + tax_roll.db (~332MB)
  instant updates, free               + CAD scraping + skip-trace metering
        user browser  ───────────────────────┘
```

Only the **frontend** is "lightweight like the game" (~73 KB gzipped). The
backend is not static-hostable (332MB DB + scraping) — it needs a real Node host.
Cloudflare Workers/Pages Functions **cannot** run it.

---

## Frontend — Cloudflare Pages

Static build; push a new version and every user gets it instantly.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Env var (build-time):** `VITE_API_BASE` = the backend's public URL
  (e.g. `https://api.hunter.example.com`). Unset = relative `/api` (dev only).

Set `VITE_API_BASE` in the Cloudflare Pages project settings (Environment
variables → Production). Connect the GitHub repo (`HauntedKernel/hunter`) and
Pages auto-builds + deploys on every push to `main`.

Local production preview:
```bash
VITE_API_BASE="https://api.hunter.example.com" npm run build
npm run preview
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
Expose the local backend at a **stable** hostname (unlike throwaway quick
tunnels). Requires a domain on Cloudflare (~$10/yr).
```bash
cloudflared tunnel login
cloudflared tunnel create hunter-api
cloudflared tunnel route dns hunter-api api.hunter.example.com
cloudflared tunnel --url http://localhost:3001 run hunter-api
```
Then `VITE_API_BASE=https://api.hunter.example.com` and
`CORS_ORIGINS=https://<your-pages-domain>`.

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
