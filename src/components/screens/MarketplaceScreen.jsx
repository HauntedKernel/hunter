import { useEffect, useMemo, useState } from 'react'
import { Lock, Check, X, ArrowRight, Loader2 } from 'lucide-react'
import CatalogService from '../../services/CatalogService'

// Territory Marketplace — the "page": which ZIPs (and which category lists within them) are
// available vs sold-exclusive, with a Stripe checkout. Ivory-editorial luxury styling.
const CATEGORY_LABEL = { residential: 'Residential', land: 'Land', commercial: 'Commercial' }
const CATEGORY_SUB = { residential: 'Houses & condos', land: 'Lots & acreage', commercial: 'Retail, office, industrial' }
const money = (n) => `$${Number(n || 0).toLocaleString()}`

export default function MarketplaceScreen({ onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)   // { tier, zip, category, price, label }

  useEffect(() => {
    let live = true
    CatalogService.getZips()
      .then(d => { if (live) { setData(d); setLoading(false) } })
      .catch(e => { if (live) { setError(e.message); setLoading(false) } })
    return () => { live = false }
  }, [])

  const zips = useMemo(() => {
    let list = data?.zips || []
    if (cat !== 'all') list = list.filter(z => z.categories.some(c => c.category === cat))
    if (q.trim()) list = list.filter(z => z.zip.startsWith(q.trim()))
    return list
  }, [data, cat, q])

  return (
    <div className="mkt">
      <header className="mkt-head">
        <div className="mkt-eyebrow">By Invitation · Dallas County</div>
        <h1 className="mkt-title">Claim Your Territory</h1>
        <p className="mkt-sub">
          Off-market motivated sellers, delivered monthly. One agent per exclusive list —
          when a territory is claimed, it&rsquo;s yours alone. Browse what remains open.
        </p>
        {data && (
          <div className="mkt-stats">
            <div className="mkt-stat"><div className="mkt-stat-n">{data.totals.zips}</div><div className="mkt-stat-l">ZIP Territories</div></div>
            <div className="mkt-stat"><div className="mkt-stat-n">{data.totals.totalLeads.toLocaleString()}</div><div className="mkt-stat-l">Live Sellers</div></div>
            <div className="mkt-stat"><div className="mkt-stat-n">{data.totals.soldExclusives}</div><div className="mkt-stat-l">Exclusives Claimed</div></div>
          </div>
        )}
      </header>

      <div className="mkt-controls">
        <div className="mkt-filters">
          {['all', 'residential', 'land', 'commercial'].map(c => (
            <button key={c} className={`mkt-filter ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {c === 'all' ? 'All Categories' : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <input className="mkt-search" placeholder="Search ZIP…" value={q}
          onChange={e => setQ(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} inputMode="numeric" />
      </div>

      {loading && <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}><Loader2 className="spin" size={22} /> Loading territories…</div>}
      {error && <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Couldn&rsquo;t load the catalog: {error}</div>}

      {!loading && !error && (
        <div className="mkt-grid">
          {zips.map(z => (
            <TerritoryCard key={z.zip} z={z} cat={cat} onClaim={setModal} />
          ))}
          {zips.length === 0 && <div style={{ color: 'var(--muted)', padding: 30 }}>No territories match that filter.</div>}
        </div>
      )}

      {modal && <CheckoutModal sel={modal} paymentsEnabled={data?.paymentsEnabled} onClose={() => setModal(null)} />}
    </div>
  )
}

function StatusPill({ ex }) {
  if (ex.status === 'sold') return <span className="pill pill-sold">Sold · <b>{ex.owner}</b></span>
  if (ex.status === 'unavailable') return <span className="pill pill-na">Unavailable</span>
  return <span className="pill pill-available">Available</span>
}

function TerritoryCard({ z, cat, onClaim }) {
  const shown = cat === 'all' ? z.categories : z.categories.filter(c => c.category === cat)
  const taken = z.categories.some(c => c.exclusive.status === 'sold')
  return (
    <div className={`terr-card ${taken ? 'is-taken' : ''}`}>
      <div className="terr-top">
        <div className="terr-zip">{z.zip}</div>
        <div className="terr-leads"><b>{z.leadCount.toLocaleString()}</b> sellers</div>
      </div>
      <div className="terr-rule" />

      <div className="terr-cats">
        {shown.map(c => (
          <div className="terr-cat" key={c.category}>
            <div className="terr-cat-name">{CATEGORY_LABEL[c.category]}<small>{c.leadCount} leads · {CATEGORY_SUB[c.category]}</small></div>
            {c.exclusive.status === 'available'
              ? <div className="terr-cat-price"><b>{money(c.exclusive.price)}</b>/mo</div>
              : <div className="terr-cat-price">&nbsp;</div>}
            {c.exclusive.status === 'available'
              ? <button className="pill pill-available" style={{ cursor: 'pointer' }}
                  onClick={() => onClaim({ tier: 'category', zip: z.zip, category: c.category, price: c.exclusive.price, label: `Exclusive ${CATEGORY_LABEL[c.category]} — ${z.zip}` })}>
                  Claim
                </button>
              : <StatusPill ex={c.exclusive} />}
          </div>
        ))}
      </div>

      <div className="terr-foot">
        <div className="terr-tiers">
          {/* Shared on-ramp */}
          <div className="terr-tier">
            <span className="terr-tier-label">Shared list · <b>{money(z.shared.price)}</b>/mo
              {z.shared.status === 'available' && ` · ${z.shared.seatsLeft} of ${z.shared.cap} seats`}
              {z.shared.status === 'full' && ' · waitlist'}
            </span>
          </div>
          {/* Whole-ZIP exclusive */}
          <div className="terr-tier">
            <span className="terr-tier-label">Own all of {z.zip} · <b>{money(z.zipExclusive.price)}</b>/mo</span>
            {z.zipExclusive.status === 'sold' && <span className="pill pill-sold">Held · <b>{z.zipExclusive.owner}</b></span>}
            {z.zipExclusive.status === 'unavailable' && <span className="pill pill-na">Partially claimed</span>}
          </div>
        </div>

        <div className="terr-cta">
          {z.shared.status === 'available'
            ? <button className="btn-lux ghost" onClick={() => onClaim({ tier: 'shared', zip: z.zip, price: z.shared.price, label: `Shared Territory — ${z.zip}` })}>Join Shared</button>
            : <button className="btn-lux ghost" disabled>Shared Full</button>}
          {z.zipExclusive.status === 'available'
            ? <button className="btn-lux" onClick={() => onClaim({ tier: 'zip', zip: z.zip, price: z.zipExclusive.price, label: `Exclusive ZIP — ${z.zip}` })}>Own {z.zip}</button>
            : <button className="btn-lux" disabled><Lock size={12} style={{ marginRight: 5 }} />{z.zipExclusive.status === 'sold' ? 'Claimed' : 'Locked'}</button>}
        </div>
      </div>
    </div>
  )
}

function CheckoutModal({ sel, paymentsEnabled, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setErr(null); setBusy(true)
    try {
      const r = await CatalogService.checkout({ tier: sel.tier, zip: sel.zip, category: sel.category, name, email })
      if (r.url) { window.location.href = r.url; return }   // → Stripe Checkout
      setDone(true)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="mkt-modal-back" onClick={onClose}>
      <div className="mkt-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3>{done ? 'Request received' : 'Reserve territory'}</h3>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>

        {done ? (
          <p className="mkt-modal-sub">Thank you — we&rsquo;ll be in touch shortly to finalize <b>{sel.label}</b>. Your seat is held.</p>
        ) : (
          <>
            <p className="mkt-modal-sub">{sel.label}</p>
            <div className="mkt-field"><label>Full name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Agent" /></div>
            <div className="mkt-field"><label>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@brokerage.com" type="email" /></div>

            <div className="mkt-modal-line">
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Monthly</span>
              <span className="amt">{money(sel.price)}<span style={{ fontSize: 14, color: 'var(--muted)' }}>/mo</span></span>
            </div>

            {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}

            <button className="btn-lux" style={{ width: '100%', marginTop: 16 }} onClick={submit} disabled={busy || !email}>
              {busy ? <Loader2 size={14} className="spin" /> : <>Continue to secure checkout <ArrowRight size={14} style={{ marginLeft: 6 }} /></>}
            </button>
            <p className="mkt-note">
              {paymentsEnabled
                ? <><Lock size={11} style={{ verticalAlign: -1 }} /> Secured by Stripe. Cancel anytime. First-month performance guarantee on exclusives.</>
                : 'Concierge onboarding — submit your details and our team will confirm availability and complete your subscription by hand.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
