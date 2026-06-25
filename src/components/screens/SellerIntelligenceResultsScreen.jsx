import React, { useState, useEffect, useRef } from 'react';
import SellerIntelligenceService from '../../services/SellerIntelligenceService';

const prettifySignal = (t) => String(t || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Discovery signals → display chrome. Ordered by intent strength so the most
// telling signals (estate death-sale, pre-foreclosure) always surface first.
const SIGNAL_META = {
  estate:         { icon: '⚰️', label: 'Estate', cls: 'badge-estate', priority: 1 },
  preForeclosure: { icon: '⚖️', label: 'Pre-foreclosure', cls: 'badge-foreclosure', priority: 2 },
  taxDelinquency: { icon: '🔴', label: 'Tax delinquent', cls: 'badge-delinquent', priority: 3 },
  elderlyOwner:   { icon: '👵', label: 'Elderly', cls: 'badge-signal', priority: 4 },
  emptyNester:    { icon: '🪺', label: 'Empty-nester', cls: 'badge-signal', priority: 5 },
  absenteeOwner:  { icon: '🏚️', label: 'Absentee', cls: 'badge-signal', priority: 6 },
};

// Factors that actually fired (points > 0), known discovery signals first (by
// intent priority), then any other contributing factor.
const firedSignals = (lead) => {
  const fired = (lead.motivationFactors || []).filter(f => f.points > 0);
  const known = fired.filter(f => SIGNAL_META[f.type])
    .sort((a, b) => SIGNAL_META[a.type].priority - SIGNAL_META[b.type].priority);
  const other = fired.filter(f => !SIGNAL_META[f.type]);
  return [...known, ...other];
};
const leadHasEstate = (lead) => (lead.motivationFactors || []).some(f => f.type === 'estate' && f.points > 0);

const SellerIntelligenceResultsScreen = ({ onNavigate, searchParams }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [sortBy, setSortBy] = useState('score');
  const [filterBy, setFilterBy] = useState('all');
  const [signalFilter, setSignalFilter] = useState('all');
  const [campaignName, setCampaignName] = useState('');

  // --- Background CAD enrichment of selected leads ---
  // A live mirror of leads (so the async queue always reads current state),
  // the set of leads currently in flight, and a flag so only one queue runs.
  const leadsRef = useRef(leads);
  const inFlightRef = useRef(new Set());
  const queueRunningRef = useRef(false);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  useEffect(() => {
    loadLeads();
    generateCampaignName();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = searchParams || {
        area: 'Highland Park, Dallas, TX',
        radius: 5,
        propertyTypes: { residential: true }
      };

      const result = await SellerIntelligenceService.searchLeads(params);
      setLeads(result.leads || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCampaignName = () => {
    const area = searchParams?.area || 'Highland Park, Dallas, TX';
    const areaName = area.split(',')[0];
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    setCampaignName(`${areaName} - ${date}`);
  };

  // Expand/collapse a lead. On expand, lazily fetch CAD details once (full
  // street address, beds/baths/sqft, year built) for that single property.
  const handleSelectLead = async (lead) => {
    const isOpening = selectedLead?.id !== lead.id;
    setSelectedLead(isOpening ? lead : null);

    // Load skip-traced contact info on first expand (DNC-gated by backend).
    if (isOpening && !lead.contactLoaded && lead.accountId) {
      SellerIntelligenceService.getContacts([lead.accountId])
        .then(({ configured, contacts }) => {
          const c = contacts[lead.accountId] || { phones: [], emails: [] };
          setLeads(prev => prev.map(l => l.id === lead.id
            ? { ...l, contact: c, contactConfigured: configured, contactLoaded: true } : l));
        })
        .catch(err => setLeads(prev => prev.map(l => l.id === lead.id
          ? { ...l, contactLoaded: true, contactError: err.message } : l)));
    }

    // Enrich on first expand, unless already done / in progress (e.g. the
    // background queue already picked it up).
    if (!isOpening || lead.enriched || lead.enriching || inFlightRef.current.has(lead.id)) return;
    await enrichOne(lead);
  };

  // Merge a bulk-enrich result onto a lead (or record its error).
  const applyEnrichment = (leadId, result) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      if (!result || result.error) {
        return { ...l, enriching: false, enriched: true, cadError: result?.error || 'no result' };
      }
      return {
        ...l,
        enriching: false,
        enriched: true,
        cad: result,
        fullAddress: result.fullAddress || l.fullAddress,
        bedrooms: result.bedrooms ?? l.bedrooms,
        bathrooms: result.bathrooms ?? l.bathrooms,
        sqft: result.sqft ?? l.sqft,
        yearBuilt: result.yearBuilt ?? l.yearBuilt
      };
    }));
  };

  // Enrich a single lead (used by click-to-expand). Goes through the cached
  // bulk endpoint with one address.
  const enrichOne = async (lead) => {
    inFlightRef.current.add(lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, enriching: true } : l));
    try {
      const results = await SellerIntelligenceService.bulkEnrichLeads([lead.fullAddress || lead.address]);
      applyEnrichment(lead.id, results[0]);
    } catch (err) {
      console.error('CAD enrichment failed:', err);
      applyEnrichment(lead.id, { error: err.message });
    } finally {
      inFlightRef.current.delete(lead.id);
    }
  };

  // Drain selected-but-unenriched leads through the cached bulk endpoint in
  // small chunks — cached addresses come back instantly, misses are scraped
  // (rate-limited) server-side. Chunking keeps the progress banner moving and
  // re-scans each round so leads selected mid-run are picked up.
  const ENRICH_CHUNK = 5;
  const runEnrichmentQueue = async () => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    try {
      while (true) {
        const batch = leadsRef.current
          .filter(l => l.selected && !l.enriched && !l.enriching && !inFlightRef.current.has(l.id))
          .slice(0, ENRICH_CHUNK);
        if (batch.length === 0) break;

        const ids = new Set(batch.map(l => l.id));
        batch.forEach(l => inFlightRef.current.add(l.id));
        setLeads(prev => prev.map(l => ids.has(l.id) ? { ...l, enriching: true } : l));

        const addresses = batch.map(l => l.fullAddress || l.address);
        try {
          const results = await SellerIntelligenceService.bulkEnrichLeads(addresses);
          batch.forEach((l, i) => applyEnrichment(l.id, results[i]));
        } catch (err) {
          console.error('Bulk enrichment failed:', err);
          batch.forEach(l => applyEnrichment(l.id, { error: err.message }));
        } finally {
          batch.forEach(l => inFlightRef.current.delete(l.id));
        }
      }
    } finally {
      queueRunningRef.current = false;
    }
  };

  const pendingEnrichCount = leads.filter(l => l.selected && !l.enriched && !l.enriching).length;
  useEffect(() => {
    if (pendingEnrichCount > 0) runEnrichmentQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEnrichCount]);

  const handleSort = (type) => {
    setSortBy(type);
    const sorted = [...leads];
    switch (type) {
      case 'score': sorted.sort((a, b) => b.motivationScore - a.motivationScore); break;
      case 'value': sorted.sort((a, b) => (b.propertyValue || 0) - (a.propertyValue || 0)); break;
      case 'owed': sorted.sort((a, b) => (b.amountOwed || 0) - (a.amountOwed || 0)); break;
      case 'years': sorted.sort((a, b) => (b.yearsDelinquent || 0) - (a.yearsDelinquent || 0)); break;
      default: break;
    }
    setLeads(sorted);
  };

  const handleFilter = (type) => setFilterBy(type);

  const passesScore = (lead) => {
    if (filterBy === 'all') return true;
    if (filterBy === 'high') return lead.motivationScore >= 85;
    if (filterBy === 'medium') return lead.motivationScore >= 70 && lead.motivationScore < 85;
    if (filterBy === 'low') return lead.motivationScore < 70;
    return true;
  };
  const hasSignal = (lead, type) => (lead.motivationFactors || []).some(f => f.type === type && f.points > 0);
  const filteredLeads = leads.filter(lead => passesScore(lead) && (signalFilter === 'all' || hasSignal(lead, signalFilter)));

  const toggleLeadSelection = (leadId) => {
    setLeads(prevLeads =>
      prevLeads.map(lead => lead.id === leadId ? { ...lead, selected: !lead.selected } : lead)
    );
  };

  const selectAllLeads = () => {
    const allSelected = filteredLeads.length > 0 && filteredLeads.every(lead => lead.selected);
    const visible = new Set(filteredLeads.map(l => l.id));
    setLeads(prevLeads => prevLeads.map(lead => visible.has(lead.id) ? { ...lead, selected: !allSelected } : lead));
  };

  const getSelectedCount = () => leads.filter(lead => lead.selected).length;

  const handleEnableCampaign = async () => {
    const selectedLeads = leads.filter(lead => lead.selected);
    if (selectedLeads.length === 0) {
      alert('Please select at least one lead to save a campaign');
      return;
    }
    if (!campaignName.trim()) {
      alert('Please enter a campaign name');
      return;
    }

    // Persist a real campaign: the leads the user picked + the search that
    // found them. We store lead essentials (not the full CAD blob) to keep it small.
    const campaign = {
      id: `camp_${Date.now()}`,
      name: campaignName.trim(),
      area: searchParams?.area || campaignName.trim(),
      searchParams: searchParams || null,
      status: 'active',
      totalLeads: selectedLeads.length,
      createdAt: new Date().toISOString(),
      leads: selectedLeads.map(l => ({
        id: l.id, address: l.address, fullAddress: l.fullAddress, ownerName: l.ownerName,
        city: l.city, state: l.state, zip: l.zip, motivationScore: l.motivationScore,
        urgencyScore: l.urgencyScore, amountOwed: l.amountOwed, yearsDelinquent: l.yearsDelinquent,
        propertyValue: l.propertyValue, propertyType: l.propertyType, bedrooms: l.bedrooms,
        bathrooms: l.bathrooms, sqft: l.sqft, yearBuilt: l.yearBuilt
      }))
    };

    await SellerIntelligenceService.saveCampaign(campaign);
    alert(`Campaign "${campaign.name}" saved with ${selectedLeads.length} lead${selectedLeads.length > 1 ? 's' : ''}.`);
    onNavigate('sellers_dashboard');
  };

  const handleExport = async () => {
    const selectedLeads = leads.filter(lead => lead.selected);
    if (selectedLeads.length === 0) {
      alert('Please select leads to export');
      return;
    }

    const notEnriched = selectedLeads.filter(l => !l.enriched).length;
    if (notEnriched > 0) {
      const proceed = window.confirm(
        `${notEnriched} of ${selectedLeads.length} selected leads are still being enriched with CAD ` +
        `details (beds/baths/sqft). Export now with partial data, or cancel and wait for it to finish?`
      );
      if (!proceed) return;
    }

    // Pull skip-traced contact info for the export (DNC-gated by the backend).
    let contactMap = {};
    const accts = selectedLeads.map(l => l.accountId).filter(Boolean);
    if (accts.length) {
      try {
        const { contacts } = await SellerIntelligenceService.getContacts(accts);
        contactMap = contacts || {};
      } catch (err) {
        console.error('Contact fetch for export failed:', err);
      }
    }
    const leadsForExport = selectedLeads.map(l => ({ ...l, _contact: contactMap[l.accountId] }));

    const exportData = await SellerIntelligenceService.exportLeads(leadsForExport, 'csv');
    if (exportData) {
      const blob = new Blob([exportData.content], { type: exportData.mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportData.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  // ---- Derived summary ----
  const areaName = (searchParams?.area || 'Highland Park, Dallas, TX').split(',')[0];
  const selectedCount = getSelectedCount();
  const avgScore = filteredLeads.length
    ? Math.round(filteredLeads.reduce((s, l) => s + (l.motivationScore || 0), 0) / filteredLeads.length)
    : 0;
  const totalOwed = filteredLeads.reduce((s, l) => s + (l.amountOwed || 0), 0);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-wrap">
          <div className="spinner"></div>
          <h2 className="page-title">Finding motivated sellers</h2>
          <p className="page-sub">Scoring Dallas County public records…</p>
        </div>
      </div>
    );
  }

  const SORTS = [
    { key: 'score', label: 'Score' },
    { key: 'owed', label: 'Owed' },
    { key: 'years', label: 'Yrs' },
    { key: 'value', label: 'Value' }
  ];
  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'high', label: 'High (85+)' },
    { key: 'medium', label: 'Medium (70–84)' },
    { key: 'low', label: 'Low (<70)' }
  ];
  const SIGNAL_FILTERS = [
    { key: 'all', label: 'All signals' },
    { key: 'estate', label: '⚰️ Estate / Inherited' },
    { key: 'preForeclosure', label: '⚖️ Pre-foreclosure' },
    { key: 'taxDelinquency', label: '🔴 Tax delinquent' },
    { key: 'elderlyOwner', label: '👵 Elderly / Disabled' },
    { key: 'absenteeOwner', label: '🏚️ Absentee' },
    { key: 'emptyNester', label: '🪺 Empty-nester' }
  ];
  const signalCount = (key) => key === 'all'
    ? leads.length
    : leads.filter(l => hasSignal(l, key)).length;
  const allVisibleSelected = filteredLeads.length > 0 && filteredLeads.every(l => l.selected);

  const sortArrow = (key) => (sortBy === key ? ' ↓' : '');

  return (
    <>
      <div className="container">
        <div className="page-head">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('seller_intelligence_area')}>← New search</button>
            <h1 className="page-title" style={{ marginTop: 6 }}>{areaName} — motivated sellers</h1>
            <p className="page-sub">{filteredLeads.length} leads • {selectedCount} selected</p>
          </div>
          <button className="btn" onClick={handleExport}>📥 Export CSV</button>
        </div>

        <div className="results-layout">
          {/* Filter sidebar */}
          <aside className="filter-sidebar card">
            <div>
              <div className="sidebar-block-title">Summary</div>
              <div className="summary-stat"><span className="k">Leads</span><span className="v">{filteredLeads.length}</span></div>
              <div className="summary-stat"><span className="k">Avg score</span><span className="v">{avgScore}</span></div>
              <div className="summary-stat"><span className="k">Total owed</span><span className="v">${Math.round(totalOwed).toLocaleString()}</span></div>
            </div>
            <div>
              <div className="sidebar-block-title">Filter by signal</div>
              <div className="filter-list">
                {SIGNAL_FILTERS.map(s => {
                  const count = signalCount(s.key);
                  if (s.key !== 'all' && count === 0) return null;
                  return (
                    <button
                      key={s.key}
                      className={`chip ${signalFilter === s.key ? 'chip-active' : ''}`}
                      onClick={() => setSignalFilter(s.key)}
                    >
                      {s.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="sidebar-block-title">Filter by score</div>
              <div className="filter-list">
                {FILTERS.map(f => (
                  <button
                    key={f.key}
                    className={`chip ${filterBy === f.key ? 'chip-active' : ''}`}
                    onClick={() => handleFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Leads table */}
          <section className="leads-panel card">
            <div className="leads-table">
              <div className="lead-row lead-row--head">
                <span></span>
                <span>Owner / Address</span>
                <button className="th-sort" onClick={() => handleSort('score')}>Score{sortArrow('score')}</button>
                <button className="th-sort" onClick={() => handleSort('owed')}>Owed{sortArrow('owed')}</button>
                <button className="th-sort" onClick={() => handleSort('years')}>Yrs{sortArrow('years')}</button>
                <button className="th-sort" onClick={() => handleSort('value')}>Value{sortArrow('value')}</button>
                <span>Type</span>
                <span>Signals</span>
              </div>

              {filteredLeads.length === 0 && (
                <div className="empty-state">No leads match this filter.</div>
              )}

              {filteredLeads.map((lead) => (
                <React.Fragment key={lead.id}>
                  <div
                    className={`lead-row lead-row--body ${lead.selected ? 'lead-row--selected' : ''} ${leadHasEstate(lead) ? 'lead-row--estate' : ''}`}
                    onClick={() => handleSelectLead(lead)}
                  >
                    <span className="cell" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="checkbox" checked={lead.selected || false} onChange={() => toggleLeadSelection(lead.id)} />
                    </span>
                    <span className="cell cell-primary">
                      <span className="owner">{lead.ownerName}</span>
                      <span className="addr">{lead.address}{lead.city ? `, ${lead.city}` : ''} {lead.zip}</span>
                    </span>
                    <span className="cell cell-num">
                      <span className="cell-label">Score</span>
                      <span className="score-pill" style={{ background: SellerIntelligenceService.getMotivationColor(lead.motivationScore) }}>{lead.motivationScore}</span>
                    </span>
                    <span className="cell cell-num">
                      <span className="cell-label">Owed</span>
                      {lead.amountOwed ? `$${Math.round(lead.amountOwed).toLocaleString()}` : '—'}
                    </span>
                    <span className="cell cell-num">
                      <span className="cell-label">Yrs</span>
                      {lead.yearsDelinquent || '—'}
                    </span>
                    <span className="cell cell-num">
                      <span className="cell-label">Value</span>
                      {lead.propertyValue ? SellerIntelligenceService.formatPropertyValue(lead.propertyValue) : '—'}
                    </span>
                    <span className="cell">
                      <span className="cell-label">Type</span>
                      {lead.propertyType || '—'}
                    </span>
                    <span className="cell cell-signals">
                      <span className="cell-label">Signals</span>
                      {(() => {
                        const fired = firedSignals(lead);
                        if (fired.length === 0) return '—';
                        const shown = fired.slice(0, 3);
                        const extra = fired.length - shown.length;
                        return (
                          <>
                            {shown.map((f, i) => {
                              const m = SIGNAL_META[f.type];
                              return (
                                <span key={i} className={`badge ${m ? m.cls : 'badge-signal'}`}>
                                  {m ? `${m.icon} ${m.label}` : prettifySignal(f.type || f.description)}
                                </span>
                              );
                            })}
                            {extra > 0 && <span className="badge badge-more">+{extra}</span>}
                          </>
                        );
                      })()}
                    </span>
                  </div>

                  {selectedLead?.id === lead.id && (
                    <div className="lead-detail">
                      <div>
                        <div className="detail-block-title">Motivation factors</div>
                        {(lead.motivationFactors || []).filter(f => f.points > 0).map((factor, index) => (
                          <div key={index} className="factor">
                            <span className="dot" style={{ background: factor.severity === 'high' ? 'var(--score-high)' : factor.severity === 'medium' ? 'var(--score-med)' : 'var(--score-low)' }}></span>
                            <span>{factor.description}</span>
                          </div>
                        ))}
                        {(lead.motivationFactors || []).filter(f => f.points > 0).length === 0 && (
                          <div className="muted-note">No individual factors recorded.</div>
                        )}
                      </div>

                      {/* Lazy CAD enrichment — fetched on first expand */}
                      <div>
                        <div className="detail-block-title">Property details (Dallas CAD)</div>
                        {lead.enriching && <div className="muted-note">⏳ Looking up CAD records…</div>}
                        {!lead.enriching && lead.cad && (
                          <>
                            {lead.cad.fullAddress && lead.cad.fullAddress !== lead.address && (
                              <div className="kv"><span className="k">Full address</span><span className="v">{lead.cad.fullAddress}</span></div>
                            )}
                            <div className="kv"><span className="k">Beds</span><span className="v">{lead.cad.bedrooms ?? '—'}</span></div>
                            <div className="kv"><span className="k">Baths</span><span className="v">{lead.cad.bathrooms ?? '—'}</span></div>
                            <div className="kv"><span className="k">Sq ft</span><span className="v">{lead.cad.sqft ? lead.cad.sqft.toLocaleString() : '—'}</span></div>
                            <div className="kv"><span className="k">Year built</span><span className="v">{lead.cad.yearBuilt ?? '—'}</span></div>
                            {lead.cad.cadValue ? (
                              <div className="kv"><span className="k">CAD value</span><span className="v">{SellerIntelligenceService.formatPropertyValue(lead.cad.cadValue)}</span></div>
                            ) : null}
                          </>
                        )}
                        {!lead.enriching && lead.cadError && (
                          <div className="muted-note">CAD lookup unavailable for this address. Tax-roll data is confirmed; CAD often needs a full street number.</div>
                        )}
                        {!lead.enriching && lead.enriched && !lead.cad && !lead.cadError && (
                          <div className="muted-note">No additional CAD records found.</div>
                        )}
                      </div>

                      {/* Skip-traced contact info — DNC-gated */}
                      <div>
                        <div className="detail-block-title">Contact (skip-trace)</div>
                        {lead.contact && (lead.contact.phones?.length || lead.contact.emails?.length) ? (
                          <div>
                            {lead.contact.phones?.map((p, i) => (
                              <div key={i} className="kv">
                                <span className="v">{p.number}</span>
                                <span className={`badge ${p.callable ? 'badge-signal' : p.dnc === 'do_not_call' ? 'badge-delinquent' : ''}`}>
                                  {p.callable ? '✓ callable' : p.dnc === 'do_not_call' ? '⛔ do not call' : 'DNC not verified'}
                                </span>
                              </div>
                            ))}
                            {lead.contact.emails?.map((e, i) => (
                              <div key={i} className="kv"><span className="v">✉ {e}</span></div>
                            ))}
                            {lead.contactConfigured && !lead.contactConfigured.dnc && (
                              <div className="muted-note">Numbers can't be marked callable — no DNC provider configured. Don't call until scrubbed.</div>
                            )}
                          </div>
                        ) : (
                          <div className="muted-note">
                            {lead.contactError ? `Lookup failed: ${lead.contactError}`
                              : 'No contact on file. Load skip-trace results or configure a provider.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="action-bar">
        <button className="btn btn-sm" onClick={selectAllLeads}>{allVisibleSelected ? 'Deselect all' : 'Select all'}</button>
        <span className="page-sub">{selectedCount} of {filteredLeads.length} selected</span>
        {selectedCount > 0 && (() => {
          const sel = leads.filter(l => l.selected);
          const enr = sel.filter(l => l.enriched).length;
          const active = enr < sel.length;
          return (
            <span className={`enrich-banner ${active ? 'enrich-banner--active' : ''}`}>
              {active ? `⏳ Enriching ${enr}/${sel.length}…` : `✓ ${sel.length} enriched`}
            </span>
          );
        })()}
        <span className="spacer"></span>
        <input
          className="input"
          style={{ maxWidth: 220 }}
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Campaign name"
        />
        <button className="btn" onClick={handleEnableCampaign}>💾 Save campaign</button>
        <button className="btn btn-primary" onClick={handleExport}>📥 Export</button>
      </div>
    </>
  );
};

export default SellerIntelligenceResultsScreen;
