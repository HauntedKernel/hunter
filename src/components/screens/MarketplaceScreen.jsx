import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, X, ArrowRight, Loader2, BellRing } from 'lucide-react'
import CatalogService from '../../services/CatalogService'
import RegionMap from '../RegionMap'

// Territory Marketplace — service-region map + ZIP × category availability with Stripe checkout,
// waitlist for claimed territories, and a request form for markets we don't serve yet.
const CATEGORY_LABEL = { residential: 'Residential', land: 'Land', commercial: 'Commercial' }
const CATEGORY_SUB = { residential: 'Houses & condos', land: 'Lots & acreage', commercial: 'Retail, office, industrial' }
const money = (n) => `$${Number(n || 0).toLocaleString()}`

export default function MarketplaceScreen() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)   // { kind:'checkout'|'waitlist', tier, zip, category, price, label }
  const gridRef = useRef(null)

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

  const selectFromMap = (zip) => {
    setQ(zip)
    setTimeout(() => gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

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

      {data && <RegionMap zips={data.zips} onSelectZip={selectFromMap} />}

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
        <div className="mkt-grid" ref={gridRef}>
          {zips.map(z => <TerritoryCard key={z.zip} z={z} cat={cat} onOpen={setModal} />)}
          {zips.length === 0 && <div style={{ color: 'var(--muted)', padding: 30 }}>No territories match that filter.</div>}
        </div>
      )}

      <RegionRequest />

      {modal?.kind === 'checkout' && <CheckoutModal sel={modal} paymentsEnabled={data?.paymentsEnabled} onClose={() => setModal(null)} />}
      {modal?.kind === 'waitlist' && <WaitlistModal sel={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

function TerritoryCard({ z, cat, onOpen }) {
  const shown = cat === 'all' ? z.categories : z.categories.filter(c => c.category === cat)
  const taken = z.categories.some(c => c.exclusive.status === 'sold')
  const claim = (tier, category, price, label) => onOpen({ kind: 'checkout', tier, zip: z.zip, category, price, label })
  const wait = (tier, category, label) => onOpen({ kind: 'waitlist', tier, zip: z.zip, category, label })

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
            {c.exclusive.status === 'available' ? (
              <button className="pill pill-available" style={{ cursor: 'pointer' }}
                onClick={() => claim('category', c.category, c.exclusive.price, `Exclusive ${CATEGORY_LABEL[c.category]} — ${z.zip}`)}>Claim</button>
            ) : c.exclusive.status === 'sold' ? (
              <button className="pill pill-sold" style={{ cursor: 'pointer' }} title="Join the waitlist"
                onClick={() => wait('category', c.category, `Waitlist · ${CATEGORY_LABEL[c.category]} — ${z.zip}`)}>Sold · <b>{c.exclusive.owner}</b></button>
            ) : <span className="pill pill-na">Unavailable</span>}
          </div>
        ))}
      </div>

      <div className="terr-foot">
        <div className="terr-tiers">
          <div className="terr-tier">
            <span className="terr-tier-label">Shared list · <b>{money(z.shared.price)}</b>/mo
              {z.shared.status === 'available' && ` · ${z.shared.seatsLeft} of ${z.shared.cap} seats`}
              {z.shared.status === 'full' && ' · full'}
            </span>
          </div>
          <div className="terr-tier">
            <span className="terr-tier-label">Own all of {z.zip} · <b>{money(z.zipExclusive.price)}</b>/mo</span>
            {z.zipExclusive.status === 'sold' && <span className="pill pill-sold">Held · <b>{z.zipExclusive.owner}</b></span>}
            {z.zipExclusive.status === 'unavailable' && <span className="pill pill-na">Partially claimed</span>}
          </div>
        </div>

        <div className="terr-cta">
          {z.shared.status === 'available'
            ? <button className="btn-lux ghost" onClick={() => claim('shared', null, z.shared.price, `Shared Territory — ${z.zip}`)}>Join Shared</button>
            : <button className="btn-lux ghost" onClick={() => wait('shared', null, `Waitlist · Shared — ${z.zip}`)}><BellRing size={12} style={{ marginRight: 5 }} />Waitlist</button>}
          {z.zipExclusive.status === 'available'
            ? <button className="btn-lux" onClick={() => claim('zip', null, z.zipExclusive.price, `Exclusive ZIP — ${z.zip}`)}>Own {z.zip}</button>
            : <button className="btn-lux" onClick={() => wait('zip', null, `Waitlist · Exclusive ${z.zip}`)}><BellRing size={12} style={{ marginRight: 5 }} />Waitlist</button>}
        </div>
      </div>
    </div>
  )
}

function Field({ label, ...props }) {
  return <div className="mkt-field"><label>{label}</label><input {...props} /></div>
}

function CheckoutModal({ sel, paymentsEnabled, onClose }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [done, setDone] = useState(false)
  const submit = async () => {
    setErr(null); setBusy(true)
    try {
      const r = await CatalogService.checkout({ tier: sel.tier, zip: sel.zip, category: sel.category, name, email })
      if (r.url) { window.location.href = r.url; return }
      setDone(true)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={done ? 'Request received' : 'Reserve territory'} onClose={onClose}>
      {done ? <p className="mkt-modal-sub">Thank you — we&rsquo;ll finalize <b>{sel.label}</b> shortly. Your seat is held.</p> : (
        <>
          <p className="mkt-modal-sub">{sel.label}</p>
          <Field label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Agent" />
          <Field label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@brokerage.com" type="email" />
          <div className="mkt-modal-line"><span style={{ color: 'var(--muted)', fontSize: 13 }}>Monthly</span>
            <span className="amt">{money(sel.price)}<span style={{ fontSize: 14, color: 'var(--muted)' }}>/mo</span></span></div>
          {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
          <button className="btn-lux" style={{ width: '100%', marginTop: 16 }} onClick={submit} disabled={busy || !email}>
            {busy ? <Loader2 size={14} className="spin" /> : <>Continue to secure checkout <ArrowRight size={14} style={{ marginLeft: 6 }} /></>}
          </button>
          <p className="mkt-note">{paymentsEnabled
            ? <><Lock size={11} style={{ verticalAlign: -1 }} /> Secured by Stripe. Cancel anytime. First-month performance guarantee on exclusives.</>
            : 'Concierge onboarding — submit your details and our team will confirm availability by hand.'}</p>
        </>
      )}
    </Modal>
  )
}

function WaitlistModal({ sel, onClose }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [done, setDone] = useState(false)
  const submit = async () => {
    setErr(null); setBusy(true)
    try { await CatalogService.joinWaitlist({ zip: sel.zip, category: sel.category, tier: sel.tier, name, email }); setDone(true) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={done ? 'You&rsquo;re on the list' : 'Join the waitlist'} onClose={onClose}>
      {done ? <p className="mkt-modal-sub">We&rsquo;ll notify you the moment <b>{sel.label.replace(/^Waitlist · /, '')}</b> frees up — first in line, no obligation.</p> : (
        <>
          <p className="mkt-modal-sub">{sel.label} is currently held. Be first in line when it reopens.</p>
          <Field label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Agent" />
          <Field label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@brokerage.com" type="email" />
          {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
          <button className="btn-lux" style={{ width: '100%', marginTop: 16 }} onClick={submit} disabled={busy || !email}>
            {busy ? <Loader2 size={14} className="spin" /> : 'Notify me when it opens'}
          </button>
        </>
      )}
    </Modal>
  )
}

function RegionRequest() {
  const [region, setRegion] = useState(''); const [email, setEmail] = useState(''); const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [err, setErr] = useState(null)
  const submit = async (e) => {
    e.preventDefault(); setErr(null); setBusy(true)
    try { await CatalogService.requestRegion({ region, email, note }); setDone(true) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <section className="region-req">
      <div className="region-req-inner">
        <div>
          <div className="mkt-eyebrow">Expanding</div>
          <h2 className="region-req-title">Don&rsquo;t see your market?</h2>
          <p className="mkt-sub" style={{ margin: '8px 0 0' }}>We&rsquo;re live in Dallas County and opening new regions by demand. Tell us where you sell — you&rsquo;ll get first claim when it launches.</p>
        </div>
        {done ? (
          <div className="region-req-done">Thank you — you&rsquo;re first in line for <b>{region}</b>. We&rsquo;ll be in touch when it opens.</div>
        ) : (
          <form className="region-req-form" onSubmit={submit}>
            <input className="mkt-search" placeholder="County / metro (e.g. Tarrant County)" value={region} onChange={e => setRegion(e.target.value)} required />
            <input className="mkt-search" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="mkt-search" placeholder="Anything specific? (optional)" value={note} onChange={e => setNote(e.target.value)} />
            <button className="btn-lux" disabled={busy || !region || !email}>{busy ? <Loader2 size={14} className="spin" /> : 'Request my region'}</button>
            {err && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</div>}
          </form>
        )}
      </div>
    </section>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="mkt-modal-back" onClick={onClose}>
      <div className="mkt-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h3 dangerouslySetInnerHTML={{ __html: title }} />
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
