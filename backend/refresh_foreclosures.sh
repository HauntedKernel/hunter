#!/bin/bash
# Monthly refresh of the pre-foreclosure feed (run by cron on the backend host).
# OCRs the county's recently-posted foreclosure notices and reloads legal_events.
#
# SAFE BY DESIGN: it only clears/replaces the live feed if the scrape actually
# produced records — an empty or failed scrape leaves the existing feed intact
# (so a county-site outage or posting lag can't wipe live leads).
#
# Rolling 4-month window (current + previous 3): the county posts notices by
# SALE month and the site lags ~1 month (and keeps ~3 months up), so a window
# absorbs that and captures everything currently posted. Non-existent month
# folders simply yield 0 files (no OCR cost). Duplicate properties across months
# are harmless — the discovery JOIN groups legal_events by account_id.
#
# Install (cron, 03:00 on the 7th each month):
#   (crontab -l 2>/dev/null; echo "0 3 7 * * /bin/bash $HOME/hunter/backend/refresh_foreclosures.sh") | crontab -
set -u
BACKEND="$HOME/hunter/backend"
LOG="$HOME/hunter/foreclosure_cron.log"
OUT="/tmp/fc_refresh.csv"

echo "===== $(date) foreclosure refresh =====" >> "$LOG"
echo "event_type,account_id,address,owner_name,filed_date,sale_date,source" > "$OUT"

# scrape_foreclosures.js writes foreclosures_<Month>.csv into its CWD — run from
# /tmp so the per-month CSVs land where we read them below.
cd /tmp || exit 1

# Anchor month math to the 15th so month-end rollovers don't skip a month.
for d in 0 1 2 3; do
  M=$(date -d "$(date +%Y-%m-15) -$d month" +%B)
  echo "--- scraping $M ---" >> "$LOG"
  nice -n 15 node "$BACKEND/scrape_foreclosures.js" "$M" "" --dpi 200 >> "$LOG" 2>&1 || true
  [ -f "/tmp/foreclosures_$M.csv" ] && tail -n +2 "/tmp/foreclosures_$M.csv" >> "$OUT"
done

N=$(($(wc -l < "$OUT") - 1))
echo "combined records: $N" >> "$LOG"
if [ "$N" -ge 1 ]; then
  cd "$BACKEND" || exit 1
  node ingest_legal_events.js --clear >> "$LOG" 2>&1
  node ingest_legal_events.js "$OUT" >> "$LOG" 2>&1
  pm2 restart hunter-api >> "$LOG" 2>&1
  echo "DONE: refreshed feed from $N scraped records" >> "$LOG"
else
  echo "SKIP: 0 records scraped — left existing feed intact" >> "$LOG"
fi
