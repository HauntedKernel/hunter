class SellerIntelligenceService {
  static async getCampaigns() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const campaigns = [
          {
            id: 'campaign_001',
            area: 'Highland Park, Dallas, TX',
            status: 'active',
            totalLeads: 47,
            contacted: 32,
            responses: 8,
            responseRate: 25,
            startDate: '3 days ago',
            radius: 5,
            propertyTypes: { singleFamily: true, condo: true }
          },
          {
            id: 'campaign_002',
            area: 'Uptown, Dallas, TX',
            status: 'active',
            totalLeads: 62,
            contacted: 45,
            responses: 12,
            responseRate: 27,
            startDate: '1 week ago',
            radius: 3,
            propertyTypes: { condo: true, commercial: true }
          },
          {
            id: 'campaign_003',
            area: 'Preston Hollow, Dallas, TX',
            status: 'paused',
            totalLeads: 35,
            contacted: 20,
            responses: 3,
            responseRate: 15,
            startDate: '2 weeks ago',
            radius: 7,
            propertyTypes: { singleFamily: true, rawLand: true }
          }
        ];
        resolve(campaigns);
      }, 500);
    });
  }

  static async searchAreas(query) {
    const areas = [
      { name: 'Highland Park, Dallas, TX', zip: '75205', type: 'neighborhood' },
      { name: 'University Park, Dallas, TX', zip: '75225', type: 'neighborhood' },
      { name: 'Preston Hollow, Dallas, TX', zip: '75230', type: 'neighborhood' },
      { name: 'Lakewood, Dallas, TX', zip: '75214', type: 'neighborhood' },
      { name: 'Uptown, Dallas, TX', zip: '75201', type: 'neighborhood' },
      { name: 'Oak Lawn, Dallas, TX', zip: '75219', type: 'neighborhood' },
      { name: 'Deep Ellum, Dallas, TX', zip: '75226', type: 'neighborhood' },
      { name: 'Bishop Arts District, Dallas, TX', zip: '75208', type: 'neighborhood' },
      { name: 'Knox-Henderson, Dallas, TX', zip: '75206', type: 'neighborhood' },
      { name: 'Lower Greenville, Dallas, TX', zip: '75206', type: 'neighborhood' }
    ];

    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = areas.filter(area => 
          area.name.toLowerCase().includes(query.toLowerCase()) ||
          area.zip.includes(query)
        );
        resolve(filtered);
      }, 200);
    });
  }

  static async getLeadEstimates(area, criteria) {
    const baseEstimates = {
      financial: Math.floor(Math.random() * 30) + 15,
      transitions: Math.floor(Math.random() * 40) + 20,
      property: Math.floor(Math.random() * 25) + 10,
      timing: Math.floor(Math.random() * 45) + 25,
      ownership: Math.floor(Math.random() * 35) + 15
    };

    return new Promise((resolve) => {
      setTimeout(() => {
        const estimates = {};
        Object.keys(criteria).forEach(key => {
          if (criteria[key]) {
            estimates[key] = baseEstimates[key];
          }
        });
        resolve(estimates);
      }, 300);
    });
  }

  static async searchLeads(params) {
    const { area, radius, propertyTypes } = params;
    
    const mockLeads = [
      {
        id: 'lead_001',
        address: '4521 Beverly Dr',
        city: 'Highland Park',
        state: 'TX',
        zip: '75205',
        ownerName: 'John & Mary Smith',
        motivationScore: 94,
        motivationFactors: [
          { type: 'financial', description: 'Tax delinquency (3 months)', severity: 'high' },
          { type: 'transitions', description: 'Job relocation to Austin', severity: 'medium' },
          { type: 'property', description: 'Foundation repairs needed', severity: 'high' }
        ],
        confidence: 89,
        propertyValue: 750000,
        lastSaleDate: '2008-03-15',
        propertyType: 'Single Family',
        bedrooms: 4,
        bathrooms: 3.5,
        sqft: 3200,
        lotSize: 8500,
        yearBuilt: 1952,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_002',
        address: '3842 Mockingbird Ln',
        city: 'University Park',
        state: 'TX',
        zip: '75225',
        ownerName: 'Robert Johnson',
        motivationScore: 87,
        motivationFactors: [
          { type: 'ownership', description: 'Owned for 15+ years', severity: 'medium' },
          { type: 'timing', description: 'Area appreciation 45% last 5 years', severity: 'high' },
          { type: 'transitions', description: 'Recent retirement', severity: 'medium' }
        ],
        confidence: 82,
        propertyValue: 920000,
        lastSaleDate: '2007-07-22',
        propertyType: 'Single Family',
        bedrooms: 5,
        bathrooms: 4,
        sqft: 4100,
        lotSize: 10200,
        yearBuilt: 1958,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_003',
        address: '2156 Preston Rd',
        city: 'Dallas',
        state: 'TX',
        zip: '75230',
        ownerName: 'Sarah Williams',
        motivationScore: 82,
        motivationFactors: [
          { type: 'property', description: 'Roof replacement needed', severity: 'medium' },
          { type: 'financial', description: 'HOA liens filed', severity: 'high' },
          { type: 'transitions', description: 'Divorce proceedings', severity: 'high' }
        ],
        confidence: 91,
        propertyValue: 425000,
        lastSaleDate: '2015-11-03',
        propertyType: 'Townhome',
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 2200,
        lotSize: 3000,
        yearBuilt: 1985,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_004',
        address: '5673 Lakewood Blvd',
        city: 'Dallas',
        state: 'TX',
        zip: '75214',
        ownerName: 'Michael & Jennifer Brown',
        motivationScore: 79,
        motivationFactors: [
          { type: 'timing', description: 'Peak market conditions', severity: 'medium' },
          { type: 'ownership', description: 'Investment property', severity: 'low' },
          { type: 'financial', description: 'Multiple property ownership', severity: 'low' }
        ],
        confidence: 75,
        propertyValue: 580000,
        lastSaleDate: '2012-04-18',
        propertyType: 'Single Family',
        bedrooms: 3,
        bathrooms: 2,
        sqft: 2400,
        lotSize: 7200,
        yearBuilt: 1948,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_005',
        address: '1890 Oak Lawn Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75219',
        ownerName: 'Estate of Patricia Davis',
        motivationScore: 96,
        motivationFactors: [
          { type: 'transitions', description: 'Inherited property', severity: 'high' },
          { type: 'property', description: 'Vacant for 6+ months', severity: 'high' },
          { type: 'financial', description: 'Estate settlement needed', severity: 'high' }
        ],
        confidence: 94,
        propertyValue: 340000,
        lastSaleDate: '1998-09-12',
        propertyType: 'Condo',
        bedrooms: 2,
        bathrooms: 2,
        sqft: 1450,
        lotSize: 0,
        yearBuilt: 1972,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_006',
        address: '7234 Greenville Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75206',
        ownerName: 'David Martinez',
        motivationScore: 73,
        motivationFactors: [
          { type: 'property', description: 'Code violations pending', severity: 'medium' },
          { type: 'financial', description: 'Behind on mortgage', severity: 'medium' }
        ],
        confidence: 68,
        propertyValue: 295000,
        lastSaleDate: '2019-02-28',
        propertyType: 'Multi-Family',
        bedrooms: 4,
        bathrooms: 2,
        sqft: 1800,
        lotSize: 5500,
        yearBuilt: 1962,
        units: 2,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_007',
        address: '4112 Swiss Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75204',
        ownerName: 'Lisa Thompson',
        motivationScore: 85,
        motivationFactors: [
          { type: 'timing', description: 'Recent area development', severity: 'high' },
          { type: 'ownership', description: 'Absentee owner', severity: 'medium' },
          { type: 'property', description: 'Major renovation needed', severity: 'high' }
        ],
        confidence: 80,
        propertyValue: 515000,
        lastSaleDate: '2010-06-15',
        propertyType: 'Single Family',
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1950,
        lotSize: 6800,
        yearBuilt: 1925,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_008',
        address: '8956 Skillman St',
        city: 'Dallas',
        state: 'TX',
        zip: '75243',
        ownerName: 'James & Patricia Wilson',
        motivationScore: 77,
        motivationFactors: [
          { type: 'transitions', description: 'Downsizing', severity: 'medium' },
          { type: 'ownership', description: 'Owned 20+ years', severity: 'medium' },
          { type: 'timing', description: 'Retirement planning', severity: 'medium' }
        ],
        confidence: 73,
        propertyValue: 385000,
        lastSaleDate: '2003-10-01',
        propertyType: 'Single Family',
        bedrooms: 4,
        bathrooms: 3,
        sqft: 2800,
        lotSize: 8100,
        yearBuilt: 1978,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_009',
        address: '2100 Commerce St',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
        ownerName: 'Dallas Holdings LLC',
        motivationScore: 88,
        motivationFactors: [
          { type: 'financial', description: 'Lease expiring', severity: 'high' },
          { type: 'timing', description: 'Market peak for commercial', severity: 'high' }
        ],
        confidence: 85,
        propertyValue: 2500000,
        lastSaleDate: '2015-05-10',
        propertyType: 'Commercial',
        bedrooms: 0,
        bathrooms: 0,
        sqft: 15000,
        lotSize: 22000,
        yearBuilt: 1985,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_010',
        address: '5500 Industrial Blvd',
        city: 'Dallas',
        state: 'TX',
        zip: '75247',
        ownerName: 'TX Manufacturing Inc',
        motivationScore: 75,
        motivationFactors: [
          { type: 'property', description: 'Warehouse needs upgrades', severity: 'medium' },
          { type: 'transitions', description: 'Business relocating', severity: 'high' }
        ],
        confidence: 78,
        propertyValue: 3200000,
        lastSaleDate: '2012-08-20',
        propertyType: 'Industrial',
        bedrooms: 0,
        bathrooms: 0,
        sqft: 25000,
        lotSize: 45000,
        yearBuilt: 1972,
        daysOnMarket: 0,
        offMarket: true
      },
      {
        id: 'lead_011',
        address: 'Vacant Land on Highway 380',
        city: 'Frisco',
        state: 'TX',
        zip: '75033',
        ownerName: 'Land Investment Group',
        motivationScore: 92,
        motivationFactors: [
          { type: 'timing', description: 'Prime development opportunity', severity: 'high' },
          { type: 'financial', description: 'Investor needs liquidity', severity: 'high' }
        ],
        confidence: 88,
        propertyValue: 1800000,
        lastSaleDate: '2018-03-15',
        propertyType: 'Raw Land',
        bedrooms: 0,
        bathrooms: 0,
        sqft: 0,
        lotSize: 435600,
        yearBuilt: 0,
        daysOnMarket: 0,
        offMarket: true
      }
    ];

    return new Promise((resolve) => {
      setTimeout(() => {
        let filteredLeads = [...mockLeads];
        
        if (propertyTypes && Object.values(propertyTypes).some(v => v)) {
          const typeMap = {
            singleFamily: 'Single Family',
            condo: 'Condo',
            townhome: 'Townhome',
            multiFamily: 'Multi-Family',
            commercial: 'Commercial',
            industrial: 'Industrial',
            rawLand: 'Raw Land'
          };
          
          filteredLeads = filteredLeads.filter(lead => {
            const leadType = lead.propertyType;
            return Object.entries(propertyTypes).some(([key, selected]) => 
              selected && typeMap[key] === leadType
            );
          });
        }
        
        filteredLeads.sort((a, b) => b.motivationScore - a.motivationScore);
        
        resolve({
          leads: filteredLeads,
          totalCount: filteredLeads.length,
          searchParams: params,
          timestamp: new Date().toISOString()
        });
      }, 1000);
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
      maximumFractionDigits: 0
    }).format(value);
  }

  static calculateDaysOwned(lastSaleDate) {
    const saleDate = new Date(lastSaleDate);
    const today = new Date();
    const diffTime = Math.abs(today - saleDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    
    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''} ${months > 0 ? `${months} mo` : ''}`;
    }
    return `${months} month${months > 1 ? 's' : ''}`;
  }

  static async exportLeads(leads, format = 'csv') {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (format === 'csv') {
          const headers = [
            'Address',
            'Owner Name',
            'Motivation Score',
            'Property Value',
            'Property Type',
            'Bedrooms',
            'Bathrooms',
            'Sqft',
            'Year Built',
            'Days Owned'
          ];
          
          const rows = leads.map(lead => [
            `${lead.address}, ${lead.city}, ${lead.state} ${lead.zip}`,
            lead.ownerName,
            lead.motivationScore,
            lead.propertyValue,
            lead.propertyType,
            lead.bedrooms,
            lead.bathrooms,
            lead.sqft,
            lead.yearBuilt,
            this.calculateDaysOwned(lead.lastSaleDate)
          ]);
          
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
}

export default SellerIntelligenceService;