import React, { useState, useEffect } from 'react';
import SellerIntelligenceService from '../../services/SellerIntelligenceService';

const CampaignDetailsScreen = ({ onNavigate, campaignId }) => {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('all');

  useEffect(() => {
    loadCampaignDetails();
  }, [campaignId]);

  const loadCampaignDetails = async () => {
    setLoading(true);
    try {
      const details = await SellerIntelligenceService.getCampaignDetails(campaignId);
      setCampaign(details);
    } catch (error) {
      console.error('Error loading campaign details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'responded': return '#16a34a';
      case 'contacted': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'no-response': return '#6b7280';
      default: return '#94a3b8';
    }
  };

  const getChannelIcon = (channel) => {
    switch(channel) {
      case 'phone': return '📞';
      case 'email': return '📧';
      case 'text': return '💬';
      case 'mail': return '📬';
      default: return '📱';
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}>⚡</div>
          <h2 style={styles.loadingTitle}>Loading Campaign Details</h2>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={styles.errorScreen}>
        <p>Campaign not found</p>
        <button onClick={() => onNavigate('sellers_dashboard')} style={styles.backButton}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const filteredLeads = selectedChannel === 'all' 
    ? campaign.leads 
    : campaign.leads.filter(lead => {
        // Filter logic based on channel activity
        return true; // Simplified for now
      });

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button onClick={() => onNavigate('sellers_dashboard')} style={styles.backButton}>
          ← Back
        </button>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>{campaign.area}</h1>
          <p style={styles.subtitle}>Campaign Dashboard</p>
        </div>
        <div style={styles.headerSpacer}></div>
      </div>

      <div style={styles.content}>
        {/* Tab Navigation - 2x2 Grid */}
        <div style={styles.tabGrid}>
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'leads', label: 'Lead Details' },
            { id: 'responses', label: 'Responses' },
            { id: 'settings', label: 'Settings' }
          ].map(tab => (
            <button
              key={tab.id}
              style={{
                ...styles.tabCard,
                ...(activeTab === tab.id ? styles.tabCardActive : {})
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <div style={{
                ...styles.tabCardLabel,
                color: activeTab === tab.id ? 'white' : '#475569'
              }}>{tab.label}</div>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div style={styles.channelsContainer}>
            {Object.entries(campaign.contactChannels).map(([channel, data]) => (
              <div key={channel} style={styles.channelCard}>
                <div style={styles.channelHeader}>
                  <div style={styles.channelName}>{channel.charAt(0).toUpperCase() + channel.slice(1)}</div>
                </div>
                
                <div style={styles.channelStats}>
                  <div style={styles.channelStat}>
                    <div style={styles.channelStatNumber}>{data.attempts}</div>
                    <div style={styles.channelStatLabel}>Total Attempts</div>
                  </div>
                  <div style={styles.channelStat}>
                    <div style={styles.channelStatNumber}>{data.successful}</div>
                    <div style={styles.channelStatLabel}>Successful</div>
                  </div>
                  <div style={styles.channelStat}>
                    <div style={styles.channelStatNumber}>{data.responses}</div>
                    <div style={styles.channelStatLabel}>Responses</div>
                  </div>
                  <div style={styles.channelStat}>
                    <div style={styles.channelStatNumber}>
                      {data.attempts > 0 ? Math.round((data.responses / data.attempts) * 100) : 0}%
                    </div>
                    <div style={styles.channelStatLabel}>Response Rate</div>
                  </div>
                </div>

                <div style={styles.channelPerformance}>
                  <div style={styles.performanceLabel}>Success Rate</div>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${data.attempts > 0 ? (data.successful / data.attempts) * 100 : 0}%`
                    }}></div>
                  </div>
                  <div style={styles.performanceValue}>
                    {data.attempts > 0 ? Math.round((data.successful / data.attempts) * 100) : 0}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div style={styles.leadsContainer}>
            <div style={styles.leadsHeader}>
              <input
                type="text"
                placeholder="Search leads..."
                style={styles.searchInput}
              />
              <select style={styles.filterSelect} onChange={(e) => setSelectedChannel(e.target.value)}>
                <option value="all">All</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="text">Text</option>
                <option value="mail">Mail</option>
              </select>
            </div>

            <div style={styles.leadsList}>
              {campaign.leads.map((lead) => (
                <div 
                  key={lead.id} 
                  style={styles.leadCard}
                  onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                >
                  <div style={styles.leadHeader}>
                    <div style={styles.leadInfo}>
                      <div style={styles.leadName}>{lead.name}</div>
                      <div style={styles.leadAddress}>{lead.address}</div>
                      <div style={styles.leadContact}>
                        <span style={styles.contactItem}>{lead.phone}</span>
                        <span style={styles.contactItem}>{lead.email}</span>
                      </div>
                    </div>
                    <div style={styles.leadStats}>
                      <div style={{
                        ...styles.leadStatus,
                        background: getStatusColor(lead.status)
                      }}>
                        {lead.status.replace('-', ' ')}
                      </div>
                      <div style={styles.leadScore}>
                        Score: {lead.motivationScore}
                      </div>
                    </div>
                  </div>

                  <div style={styles.leadActivity}>
                    <div style={styles.activityItem}>
                      <span style={styles.activityLabel}>Last Contact:</span>
                      <span style={styles.activityValue}>{lead.lastContact}</span>
                    </div>
                    <div style={styles.activityItem}>
                      <span style={styles.activityLabel}>Attempts:</span>
                      <span style={styles.activityValue}>{lead.contactAttempts}</span>
                    </div>
                    {lead.response && (
                      <div style={styles.responseBox}>
                        <span style={styles.responseLabel}>Response:</span>
                        <span style={styles.responseText}>{lead.response}</span>
                      </div>
                    )}
                  </div>

                  {selectedLead?.id === lead.id && (
                    <div style={styles.expandedDetails}>
                      <div style={styles.contactHistory}>
                        <h4 style={styles.historyTitle}>Contact History</h4>
                        <div style={styles.historyList}>
                          <div style={styles.historyItem}>
                            <span style={styles.historyText}>Phone: Called 2 days ago - No answer</span>
                          </div>
                          <div style={styles.historyItem}>
                            <span style={styles.historyText}>Email: Sent 3 days ago - Opened</span>
                          </div>
                          <div style={styles.historyItem}>
                            <span style={styles.historyText}>Text: Sent 1 day ago - Delivered</span>
                          </div>
                        </div>
                      </div>
                      <div style={styles.actionButtons}>
                        <button style={styles.contactButton}>Call Now</button>
                        <button style={styles.contactButton}>Send Email</button>
                        <button style={styles.contactButton}>Send Text</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={styles.settingsContainer}>
            <div style={styles.settingsSection}>
              <h3 style={styles.settingsTitle}>Campaign Settings</h3>
              
              <div style={styles.settingItem}>
                <label style={styles.settingLabel}>Campaign Status</label>
                <select style={styles.settingSelect}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div style={styles.settingItem}>
                <label style={styles.settingLabel}>Daily Contact Limit</label>
                <input type="number" defaultValue="10" style={styles.settingInput} />
              </div>

              <div style={styles.settingItem}>
                <label style={styles.settingLabel}>Auto-Contact</label>
                <select style={styles.settingSelect}>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div style={styles.settingItem}>
                <label style={styles.settingLabel}>Follow-up Interval (days)</label>
                <input type="number" defaultValue="3" style={styles.settingInput} />
              </div>
            </div>

            <div style={styles.settingsSection}>
              <h3 style={styles.settingsTitle}>Message Templates</h3>
              
              <div style={styles.settingItem}>
                <label style={styles.settingLabel}>Template Type</label>
                <select style={styles.settingSelect}>
                  <option value="personalized">Personalized AI</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div style={styles.settingsActions}>
              <button style={styles.saveButton}>Save Changes</button>
              <button style={styles.cancelButton}>Cancel</button>
            </div>
          </div>
        )}

        {/* Responses Tab */}
        {activeTab === 'responses' && (
          <div style={styles.responsesContainer}>
            <div style={styles.responsesSummary}>
              <h3 style={styles.summaryTitle}>Response Summary</h3>
              <div style={styles.summaryStats}>
                <div style={styles.summaryStat}>
                  <span style={styles.summaryNumber}>{campaign.responses}</span>
                  <span style={styles.summaryLabel}>Total Responses</span>
                </div>
                <div style={styles.summaryStat}>
                  <span style={styles.summaryNumber}>3</span>
                  <span style={styles.summaryLabel}>Hot Leads</span>
                </div>
                <div style={styles.summaryStat}>
                  <span style={styles.summaryNumber}>2</span>
                  <span style={styles.summaryLabel}>Scheduled Meetings</span>
                </div>
              </div>
            </div>

            <div style={styles.responsesList}>
              {campaign.leads.filter(lead => lead.response).map((lead) => (
                <div key={lead.id} style={styles.responseCard}>
                  <div style={styles.responseHeader}>
                    <div style={styles.responseLeadInfo}>
                      <div style={styles.responseLeadName}>{lead.name}</div>
                      <div style={styles.responseTime}>{lead.lastContact}</div>
                    </div>
                    <div style={{
                      ...styles.responseStatus,
                      background: getStatusColor(lead.status)
                    }}>
                      {lead.status}
                    </div>
                  </div>
                  <div style={styles.responseContent}>
                    <p style={styles.responseMessage}>{lead.response}</p>
                  </div>
                  <div style={styles.responseActions}>
                    <button style={styles.responseButton}>Follow Up</button>
                    <button style={styles.responseButton}>Schedule Meeting</button>
                    <button style={styles.responseButton}>Add Note</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
    textAlign: 'center'
  },
  loadingSpinner: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  loadingTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b'
  },
  errorScreen: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px'
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
  headerStats: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '8px'
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
    textTransform: 'uppercase'
  },
  headerStat: {
    fontSize: '13px',
    color: '#64748b'
  },
  actionButton: {
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
    padding: '20px'
  },
  tabGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '10px',
    marginBottom: '20px',
    maxWidth: '400px',
    margin: '0 auto 20px auto'
  },
  tabCard: {
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
    borderRadius: '12px',
    padding: '16px 20px',
    border: '1px solid rgba(226,232,240,0.5)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    minHeight: '60px'
  },
  tabCardActive: {
    background: '#16a34a',
    borderColor: '#16a34a',
    boxShadow: '0 4px 12px rgba(16,163,74,0.25)'
  },
  tabCardIcon: {
    fontSize: '32px'
  },
  tabCardLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center'
  },
  overviewContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px'
  },
  statCard: {
    background: 'white',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #e2e8f0'
  },
  statIcon: {
    fontSize: '32px'
  },
  statContent: {
    width: '100%'
  },
  statNumber: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '6px',
    fontWeight: '500'
  },
  statSubtext: {
    fontSize: '11px',
    color: '#94a3b8'
  },
  performanceChart: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0'
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '20px',
    margin: '0 0 20px 0'
  },
  chartContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  performanceBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  barLabel: {
    fontSize: '14px',
    color: '#475569',
    width: '120px'
  },
  barContainer: {
    flex: 1,
    height: '24px',
    background: '#f1f5f9',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    transition: 'width 0.3s'
  },
  barValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    width: '50px',
    textAlign: 'right'
  },
  leadsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  leadsHeader: {
    display: 'flex',
    gap: '10px',
    marginBottom: '12px'
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    outline: 'none',
    minWidth: 0
  },
  filterSelect: {
    padding: '8px 10px',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '80px',
    maxWidth: '100px'
  },
  leadsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  leadCard: {
    background: 'white',
    borderRadius: '10px',
    padding: '14px',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  leadHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  leadInfo: {
    flex: 1
  },
  leadName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '2px'
  },
  leadAddress: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '6px'
  },
  leadContact: {
    display: 'flex',
    gap: '12px',
    fontSize: '11px',
    color: '#475569'
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  leadStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px'
  },
  leadStatus: {
    padding: '4px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize'
  },
  leadScore: {
    fontSize: '13px',
    color: '#64748b',
    fontWeight: '600'
  },
  leadActivity: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  activityItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '13px'
  },
  activityLabel: {
    color: '#94a3b8'
  },
  activityValue: {
    color: '#475569',
    fontWeight: '500'
  },
  responseBox: {
    background: '#f0fdf4',
    borderRadius: '8px',
    padding: '8px 12px',
    marginTop: '8px'
  },
  responseLabel: {
    fontSize: '12px',
    color: '#16a34a',
    fontWeight: '600',
    marginRight: '8px'
  },
  responseText: {
    fontSize: '13px',
    color: '#15803d'
  },
  expandedDetails: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0'
  },
  contactHistory: {
    marginBottom: '16px'
  },
  historyTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '12px',
    margin: '0 0 12px 0'
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  historyItem: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '6px'
  },
  historyIcon: {
    fontSize: '16px'
  },
  historyText: {
    lineHeight: '1.4'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px'
  },
  contactButton: {
    flex: 1,
    padding: '6px 10px',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center'
  },
  channelsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px'
  },
  channelCard: {
    background: 'white',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #e2e8f0'
  },
  channelHeader: {
    marginBottom: '16px'
  },
  channelIcon: {
    fontSize: '32px'
  },
  channelName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b'
  },
  channelStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '16px'
  },
  channelStat: {
    textAlign: 'center'
  },
  channelStatNumber: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#16a34a'
  },
  channelStatLabel: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
  },
  channelPerformance: {
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9'
  },
  performanceLabel: {
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '8px'
  },
  progressBar: {
    height: '8px',
    background: '#f1f5f9',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: '#16a34a',
    transition: 'width 0.3s'
  },
  performanceValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    marginTop: '8px',
    textAlign: 'right'
  },
  responsesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  responsesSummary: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0'
  },
  summaryTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '16px',
    margin: '0 0 16px 0'
  },
  summaryStats: {
    display: 'flex',
    gap: '32px'
  },
  summaryStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  summaryNumber: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#16a34a'
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '4px'
  },
  responsesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  responseCard: {
    background: 'white',
    borderRadius: '10px',
    padding: '14px',
    border: '1px solid #e2e8f0'
  },
  responseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  responseLeadInfo: {
    flex: 1
  },
  responseLeadName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b'
  },
  responseTime: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px'
  },
  responseStatus: {
    padding: '4px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white'
  },
  responseContent: {
    marginBottom: '16px'
  },
  responseMessage: {
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.5',
    margin: 0
  },
  responseActions: {
    display: 'flex',
    gap: '8px'
  },
  responseButton: {
    flex: 1,
    padding: '6px 10px',
    background: 'transparent',
    color: '#3b82f6',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'center'
  },
  settingsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  settingsSection: {
    background: 'white',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #e2e8f0'
  },
  settingsTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '16px',
    margin: '0 0 16px 0'
  },
  settingItem: {
    marginBottom: '14px'
  },
  settingLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '6px'
  },
  settingSelect: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    background: 'white',
    color: '#1e293b',
    cursor: 'pointer',
    outline: 'none'
  },
  settingInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    outline: 'none',
    boxSizing: 'border-box'
  },
  settingsActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '20px'
  },
  saveButton: {
    flex: 1,
    padding: '10px 16px',
    background: '#16a34a',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelButton: {
    flex: 1,
    padding: '10px 16px',
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  headerSpacer: {
    width: '40px'
  }
};

export default CampaignDetailsScreen;