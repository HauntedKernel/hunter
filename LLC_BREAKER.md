# LLC-Breaker — status & handoff (2026-06-30)

Turns an entity-owned parcel (LLC / Corp / LP) into the **person** behind it, so an
entity-owned delinquent lead carries a real, reachable contact. Layered, free-first.

## Where it plugs in
- Output rides on the existing lead `contact` block (`TaxRollProcessor.formatPropertyResult`),
  surfaced by the delinquent API (`/api/property/delinquent?area=<zip>` on the box, port 3001).
- New `contact` fields: `contact.portfolio` (LEG 1) and `contact.webHints` + `tier:"web"` (LEG 2).

## LEG 1 — Comptroller reverse-index  ✅ LIVE, free, ToS-clean
Inverts the cached Comptroller registered-agent/officer data (`entity_registry`, built by
`resolve_entities.js`) into a **person → the entities they're behind** map.
- Code: `lib/agent_reverse.js` (pure: `personKey`, `indexByPerson`, `portfolios`, `isServiceFirm`).
- Builder: `break_llcs.js` LEG 1 → table `entity_portfolio(person_key, name, entity_count, entities_json)`.
- Surfaces as `contact.portfolio = { count, entities[] }` when a person is behind 2+ entities.
- Service-firm filter drops registered-agent shops (bookkeeping/CPA/legal) that aren't owners.
- Current yield: **116 people behind 2+ delinquent entities** (e.g. Viswanath Palepu → 8,
  Clay E. Cooley → 5). Rebuilt automatically each week by `refresh_tax_roll.sh` **step 6d**.

## LEG 2 — open-web snippet miner  ✅ LIVE (Serper), precision-hardened, PARTIALLY backfilled
For entities the Comptroller can't resolve (agent-service shells, holding cos), a plain web
search surfaces the principal in the result **snippets** (mine snippets only, never gated bodies).
- Code: `lib/serp.js` (pluggable Brave/Serper, gated on `SERP_API_KEY`), `lib/llc_breaker.js`
  (pure `mineSnippets`; `isPromotable`; `revalidateStored`). Writes `llc_breaks`.
- Surfaces as `contact.webHints { candidates[], phones[], litigation[], ambiguous }`, each candidate
  carrying `sources[]` + `signals[]`. **Scope-B posture: sourced, low-confidence, never asserted.**
- **Promotion** (setting `contact.name` at `tier:"web"`, strictly below `registry`) only for a
  single, non-ambiguous, corroborated hit — `isPromotable`: Comptroller-officer match OR
  (surname-in-entity AND a real given name from `FIRST_NAMES`). Reason always cites the source +
  "unverified, confirm before contact".
- Precision guards (the miner is noisy — keep them): reject entity-name echoed as a person;
  business/brand/role blocklist (`NON_NAME`); given-name gate for promotion.
- Offline re-scoring: `cleanup_llc_breaks.js` re-runs `revalidateStored` over stored candidates
  ($0, no re-query) — reverts all `tier:"web"` and re-promotes only the valid.

### Enable / continue LEG 2
```bash
cd ~/hunter/backend
node break_llcs.js --selftest                                   # miner test (7/7)
SERP_PROVIDER=serper SERP_API_KEY=<key> node break_llcs.js --limit=N   # backfill (resumable)
```

## Current numbers (free-tier stop)
User is on Serper's **free tier only** (no $50 for the 50k pack). Backfill stopped at
**~2,780 of ~13k** entities mined — all free. Of those: **179 credible hints**, **22 clean
promotions** (e.g. Pedro Ormeno ⇐ Ormeno Enterprises, Tom Cusick ⇐ Thomas Cusick Custom Homes).

## Remaining / TODO
- **~10.3k entities unmined.** Finish for FREE via **Brave free tier** (~2k/mo, `SERP_PROVIDER=brave`)
  in monthly chunks, or all at once when a Serper $50 pack is affordable.
- County OPR assumed-name index is **paywalled/scrape-resistant** — do NOT re-investigate.
- Optional: widen to non-delinquent distinctive entities (`ALL_ENTITIES=1`) once budget allows.

## Files
`lib/agent_reverse.js`, `lib/serp.js`, `lib/llc_breaker.js`, `break_llcs.js`,
`cleanup_llc_breaks.js`, `resolve_entities.js` (upstream Comptroller), `lib/comptroller.js`,
`refresh_tax_roll.sh` (step 6d), `src/processors/TaxRollProcessor.js` (contact block + joins).
