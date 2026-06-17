import React, { useState, useEffect, useRef } from 'react';
import SellerIntelligenceService from '../../services/SellerIntelligenceService';

const SellerIntelligenceResultsScreen = ({ onNavigate, searchParams }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeTab, setActiveTab] = useState('leads');
  const [sortBy, setSortBy] = useState('score');
  const [filterBy, setFilterBy] = useState('all');
  const [campaignName, setCampaignName] = useState('');
  const [campaignSettings, setCampaignSettings] = useState({
    autoContact: true,
    dailyLimit: 10,
    messageTemplate: 'personalized',
    followUpDays: 3
  });

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
        propertyTypes: { singleFamily: true, condo: true, townhome: true, commercial: true }
      };
      
      const result = await SellerIntelligenceService.searchLeads(params);
      console.log('🔍 Search result:', {
        source: result.source,
        totalFound: result.totalFound,
        leadsCount: result.leads?.length || 0,
        error: result.error,
        message: result.message
      });
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
    switch(type) {
      case 'score':
        sorted.sort((a, b) => b.motivationScore - a.motivationScore);
        break;
      case 'value':
        sorted.sort((a, b) => b.propertyValue - a.propertyValue);
        break;
      case 'confidence':
        sorted.sort((a, b) => b.confidence - a.confidence);
        break;
      default:
        break;
    }
    setLeads(sorted);
  };

  const handleFilter = (type) => {
    setFilterBy(type);
  };

  const filteredLeads = leads.filter(lead => {
    if (filterBy === 'all') return true;
    if (filterBy === 'high') return lead.motivationScore >= 85;
    if (filterBy === 'medium') return lead.motivationScore >= 70 && lead.motivationScore < 85;
    if (filterBy === 'low') return lead.motivationScore < 70;
    return true;
  });

  const toggleLeadSelection = (leadId) => {
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId 
          ? { ...lead, selected: !lead.selected }
          : lead
      )
    );
  };

  const selectAllLeads = () => {
    const allSelected = filteredLeads.every(lead => lead.selected);
    setLeads(prevLeads => 
      prevLeads.map(lead => ({ ...lead, selected: !allSelected }))
    );
  };

  const getSelectedCount = () => {
    return leads.filter(lead => lead.selected).length;
  };

  const handleEnableCampaign = async () => {
    const selectedLeads = leads.filter(lead => lead.selected);
    if (selectedLeads.length === 0) {
      alert('Please select at least one lead to create a campaign');
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
        id: l.id,
        address: l.address,
        fullAddress: l.fullAddress,
        ownerName: l.ownerName,
        city: l.city,
        state: l.state,
        zip: l.zip,
        motivationScore: l.motivationScore,
        urgencyScore: l.urgencyScore,
        amountOwed: l.amountOwed,
        yearsDelinquent: l.yearsDelinquent,
        propertyValue: l.propertyValue,
        propertyType: l.propertyType,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        sqft: l.sqft,
        yearBuilt: l.yearBuilt
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

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}>⚡</div>
          <h2 style={styles.loadingTitle}>Finding Motivated Sellers</h2>
          <p style={styles.loadingText}>Analyzing public records and AI signals...</p>
          <div style={styles.progressBar}>
            <div style={styles.progressFill}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button onClick={() => onNavigate('seller_intelligence_area')} style={styles.backButton}>
          ← Back
        </button>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Campaign Setup</h1>
          <p style={styles.subtitle}>{filteredLeads.length} leads found • {getSelectedCount()} selected</p>
        </div>
        <button onClick={handleExport} style={styles.exportButton}>
          📥
        </button>
      </div>

      <div style={styles.content}>
        {/* Tab Navigation */}
        <div style={styles.tabContainer}>
          <div style={styles.tabBar}>
            {[
              { id: 'leads', label: 'Lead Selection', icon: '👥' },
              { id: 'campaign', label: 'Campaign Settings', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                style={{
                  ...styles.tab,
                  background: activeTab === tab.id ? '#16a34a' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#64748b'
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                <span style={styles.tabIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <>
            {(() => {
              const sel = leads.filter(l => l.selected);
              if (sel.length === 0) return null;
              const enr = sel.filter(l => l.enriched).length;
              const active = enr < sel.length;
              return (
                <div style={{ ...styles.enrichBanner, ...(active ? {} : styles.enrichBannerDone) }}>
                  {active
                    ? `⏳ Enriching selected leads with CAD details… ${enr}/${sel.length} (export will include beds/baths/sqft)`
                    : `✓ All ${sel.length} selected leads enriched — export includes beds/baths/sqft/year built`}
                </div>
              );
            })()}

            <div style={styles.controls}>
              <div style={styles.selectionControls}>
                <button onClick={selectAllLeads} style={styles.selectAllButton}>
                  {filteredLeads.every(lead => lead.selected) ? 'Deselect All' : 'Select All'}
                </button>
                <span style={styles.selectionCount}>
                  {getSelectedCount()} of {filteredLeads.length} selected
                </span>
              </div>
              
              <div style={styles.filterGroup}>
                <button 
                  onClick={() => handleFilter('all')}
                  style={{
                    ...styles.filterButton,
                    ...(filterBy === 'all' ? styles.filterButtonActive : {})
                  }}
                >
                  All
                </button>
                <button 
                  onClick={() => handleFilter('high')}
                  style={{
                    ...styles.filterButton,
                    ...(filterBy === 'high' ? styles.filterButtonActive : {})
                  }}
                >
                  High
                </button>
                <button 
                  onClick={() => handleFilter('medium')}
                  style={{
                    ...styles.filterButton,
                    ...(filterBy === 'medium' ? styles.filterButtonActive : {})
                  }}
                >
                  Medium
                </button>
                <button 
                  onClick={() => handleFilter('low')}
                  style={{
                    ...styles.filterButton,
                    ...(filterBy === 'low' ? styles.filterButtonActive : {})
                  }}
                >
                  Low
                </button>
              </div>
              
              <select 
                value={sortBy} 
                onChange={(e) => handleSort(e.target.value)}
                style={styles.sortSelect}
              >
                <option value="score">Sort by Score</option>
                <option value="value">Sort by Value</option>
                <option value="confidence">Sort by Confidence</option>
              </select>
            </div>

            <div style={styles.leadsList}>
              {filteredLeads.map((lead) => (
                <div 
                  key={lead.id} 
                  style={{
                    ...styles.leadCard,
                    ...(lead.selected ? styles.leadCardSelected : {}),
                    ...(lead.isDelinquent ? styles.leadCardDelinquent : {})
                  }}
                >
                  <div style={styles.leadCheckbox}>
                    <input
                      type="checkbox"
                      checked={lead.selected || false}
                      onChange={() => toggleLeadSelection(lead.id)}
                      style={styles.checkbox}
                    />
                  </div>
                  
                  <div
                    style={styles.leadContent}
                    onClick={() => handleSelectLead(lead)}
                  >
                    <div style={styles.leadHeader}>
                      <div style={styles.leadAddress}>
                        <div style={styles.addressLine}>
                          {lead.address}
                          {lead.isDelinquent && (
                            <span style={styles.delinquentBadge}>
                              ⚠️ TAX DELINQUENT
                            </span>
                          )}
                        </div>
                        <div style={styles.cityLine}>{lead.city}, {lead.state} {lead.zip}</div>
                      </div>
                      <div style={styles.leadScore}>
                        <div 
                          style={{
                            ...styles.scoreCircle,
                            borderColor: SellerIntelligenceService.getMotivationColor(lead.motivationScore)
                          }}
                        >
                          <span style={styles.scoreNumber}>{lead.motivationScore}</span>
                        </div>
                      </div>
                    </div>

                    <div style={styles.leadInfo}>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Owner:</span>
                        <span style={styles.infoValue}>{lead.ownerName}</span>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Value:</span>
                        <span style={styles.infoValue}>
                          {SellerIntelligenceService.formatPropertyValue(lead.propertyValue)}
                        </span>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Type:</span>
                        <span style={styles.infoValue}>{lead.propertyType}</span>
                      </div>
                      <div style={styles.infoRow}>
                        <span style={styles.infoLabel}>Confidence:</span>
                        <span style={styles.infoValue}>{lead.confidence}%</span>
                      </div>
                      {lead.isDelinquent && (
                        <div style={styles.taxDelinquentInfo}>
                          <div style={styles.delinquentHeader}>
                            <span style={styles.delinquentIcon}>⚠️</span>
                            <span style={styles.delinquentTitle}>Tax Delinquent Property</span>
                          </div>
                          <div style={styles.delinquentDetails}>
                            <div style={styles.delinquentItem}>
                              <span style={styles.delinquentLabel}>Amount Owed:</span>
                              <span style={styles.delinquentAmount}>${lead.amountOwed?.toLocaleString()}</span>
                            </div>
                            <div style={styles.delinquentItem}>
                              <span style={styles.delinquentLabel}>Years Delinquent:</span>
                              <span style={styles.delinquentYears}>{lead.yearsDelinquent} year{lead.yearsDelinquent > 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedLead?.id === lead.id && (
                      <div style={styles.expandedInfo}>
                        <div style={styles.motivationFactors}>
                          <h4 style={styles.factorsTitle}>Motivation Factors:</h4>
                          {lead.motivationFactors.map((factor, index) => (
                            <div key={index} style={styles.factorItem}>
                              <span style={{
                                ...styles.factorDot,
                                background: factor.severity === 'high' ? '#dc2626' :
                                           factor.severity === 'medium' ? '#f59e0b' : '#6b7280'
                              }}></span>
                              <span style={styles.factorText}>{factor.description}</span>
                            </div>
                          ))}
                        </div>

                        {/* Lazy CAD enrichment — fetched on first expand */}
                        <div style={styles.cadDetails}>
                          <h4 style={styles.factorsTitle}>Property Details (Dallas CAD):</h4>

                          {lead.enriching && (
                            <div style={styles.cadLoading}>
                              <span style={styles.cadSpinner}>⏳</span>
                              <span>Looking up CAD records…</span>
                            </div>
                          )}

                          {!lead.enriching && lead.cad && (
                            <div style={styles.cadGrid}>
                              {lead.cad.fullAddress && lead.cad.fullAddress !== lead.address && (
                                <div style={styles.cadRowFull}>
                                  <span style={styles.infoLabel}>Full Address:</span>
                                  <span style={styles.infoValue}>{lead.cad.fullAddress}</span>
                                </div>
                              )}
                              <div style={styles.infoRow}>
                                <span style={styles.infoLabel}>Beds:</span>
                                <span style={styles.infoValue}>{lead.cad.bedrooms ?? '—'}</span>
                              </div>
                              <div style={styles.infoRow}>
                                <span style={styles.infoLabel}>Baths:</span>
                                <span style={styles.infoValue}>{lead.cad.bathrooms ?? '—'}</span>
                              </div>
                              <div style={styles.infoRow}>
                                <span style={styles.infoLabel}>Sq Ft:</span>
                                <span style={styles.infoValue}>{lead.cad.sqft ? lead.cad.sqft.toLocaleString() : '—'}</span>
                              </div>
                              <div style={styles.infoRow}>
                                <span style={styles.infoLabel}>Year Built:</span>
                                <span style={styles.infoValue}>{lead.cad.yearBuilt ?? '—'}</span>
                              </div>
                              {lead.cad.cadValue ? (
                                <div style={styles.infoRow}>
                                  <span style={styles.infoLabel}>CAD Value:</span>
                                  <span style={styles.infoValue}>
                                    {SellerIntelligenceService.formatPropertyValue(lead.cad.cadValue)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          )}

                          {!lead.enriching && lead.cadError && (
                            <div style={styles.cadError}>
                              CAD lookup unavailable for this address. Tax-roll data above is
                              confirmed; CAD often needs a full street number.
                            </div>
                          )}

                          {!lead.enriching && lead.enriched && !lead.cad && !lead.cadError && (
                            <div style={styles.cadError}>No additional CAD records found.</div>
                          )}
                        </div>

                        {/* Skip-traced contact info — DNC-gated */}
                        <div style={styles.contactBox}>
                          <h4 style={styles.factorsTitle}>Contact (skip-trace):</h4>
                          {lead.contact && (lead.contact.phones?.length || lead.contact.emails?.length) ? (
                            <div>
                              {lead.contact.phones?.map((p, i) => (
                                <div key={i} style={styles.contactRow}>
                                  <span style={styles.infoValue}>{p.number}</span>
                                  <span style={{
                                    ...styles.dncBadge,
                                    ...(p.callable ? styles.dncClear : p.dnc === 'do_not_call' ? styles.dncBlock : styles.dncUnknown)
                                  }}>
                                    {p.callable ? '✓ callable' : p.dnc === 'do_not_call' ? '⛔ do not call' : 'DNC not verified'}
                                  </span>
                                </div>
                              ))}
                              {lead.contact.emails?.map((e, i) => (
                                <div key={i} style={styles.contactRow}><span style={styles.infoValue}>✉ {e}</span></div>
                              ))}
                              {lead.contactConfigured && !lead.contactConfigured.dnc && (
                                <div style={styles.cadError}>Numbers can't be marked callable — no DNC provider configured. Don't call until scrubbed.</div>
                              )}
                            </div>
                          ) : (
                            <div style={styles.cadError}>
                              {lead.contactError ? `Lookup failed: ${lead.contactError}`
                                : 'No contact on file. Load skip-trace results (ingest_contacts.js) or configure a provider.'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Campaign Settings Tab */}
        {activeTab === 'campaign' && (
          <div style={styles.section}>
            <div style={styles.settingsGroup}>
              <h3 style={styles.settingsTitle}>Campaign Details</h3>
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name"
                  style={styles.input}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>
                  <input
                    type="checkbox"
                    checked={campaignSettings.autoContact}
                    onChange={(e) => setCampaignSettings(prev => ({
                      ...prev,
                      autoContact: e.target.checked
                    }))}
                    style={styles.checkbox}
                  />
                  Enable automatic contact outreach
                </label>
              </div>
            </div>

            <div style={styles.settingsGroup}>
              <h3 style={styles.settingsTitle}>Outreach Settings</h3>
              
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Daily Contact Limit</label>
                <select
                  value={campaignSettings.dailyLimit}
                  onChange={(e) => setCampaignSettings(prev => ({
                    ...prev,
                    dailyLimit: parseInt(e.target.value)
                  }))}
                  style={styles.select}
                >
                  <option value={5}>5 contacts per day</option>
                  <option value={10}>10 contacts per day</option>
                  <option value={20}>20 contacts per day</option>
                  <option value={50}>50 contacts per day</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Message Template</label>
                <select
                  value={campaignSettings.messageTemplate}
                  onChange={(e) => setCampaignSettings(prev => ({
                    ...prev,
                    messageTemplate: e.target.value
                  }))}
                  style={styles.select}
                >
                  <option value="personalized">Personalized AI Messages</option>
                  <option value="professional">Professional Template</option>
                  <option value="casual">Casual Template</option>
                  <option value="custom">Custom Template</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Follow-up Interval</label>
                <select
                  value={campaignSettings.followUpDays}
                  onChange={(e) => setCampaignSettings(prev => ({
                    ...prev,
                    followUpDays: parseInt(e.target.value)
                  }))}
                  style={styles.select}
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div style={styles.actionBar}>
        <div style={styles.summaryStats}>
          <div style={styles.statItem}>
            <span style={styles.statNumber}>{getSelectedCount()}</span>
            <span style={styles.statLabel}>Selected Leads</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statNumber}>
              {leads.filter(l => l.selected && l.motivationScore >= 85).length}
            </span>
            <span style={styles.statLabel}>High Priority</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statNumber}>
              {Math.round(leads.filter(l => l.selected).reduce((acc, l) => acc + l.confidence, 0) / getSelectedCount() || 0)}%
            </span>
            <span style={styles.statLabel}>Avg Confidence</span>
          </div>
        </div>
        
        <button 
          onClick={handleEnableCampaign}
          style={styles.enableButton}
          disabled={getSelectedCount() === 0}
        >
          🚀 Enable Campaign
        </button>
      </div>
    </div>
  );
};

const styles = {
  screen: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
    display: 'flex',
    flexDirection: 'column'
  },
  loadingScreen: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)'
  },
  loadingContent: {
    textAlign: 'center',
    padding: '40px'
  },
  loadingSpinner: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  loadingTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '8px'
  },
  loadingText: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '24px'
  },
  progressBar: {
    width: '200px',
    height: '4px',
    background: '#e2e8f0',
    borderRadius: '2px',
    overflow: 'hidden',
    margin: '0 auto'
  },
  progressFill: {
    width: '60%',
    height: '100%',
    background: '#16a34a'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '20px',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(226,232,240,0.5)',
    gap: '16px'
  },
  backButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '16px',
    color: '#3b82f6',
    cursor: 'pointer',
    padding: '8px',
    fontWeight: '600'
  },
  headerContent: {
    flex: 1,
    textAlign: 'center'
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
    letterSpacing: '-0.3px'
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: '4px 0 0 0'
  },
  exportButton: {
    background: 'transparent',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '18px',
    cursor: 'pointer'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  tabContainer: {
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    border: '1px solid rgba(226,232,240,0.5)'
  },
  tabBar: {
    display: 'flex',
    gap: '4px'
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '12px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s'
  },
  tabIcon: {
    fontSize: '16px'
  },
  controls: {
    padding: '16px 20px',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  selectionControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  selectAllButton: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: '500',
    background: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  selectionCount: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '500'
  },
  filterGroup: {
    display: 'flex',
    gap: '8px'
  },
  filterButton: {
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: '500',
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  filterButtonActive: {
    background: '#16a34a',
    color: 'white',
    borderColor: '#16a34a'
  },
  sortSelect: {
    padding: '6px 12px',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: 'white',
    color: '#475569',
    cursor: 'pointer',
    outline: 'none'
  },
  leadsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  leadCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    transition: 'all 0.2s',
    display: 'flex',
    gap: '12px'
  },
  leadCardSelected: {
    borderColor: '#16a34a',
    background: 'rgba(16,163,74,0.02)'
  },
  leadCardDelinquent: {
    borderLeft: '5px solid #dc2626',
    backgroundColor: '#fff5f5',
    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)'
  },
  leadCheckbox: {
    display: 'flex',
    alignItems: 'flex-start',
    paddingTop: '4px'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  leadContent: {
    flex: 1,
    cursor: 'pointer'
  },
  leadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  leadAddress: {
    flex: 1
  },
  addressLine: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '2px'
  },
  cityLine: {
    fontSize: '13px',
    color: '#64748b'
  },
  leadScore: {
    display: 'flex',
    alignItems: 'center'
  },
  scoreCircle: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    border: '3px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'white'
  },
  scoreNumber: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b'
  },
  leadInfo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f1f5f9'
  },
  infoRow: {
    display: 'flex',
    gap: '6px',
    fontSize: '13px'
  },
  infoLabel: {
    color: '#94a3b8',
    fontWeight: '500'
  },
  infoValue: {
    color: '#475569',
    fontWeight: '600'
  },
  expandedInfo: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e2e8f0'
  },
  motivationFactors: {
    background: '#f8fafc',
    borderRadius: '8px',
    padding: '12px'
  },
  factorsTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '12px',
    margin: '0 0 12px 0'
  },
  factorItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px'
  },
  factorDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0
  },
  factorText: {
    fontSize: '13px',
    color: '#475569'
  },
  cadDetails: {
    marginTop: '12px',
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '8px',
    padding: '12px'
  },
  cadLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#0369a1',
    fontWeight: '500'
  },
  cadSpinner: {
    fontSize: '15px'
  },
  cadGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px'
  },
  cadRowFull: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: '6px',
    fontSize: '13px',
    marginBottom: '4px'
  },
  cadError: {
    fontSize: '12px',
    color: '#64748b',
    fontStyle: 'italic',
    lineHeight: 1.4
  },
  contactBox: {
    marginTop: '12px',
    background: '#fefce8',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '12px'
  },
  contactRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '6px'
  },
  dncBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  dncClear: { background: '#dcfce7', color: '#15803d' },
  dncBlock: { background: '#fee2e2', color: '#b91c1c' },
  dncUnknown: { background: '#f1f5f9', color: '#64748b' },
  enrichBanner: {
    padding: '10px 14px',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#1d4ed8'
  },
  enrichBannerDone: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#15803d'
  },
  section: {
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    border: '1px solid rgba(226,232,240,0.5)'
  },
  settingsGroup: {
    marginBottom: '24px'
  },
  settingsTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '16px',
    margin: '0 0 16px 0'
  },
  inputGroup: {
    marginBottom: '16px'
  },
  inputLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    outline: 'none',
    background: 'white',
    cursor: 'pointer',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box'
  },
  actionBar: {
    padding: '16px 20px',
    background: 'white',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px'
  },
  summaryStats: {
    display: 'flex',
    gap: '20px'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#16a34a'
  },
  statLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  enableButton: {
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(16,163,74,0.3)',
    transition: 'all 0.2s'
  },
  delinquentBadge: {
    display: 'inline-block',
    marginLeft: '12px',
    padding: '2px 8px',
    background: '#dc2626',
    color: 'white',
    fontSize: '10px',
    fontWeight: '700',
    borderRadius: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  taxDelinquentInfo: {
    gridColumn: '1 / -1',
    marginTop: '12px',
    padding: '12px',
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px'
  },
  delinquentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  delinquentIcon: {
    fontSize: '16px'
  },
  delinquentTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#991b1b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  delinquentDetails: {
    display: 'flex',
    gap: '20px'
  },
  delinquentItem: {
    display: 'flex',
    gap: '6px',
    fontSize: '12px'
  },
  delinquentLabel: {
    color: '#7f1d1d',
    fontWeight: '500'
  },
  delinquentAmount: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: '13px'
  },
  delinquentYears: {
    color: '#dc2626',
    fontWeight: '600'
  }
};

export default SellerIntelligenceResultsScreen;