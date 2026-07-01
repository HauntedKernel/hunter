import { useEffect, useMemo, useRef, useState } from 'react'
import { Lock, X, ArrowRight, Loader2, BellRing, Check, ShoppingBag, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import CatalogService from '../../services/CatalogService'
import RegionMap from '../RegionMap'

// Territory Marketplace — service-region map + a Dallas County → ZIP → expanded-card accordion.
// Multi-select into a portfolio (volume discount), Stripe checkout, waitlist, region requests.
const CATEGORY_LABEL = { residential: 'Residential', land: 'Land', commercial: 'Commercial' }
const CATEGORY_SUB = { residential: 'Houses & condos', land: 'Lots & acreage', commercial: 'Retail, office, industrial' }
const money = (n) => `$${Number(n || 0).toLocaleString()}`
const discountPct = (n) => (n >= 4 ? 20 : n === 3 ? 15 : n === 2 ? 10 : 0)
const keyOf = (it) => `${it.tier}:${it.zip}:${it.category || ''}`
// Term-commitment options. Combined with the volume discount, capped at 25%.
const TERMS = [
  { m: 1, label: 'Monthly', pct: 0, note: 'billed monthly' },
  { m: 3, label: '3 months', pct: 5, note: 'billed quarterly' },
  { m: 6, label: '6 months', pct: 10, note: 'billed every 6 months' },
  { m: 12, label: 'Annual', pct: 15, note: 'billed annually' },
]
const DISCOUNT_CAP = 25

export default function MarketplaceScreen() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState([])
  const [waitlist, setWaitlist] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const listRef = useRef(null)

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

  const cartKeys = useMemo(() => new Set(cart.map(keyOf)), [cart])
  const toggleCart = (it) => setCart(c => c.some(x => keyOf(x) === keyOf(it)) ? c.filter(x => keyOf(x) !== keyOf(it)) : [...c, it])
  const removeCart = (k) => setCart(c => c.filter(x => keyOf(x) !== k))

  const subtotal = cart.reduce((s, it) => s + it.price, 0)
  const pct = discountPct(cart.length)
  const total = Math.round(subtotal * (1 - pct / 100))

  const selectFromMap = (zip) => {
    setQ(zip)
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  return (
    <div className="mkt" style={{ paddingBottom: cart.length ? 110 : 80 }}>
      <header className="mkt-head">
        <div className="mkt-eyebrow">By Invitation · Dallas County</div>
        <h1 className="mkt-title">Claim Your Territory</h1>
        <p className="mkt-sub">
          Off-market motivated sellers, delivered monthly. One agent per exclusive list — when a
          territory is claimed, it&rsquo;s yours alone. Build a portfolio and save up to 20%.
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
        <div ref={listRef}>
          <div className="terr-group-head">
            <span className="terr-group-name">Dallas County</span>
            <span className="terr-group-count">{zips.length} ZIP {zips.length === 1 ? 'territory' : 'territories'}</span>
          </div>
          <div className="terr-list">
            {zips.map(z => (
              <TerritoryRow key={z.zip} z={z} cat={cat} cartKeys={cartKeys}
                onToggle={toggleCart} onWaitlist={setWaitlist} defaultOpen={zips.length === 1} />
            ))}
            {zips.length === 0 && <div style={{ color: 'var(--muted)', padding: 30 }}>No territories match that filter.</div>}
          </div>
        </div>
      )}

      <RegionRequest />

      {cart.length > 0 && (
        <div className="cart-bar">
          <div className="cart-bar-info">
            <ShoppingBag size={18} />
            <span><b>{cart.length}</b> territ{cart.length > 1 ? 'ories' : 'ory'} selected</span>
            {pct > 0 && <span className="cart-save">Portfolio discount −{pct}%</span>}
            <span className="cart-total">{money(total)}<span className="cart-per">/mo</span>
              {pct > 0 && <span className="cart-strike">{money(subtotal)}</span>}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-lux ghost" onClick={() => setCart([])}>Clear</button>
            <button className="btn-lux" onClick={() => setCheckoutOpen(true)}>Review &amp; checkout <ArrowRight size={14} style={{ marginLeft: 6 }} /></button>
          </div>
        </div>
      )}

      {checkoutOpen && <CheckoutModal cart={cart} subtotal={subtotal}
        paymentsEnabled={data?.paymentsEnabled} onRemove={removeCart} onClose={() => setCheckoutOpen(false)} />}
      {waitlist && <WaitlistModal sel={waitlist} onClose={() => setWaitlist(null)} />}
    </div>
  )
}

function TrendChip({ trend }) {
  if (!trend) return null
  const map = {
    rising: { Ico: TrendingUp, cls: 'trend-rising', label: 'Distress rising' },
    cooling: { Ico: TrendingDown, cls: 'trend-cooling', label: 'Cooling' },
    steady: { Ico: Minus, cls: 'trend-steady', label: 'Steady' },
  }[trend]
  if (!map) return null
  const { Ico, cls, label } = map
  return <span className={`trend-chip ${cls}`}><Ico size={12} />{label}</span>
}

function TerritoryRow({ z, cat, cartKeys, onToggle, onWaitlist, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const shown = cat === 'all' ? z.categories : z.categories.filter(c => c.category === cat)
  const openN = z.categories.filter(c => c.exclusive.status === 'available').length
  const soldN = z.categories.filter(c => c.exclusive.status === 'sold').length
  const add = (tier, category, price, label) => onToggle({ tier, zip: z.zip, category, price, label })
  const wait = (tier, category, label) => onWaitlist({ tier, zip: z.zip, category, label })
  const inCart = (tier, category) => cartKeys.has(`${tier}:${z.zip}:${category || ''}`)

  const SelectBtn = ({ tier, category, price, label, cls, children }) => (
    <button className={`${cls} ${inCart(tier, category) ? 'in-cart' : ''}`} onClick={() => add(tier, category, price, label)}>
      {inCart(tier, category) ? <><Check size={12} style={{ marginRight: 4 }} />Selected</> : children}
    </button>
  )

  return (
    <div className={`terr-row ${open ? 'is-open' : ''} ${soldN ? 'is-taken' : ''}`}>
      <button className="terr-row-head" onClick={() => setOpen(o => !o)}>
        <span className="terr-row-zip">{z.zip}</span>
        <span className="terr-row-leads"><b>{z.leadCount.toLocaleString()}</b> sellers</span>
        <span className="terr-row-avail">
          {openN > 0 && <span className="pill pill-available">{openN} open</span>}
          {soldN > 0 && <span className="pill pill-sold">{soldN} held</span>}
        </span>
        <TrendChip trend={z.insights?.trend} />
        <ChevronDown size={18} className="terr-row-chev" />
      </button>

      {open && (
        <div className="terr-row-body">
          {z.insights && (
            <div className="terr-insights">
              <span className="terr-ins-label">Market intelligence</span>
              {z.insights.trend && <TrendChip trend={z.insights.trend} />}
              {z.insights.freshDistress != null && <span className="ins-chip"><b>{z.insights.freshDistress}%</b> fresh distress (&lt;1yr)</span>}
              {z.insights.elderly != null && <span className="ins-chip"><b>{z.insights.elderly}%</b> downsizer-age owners</span>}
            </div>
          )}

          <div className="terr-cats">
            {shown.map(c => (
              <div className="terr-cat" key={c.category}>
                <div className="terr-cat-name">{CATEGORY_LABEL[c.category]}<small>{c.leadCount} leads · {CATEGORY_SUB[c.category]}</small></div>
                {c.exclusive.status === 'available'
                  ? <div className="terr-cat-price"><b>{money(c.exclusive.price)}</b>/mo</div>
                  : <div className="terr-cat-price">&nbsp;</div>}
                {c.exclusive.status === 'available' ? (
                  <SelectBtn tier="category" category={c.category} price={c.exclusive.price}
                    label={`Exclusive ${CATEGORY_LABEL[c.category]} — ${z.zip}`} cls="pill pill-available">Claim</SelectBtn>
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
                  {z.shared.status === 'full' && ' · full'}</span>
              </div>
              <div className="terr-tier">
                <span className="terr-tier-label">Own all of {z.zip} · <b>{money(z.zipExclusive.price)}</b>/mo</span>
                {z.zipExclusive.status === 'sold' && <span className="pill pill-sold">Held · <b>{z.zipExclusive.owner}</b></span>}
                {z.zipExclusive.status === 'unavailable' && <span className="pill pill-na">Partially claimed</span>}
              </div>
            </div>
            <div className="terr-cta">
              {z.shared.status === 'available'
                ? <SelectBtn tier="shared" price={z.shared.price} label={`Shared Territory — ${z.zip}`} cls="btn-lux ghost">Join Shared</SelectBtn>
                : <button className="btn-lux ghost" onClick={() => wait('shared', null, `Waitlist · Shared — ${z.zip}`)}><BellRing size={12} style={{ marginRight: 5 }} />Waitlist</button>}
              {z.zipExclusive.status === 'available'
                ? <SelectBtn tier="zip" price={z.zipExclusive.price} label={`Exclusive ZIP — ${z.zip}`} cls="btn-lux">Own {z.zip}</SelectBtn>
                : <button className="btn-lux" onClick={() => wait('zip', null, `Waitlist · Exclusive ${z.zip}`)}><BellRing size={12} style={{ marginRight: 5 }} />Waitlist</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, ...props }) {
  return <div className="mkt-field"><label>{label}</label><input {...props} /></div>
}

function CheckoutModal({ cart, subtotal, paymentsEnabled, onRemove, onClose }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState('')
  const [term, setTerm] = useState(1)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [done, setDone] = useState(false)

  const volumePct = discountPct(cart.length)
  const t = TERMS.find(x => x.m === term) || TERMS[0]
  const rawPct = volumePct + t.pct
  const combined = Math.min(DISCOUNT_CAP, rawPct)
  const capped = rawPct > DISCOUNT_CAP
  const effMonthly = Math.round(subtotal * (1 - combined / 100))
  const billed = effMonthly * term

  const submit = async () => {
    setErr(null); setBusy(true)
    try {
      const items = cart.map(it => ({ tier: it.tier, zip: it.zip, category: it.category }))
      const r = await CatalogService.checkout({ items, name, email, term })
      if (r.url) { window.location.href = r.url; return }
      setDone(true)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={done ? 'Request received' : 'Your selection'} onClose={onClose}>
      {done ? <p className="mkt-modal-sub">Thank you — we&rsquo;ll finalize your territories shortly. Your seats are held.</p> : (
        <>
          <div className="cart-list">
            {cart.map(it => (
              <div className="cart-item" key={keyOf(it)}>
                <span>{it.label}</span>
                <span className="cart-item-r">{money(it.price)}<button className="cart-x" onClick={() => onRemove(keyOf(it))}><X size={13} /></button></span>
              </div>
            ))}
          </div>

          <div className="term-block">
            <div className="term-label">Commitment{t.pct > 0 && <span className="term-save"> · save {t.pct}%</span>}</div>
            <div className="term-seg">
              {TERMS.map(x => (
                <button key={x.m} className={`term-opt ${term === x.m ? 'active' : ''}`} onClick={() => setTerm(x.m)}>
                  {x.label}{x.pct > 0 && <small>−{x.pct}%</small>}
                </button>
              ))}
            </div>
          </div>

          <div className="cart-sum">
            <div><span>Subtotal</span><span>{money(subtotal)}/mo</span></div>
            {volumePct > 0 && <div className="cart-sum-disc"><span>Portfolio discount ({cart.length} territories)</span><span>−{volumePct}%</span></div>}
            {t.pct > 0 && <div className="cart-sum-disc"><span>{t.label} commitment</span><span>−{t.pct}%</span></div>}
            {capped && <div className="cart-sum-cap"><span>Combined discount capped</span><span>−{DISCOUNT_CAP}%</span></div>}
            <div className="cart-sum-total">
              <span>Total</span>
              <span className="amt">{money(effMonthly)}<span style={{ fontSize: 14, color: 'var(--muted)' }}>/mo</span></span>
            </div>
            <div className="cart-billed">{term === 1 ? 'billed monthly' : `${money(billed)} ${t.note}`}</div>
          </div>

          <Field label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Agent" />
          <Field label="Email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@brokerage.com" type="email" />
          {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{err}</div>}
          <button className="btn-lux" style={{ width: '100%', marginTop: 16 }} onClick={submit} disabled={busy || !email || !cart.length}>
            {busy ? <Loader2 size={14} className="spin" /> : <>Continue to secure checkout <ArrowRight size={14} style={{ marginLeft: 6 }} /></>}
          </button>
          <p className="mkt-note">{paymentsEnabled
            ? <><Lock size={11} style={{ verticalAlign: -1 }} /> Secured by Stripe. Discounts apply every cycle. {term === 1 ? 'Cancel anytime.' : 'First-month performance guarantee — money back if the leads don’t beat your current source.'}</>
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
