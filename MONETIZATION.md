# Hunter — Monetization & Cost Strategy

*Living strategy doc. Last updated 2026-06-17. Owner: Cole.*
*Thinking document, not a build spec. Don't build billing until users are asking to pay (see §6).*

---

## 1. The key reframe: only two things cost money per use

Hunter's data sources split into two cost types, and conflating them causes the
"I'll rack up charges while people look around" fear. They are different:

| Type | Sources | Cost shape |
|---|---|---|
| **Fixed-cost feeds** | Tax roll, voter file, foreclosure/lis-pendens list | Pay **once** to acquire/ingest, then serve from our own DB to **infinite users at $0 marginal cost** |
| **Per-lookup live costs** | **Skip-trace** (phone/email), **DNC scrub** | Cost money **every time** a user triggers them |

**Implication:** browsing, scoring, filtering, owner names, amounts owed, years
delinquent, property details (CAD) — all free for us to serve, forever, no matter
how much anyone explores. The only thing with a per-use cost is **contact
reveal** (skip-trace + DNC). That, and only that, is the paywall surface.

The "racking up charges" risk is therefore tiny and fully controllable.

---

## 2. The golden rule

> **Never trigger a billable call before money changes hands. Trace once, cache forever, bill once.**

- Skip-trace a given property **one time**, store it permanently (the `contacts`
  table already does this). 50 users view that lead, or the same user reopens it
  10 times → still **one** vendor charge, ever.
- Only trace on an **explicit unlock action** (and ideally on committed intent —
  e.g. adding to a campaign / exporting — not on idle viewing).
- DNC scrub: same — scrub at reveal time, cache the result.

Result: cost is always *downstream* of user intent and (per §3) downstream of payment.

---

## 3. The model: sell "unlimited leads," meter the contacts

### Free tier — the acquisition engine (costs us $0)
Unlimited discovery, scoring, all six motivation signals, owner names, property
details, and CSV export **without contact info**. Zero reveals (or ~3 trial
reveals). People can fully evaluate the product — see real, ranked, valuable
leads — before we spend a cent. This is the entire top-of-funnel.

### Paid tier — "unlimited leads" + metered reveals
~$99/mo or ~$799/yr (illustrative — validate against vendor pricing):
- Marketed as **"unlimited leads"** — which is *true and honest*, because
  discovery/scoring/owner/property data genuinely are unlimited and cost us nothing.
- Includes a **generous allotment of contact reveals** (e.g. 100/mo or
  1,500/yr — more than ~99% of users will ever use).
- **Overage** = cheap credit packs (e.g. $X for 100 more reveals).

This keeps the marketing frame the customer responds to while metering the one
thing that actually costs us money.

### Why not the two extremes
- **Pure per-lead ("$2 a lead")** — feels nickel-and-dime, caps perceived value.
  REIs think in deal ROI (one deal = $5–20k), so a single lead's price reads as
  trivial *and* annoying. Weak.
- **Truly unlimited skip-trace** — a loaded gun. With a per-lookup cost, one
  power user revealing 20,000 contacts can cost more than they paid. Flat-rate +
  marginal cost is how data products go bankrupt. The included-allotment + fair-use
  cap is what makes "unlimited" safe to say.

**The synthesis:** "unlimited leads" framing (honest) + invisible reveal cap
(protects margin). Customer keeps the pitch; we keep the bank account.

---

## 4. Why this matches the customer's logic

An investor/agent will pay $500–1,000+/yr for "unlimited leads, pays for itself
with one deal" — that math is real to them. We honor that framing *and* protect
ourselves, because the unlimited part (finding leads) is exactly the part that's
free for us to provide. We only meter the part that isn't.

---

## 5. Cash-flow rules for a bootstrapped (broke) founder

1. **Prepaid only.** Subscription and credits are paid **before** we incur any
   skip-trace cost. We never front vendor charges out of pocket.
2. **Pay-as-you-go vendor, no minimums.** Use a skip-trace vendor billed per hit
   (BatchData, REISkip, etc.) — ~$0.07–0.25/hit, paid only when a *paying* user
   reveals. Charge an effective ~$0.50–1/reveal → each reveal funds itself with margin.
3. **Don't sign anything yet.** The free discovery product costs $0 to run. Ship
   it, add a locked "🔒 Unlock N contacts" button, and measure clicks. That
   validates willingness-to-pay with zero spend. Only wire a vendor once prepaid
   credits or clear demand justify it.
4. **Cache is the moat against cost** (§2) — it caps total COGS regardless of traffic.

Fixed-cost feeds note: the voter file (~$1,100 statewide) and foreclosure lists
are *one-time/periodic* costs, not per-user — they don't scale with usage, so they
don't create the "charges while browsing" problem. Acquire them when revenue (or
need) justifies; until then those signals simply stay inactive (already gated).

---

## 6. Rollout sequence

1. **Now** — ship Hunter free: discovery + scoring + owner/property detail.
   $0 COGS. Prove the leads are good enough that people *ask* for contact info.
2. **Demand signal** — locked "Unlock contacts" CTA on the lead list. Tells us who
   would pay, at no cost.
3. **Monetize** — add accounts + Stripe (subscriptions + one-time credit packs) +
   a credits/subscription **ledger**, and a **balance check in front of
   `/api/property/contact`** (which already caches). Sign a pay-as-you-go
   skip-trace vendor.
4. **DNC** — same pattern: scrub at reveal, cache, gate behind the same balance check.

Per §5.3, **do not build billing until step 2 shows demand.** Building Stripe +
accounts now would be premature.

---

## 7. Where the code already supports this

- **Discovery / scoring / signals** — already free, DB-served, zero marginal cost.
- **`contacts` cache + `/api/property/contact`** — already the single chokepoint
  for the only billable action. Add the balance check *here*; nothing else needs
  a paywall.
- **DNC fail-closed gate** — already enforced, so compliance cost/logic is contained.
- **To add when monetizing:** user accounts/auth, a credits/subscription ledger,
  a Stripe integration, and the pre-trace balance check. That's the whole billing
  surface — small, because only one endpoint spends money.

---

## 8. Open questions

- Skip-trace vendor choice + real per-hit cost (drives reveal pricing).
- Reveal allotment size per tier (set above realistic heavy use, below abuse).
- Trial reveals on signup: 0 (pure gate) vs. ~3 (let them taste contact data)?
  Costs ~$1/signup — only if affordable.
- Trigger point for the billable trace: on "unlock" click vs. on campaign-add /
  export (committed intent reduces wasted spend).
- Annual vs. monthly mix (annual = cash up front, better for bootstrapping).
