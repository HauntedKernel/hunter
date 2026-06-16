/**
 * Highland Park Urgency Service
 * Sorts tax delinquent properties by urgency and enhances with CAD data
 */

const TaxRollProcessor = require('../processors/TaxRollProcessor');
const { DallasCADScraper } = require('../scrapers/DallasCADScraper');
const Logger = require('../utils/Logger');

class HighlandParkUrgencyService {
  constructor() {
    this.logger = new Logger('HighlandParkUrgencyService', {
      logLevel: 'info',
      enableConsole: true
    });
    
    this.taxRollProcessor = new TaxRollProcessor();
    this.cadScraper = new DallasCADScraper();
    
    // Highland Park ZIP codes
    this.highlandParkZips = ['75205', '75219', '75206', '75225'];
  }

  /**
   * Calculate urgency score for a property
   * Higher score = more urgent/better opportunity
   */
  calculateUrgencyScore(property) {
    let score = 0;
    
    // 1. Amount owed factor (0-40 points)
    if (property.delinquent_amount > 10000) score += 40;
    else if (property.delinquent_amount > 5000) score += 35;
    else if (property.delinquent_amount > 2500) score += 30;
    else if (property.delinquent_amount > 1000) score += 25;
    else if (property.delinquent_amount > 500) score += 20;
    else if (property.delinquent_amount > 250) score += 15;
    else if (property.delinquent_amount > 100) score += 10;
    else score += 5;
    
    // 2. Years delinquent factor (0-30 points)
    const yearsDelinquent = property.delinquent_years || 0;
    if (yearsDelinquent >= 4) score += 30;
    else if (yearsDelinquent === 3) score += 25;
    else if (yearsDelinquent === 2) score += 20;
    else if (yearsDelinquent === 1) score += 15;
    else score += 5;
    
    // 3. Escalation rate (0-20 points)
    // Check if amount is growing rapidly
    if (property.total_amount_due_90 && property.total_amount_due) {
      const escalationRate = (property.total_amount_due_90 - property.total_amount_due) / Math.max(property.total_amount_due, 1);
      if (escalationRate > 0.15) score += 20;  // Growing >15% in 90 days
      else if (escalationRate > 0.10) score += 15;
      else if (escalationRate > 0.05) score += 10;
      else if (escalationRate > 0) score += 5;
    }
    
    // 4. Property type factors (0-10 points)
    if (!property.homestead_exemption) {
      score += 10; // Non-homestead = likely investment property
    }
    
    // 5. Financial distress indicators
    if (property.payment_agreement && property.delinquent_amount > 0) {
      score += 5; // Failed payment agreement = high distress
    }
    
    if (property.over65_exemption || property.disabled_exemption) {
      score += 5; // May need cash more urgently
    }
    
    // 6. Legal pressure factors
    if (property.attorney_date_set) score += 10;
    if (property.court_cost > 0) score += 5;
    if (property.abstract_fee > 0) score += 5;
    
    // 7. Time sensitivity - Due date proximity
    if (property.due_date) {
      const dueDate = this.parseDate(property.due_date);
      const today = new Date();
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue > 365) score += 15;  // Over 1 year overdue
      else if (daysOverdue > 180) score += 10;  // Over 6 months
      else if (daysOverdue > 90) score += 5;   // Over 3 months
    }
    
    return Math.min(100, score); // Cap at 100
  }

  /**
   * Parse YYYYMMDD date string
   */
  parseDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  /**
   * Get Highland Park delinquent properties sorted by urgency
   */
  async getUrgentHighlandParkProperties(options = {}) {
    try {
      const limit = options.limit || 100;
      const minAmount = options.minAmount || 100;
      const enhanceWithCAD = options.enhanceWithCAD !== false;
      
      this.logger.info('Fetching urgent Highland Park properties', { limit, minAmount });
      
      // Initialize database
      await this.taxRollProcessor.initializeDatabase();
      
      // Query for Highland Park properties
      const sql = `
        SELECT * FROM tax_roll 
        WHERE is_delinquent = 1 
          AND suit_pending = 0
          AND bankruptcy_filed = 0
          AND payment_status NOT IN ('SUIT_PENDING', 'BANKRUPTCY')
          AND delinquent_amount >= ?
          AND (
            city LIKE '%HIGHLAND PARK%' OR
            zip_code LIKE '75205%' OR
            zip_code LIKE '75206%' OR
            zip_code LIKE '75219%' OR
            zip_code LIKE '75225%'
          )
        ORDER BY delinquent_amount DESC
        LIMIT 500
      `;
      
      const properties = await this.taxRollProcessor.db.all(sql, [minAmount]);
      
      this.logger.info(`Found ${properties.length} Highland Park delinquent properties`);
      
      // Calculate urgency scores
      const scoredProperties = properties.map(prop => ({
        ...prop,
        urgencyScore: this.calculateUrgencyScore(prop),
        urgencyFactors: this.getUrgencyFactors(prop)
      }));
      
      // Sort by urgency score (highest first)
      scoredProperties.sort((a, b) => b.urgencyScore - a.urgencyScore);
      
      // Take top N properties
      const topProperties = scoredProperties.slice(0, limit);
      
      // Enhance with CAD data if requested
      if (enhanceWithCAD && topProperties.length > 0) {
        this.logger.info(`Enhancing top ${topProperties.length} properties with CAD data`);
        
        const enhanced = [];
        for (const property of topProperties.slice(0, 20)) { // Limit CAD lookups to top 20
          try {
            // Format address for CAD search
            const address = property.property_address || '';
            const city = property.city || 'DALLAS';
            
            if (address && address.length > 3) {
              this.logger.debug(`Fetching CAD data for ${address}, ${city}`);
              const cadData = await this.cadScraper.getPropertyDetails(address, city);
              
              enhanced.push({
                ...property,
                cadData: cadData,
                enhanced: true
              });
            } else {
              enhanced.push({
                ...property,
                cadData: null,
                enhanced: false
              });
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (error) {
            this.logger.warn(`Failed to enhance property ${property.account_id}`, { error: error.message });
            enhanced.push({
              ...property,
              cadData: null,
              enhanced: false
            });
          }
        }
        
        // Add remaining properties without CAD enhancement
        enhanced.push(...topProperties.slice(20).map(p => ({
          ...p,
          cadData: null,
          enhanced: false
        })));
        
        return this.formatResults(enhanced);
      }
      
      return this.formatResults(topProperties);
      
    } catch (error) {
      this.logger.error('Failed to get urgent Highland Park properties', { error: error.message });
      throw error;
    }
  }

  /**
   * Get urgency factors explanation
   */
  getUrgencyFactors(property) {
    const factors = [];
    
    if (property.delinquent_amount > 5000) {
      factors.push(`High tax debt: $${property.delinquent_amount.toFixed(2)}`);
    } else if (property.delinquent_amount > 1000) {
      factors.push(`Moderate tax debt: $${property.delinquent_amount.toFixed(2)}`);
    }
    
    if (property.delinquent_years >= 3) {
      factors.push(`Long-term delinquent: ${property.delinquent_years} years`);
    }
    
    if (!property.homestead_exemption) {
      factors.push('Non-homestead property (likely investment)');
    }
    
    if (property.payment_agreement) {
      factors.push('Has payment agreement (may be struggling)');
    }
    
    if (property.over65_exemption) {
      factors.push('Over 65 exemption (may need liquidity)');
    }
    
    if (property.attorney_date_set) {
      factors.push('Legal proceedings initiated');
    }
    
    if (property.total_amount_due_90 > property.total_amount_due * 1.1) {
      factors.push('Rapidly escalating debt');
    }
    
    return factors;
  }

  /**
   * Format results for API response
   */
  formatResults(properties) {
    return properties.map(prop => ({
      // Core identification
      accountId: prop.account_id,
      propertyId: prop.property_id,
      parcelNumber: prop.parcel_number,
      
      // Location
      address: prop.property_address || 'Address Not Available',
      city: prop.city,
      state: prop.state || 'TX',
      zipCode: prop.zip_code,
      
      // Owner information
      ownerName: prop.owner_name,
      ownerAddress: prop.owner_address,
      
      // Financial information
      taxAmount: prop.tax_amount,
      delinquentAmount: prop.delinquent_amount,
      totalAmountDue: prop.total_amount_due,
      totalAmountDue30: prop.total_amount_due_30,
      totalAmountDue60: prop.total_amount_due_60,
      totalAmountDue90: prop.total_amount_due_90,
      courtCost: prop.court_cost,
      abstractFee: prop.abstract_fee,
      
      // Status information
      yearsDelinquent: prop.delinquent_years,
      paymentStatus: prop.payment_status,
      datePaid: prop.date_paid,
      dueDate: prop.due_date,
      paymentAgreement: prop.payment_agreement,
      deferred: prop.deferred,
      attorneyDateSet: prop.attorney_date_set,
      
      // Exemptions
      exemptions: prop.exemptions,
      homesteadExemption: prop.homestead_exemption,
      over65Exemption: prop.over65_exemption,
      veteranExemption: prop.veteran_exemption,
      disabledExemption: prop.disabled_exemption,
      
      // Urgency scoring
      urgencyScore: prop.urgencyScore,
      urgencyFactors: prop.urgencyFactors,
      urgencyLevel: this.getUrgencyLevel(prop.urgencyScore),
      
      // CAD enhancement
      cadData: prop.cadData || null,
      enhanced: prop.enhanced || false,
      
      // Metadata
      source: 'dallas_county_tax_roll',
      taxYear: prop.tax_year,
      lastUpdated: prop.updated_at
    }));
  }

  /**
   * Get urgency level description
   */
  getUrgencyLevel(score) {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Close database connection
   */
  async close() {
    await this.taxRollProcessor.close();
  }
}

module.exports = HighlandParkUrgencyService;