#!/bin/bash
# Weekly auto-refresh of the full Dallas County tax roll + derived enrichment.
# (run by cron on the backend host). The TRW file is published Mondays.
#
# FAIL-SAFE BY DESIGN — like refresh_foreclosures.sh, it never leaves the live DB
# broken. It discovers the current TRW zip, downloads it, and rebuilds into a COPY
# of the live DB (which PRESERVES the divorce/liens/foreclosure/contacts feed tables
# — a from-scratch rebuild would wipe them). It validates the copy (row count) and
# only then ATOMICALLY swaps it in and restarts the API. Any failure before the swap
# aborts and leaves the live DB and feeds untouched.
#
# Pass --dry-run to do everything EXCEPT the swap/restart (safe end-to-end test).
#
# Install (cron, 03:00 every Tuesday — TRW posts Monday, +1 day buffer for holidays):
#   (crontab -l 2>/dev/null; echo "0 3 * * 2 /bin/bash $HOME/hunter/backend/refresh_tax_roll.sh") | crontab -
set -u
MODE="${1:-}"
BACKEND="$HOME/hunter/backend"
DATA="$BACKEND/src/data"
LOG="$HOME/hunter/taxroll_cron.log"
WORK="$HOME/hunter/.refresh_work"            # same filesystem as $DATA -> atomic mv
PAGE="https://www.dallascounty.org/departments/tax/tax-roll.php"
BASE="https://www.dallascounty.org/Assets/uploads/docs/tax/trw"
MIN_ZIP_BYTES=104857600                        # 100MB floor (zip is ~266MB; unzips to ~2.6GB) — rejects error pages
MIN_ROWS=700000                                # rebuilt roll must have >= this many rows

log(){ echo "[$(date)] $*" >> "$LOG"; }
# Single-instance lock — never let two refreshes run at once (they'd share $WORK).
exec 9>"$HOME/hunter/.refresh_taxroll.lock"
if ! flock -n 9; then log "ABORT: another tax-roll refresh is already running"; exit 0; fi
trap 'rm -rf "$WORK"' EXIT                      # always clean the big temp files
log "===== tax-roll refresh ${MODE} ====="
rm -rf "$WORK"; mkdir -p "$WORK" || { log "FATAL: mkdir $WORK"; exit 1; }

# 1. Discover the current TRW zip (filename changes weekly; exclude the sample file).
ZIP=$(curl -fsS --max-time 90 "$PAGE" | grep -oE 'trwfile\.[0-9]+\.zip' | grep -v SampleFile | head -1)
if [ -z "$ZIP" ]; then log "ABORT: could not find TRW link on $PAGE"; exit 0; fi
URL="$BASE/$ZIP"
log "current TRW: $URL"

# 2. Download + size sanity check.
if ! curl -fsS --max-time 2400 -o "$WORK/trw.zip" "$URL"; then log "ABORT: download failed"; exit 0; fi
SZ=$(stat -c%s "$WORK/trw.zip" 2>/dev/null || echo 0)
log "downloaded $((SZ/1024/1024)) MB"
if [ "$SZ" -lt "$MIN_ZIP_BYTES" ]; then log "ABORT: download too small ($SZ bytes)"; exit 0; fi

# 3. Unzip + locate the flat404.* data file.
if ! unzip -o -q "$WORK/trw.zip" -d "$WORK"; then log "ABORT: unzip failed"; exit 0; fi
FLAT=$(ls "$WORK"/flat404.* 2>/dev/null | head -1)
if [ -z "$FLAT" ]; then log "ABORT: no flat404.* file in zip"; exit 0; fi
log "flat file: $(basename "$FLAT")"

# 4. Build into a COPY of the live DB (preserves the feed tables).
cp "$DATA/tax_roll.db" "$WORK/rebuild.db" || { log "ABORT: cp live db"; exit 0; }
export TAX_ROLL_DB_PATH="$WORK/rebuild.db"
cd "$BACKEND" || { log "FATAL: cd backend"; exit 1; }
log "rebuilding tax_roll in copy (10-15 min)..."
if ! nice -n 15 node process_full_tax_roll.js "$FLAT" >> "$LOG" 2>&1; then log "ABORT: rebuild failed — live DB untouched"; exit 0; fi

# 5. Validate the rebuilt copy.
ROWS=$(node -e "const s=require('sqlite3');const d=new s.Database(process.env.TAX_ROLL_DB_PATH,s.OPEN_READONLY);d.get('SELECT COUNT(*) n FROM tax_roll',(e,r)=>{console.log(r&&r.n?r.n:0)})" 2>/dev/null)
log "rebuilt rows: ${ROWS:-0}"
if [ "${ROWS:-0}" -lt "$MIN_ROWS" ]; then log "ABORT: rebuilt row count too low (${ROWS:-0}) — keeping live DB"; exit 0; fi

# 6. Rebuild derived enrichment in the copy.
log "rebuilding enrichment (portfolios + clusters)..."
nice -n 15 node build_portfolios.js >> "$LOG" 2>&1 || log "WARN: build_portfolios failed (continuing)"
nice -n 15 node build_owner_clusters.js >> "$LOG" 2>&1 || log "WARN: build_owner_clusters failed (continuing)"

if [ "$MODE" = "--dry-run" ]; then
  log "DRY-RUN OK: rebuilt+validated ${ROWS} rows in copy; live DB NOT swapped."
  exit 0
fi

# 7. Atomic swap + restart.
cp "$DATA/tax_roll.db" "$DATA/tax_roll.db.bak-prev" 2>/dev/null
if ! mv "$WORK/rebuild.db" "$DATA/tax_roll.db"; then log "FATAL: swap failed"; exit 1; fi
pm2 restart hunter-api >> "$LOG" 2>&1
log "DONE: live DB refreshed (${ROWS} rows) + enrichment rebuilt + API restarted"
