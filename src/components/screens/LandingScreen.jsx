import { useState, useEffect } from 'react'
import SellerIntelligenceService from '../../services/SellerIntelligenceService'

// Hunter — marketing / sales landing page. Doubles as a portfolio piece:
// buyer-outcomes up top, the engineering ("how it works" + "built by") underneath.
// The live sample pulls REAL model output from the API but MASKS identities —
// proving the product works without publishing distressed owners' info or giving
// the actual leads away for free.

const SAMPLE_ZIP = '75216'
const CONTACT_EMAIL = 'cole@paradigmbridge.tech'

// Mask a public-record owner name down to initials (real, but not doxxing).
function maskName(n) {
  const cleaned = String(n || '').replace(/\b(EST OF|ESTATE OF|LIFE ESTATE|HEIRS|ET AL|ETAL)\b/gi, '').replace(/&/g, '').trim()
  const toks = cleaned.split(/\s+/).filter(t => t.length > 1)
  if (!toks.length) return 'Private owner'
  return toks.slice(0, 2).map(t => t[0].toUpperCase() + '•••').join(' ')
}

// The tax roll stores no house numbers, so the street is already semi-private.
function tidyAddress(a) {
  const street = String(a || '').split(',')[0].trim()
  if (!street) return 'Dallas, TX'
  const tc = street.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  return `${tc} · ${SAMPLE_ZIP}`
}

function probColor(pct) {
  if (pct == null) return 'var(--score-low)'
  if (pct >= 15) return 'var(--score-high)'
  if (pct >= 10) return 'var(--score-med)'
  return 'var(--brand-dark)'
}

const money = (v) => v ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v) : null

export default function LandingScreen({ onNavigate }) {
  const [sample, setSample] = useState({ status: 'loading', leads: [] })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const leads = await SellerIntelligenceService.searchDallasCADLeads({
          area: SAMPLE_ZIP,
          radius: null,
          propertyTypes: { singleFamily: true, multiFamily: true, condo: true, townhouse: true, land: true },
          // Mirror the dashboard's default: hunt every signal so the sample is representative.
          signals: {
            preForeclosure: true, taxSuit: true, delinquent: true, elderly: true, absentee: true,
            emptyNester: true, estate: true, divorce: true, freeAndClear: true,
            codeCompliance: true, recency: true,
          },
        })
        const top = (leads || [])
          .filter(l => l.sellProbabilityPct != null)
          .sort((a, b) => (b.sellProbabilityPct || 0) - (a.sellProbabilityPct || 0))
          .slice(0, 6)
        if (alive) setSample({ status: top.length ? 'ok' : 'empty', leads: top })
      } catch {
        if (alive) setSample({ status: 'error', leads: [] })
      }
    })()
    return () => { alive = false }
  }, [])

  const scrollTo = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="lp">
      {/* HERO */}
      <section className="lp-hero">
        <div className="container lp-hero-inner">
          <span className="lp-eyebrow">Off-market seller intelligence · Dallas County</span>
          <h1 className="lp-h1">
            The off-market sellers in your territory,<br />
            <span className="lp-accent">ranked by who'll actually sell.</span>
          </h1>
          <p className="lp-sub">
            Not another massive, unsorted export to dig through. A calibrated model weighs every
            property in your area and hands you a short, <strong>ranked, contact-ready shortlist</strong> —
            with the reason each one made the cut, <strong>exclusive to your territory.</strong>
          </p>
          <div className="lp-cta-row">
            <button className="btn btn-primary lp-cta" onClick={scrollTo('offer')}>Claim your territory</button>
            <button className="btn lp-cta" onClick={scrollTo('sample')}>See live output ↓</button>
          </div>
          <div className="lp-trust">
            <span><strong>675,000</strong> real ownership changes validated against</span>
            <span className="lp-dot">•</span>
            <span><strong>Weekly</strong> public-records refresh</span>
            <span className="lp-dot">•</span>
            <span><strong>DNC-compliant</strong> contacts</span>
          </div>
        </div>
      </section>

      {/* LIVE SAMPLE */}
      <section id="sample" className="lp-section">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Live output, not a screenshot</h2>
            <p className="lp-section-sub">
              Real leads from {SAMPLE_ZIP}, ranked this second by the model. Identities masked —
              the actual names, contacts, and full list go only to the territory holder.
            </p>
          </div>

          {sample.status === 'loading' && <div className="lp-note">Scoring live leads…</div>}
          {(sample.status === 'error' || sample.status === 'empty') && (
            <div className="lp-note">
              Live demo is offline right now — but the ranked sheet below is the exact shape your territory list ships in.
            </div>
          )}

          {sample.status === 'ok' && (
            <div className="lp-sample">
              <div className="lp-sample-row lp-sample-head">
                <span>#</span><span>P(sell)</span><span>Property</span><span>Why it ranks</span><span className="lp-num">Est. value</span>
              </div>
              {sample.leads.map((l, i) => {
                const factors = (l.motivationFactors || []).slice(0, 3).map(f => f.description)
                return (
                  <div className="lp-sample-row" key={l.id || i}>
                    <span className="lp-rank">{i + 1}</span>
                    <span className="lp-prob" style={{ color: probColor(l.sellProbabilityPct) }}>
                      {Number(l.sellProbabilityPct).toFixed(1)}%
                    </span>
                    <span className="lp-prop">
                      <span className="lp-owner">{maskName(l.ownerName)}</span>
                      <span className="lp-addr">{tidyAddress(l.fullAddress || l.address)}</span>
                    </span>
                    <span className="lp-why">
                      {factors.length
                        ? factors.map((f, j) => <span className="lp-chip" key={j}>{f}</span>)
                        : <span className="lp-faint">—</span>}
                    </span>
                    <span className="lp-num lp-value">{money(l.propertyValue) || '—'}</span>
                  </div>
                )
              })}
              <div className="lp-sample-foot">
                Ranked by calibrated probability — so you work the top few, not an endless list.
                <button className="btn-link" onClick={() => onNavigate && onNavigate('sellers_dashboard')}>Open the live tool →</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="lp-section lp-section-alt">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">A list vendor hands you rows. Hunter hands you a decision.</h2>
          </div>
          <div className="lp-compare">
            <div className="lp-col lp-col-them">
              <div className="lp-col-tag">Filtered list (PropStream &amp; co.)</div>
              <ul>
                <li>A massive, unsorted list of properties — you dig through it</li>
                <li>Sold to everyone (race to the bottom)</li>
                <li>Raw rows; you figure out who matters</li>
                <li>Point-and-shoot at whoever's on the list</li>
                <li>A login and a pile of homework</li>
              </ul>
            </div>
            <div className="lp-col lp-col-us">
              <div className="lp-col-tag lp-col-tag-us">Hunter</div>
              <ul>
                <li>A <strong>focused, ranked, explained</strong> shortlist</li>
                <li><strong>Exclusive</strong> to your territory</li>
                <li>Every lead comes with <strong>the reason it ranks</strong></li>
                <li>For seniors, routed to the <strong>family decision-maker</strong></li>
                <li>Done-for-you and handed to you</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SIGNAL SCIENCE — the counter-intuitive edge */}
      <section className="lp-section">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Some of what &ldquo;everyone knows&rdquo; about motivated sellers is quietly costing you</h2>
            <p className="lp-section-sub">
              Where people will sell is often intuitive — and that intuition is a real edge. But some
              of the criteria you&rsquo;d swear give you an advantage are, measured against actual sales,
              putting you at a <strong>mathematical disadvantage</strong>. We tested the folklore against
              hundreds of thousands of real ownership changes. Here&rsquo;s where it breaks.
            </p>
          </div>
          <div className="lp-grid lp-grid-3">
            <div className="lp-card lp-myth">
              <div className="lp-myth-tag">The instinct</div>
              <p className="lp-myth-line">&ldquo;They&rsquo;ve owned it for decades — they must be ready to sell.&rdquo;</p>
              <div className="lp-math-tag">What the data says</div>
              <p className="lp-math-line">Long tenure is <strong>negatively</strong> predictive. The owners who actually move are <strong>recent buyers who hit distress</strong> — the opposite of the classic farming list. Chase decades-held homes and you&rsquo;re fishing where the fish aren&rsquo;t.</p>
            </div>
            <div className="lp-card lp-myth">
              <div className="lp-myth-tag">The instinct</div>
              <p className="lp-myth-line">&ldquo;Open code violations mean a distressed, motivated owner.&rdquo;</p>
              <div className="lp-math-tag">What the data says</div>
              <p className="lp-math-line">Once you account for delinquency and absentee ownership, open code cases add <strong>almost zero</strong> extra lift. It <em>feels</em> like blood in the water — it&rsquo;s mostly noise you&rsquo;d burn weeks chasing.</p>
            </div>
            <div className="lp-card lp-myth">
              <div className="lp-myth-tag">The instinct</div>
              <p className="lp-myth-line">&ldquo;Free-and-clear owners can afford to sell, so they will.&rdquo;</p>
              <div className="lp-math-tag">What the data says</div>
              <p className="lp-math-line">Equity isn&rsquo;t motivation. What moves people is <strong>distress plus a life event</strong> — a tax suit, an estate, a divorce, an absentee landlord tired of the calls. We weight what precedes a sale, not what looks tidy.</p>
            </div>
          </div>
          <p className="lp-signal-foot">
            That&rsquo;s the difference between a <em>filter</em> and a <em>model</em>: a filter treats every
            &ldquo;distress&rdquo; signal as equal. Ours knows which ones <strong>lie</strong> — and re-weights
            them against what actually happened on the ground.
          </p>
        </div>
      </section>

      {/* DOSSIER, NOT A LIST */}
      <section className="lp-section lp-section-alt">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Every lead is a dossier — not a row in a spreadsheet</h2>
            <p className="lp-section-sub">
              Competitors sell you a name and an address and wish you luck. We hand you <strong>who
              you&rsquo;re actually dealing with</strong> — so you walk in knowing the person, the pressure,
              and the play.
            </p>
          </div>
          <div className="lp-grid">
            <div className="lp-card">
              <div className="lp-card-ico">🕵️</div>
              <h3>The human behind the LLC</h3>
              <p>Half the best leads hide behind a holding company. Others hand you &ldquo;SMITH HOLDINGS LLC&rdquo; and a shrug. We <strong>crack the shell</strong> — the real person, and every other distressed property they quietly own across the county.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">📇</div>
              <h3>Reachable — not just listed</h3>
              <p><strong>Multiple, verified contact points</strong>, not one stale skip-trace number everyone else already dialed. For senior owners, the adult-child decision-maker too. Scrubbed against DNC before anything is marked callable.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">🧭</div>
              <h3>The &ldquo;why now&rdquo;, spelled out</h3>
              <p>Every lead carries the <strong>signals that fired</strong> and the story they tell — a tax suit, an estate, a divorce, an out-of-state landlord done with the calls. You open the conversation already knowing the pressure.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">🔒</div>
              <h3>Yours alone — never resold</h3>
              <p>Claim a list and it&rsquo;s exclusively yours. The big predictive vendors resell the same &ldquo;likely sellers&rdquo; to every agent in your ZIP. Here, one owner per territory — you&rsquo;re not racing five people to the same door.</p>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET INTELLIGENCE — the moat */}
      <section className="lp-section">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Edges you&rsquo;d need a data scientist on staff to even find</h2>
            <p className="lp-section-sub">
              The real moat isn&rsquo;t the data — everyone can pull the county records. It&rsquo;s knowing
              <strong> what to study, how to model it, and where to look</strong>. A few of the things
              baked into your ranking that you&rsquo;d never think to test:
            </p>
          </div>
          <div className="lp-grid lp-grid-3">
            <div className="lp-card lp-intel">
              <div className="lp-intel-stat">60<span>not 65</span></div>
              <h3>Texans start moving at 60</h3>
              <p>The median Texas seller is <strong>63–64</strong> — below the 65 exemption line every other list anchors on. We catch the downsizing wave <strong>years earlier</strong>, before your competition even flags the household.</p>
            </div>
            <div className="lp-card lp-intel">
              <div className="lp-intel-stat">▲▼<span>per ZIP</span></div>
              <h3>Momentum, block by block</h3>
              <p>We benchmark each ZIP&rsquo;s <strong>fresh distress against the county</strong> — so you can claim the territory that&rsquo;s <strong>heating up</strong>, not the one that already peaked. Rising, steady, or cooling, shown on every card.</p>
            </div>
            <div className="lp-card lp-intel">
              <div className="lp-intel-stat">30+<span>signals</span></div>
              <h3>Kept only what moves the needle</h3>
              <p>Name rarity, tenure direction, absentee fatigue, estate patterns — we&rsquo;ve <strong>tested dozens</strong> against real sales and <strong>discarded the ones that only look smart</strong>. You get the survivors, weighted by how much they actually matter.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (the resume layer) */}
      <section className="lp-section">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">The method, not a hunch</h2>
            <p className="lp-section-sub">
              Most lists are one filter and a hope. Hunter's score is grounded in decades of
              published research on why and when people move — then validated against real local
              outcomes, so the ranking reflects what actually happens, not a gut feel.
            </p>
          </div>
          <div className="lp-grid">
            <div className="lp-card">
              <div className="lp-card-ico">🗂️</div>
              <h3>County-scale data engine</h3>
              <p>The full county property record, refreshed weekly and fused with foreclosure filings, ownership history, and other public-record sources into one continuously-updated base.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">📚</div>
              <h3>Grounded in the research</h3>
              <p>Built on the academic literature on residential mobility and home turnover — the well-studied life-event, financial, and ownership factors that precede a sale — rather than a single arbitrary filter.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">📊</div>
              <h3>Trained &amp; validated</h3>
              <p>The model is trained and back-tested against hundreds of thousands of real ownership changes, and checked for <strong>calibration</strong> — so a stated likelihood means what it says, not a vanity number.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">📞</div>
              <h3>Contact-ready &amp; compliant</h3>
              <p>Skip-traced phones bundled in, with a fail-closed DNC gate — nothing is presented as callable until it's scrubbed. For senior owners, the adult-child contact comes too.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OFFER + RISK REVERSAL */}
      <section id="offer" className="lp-section lp-section-alt">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">Founder partners — first territories</h2>
            <p className="lp-section-sub">
              I'm onboarding the first exclusive partners. <strong>First month: if the leads aren't
              better than what you're working now, you don't pay.</strong>
            </p>
          </div>
          <div className="lp-pricing">
            <div className="lp-price-card">
              <div className="lp-price-name">Shared Territory</div>
              <div className="lp-price"><span>$249</span>/mo</div>
              <ul>
                <li>One ZIP · all categories</li>
                <li>Ranked list + contacts + the "why"</li>
                <li>Capped at 3 agents per ZIP</li>
              </ul>
            </div>
            <div className="lp-price-card lp-price-feature">
              <div className="lp-price-badge">Most popular</div>
              <div className="lp-price-name">Exclusive Category</div>
              <div className="lp-price"><span>$799</span>/mo</div>
              <ul>
                <li>One category — Residential, Land, or Commercial</li>
                <li><strong>Yours alone</strong> — nobody else gets that list</li>
                <li>Fresh distress each month · contacts included</li>
                <li>First-month performance guarantee</li>
              </ul>
            </div>
            <div className="lp-price-card">
              <div className="lp-price-name">Exclusive ZIP</div>
              <div className="lp-price"><span>$1,899</span>/mo</div>
              <ul>
                <li>The whole ZIP — every category</li>
                <li>Sole owner · nobody else works it</li>
                <li>Family-decision-maker routing for seniors</li>
              </ul>
            </div>
          </div>
          <div className="lp-offer-cta">
            <button className="btn btn-primary lp-cta" onClick={() => onNavigate && onNavigate('marketplace')}>
              See live availability →
            </button>
            <span className="lp-faint">Browse the map, check what's open, claim in minutes.</span>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="container lp-footer-inner">
          <span><strong>Hunter</strong> · Off-market seller intelligence · Dallas County</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="btn-link">{CONTACT_EMAIL}</a>
        </div>
      </footer>
    </div>
  )
}
