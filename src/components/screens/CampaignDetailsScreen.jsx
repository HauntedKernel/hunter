import React, { useState, useEffect } from 'react';
import SellerIntelligenceService from '../../services/SellerIntelligenceService';

// Shows a real saved campaign: the leads the realtor picked, with the search
// that found them. No mock outreach data — only what was actually saved.
const CampaignDetailsScreen = ({ onNavigate, campaignId }) => {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async () => {
    if (!window.confirm(`Delete campaign "${campaign.name || campaign.area}"? This can't be undone.`)) return;
    await SellerIntelligenceService.deleteCampaign(campaignId);
    onNavigate('sellers_dashboard');
  };

  const handleExport = async () => {
    const exportData = await SellerIntelligenceService.exportLeads(campaign.leads || [], 'csv');
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

  const fmtMoney = (v) => '$' + Math.round(v || 0).toLocaleString();

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingContent}>
          <div style={styles.loadingSpinner}>⚡</div>
          <h2 style={styles.loadingTitle}>Loading Campaign</h2>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={styles.errorScreen}>
        <p>Campaign not found.</p>
        <button onClick={() => onNavigate('sellers_dashboard')} style={styles.linkButton}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const leads = campaign.leads || [];
  const avgScore = leads.length
    ? Math.round(leads.reduce((s, l) => s + (l.motivationScore || 0), 0) / leads.length)
    : 0;
  const totalOwed = leads.reduce((s, l) => s + (l.amountOwed || 0), 0);
  const created = campaign.createdAt
    ? new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <button onClick={() => onNavigate('sellers_dashboard')} style={styles.backButton}>
          ← Back
        </button>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>{campaign.name || campaign.area}</h1>
          <p style={styles.subtitle}>{campaign.area} · saved {created}</p>
        </div>
        <div style={styles.headerSpacer}></div>
      </div>

      <div style={styles.content}>
        {/* Real campaign stats */}
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{leads.length}</div>
            <div style={styles.statLabel}>Leads</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{avgScore}</div>
            <div style={styles.statLabel}>Avg Motivation</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statNumber}>{fmtMoney(totalOwed)}</div>
            <div style={styles.statLabel}>Total Owed</div>
          </div>
        </div>

        <div style={styles.actionsRow}>
          <button onClick={handleExport} style={styles.exportButton}>📥 Export CSV</button>
          <button onClick={handleDelete} style={styles.deleteButton}>🗑 Delete</button>
        </div>

        {/* Leads */}
        <h2 style={styles.sectionTitle}>Saved Leads ({leads.length})</h2>
        <div style={styles.leadsList}>
          {leads.map((lead, i) => (
            <div key={lead.id || i} style={styles.leadCard}>
              <div style={styles.leadTop}>
                <div style={styles.leadAddress}>{lead.fullAddress || lead.address}</div>
                <div style={styles.scoreBadge}>{lead.motivationScore ?? '—'}</div>
              </div>
              <div style={styles.leadOwner}>{lead.ownerName || 'Unknown Owner'}</div>
              <div style={styles.leadMeta}>
                {lead.amountOwed > 0 && (
                  <span style={styles.metaOwed}>⚠️ {fmtMoney(lead.amountOwed)} owed
                    {lead.yearsDelinquent ? ` · ${lead.yearsDelinquent}yr` : ''}</span>
                )}
                {lead.propertyValue > 0 && <span style={styles.metaItem}>Value {fmtMoney(lead.propertyValue)}</span>}
                {lead.urgencyScore != null && <span style={styles.metaItem}>Urgency {lead.urgencyScore}</span>}
              </div>
              {(lead.bedrooms || lead.bathrooms || lead.sqft || lead.yearBuilt) && (
                <div style={styles.leadDetail}>
                  {lead.bedrooms ? `${lead.bedrooms} bd` : ''}
                  {lead.bathrooms ? ` · ${lead.bathrooms} ba` : ''}
                  {lead.sqft ? ` · ${Number(lead.sqft).toLocaleString()} sqft` : ''}
                  {lead.yearBuilt ? ` · built ${lead.yearBuilt}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
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
    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)'
  },
  loadingContent: { textAlign: 'center' },
  loadingSpinner: { fontSize: '48px', marginBottom: '20px' },
  loadingTitle: { fontSize: '20px', fontWeight: '700', color: '#1e293b' },
  errorScreen: {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#475569'
  },
  linkButton: {
    background: 'transparent', border: 'none', color: '#16a34a',
    fontSize: '15px', fontWeight: '600', cursor: 'pointer'
  },
  header: {
    display: 'flex', alignItems: 'center', padding: '20px',
    background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(226,232,240,0.5)', gap: '16px'
  },
  backButton: {
    background: 'transparent', border: 'none', fontSize: '16px',
    color: '#16a34a', cursor: 'pointer', padding: '8px', fontWeight: '600'
  },
  headerContent: { flex: 1, textAlign: 'center' },
  title: { fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0, letterSpacing: '-0.3px' },
  subtitle: { fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' },
  headerSpacer: { width: '40px' },
  content: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  statCard: {
    background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center',
    border: '1px solid #e2e8f0'
  },
  statNumber: { fontSize: '20px', fontWeight: '700', color: '#16a34a', letterSpacing: '-0.5px' },
  statLabel: { fontSize: '11px', color: '#64748b', marginTop: '4px' },
  actionsRow: { display: 'flex', gap: '10px' },
  exportButton: {
    flex: 1, padding: '12px', background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px',
    fontWeight: '700', cursor: 'pointer'
  },
  deleteButton: {
    padding: '12px 16px', background: 'white', color: '#dc2626',
    border: '1px solid #fca5a5', borderRadius: '10px', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer'
  },
  sectionTitle: { fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 },
  leadsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  leadCard: {
    background: 'white', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0'
  },
  leadTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
  leadAddress: { fontSize: '15px', fontWeight: '600', color: '#1e293b' },
  scoreBadge: {
    background: '#f0fdf4', color: '#15803d', borderRadius: '8px',
    padding: '2px 10px', fontSize: '14px', fontWeight: '700', flexShrink: 0
  },
  leadOwner: { fontSize: '13px', color: '#475569', marginTop: '4px' },
  leadMeta: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px', fontSize: '12px' },
  metaOwed: { color: '#dc2626', fontWeight: '600' },
  metaItem: { color: '#64748b', fontWeight: '500' },
  leadDetail: {
    marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9',
    fontSize: '12px', color: '#475569'
  }
};

export default CampaignDetailsScreen;
