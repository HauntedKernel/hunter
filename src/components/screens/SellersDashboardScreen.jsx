import React, { useState, useEffect } from 'react';
import SellerIntelligenceService from '../../services/SellerIntelligenceService';

const SellersDashboardScreen = ({ onNavigate }) => {
  const [selectedArea, setSelectedArea] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchRadius, setSearchRadius] = useState(5);
  const [campaigns, setCampaigns] = useState([]);
  const [activeTab, setActiveTab] = useState('search');

  // Texas property records don't distinguish house/condo/townhome (all are
  // state category "A"), so we offer one Residential toggle rather than three
  // that would return identical results.
  const [propertyTypes, setPropertyTypes] = useState({
    residential: true,
    multiFamily: false,
    commercial: false,
    industrial: false,
    rawLand: false
  });

  // Motivation signals to hunt for (drives the backend discovery query).
  const [signals, setSignals] = useState({
    preForeclosure: true,
    delinquent: true,
    elderly: true,
    absentee: true,
    emptyNester: true
  });

  // Quick-fill suggestions for the area input — real Dallas neighborhoods/ZIPs.
  const areaSuggestions = [
    'Highland Park, Dallas, TX',
    'University Park, Dallas, TX',
    'Preston Hollow, Dallas, TX',
    'Lakewood, Dallas, TX',
    'Uptown, Dallas, TX',
    '75205', '75225', '75214'
  ];

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    const saved = await SellerIntelligenceService.getCampaigns();
    setCampaigns(saved);
  };

  const handleSearch = () => {
    if (selectedArea.trim() === '') { alert('Please enter a target area'); return; }
    if (!Object.values(propertyTypes).some(v => v)) { alert('Please select at least one property type'); return; }
    if (!Object.values(signals).some(v => v)) { alert('Please select at least one motivation signal'); return; }

    onNavigate('seller_intelligence_results', {
      area: selectedArea,
      radius: searchRadius,
      propertyTypes,
      signals
    });
  };

  const filteredSuggestions = areaSuggestions.filter(area =>
    area.toLowerCase().includes(selectedArea.toLowerCase())
  );

  const propertyTypeLabels = {
    residential: 'Residential (house / condo / townhome)',
    multiFamily: 'Multi-Family',
    commercial: 'Commercial',
    industrial: 'Industrial',
    rawLand: 'Raw Land'
  };

  const signalDefs = [
    { key: 'preForeclosure', icon: '⚖️', label: 'Pre-Foreclosure', desc: 'Notice of trustee sale / lis pendens' },
    { key: 'delinquent', icon: '🔴', label: 'Tax Delinquent', desc: 'Owes back property taxes' },
    { key: 'elderly', icon: '👵', label: 'Elderly / Disabled', desc: 'Over-65 or disability exemption' },
    { key: 'absentee', icon: '🏚️', label: 'Absentee Owner', desc: 'Mailing address differs from the property' },
    { key: 'emptyNester', icon: '🪺', label: 'Empty Nester', desc: 'Voter file: kids likely moved out' }
  ];

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Find off-market sellers</h1>
          <p className="page-sub">Motivated sellers from Dallas County public records</p>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'search', label: '🔍 New Search' },
          { id: 'campaigns', label: '📊 Active Campaigns' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- New Search ---- */}
      {activeTab === 'search' && (
        <div className="card" style={{ padding: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s5)' }}>
          <div style={{ position: 'relative', maxWidth: 520 }}>
            <label className="field-label">Target area</label>
            <input
              className="input"
              type="text"
              value={selectedArea}
              onChange={(e) => { setSelectedArea(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="City, neighborhood, or ZIP — e.g. Highland Park or 75205"
            />
            {showSuggestions && selectedArea && filteredSuggestions.length > 0 && (
              <div className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20, overflow: 'hidden' }}>
                {filteredSuggestions.map((area, i) => (
                  <div
                    key={i}
                    style={{ padding: '10px 12px', cursor: 'pointer' }}
                    onMouseDown={() => { setSelectedArea(area); setShowSuggestions(false); }}
                  >
                    {area}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--s5)' }}>
            {/* Property types */}
            <div>
              <label className="field-label">Property types</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(propertyTypeLabels).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={propertyTypes[key]}
                      onChange={(e) => setPropertyTypes(prev => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Motivation signals */}
            <div>
              <label className="field-label">Motivation signals</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {signalDefs.map(sig => (
                  <label key={sig.key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', boxShadow: 'none' }}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={signals[sig.key]}
                      onChange={(e) => setSignals(prev => ({ ...prev, [sig.key]: e.target.checked }))}
                    />
                    <span style={{ fontSize: 18 }}>{sig.icon}</span>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{sig.label}</span>
                      <span className="page-sub" style={{ fontSize: 12 }}>{sig.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 320 }}>
            <label className="field-label">Search radius: {searchRadius} miles</label>
            <input type="range" min="1" max="25" value={searchRadius} onChange={(e) => setSearchRadius(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--brand)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={handleSearch}>
              🔍 Find motivated sellers
            </button>
            <span className="badge badge-signal">🏛️ Live Dallas County tax roll</span>
          </div>
        </div>
      )}

      {/* ---- Active Campaigns ---- */}
      {activeTab === 'campaigns' && (
        campaigns.length > 0 ? (
          <div className="card-grid">
            {campaigns.map((campaign) => {
              const cLeads = campaign.leads || [];
              const avgScore = cLeads.length ? Math.round(cLeads.reduce((s, l) => s + (l.motivationScore || 0), 0) / cLeads.length) : 0;
              const totalOwed = cLeads.reduce((s, l) => s + (l.amountOwed || 0), 0);
              const created = campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              return (
                <div key={campaign.id} className="card" style={{ padding: 'var(--s4)', cursor: 'pointer' }} onClick={() => onNavigate('campaign_details', { campaignId: campaign.id })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{campaign.name || campaign.area}</div>
                      {campaign.name && campaign.area && <div className="page-sub" style={{ fontSize: 13 }}>{campaign.area}</div>}
                    </div>
                    <span className="badge badge-signal">{campaign.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--s5)', marginTop: 'var(--s4)' }}>
                    <div><div style={{ fontWeight: 800, fontSize: 18 }}>{campaign.totalLeads ?? cLeads.length}</div><div className="page-sub" style={{ fontSize: 12 }}>Leads</div></div>
                    <div><div style={{ fontWeight: 800, fontSize: 18 }}>{avgScore}</div><div className="page-sub" style={{ fontSize: 12 }}>Avg score</div></div>
                    <div><div style={{ fontWeight: 800, fontSize: 18 }}>${Math.round(totalOwed).toLocaleString()}</div><div className="page-sub" style={{ fontSize: 12 }}>Total owed</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--s4)', borderTop: '1px solid var(--line-2)', paddingTop: 'var(--s3)' }}>
                    <span className="page-sub" style={{ fontSize: 12 }}>Created {created}</span>
                    <span style={{ color: 'var(--brand-dark)', fontWeight: 600, fontSize: 13 }}>View →</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card empty-state">
            <p style={{ fontWeight: 600 }}>No saved campaigns yet</p>
            <p className="page-sub">Run a search and save selected leads to start a campaign.</p>
          </div>
        )
      )}
    </div>
  );
};

export default SellersDashboardScreen;
