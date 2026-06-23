import React, { useState, useEffect } from 'react';
import SellerIntelligenceService from '../../services/SellerIntelligenceService';

// Shows a real saved campaign: the leads the realtor picked, with the search
// that found them. No mock outreach data — only what was actually saved.
const CampaignDetailsScreen = ({ onNavigate, campaignId }) => {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCampaignDetails(); }, [campaignId]);

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
      <div className="container">
        <div className="loading-wrap"><div className="spinner"></div><p className="page-sub">Loading campaign…</p></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container">
        <div className="card empty-state">
          <p style={{ fontWeight: 600 }}>Campaign not found.</p>
          <button className="btn btn-ghost" onClick={() => onNavigate('sellers_dashboard')}>← Back to dashboard</button>
        </div>
      </div>
    );
  }

  const leads = campaign.leads || [];
  const avgScore = leads.length ? Math.round(leads.reduce((s, l) => s + (l.motivationScore || 0), 0) / leads.length) : 0;
  const totalOwed = leads.reduce((s, l) => s + (l.amountOwed || 0), 0);
  const created = campaign.createdAt
    ? new Date(campaign.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('sellers_dashboard')}>← Back</button>
          <h1 className="page-title" style={{ marginTop: 6 }}>{campaign.name || campaign.area}</h1>
          <p className="page-sub">{campaign.area} · saved {created}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s3)' }}>
          <button className="btn" onClick={handleExport}>📥 Export CSV</button>
          <button className="btn" style={{ color: 'var(--danger)', borderColor: '#fca5a5' }} onClick={handleDelete}>🗑 Delete</button>
        </div>
      </div>

      <div className="card-grid" style={{ marginBottom: 'var(--s5)' }}>
        <div className="card" style={{ padding: 'var(--s4)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-dark)' }}>{leads.length}</div>
          <div className="page-sub" style={{ fontSize: 12 }}>Leads</div>
        </div>
        <div className="card" style={{ padding: 'var(--s4)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-dark)' }}>{avgScore}</div>
          <div className="page-sub" style={{ fontSize: 12 }}>Avg motivation</div>
        </div>
        <div className="card" style={{ padding: 'var(--s4)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand-dark)' }}>{fmtMoney(totalOwed)}</div>
          <div className="page-sub" style={{ fontSize: 12 }}>Total owed</div>
        </div>
      </div>

      <h2 className="page-title" style={{ fontSize: 16, marginBottom: 'var(--s4)' }}>Saved leads ({leads.length})</h2>
      <div className="card-grid">
        {leads.map((lead, i) => (
          <div key={lead.id || i} className="card" style={{ padding: 'var(--s4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>{lead.fullAddress || lead.address}</div>
              <span className="badge badge-signal">{lead.motivationScore ?? '—'}</span>
            </div>
            <div className="page-sub" style={{ fontSize: 13, marginTop: 2 }}>{lead.ownerName || 'Unknown owner'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, fontSize: 12 }}>
              {lead.amountOwed > 0 && (
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {fmtMoney(lead.amountOwed)} owed{lead.yearsDelinquent ? ` · ${lead.yearsDelinquent}yr` : ''}</span>
              )}
              {lead.propertyValue > 0 && <span className="page-sub">Value {fmtMoney(lead.propertyValue)}</span>}
              {lead.urgencyScore != null && <span className="page-sub">Urgency {lead.urgencyScore}</span>}
            </div>
            {(lead.bedrooms || lead.bathrooms || lead.sqft || lead.yearBuilt) && (
              <div className="page-sub" style={{ fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line-2)' }}>
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
  );
};

export default CampaignDetailsScreen;
