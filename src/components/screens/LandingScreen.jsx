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
            Not another filtered list of everyone who's tax-delinquent. A calibrated
            sell-probability model scores <strong>960,000+ Dallas properties</strong> and hands you a
            short, ranked, contact-ready list — <strong>exclusive to your territory.</strong>
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
                Ranked by calibrated probability — so you work the top few, not all 1,700.
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
                <li>All 1,700 tax-delinquent — you sort them</li>
                <li>Sold to everyone (race to the bottom)</li>
                <li>Raw rows; you figure out who matters</li>
                <li>Solicit whoever's on the list</li>
                <li>A login and homework</li>
              </ul>
            </div>
            <div className="lp-col lp-col-us">
              <div className="lp-col-tag lp-col-tag-us">Hunter</div>
              <ul>
                <li><strong>Ranked probability</strong> — work the top 20, skip 1,680</li>
                <li><strong>Exclusive</strong> to your territory</li>
                <li>Curated, deduped, with the <strong>"why"</strong></li>
                <li>For seniors, routed to the <strong>family decision-maker</strong></li>
                <li>A done-for-you sheet, handed to you</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (the resume layer) */}
      <section className="lp-section">
        <div className="container">
          <div className="lp-section-head">
            <h2 className="lp-h2">How it works</h2>
            <p className="lp-section-sub">Public records in, a calibrated probability out. The rigor is the product.</p>
          </div>
          <div className="lp-grid">
            <div className="lp-card">
              <div className="lp-card-ico">🗂️</div>
              <h3>960k-property data engine</h3>
              <p>The full Dallas County tax roll, refreshed weekly, plus an OCR'd foreclosure feed and free DCAD ownership-tenure data — joined into one searchable base.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">📊</div>
              <h3>Calibrated sell-probability</h3>
              <p>A model trained on <strong>675,000 real ownership changes</strong> — validated, not vibes. Tax-suit sellers turn over at <strong>2.45×</strong> the base rate; absentee + senior at <strong>3.07×</strong>.</p>
            </div>
            <div className="lp-card">
              <div className="lp-card-ico">🧩</div>
              <h3>Stacked signals</h3>
              <p>Tax suits, absentee owners, estates/heirs, divorce, free-and-clear equity, long tenure — fused into one score with the interaction effects that actually move likelihood-to-sell.</p>
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
              <div className="lp-price-name">Territory list</div>
              <div className="lp-price"><span>$200</span>/mo</div>
              <ul>
                <li>Ranked, curated list for your ZIPs</li>
                <li>Contacts + the "why" on every lead</li>
                <li>Capped subscribers per territory</li>
              </ul>
            </div>
            <div className="lp-price-card lp-price-feature">
              <div className="lp-price-badge">Most popular</div>
              <div className="lp-price-name">Exclusive territory</div>
              <div className="lp-price"><span>$500</span>/mo</div>
              <ul>
                <li>Your territory, <strong>nobody else's</strong></li>
                <li>Fresh sellers each month (new distress only)</li>
                <li>Family-decision-maker routing for seniors</li>
                <li>First-month performance guarantee</li>
              </ul>
            </div>
          </div>
          <div className="lp-offer-cta">
            <a className="btn btn-primary lp-cta" href={`mailto:${CONTACT_EMAIL}?subject=Hunter%20territory%20—%20interested&body=Which%20area%20do%20you%20farm%3F`}>
              Claim a territory
            </a>
            <span className="lp-faint">No card to start. Reply and tell me your farm area.</span>
          </div>
        </div>
      </section>

      {/* BUILT BY (resume punch) */}
      <section className="lp-section">
        <div className="container lp-about">
          <h2 className="lp-h2">Built solo, end to end</h2>
          <p className="lp-about-p">
            Hunter is a one-person build: a public-records data pipeline over 960k properties, a
            trained-and-validated predictive model (logistic sell-probability, calibrated against
            675k real sales), a React product surface, and full production deployment
            (Cloudflare Pages + tunnel → ARM server, process-managed, weekly auto-refresh).
            Data engineering, applied ML, and product — shipped live at hunter.living.
          </p>
          <div className="lp-stack">
            {['Node / Express', 'SQLite · 960k rows', 'Logistic model (no deps)', 'React + Vite', 'Cloudflare Pages', 'OCR foreclosure feed'].map(t => (
              <span className="lp-tag" key={t}>{t}</span>
            ))}
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
