import { useEffect, useState } from 'react'
import { X, Loader2, Building2, User, Phone, Mail, Globe, TrendingUp } from 'lucide-react'
import CatalogService from '../services/CatalogService'

// Deep-dossier modal — runs the multi-hop web resolver for an entity-owned lead and shows the
// operator: principal(s), their portfolio (★ = also in our roll), contacts, context/PI, and the
// motivation read. Everything is sourced + framed as leads to verify (never asserted).
export default function DossierModal({ entity, onClose }) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let live = true
    CatalogService.dossier(entity)
      .then(r => live && setState({ loading: false, d: r.dossier, cached: r.cached }))
      .catch(e => live && setState({ loading: false, error: e.message }))
    return () => { live = false }
  }, [entity])

  const d = state.d
  return (
    <div className="mkt-modal-back" onClick={onClose}>
      <div className="mkt-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="mkt-eyebrow">Deep Dossier</div>
            <h3 style={{ fontSize: 24 }}>{entity}</h3>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={18} /></button>
        </div>

        {state.loading && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--muted)' }}>
            <Loader2 className="spin" size={22} /><div style={{ marginTop: 8 }}>Tracing the web… following the ownership thread (~20s).</div>
          </div>
        )}
        {state.error && <div style={{ color: 'var(--danger)', padding: 20 }}>Couldn&rsquo;t build the dossier: {state.error}</div>}

        {d && (
          <div className="dossier">
            {d.motivation?.angle && (
              <div className="dsr-angle"><TrendingUp size={15} /> <span>{d.motivation.angle}</span></div>
            )}

            <div className="dsr-sec"><User size={13} /> PRINCIPAL{d.principals.length > 1 ? 'S' : ''}</div>
            {d.principals.length ? d.principals.map((p, i) => (
              <div className="dsr-row" key={i}>
                <span className="dsr-name">{p.name}{p.verified && <span className="dsr-vf" title="confirmed via TX Comptroller"> ✓</span>}</span>
                <span className="dsr-meta">{p.roles.join(', ') || 'role?'} · {p.sources.slice(0, 3).join(', ')}</span>
              </div>
            )) : <div className="muted-note">No principal resolved from the web.</div>}
            {d.maybePeople?.length ? <div className="muted-note">Possible (unconfirmed): {d.maybePeople.join(', ')}</div> : null}

            <div className="dsr-sec"><Building2 size={13} /> PORTFOLIO <span className="dsr-hint">★ = in our delinquent roll</span></div>
            {d.entities.map((e, i) => (
              <div className="dsr-row" key={i}>
                <span className="dsr-name">{e.inRoll && <span className="dsr-star">★ </span>}{e.name}</span>
                <span className="dsr-meta">{e.owed ? `$${e.owed.toLocaleString()} owed` : e.sources.slice(0, 2).join(', ')}</span>
              </div>
            ))}

            {(d.contacts.phones.length || d.contacts.emails.length || d.contacts.sites.length) ? (
              <>
                <div className="dsr-sec"><Phone size={13} /> CONTACTS <span className="dsr-hint">unverified — confirm before calling</span></div>
                {d.contacts.phones.map((p, i) => <div className="dsr-row" key={'p' + i}><span className="dsr-name"><Phone size={11} /> {p.value}</span><span className="dsr-meta">{p.source}</span></div>)}
                {d.contacts.emails.map((e, i) => <div className="dsr-row" key={'e' + i}><span className="dsr-name"><Mail size={11} /> {e.value}</span><span className="dsr-meta">{e.source}</span></div>)}
                {d.contacts.sites.length ? <div className="dsr-row"><span className="dsr-name"><Globe size={11} /> {d.contacts.sites.slice(0, 4).join(' · ')}</span></div> : null}
              </>
            ) : null}

            {(d.context.competency.length || d.context.tenure.length || d.context.lenders.length) ? (
              <>
                <div className="dsr-sec">CONTEXT / PI</div>
                {d.context.competency.length ? <div className="dsr-ctx"><b>competency</b> {d.context.competency.join(', ')}</div> : null}
                {d.context.tenure.length ? <div className="dsr-ctx"><b>tenure</b> {d.context.tenure.join(', ')}</div> : null}
                {d.context.lenders.length ? <div className="dsr-ctx"><b>lenders</b> {d.context.lenders.join(', ')}</div> : null}
                {d.context.volume.length ? <div className="dsr-ctx"><b>volume</b> {d.context.volume.slice(0, 6).join(', ')}</div> : null}
              </>
            ) : null}

            <div className="dsr-foot">{d.searches} web searches{state.cached ? ' · cached' : ''} · every fact carries its source — treat as leads to verify.</div>
          </div>
        )}
      </div>
    </div>
  )
}
