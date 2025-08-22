import React, { useState, useEffect } from 'react';
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
      setLeads(result.leads);
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

  const handleEnableCampaign = () => {
    const selectedLeads = leads.filter(lead => lead.selected);
    if (selectedLeads.length === 0) {
      alert('Please select at least one lead to create a campaign');
      return;
    }
    
    if (!campaignName.trim()) {
      alert('Please enter a campaign name');
      return;
    }

    // Here you would save the campaign
    alert(`Campaign "${campaignName}" created with ${selectedLeads.length} leads!`);
    onNavigate('seller_intelligence_area');
  };

  const handleExport = async () => {
    const selectedLeads = leads.filter(lead => lead.selected);
    if (selectedLeads.length === 0) {
      alert('Please select leads to export');
      return;
    }
    
    const exportData = await SellerIntelligenceService.exportLeads(selectedLeads, 'csv');
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
                    ...(lead.selected ? styles.leadCardSelected : {})
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
                    onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                  >
                    <div style={styles.leadHeader}>
                      <div style={styles.leadAddress}>
                        <div style={styles.addressLine}>{lead.address}</div>
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
  }
};

export default SellerIntelligenceResultsScreen;