// Base URL for the backend API.
//   - Dev (`npm run dev`): VITE_API_BASE is unset -> '' -> relative '/api/...'
//     which the Vite dev-server proxy forwards to localhost:3001.
//   - Production (static build on Cloudflare Pages): set VITE_API_BASE to the
//     backend's public URL (named tunnel or VPS), e.g. https://api.hunter.app
const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

class SellerIntelligenceService {

  /**
   * Search for delinquent properties in area using Dallas County tax records
   * Integrates with our backend Property Intelligence API
   */
  static async searchDallasCADLeads(params) {
    const { area, radius, propertyTypes, signals } = params;
    
    try {
      console.log('🔍 Searching for delinquent properties in:', area);
      
      // Search for delinquent properties directly using Dallas County tax records
      const response = await fetch(`${API_BASE}/api/property/delinquent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          area: area,
          options: {
            radius: radius,
            propertyTypes: propertyTypes,
            signals: signals
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Dallas CAD API error: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('📥 Dallas CAD API Response:', {
        success: data.success,
        hasData: !!data.data,
        allResultsCount: data.data?.allResults?.length || 0,
        motivatedSellersCount: data.data?.motivatedSellers?.length || 0
      });
      
      if (!data.success) {
        throw new Error(data.error || 'Dallas CAD analysis failed');
      }

      // Convert Dallas CAD results to lead format
      const leads = SellerIntelligenceService.convertCADResultsToLeads(data.data);
      
      console.log(`🔄 Converted ${leads.length} Dallas CAD results to leads`);
      
      // Show all Dallas CAD results (even with low scores while HTML parsing is being improved)
      // TODO: Increase threshold back to >= 45 once Dallas CAD HTML parsing extracts real property data
      const motivatedLeads = leads.filter(lead => lead.motivationScore >= 0);
      
      console.log(`✅ Found ${motivatedLeads.length} properties from Dallas CAD (${leads.length} analyzed)`);
      if (leads.length > 0) {
        console.log('🎯 Dallas CAD leads:', leads.map(l => `${l.address} (Score: ${l.motivationScore})`));
      }
      console.log('🔍 MOTIVATION THRESHOLD TEST:', {
        leadsLength: leads.length,
        motivatedLeadsLength: motivatedLeads.length,
        sampleLead: leads[0],
        threshold: '>=0'
      });
      
      return motivatedLeads;
      
    } catch (error) {
      console.error('❌ Dallas CAD lead search failed:', error);
      throw error;
    }
  }
  
  /**
   * Lazily enrich a single lead with Dallas CAD details.
   *
   * Discovery returns complete leads instantly from the tax-roll DB, but CAD
   * details (full street address with house number, beds/baths/sqft, year
   * built) require a live scrape of dallascad.org. We only pay that cost when a
   * user opens a specific lead — keeping searches fast while still surfacing
   * full detail on demand.
   *
   * @param {string} address - Best-known address for the lead
   * @returns {Promise<Object>} Normalized CAD fields (may be partial)
   */
  static async enrichLeadWithCAD(address) {
    const response = await fetch(`${API_BASE}/api/property/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });

    if (!response.ok) {
      throw new Error(`CAD analyze API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'CAD analysis failed');
    }

    const d = data.data || {};
    return {
      fullAddress: d.property?.address || address,
      accountId: d.property?.accountId || null,
      bedrooms: d.property?.bedrooms || null,
      bathrooms: d.property?.bathrooms || null,
      sqft: d.property?.squareFeet || null,
      yearBuilt: d.property?.yearBuilt || null,
      propertyType: d.property?.propertyType || null,
      cadValue: d.property?.currentValue || null,
      ownerName: d.ownership?.ownerName || null,
      ownerAddress: d.ownership?.ownerAddress || null
    };
  }

  /**
   * Fetch skip-traced contact info (phone/email) for leads by account id, with
   * the DNC compliance gate applied by the backend. Returns
   * { configured: {skiptrace, dnc}, contacts: { [accountId]: {phones, emails} } }.
   */
  static async getContacts(accountIds) {
    const ids = (accountIds || []).filter(Boolean);
    if (!ids.length) return { configured: { skiptrace: false, dnc: false }, contacts: {} };
    const response = await fetch(`${API_BASE}/api/property/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountIds: ids })
    });
    if (!response.ok) throw new Error(`Contact API error: ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Contact lookup failed');
    return { configured: data.configured, contacts: data.contacts || {} };
  }

  /**
   * Bulk-enrich many leads in one request. The backend serves cached results
   * instantly and scrapes only the misses, so repeat selections are fast.
   * Results are returned in the same order as the input addresses.
   *
   * @param {string[]} addresses
   * @returns {Promise<Array>} per-address result (each has cached/error fields)
   */
  static async bulkEnrichLeads(addresses) {
    const response = await fetch(`${API_BASE}/api/property/bulk-enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses })
    });

    if (!response.ok) {
      throw new Error(`Bulk enrich API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Bulk enrich failed');
    }

    return data.results || [];
  }

  /**
   * Convert Dallas CAD API results to lead format expected by frontend
   */
  static convertCADResultsToLeads(cadData) {
    const leads = [];
    
    // Process ALL results from Dallas CAD (not just motivated sellers)
    const allResults = cadData.allResults || cadData.motivatedSellers || [];
    console.log(`🔄 Converting ${allResults.length} Dallas CAD results to lead format`);
    console.log('📊 CAD Data structure:', {
      hasAllResults: !!cadData.allResults,
      allResultsLength: cadData.allResults?.length,
      hasMotivatedSellers: !!cadData.motivatedSellers,
      motivatedSellersLength: cadData.motivatedSellers?.length
    });
    
    if (allResults && allResults.length > 0) {
      allResults.forEach((seller, index) => {
        const lead = {
          id: `cad_lead_${Date.now()}_${index}`,
          accountId: seller.property?.accountId || null,
          address: seller.property.address?.split(',')[0] || 'Unknown Address',
          fullAddress: seller.property.address,
          city: seller.geographic?.neighborhood || 'Dallas',
          state: 'TX',
          zip: SellerIntelligenceService.extractZipFromAddress(seller.property.address),
          ownerName: seller.ownership?.ownerName || 'Unknown Owner',
          
          // Motivation analysis
          motivationScore: seller.motivation.totalScore,
          motivationFactors: seller.motivation.factors?.filter(factor => factor.points > 0).map(factor => ({
            type: factor.type,
            description: factor.description,
            severity: factor.points > 20 ? 'high' : factor.points > 10 ? 'medium' : 'low',
            points: factor.points
          })) || [],
          
          // Property details
          propertyValue: seller.financial?.currentValue || seller.property?.currentValue || 0,
          propertyType: seller.property?.propertyType || 'Single Family',
          confidence: seller.motivation?.confidence || 50,
          
          // Additional data
          bedrooms: seller.property?.bedrooms || 0,
          bathrooms: seller.property?.bathrooms || 0,
          sqft: seller.property?.squareFeet || 0,
          yearBuilt: seller.property?.yearBuilt || 0,
          
          // Tax Delinquency Information
          isDelinquent: seller.taxDelinquency?.isDelinquent || false,
          amountOwed: seller.taxDelinquency?.amountOwed || 0,
          yearsDelinquent: seller.taxDelinquency?.yearsDelinquent || 0,
          foreclosureRisk: seller.taxDelinquency?.foreclosureRisk || 'LOW',
          urgencyScore: seller.taxDelinquency?.urgencyScore || 0,
          
          // Status
          status: seller.taxDelinquency?.isDelinquent ? 'tax_delinquent' : 'new',
          lastContact: null,
          notes: seller.taxDelinquency?.isDelinquent ? [`⚠️ TAX DELINQUENT: $${seller.taxDelinquency.amountOwed?.toLocaleString()} owed (${seller.taxDelinquency.yearsDelinquent} years)`] : [],
          offMarket: true,
          daysOnMarket: 0
        };
        
        leads.push(lead);
      });
    }
    
    console.log(`✅ Converted ${leads.length} Dallas CAD results to leads`);
    return leads;
  }

  static async searchLeads(params) {
    const { area, radius, propertyTypes } = params;
    
    console.log('🚀 SEARCH LEADS CALLED WITH:', params);
    
    try {
      // Integrate Dallas CAD scraping to find real motivated sellers
      console.log('🔍 Searching Dallas CAD for area:', area);
      const cadResults = await SellerIntelligenceService.searchDallasCADLeads(params);
      
      console.log('📋 CAD Results received:', {
        cadResults: !!cadResults,
        length: cadResults?.length || 0,
        firstResult: cadResults?.[0] || null
      });
      
      if (cadResults && cadResults.length > 0) {
        console.log(`✅ Dallas CAD found ${cadResults.length} properties, using real data`);
        const result = {
          leads: cadResults,
          totalFound: cadResults.length,
          source: 'dallas_cad_live',
          searchParams: params
        };
        console.log('🎯 FINAL RESULT:', result);
        return result;
      }
      
      console.log('⚠️ Dallas CAD returned no results');
    } catch (error) {
      console.error('❌ Dallas CAD integration failed:', error);
      // Return error details for debugging
      const errorResult = {
        leads: [],
        totalFound: 0,
        source: 'error',
        searchParams: params,
        error: error.message,
        message: `Error: ${error.message}`
      };
      console.log('🚨 ERROR RESULT:', errorResult);
      return errorResult;
    }
    
    // No results from Dallas CAD (not an error, just no data)
    console.log('⚠️ Dallas CAD returned empty results');
    const emptyResult = {
      leads: [],
      totalFound: 0,
      source: 'dallas_cad_empty',
      searchParams: params,
      message: 'No properties found in the selected area.'
    };
    console.log('📭 EMPTY RESULT:', emptyResult);
    return emptyResult;
  }

  // --- Campaigns: real, persisted in the browser via localStorage ---
  // A campaign is a saved search: the leads the realtor picked, plus the search
  // params and counts. No mock outreach data — only what the user actually did.
  static CAMPAIGNS_KEY = 'hunter_campaigns';

  static _readCampaigns() {
    if (typeof localStorage === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(SellerIntelligenceService.CAMPAIGNS_KEY)) || [];
    } catch {
      return [];
    }
  }

  static _writeCampaigns(campaigns) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SellerIntelligenceService.CAMPAIGNS_KEY, JSON.stringify(campaigns));
  }

  static async getCampaigns() {
    // Newest first
    return SellerIntelligenceService._readCampaigns()
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /** Create or update a saved campaign. */
  static async saveCampaign(campaign) {
    const campaigns = SellerIntelligenceService._readCampaigns();
    const idx = campaigns.findIndex(c => c.id === campaign.id);
    if (idx >= 0) campaigns[idx] = { ...campaigns[idx], ...campaign };
    else campaigns.push(campaign);
    SellerIntelligenceService._writeCampaigns(campaigns);
    return campaign;
  }

  static async deleteCampaign(campaignId) {
    const campaigns = SellerIntelligenceService._readCampaigns().filter(c => c.id !== campaignId);
    SellerIntelligenceService._writeCampaigns(campaigns);
    return true;
  }

  static async getCampaignById(campaignId) {
    return SellerIntelligenceService._readCampaigns().find(c => c.id === campaignId) || null;
  }

  static async getCampaignDetails(campaignId) {
    return SellerIntelligenceService.getCampaignById(campaignId);
  }

  static async exportLeads(leads, format = 'csv') {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (format === 'csv') {
          const headers = [
            'Address',
            'Owner Name',
            'Motivation Score',
            'Urgency Score',
            'Amount Owed',
            'Years Delinquent',
            'Property Value',
            'Property Type',
            'Beds',
            'Baths',
            'SqFt',
            'Year Built',
            'Phone (DNC-cleared)',
            'Phones (all, DNC status)',
            'Email',
            'City',
            'State',
            'ZIP'
          ];

          // Prefer CAD-enriched values (full address, beds/baths/sqft/year) when
          // present; fall back to the tax-roll lead fields otherwise.
          const csvCell = (v) => {
            const s = String(v ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          };

          // Contact info (compliance-gated): only DNC-cleared numbers go in the
          // callable column; the "all" column lists every number with its DNC
          // status so a do-not-call number is never presented as safe to call.
          const contactCols = (lead) => {
            const c = lead._contact;
            if (!c) return ['', '', ''];
            const cleared = (c.phones || []).filter(p => p.callable).map(p => p.number).join('; ');
            const all = (c.phones || []).map(p => `${p.number} [${p.dnc}]`).join('; ');
            const emails = (c.emails || []).join('; ');
            return [cleared, all, emails];
          };

          const rows = leads.map(lead => [
            lead.cad?.fullAddress || lead.fullAddress || lead.address || '',
            lead.ownerName || '',
            lead.motivationScore || 0,
            lead.urgencyScore || 0,
            lead.amountOwed || 0,
            lead.yearsDelinquent || 0,
            lead.propertyValue || lead.estimatedValue || 0,
            lead.propertyType || '',
            lead.bedrooms ?? lead.cad?.bedrooms ?? '',
            lead.bathrooms ?? lead.cad?.bathrooms ?? '',
            lead.sqft ?? lead.cad?.sqft ?? '',
            lead.yearBuilt ?? lead.cad?.yearBuilt ?? '',
            ...contactCols(lead),
            lead.city || '',
            lead.state || 'TX',
            lead.zip || ''
          ].map(csvCell));
          
          const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
          ].join('\n');
          
          resolve({
            content: csvContent,
            filename: `seller_leads_${new Date().toISOString().split('T')[0]}.csv`,
            mimeType: 'text/csv'
          });
        }
        
        resolve(null);
      }, 500);
    });
  }

  static getMotivationColor(score) {
    if (score >= 85) return '#dc2626';
    if (score >= 70) return '#f59e0b';
    return '#6b7280';
  }

  static getConfidenceLevel(confidence) {
    if (confidence >= 90) return 'Very High';
    if (confidence >= 80) return 'High';
    if (confidence >= 70) return 'Medium';
    if (confidence >= 60) return 'Moderate';
    return 'Low';
  }

  static formatPropertyValue(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  static extractZipFromAddress(address) {
    if (!address) return '';
    const zipMatch = address.match(/\b(\d{5}(-\d{4})?)\b/);
    return zipMatch ? zipMatch[1] : '';
  }
}

export default SellerIntelligenceService;