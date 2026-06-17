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

## Backend — your machine now, free always-on box later

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

### Phase 2 — Oracle Cloud Always Free ($0, always-on) — recommended home
Gets the backend off your laptop for **free, forever** (not a 12-month trial).
Oracle's Always Free **Ampere A1 (ARM)** shape gives up to 4 cores + 24 GB RAM +
200 GB storage — easily runs Node + the 332 MB SQLite DB + scraping.

> Heads-up: free A1 (ARM) capacity is often "out of capacity" in popular regions.
> Pick a less-busy home region, try different availability domains, and retry
> (or script retries). The tiny AMD micro (1 GB RAM) also works but is cramped.

**1. Provision the VM**
- Oracle Cloud → Compute → Instances → Create.
- Shape: **Ampere (VM.Standard.A1.Flex)**, ~2–4 OCPU / 12–24 GB (all Always Free).
- Image: **Ubuntu 22.04 (aarch64)**. Add your SSH public key. Create.
- You do **not** need to open any inbound port for the API — the cloudflared
  tunnel dials *out* to Cloudflare. Leave only SSH (22) open.

**2. Install runtime (SSH in)**
```bash
sudo apt update && sudo apt install -y nodejs npm git build-essential python3
sudo npm install -g pm2          # keeps the backend running across crashes/reboots
# (if distro Node is old, install Node 20+ via nodesource)
```
`build-essential`/`python3` cover the native `sqlite3` build on ARM.

**3. Get the code + data**
```bash
git clone https://github.com/HauntedKernel/hunter.git
cd hunter/backend && npm install
```
The DB is gitignored, so copy your already-built one up from your machine
(it already has the absentee column + indexes — no rebuild needed):
```bash
# from your local machine:
scp backend/src/data/tax_roll.db  ubuntu@<vm-ip>:~/hunter/backend/src/data/
```
*(Alternative: rebuild on the box — `node process_full_tax_roll.js` then
`node migrate_signal_columns.js` — but that needs the 2.8 GB county file uploaded.)*

**4. Run the backend under pm2**
```bash
cd ~/hunter/backend
pm2 start server.js --name hunter-api
pm2 save && pm2 startup        # run the printed command so it survives reboots
```

**5. Run the named tunnel from the box**
```bash
# install cloudflared (arm64)
curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create hunter-api
cloudflared tunnel route dns hunter-api api.hunter.living
# install it as a service so it stays up:
sudo cloudflared service install
# then configure the tunnel to point at http://localhost:3001 (config.yml) and start it
sudo systemctl enable --now cloudflared
```
Set the Pages env var `API_ORIGIN = https://api.hunter.living`. Done — the box is
always-on and nothing but SSH is exposed publicly.

**Updates:** `git pull && cd backend && npm install && pm2 restart hunter-api`.
Data refresh: re-run the relevant `ingest_*` / processor script on the box.

(Other paid options if you ever outgrow free: Hetzner ~$5/mo, Render, Railway, Fly.)

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
| Demo / first users | Pages (free) | your machine + named tunnel | ~$0 (domain already owned) |
| Always-on | Pages (free) | **Oracle Cloud Always Free** + tunnel | **$0** |
| If you outgrow free | Pages (free) | Hetzner/Render/Railway/Fly | ~$5–15 |

No per-user infra cost. The only usage-based cost is skip-trace/DNC, which is
prepaid by the user (MONETIZATION.md). hunter.living is the one fixed cost (already paid).

---

## Local development (recap)

```bash
cd backend && npm start         # API on :3001
npm run dev                     # frontend on https://localhost:5173 (proxies /api)
```
`VITE_API_BASE` unset in dev → relative `/api` → Vite proxy → localhost:3001.
