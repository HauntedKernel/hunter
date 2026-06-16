import React, { useState, useEffect } from 'react';
import SellerIntelligenceService from '../../services/SellerIntelligenceService';

const SellersDashboardScreen = ({ onNavigate }) => {
  const [selectedArea, setSelectedArea] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchRadius, setSearchRadius] = useState(5);
  const [campaigns, setCampaigns] = useState([]);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [propertyTypes, setPropertyTypes] = useState({
    singleFamily: true,
    condo: false,
    townhome: false,
    multiFamily: false,
    commercial: false,
    industrial: false,
    rawLand: false
  });

  const mockAreas = [
    'Highland Park, Dallas, TX',
    'University Park, Dallas, TX',
    'Preston Hollow, Dallas, TX',
    'Lakewood, Dallas, TX',
    'Uptown, Dallas, TX',
    '75205',
    '75225',
    '75214'
  ];

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    const mockCampaigns = await SellerIntelligenceService.getCampaigns();
    setCampaigns(mockCampaigns);
  };

  const getEstimatedLeads = () => {
    const baseLeads = 45;
    const selectedTypesCount = Object.values(propertyTypes).filter(v => v).length;
    return Math.floor(baseLeads * (selectedTypesCount / 3));
  };

  const handleSearch = () => {
    const hasArea = selectedArea.trim() !== '';
    const hasPropertyTypes = Object.values(propertyTypes).some(v => v);
    
    if (!hasArea) {
      alert('Please enter a target area');
      return;
    }
    
    if (!hasPropertyTypes) {
      alert('Please select at least one property type');
      return;
    }

    onNavigate('seller_intelligence_results', {
      area: selectedArea,
      radius: searchRadius,
      propertyTypes: propertyTypes
    });
  };

  const filteredSuggestions = mockAreas.filter(area => 
    area.toLowerCase().includes(selectedArea.toLowerCase())
  );

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Find Off-Market Sellers</h1>
          <p style={styles.subtitle}>Motivated sellers from Dallas County public records</p>
        </div>
      </div>

      <div style={styles.content}>
        {/* Tab Navigation */}
        <div style={styles.tabContainer}>
          <div style={styles.tabBar}>
            {[
              { id: 'campaigns', label: 'Active Campaigns', icon: '📊' },
              { id: 'search', label: 'New Search', icon: '🔍' }
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

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div style={styles.section}>
            {campaigns.length > 0 ? (
              <div style={styles.campaignGrid}>
                {campaigns.map((campaign) => {
                  const cLeads = campaign.leads || [];
                  const avgScore = cLeads.length
                    ? Math.round(cLeads.reduce((s, l) => s + (l.motivationScore || 0), 0) / cLeads.length)
                    : 0;
                  const totalOwed = cLeads.reduce((s, l) => s + (l.amountOwed || 0), 0);
                  const created = campaign.createdAt
                    ? new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '';
                  return (
                  <div
                    key={campaign.id}
                    style={styles.campaignCard}
                    onClick={() => onNavigate('campaign_details', { campaignId: campaign.id })}
                  >
                    <div style={styles.campaignHeader}>
                      <div>
                        <div style={styles.campaignArea}>{campaign.name || campaign.area}</div>
                        {campaign.name && campaign.area && (
                          <div style={styles.campaignSubArea}>{campaign.area}</div>
                        )}
                      </div>
                      <div style={{
                        ...styles.statusBadge,
                        background: campaign.status === 'active' ? '#16a34a' :
                                   campaign.status === 'paused' ? '#f59e0b' : '#6b7280'
                      }}>
                        {campaign.status}
                      </div>
                    </div>
                    <div style={styles.campaignStats}>
                      <div style={styles.statItem}>
                        <span style={styles.statNumber}>{campaign.totalLeads ?? cLeads.length}</span>
                        <span style={styles.statLabel}>Leads</span>
                      </div>
                      <div style={styles.statItem}>
                        <span style={styles.statNumber}>{avgScore}</span>
                        <span style={styles.statLabel}>Avg Score</span>
                      </div>
                      <div style={styles.statItem}>
                        <span style={styles.statNumber}>${Math.round(totalOwed).toLocaleString()}</span>
                        <span style={styles.statLabel}>Total Owed</span>
                      </div>
                    </div>
                    <div style={styles.campaignFooter}>
                      <span style={styles.campaignDate}>Created {created}</span>
                      <span style={styles.viewDetails}>View →</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div style={styles.emptyCampaigns}>
                <p style={styles.emptyText}>No active campaigns yet</p>
                <p style={styles.emptySubtext}>Use the "New Search" tab to find motivated sellers</p>
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === 'search' && (
          <>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📍</span>
                Target Area
              </h2>
              <div style={styles.inputWrapper}>
                <input 
                  type="text"
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Enter city, neighborhood, or zip code"
                  style={styles.input}
                />
                {showSuggestions && selectedArea && filteredSuggestions.length > 0 && (
                  <div style={styles.suggestions}>
                    {filteredSuggestions.map((area, index) => (
                      <div 
                        key={index}
                        style={styles.suggestionItem}
                        onClick={() => {
                          setSelectedArea(area);
                          setShowSuggestions(false);
                        }}
                      >
                        {area}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p style={styles.helperText}>
                Example: "Highland Park, Dallas, TX" or "75205"
              </p>
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>⚙️</span>
                Search Parameters
              </h2>
              
              <div style={styles.parameterGroup}>
                <label style={styles.parameterLabel}>
                  Search Radius: {searchRadius} miles
                </label>
                <input 
                  type="range"
                  min="1"
                  max="25"
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                  style={styles.slider}
                />
                <div style={styles.sliderLabels}>
                  <span>1 mi</span>
                  <span>25 mi</span>
                </div>
              </div>

              <div style={styles.parameterGroup}>
                <label style={styles.parameterLabel}>Property Types</label>
                <div style={styles.checkboxGroup}>
                  {Object.entries({
                    singleFamily: 'Single Family',
                    condo: 'Condo',
                    townhome: 'Townhome',
                    multiFamily: 'Multi-Family',
                    commercial: 'Commercial',
                    industrial: 'Industrial',
                    rawLand: 'Raw Land'
                  }).map(([key, label]) => (
                    <label key={key} style={styles.checkboxLabel}>
                      <input 
                        type="checkbox"
                        checked={propertyTypes[key]}
                        onChange={(e) => setPropertyTypes(prev => ({
                          ...prev,
                          [key]: e.target.checked
                        }))}
                        style={styles.checkbox}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.footer}>
              <div style={styles.estimateBox}>
                <div style={styles.estimateNumber}>{getEstimatedLeads()}</div>
                <div style={styles.estimateText}>Estimated Leads</div>
              </div>
              
              <button onClick={handleSearch} style={styles.searchButton}>
                <span style={styles.searchIcon}>🔍</span>
                Find Motivated Sellers
              </button>
              
              <p style={styles.disclaimer}>
                Results powered by Dallas CAD Integration & AI analysis
              </p>
              
              <div style={styles.cadIndicator}>
                <div style={styles.cadBadge}>
                  <span style={styles.cadIcon}>🏛️</span>
                  <span style={styles.cadText}>Dallas CAD Live Data</span>
                  <span style={styles.cadStatus}>●</span>
                </div>
              </div>
            </div>
          </>
        )}
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
    flexDirection: 'column',
    position: 'relative'
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
  headerSpacer: {
    width: '60px'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  tabContainer: {
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    border: '1px solid rgba(226,232,240,0.5)',
    marginBottom: '20px'
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
  section: {
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    border: '1px solid rgba(226,232,240,0.5)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0
  },
  sectionIcon: {
    fontSize: '20px'
  },
  newCampaignButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  campaignGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  campaignCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      transform: 'translateY(-2px)'
    }
  },
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  campaignArea: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1e293b'
  },
  campaignSubArea: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '2px'
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    color: 'white',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  campaignStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid #f1f5f9'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statNumber: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1e293b'
  },
  statLabel: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '2px'
  },
  campaignFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  campaignDate: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  viewDetails: {
    fontSize: '12px',
    color: '#16a34a',
    fontWeight: '600'
  },
  emptyCampaigns: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  emptyText: {
    fontSize: '14px',
    color: '#475569',
    marginBottom: '8px'
  },
  emptySubtext: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  inputWrapper: {
    position: 'relative'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box'
  },
  suggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginTop: '4px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 10
  },
  suggestionItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#475569',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.2s'
  },
  helperText: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '8px',
    marginBottom: 0
  },
  parameterGroup: {
    marginBottom: '20px'
  },
  parameterLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '12px',
    display: 'block'
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    outline: 'none',
    marginTop: '8px',
    WebkitAppearance: 'none',
    appearance: 'none',
    background: '#e2e8f0'
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#94a3b8',
    marginTop: '4px'
  },
  checkboxGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#475569',
    cursor: 'pointer'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  footer: {
    padding: '20px',
    borderTop: '1px solid rgba(226,232,240,0.5)',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px'
  },
  estimateBox: {
    background: 'linear-gradient(135deg, rgba(16,163,74,0.1), rgba(59,130,246,0.05))',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    marginBottom: '16px',
    border: '1px solid rgba(16,163,74,0.2)'
  },
  estimateNumber: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#16a34a',
    letterSpacing: '-1px'
  },
  estimateText: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px'
  },
  searchButton: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(16,163,74,0.3)',
    transition: 'transform 0.2s'
  },
  searchIcon: {
    fontSize: '18px'
  },
  disclaimer: {
    fontSize: '11px',
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: '12px',
    marginBottom: 0
  },
  cadIndicator: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '12px'
  },
  cadBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '20px',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600'
  },
  cadIcon: {
    fontSize: '12px'
  },
  cadText: {
    color: '#3b82f6'
  },
  cadStatus: {
    color: '#10b981',
    fontSize: '8px',
    animation: 'pulse 2s infinite'
  }
};

export default SellersDashboardScreen;