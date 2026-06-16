/**
 * HTMLParser - Robust data extraction from Dallas CAD responses
 * 
 * Implements comprehensive parsing algorithms to extract property ownership,
 * valuation, taxation, and historical data from Dallas CAD HTML responses.
 */

const cheerio = require('cheerio');
const _ = require('lodash');

class HTMLParser {
  constructor() {
    this.extractionAttempts = 0;
    this.successfulExtractions = 0;
    this.patterns = this.initializeExtractionPatterns();
  }

  /**
   * Initialize regex patterns and selectors for data extraction
   */
  initializeExtractionPatterns() {
    return {
      // Owner name patterns
      ownerName: [
        // Require an uppercase-letter start and min length so we match real
        // owner names (e.g. "BARTHOLOW PETER") and NOT navigation chrome like
        // "...SearchOwner.aspx" (no /i flag — DCAD owner names are uppercase).
        /Owner\s*:?\s*([A-Z][A-Z\s,&.'-]{2,})/,
        /Property Owner\s*:?\s*([A-Z][A-Z\s,&.'-]{2,})/,
        /"owner"[^>]*>\s*([A-Z][^<]{2,})/i
      ],
      
      // Tax status patterns
      taxStatus: [
        /Tax\s*Status\s*:?\s*(CURRENT|DELINQUENT|PAID|UNPAID)/i,
        /Status\s*:?\s*(CURRENT|DELINQUENT|PAID|UNPAID)/i,
        /"status"[^>]*>(CURRENT|DELINQUENT|PAID|UNPAID)/i
      ],
      
      // Property value patterns
      assessedValue: [
        /Assessed\s*Value\s*:?\s*\$?([\d,]+)/i,
        /Total\s*Value\s*:?\s*\$?([\d,]+)/i,
        /"assessed[_-]?value"[^>]*>\$?([\d,]+)/i
      ],
      
      // Address patterns
      propertyAddress: [
        /Property\s*Address\s*:?\s*([^<\n]+)/i,
        /Address\s*:?\s*([^<\n]+)/i,
        /"address"[^>]*>([^<]+)/i
      ]
    };
  }

  /**
   * Main parsing method - extracts all available property data
   * 
   * @param {string} html - Raw HTML response from Dallas CAD
   * @param {Object} originalData - Original search parameters
   * @returns {Object} Extracted property data
   */
  parseCADResponse(html, originalData = {}) {
    this.extractionAttempts++;
    
    try {
      const $ = cheerio.load(html);
      
      const extractedData = {
        // Core identification
        address: originalData.address || this.extractPropertyAddress(html, $),
        accountId: this.extractFromDADSearchResults($, 'account_id'),
        
        // Ownership information
        ownership: {
          ownerName: this.extractOwnerName(html, $),
          ownerAddress: this.extractOwnerAddress(html, $),
          ownershipType: this.extractOwnershipType(html, $),
          ownershipDuration: this.calculateOwnershipDuration(html, $)
        },
        
        // Property location
        location: {
          address: this.extractFromDADSearchResults($, 'address'),
          city: this.extractFromDADSearchResults($, 'city'), 
          county: 'Dallas',
          state: 'TX'
        },
        
        // Valuation data - Enhanced with CAD search results
        valuation: {
          totalValue: this.parseMoneyValue(this.extractFromDADSearchResults($, 'value')),
          assessedValue: this.extractAssessedValue(html, $),
          landValue: this.extractLandValue(html, $),
          improvementValue: this.extractImprovementValue(html, $),
          marketValue: this.extractMarketValue(html, $)
        },
        
        // Property details - Enhanced with search results
        property: {
          propertyType: this.extractFromDADSearchResults($, 'type') || this.extractPropertyType(html, $),
          yearBuilt: this.extractYearBuilt(html, $),
          squareFootage: this.extractSquareFootage(html, $),
          lotSize: this.extractLotSize(html, $),
          bedrooms: this.extractBedrooms(html, $),
          bathrooms: this.extractBathrooms(html, $),
          // Additional fields for motivation scoring
          condition: this.inferPropertyCondition(html, $),
          age: this.calculatePropertyAge(html, $)
        },
        
        // Taxation information
        taxation: {
          taxYear: this.extractTaxYear(html, $),
          taxAmount: this.extractTaxAmount(html, $),
          taxStatus: this.extractTaxStatus(html, $),
          exemptions: this.extractExemptions(html, $),
          delinquencyStatus: this.extractDelinquencyStatus(html, $)
        },
        
        // Historical data
        historical: {
          lastSaleDate: this.extractLastSaleDate(html, $),
          lastSalePrice: this.extractLastSalePrice(html, $),
          priorOwners: this.extractPriorOwners(html, $),
          transferHistory: this.extractTransferHistory(html, $)
        },
        
        // Geographic context
        geographic: {
          neighborhood: this.determineNeighborhood(html, $),
          schoolDistrict: this.extractSchoolDistrict(html, $),
          marketArea: this.determineMarketArea(html, $)
        },
        
        // Extraction metadata
        metadata: {
          extractedAt: new Date().toISOString(),
          extractionQuality: this.assessExtractionQuality(),
          sourceUrl: originalData.sourceUrl,
          processingTime: Date.now() - (originalData.startTime || Date.now()),
          cadAccountId: this.extractFromDADSearchResults($, 'account_id')
        }
      };

      // Store for quality assessment
      this.lastExtractedData = extractedData;
      
      // Validate and clean extracted data
      const cleanedData = this.cleanAndValidateData(extractedData);
      
      if (this.isValidExtraction(cleanedData)) {
        this.successfulExtractions++;
      }
      
      return cleanedData;
      
    } catch (error) {
      console.error('HTML parsing error:', error);
      return this.createErrorResponse(error, originalData);
    }
  }

  /**
   * Extract owner name with multiple fallback strategies
   */
  extractOwnerName(html, $) {
    const strategies = [
      // Strategy 1: Dallas CAD search results table format
      () => this.extractFromDADSearchResults($, 'owner'),
      
      // Strategy 2: Look for specific owner name patterns
      () => this.extractWithPatterns(html, this.patterns.ownerName),
      
      // Strategy 3: Look in table cells containing "owner"
      () => this.extractFromTableCell($, 'owner'),
      
      // Strategy 4: Look in divs or spans with owner-related classes
      () => this.extractFromSelector($, '.owner-name, .property-owner, [class*="owner"]'),
      
      // Strategy 5: Look for formatted owner sections
      () => this.extractOwnerFromFormattedSection(html, $)
    ];

    const candidate = this.executeStrategies(strategies);
    return this.isValidOwnerName(candidate) ? candidate.trim() : 'Unknown Owner';
  }

  /**
   * Parse a Dallas CAD residential detail page (AcctDetailRes.aspx).
   *
   * The search results row only carries owner / address / value / type. The
   * building characteristics (beds, baths, sqft, year built, stories) live on
   * the per-property detail page, in spans with stable IDs (MainImpRes1_lbl*).
   *
   * @param {string} html - Detail page HTML
   * @returns {Object} Building characteristics (fields are null when absent)
   */
  parseResidentialDetail(html) {
    const $ = cheerio.load(html);

    const text = (id) => {
      const t = $('#' + id).text();
      return t ? t.replace(/ /g, ' ').trim() : '';
    };
    const num = (s) => {
      const m = String(s).replace(/,/g, '').match(/\d+(\.\d+)?/);
      return m ? parseFloat(m[0]) : null;
    };

    const fullBath = num(text('MainImpRes1_lblFullBath'));
    const halfBath = num(text('MainImpRes1_lblHalfBath'));
    let bathrooms = null;
    if (fullBath !== null || halfBath !== null) {
      bathrooms = (fullBath || 0) + (halfBath || 0) * 0.5;
    }

    return {
      bedrooms: num(text('MainImpRes1_lblBedRoom')),
      bathrooms,
      fullBaths: fullBath,
      halfBaths: halfBath,
      squareFootage: num(text('MainImpRes1_lblLivingArea')),
      yearBuilt: num(text('MainImpRes1_lblYearBuilt')),
      stories: text('MainImpRes1_lblNumStories') || null
    };
  }

  /**
   * Guard against junk leaking from loose fallback strategies on pages that
   * have no real owner (e.g. a "No Records" search page). Rejects URLs, file
   * names (.aspx), markup, and tokens too short to be a name.
   */
  isValidOwnerName(name) {
    if (!name || typeof name !== 'string') return false;
    const n = name.trim();
    if (n.length < 3) return false;
    if (!/[A-Za-z]/.test(n)) return false;                 // must contain a letter
    if (/\.(aspx|php|html?|js|com|net|org)\b/i.test(n)) return false; // looks like a URL/file
    if (/https?:|[\/<>{}]/.test(n)) return false;          // URL or markup fragment
    return true;
  }

  /**
   * Extract tax status - critical for motivation scoring
   */
  extractTaxStatus(html, $) {
    const strategies = [
      // Strategy 1: Direct pattern matching
      () => this.extractWithPatterns(html, this.patterns.taxStatus),
      
      // Strategy 2: Look in tax-related table cells
      () => this.extractFromTableCell($, 'tax.*status'),
      
      // Strategy 3: Look for payment indicators
      () => this.extractTaxStatusFromPaymentInfo(html, $),
      
      // Strategy 4: Infer from delinquency indicators
      () => this.inferTaxStatusFromDelinquencyIndicators(html, $)
    ];

    const status = this.executeStrategies(strategies);
    return this.normalizeTaxStatus(status);
  }

  /**
   * Extract assessed value with currency parsing
   */
  extractAssessedValue(html, $) {
    const strategies = [
      () => this.extractFromDADSearchResults($, 'value'),
      () => this.extractWithPatterns(html, this.patterns.assessedValue),
      () => this.extractFromTableCell($, 'assessed.*value'),
      () => this.extractFromTableCell($, 'total.*value'),
      () => this.extractValueFromFormattedSection(html, $, 'assessed')
    ];

    const rawValue = this.executeStrategies(strategies);
    return this.parseMoneyValue(rawValue);
  }

  /**
   * Extract property address with cleaning
   */
  extractPropertyAddress(html, $) {
    const strategies = [
      () => this.extractFromDADSearchResults($, 'address'),
      () => this.extractWithPatterns(html, this.patterns.propertyAddress),
      () => this.extractFromTableCell($, 'property.*address'),
      () => this.extractFromTableCell($, '^address'),
      () => this.extractAddressFromHeader(html, $)
    ];

    const address = this.executeStrategies(strategies);
    return this.cleanAddress(address);
  }

  /**
   * Extract owner address for absentee owner detection
   */
  extractOwnerAddress(html, $) {
    const strategies = [
      () => this.extractFromTableCell($, 'mailing.*address'),
      () => this.extractFromTableCell($, 'owner.*address'),
      () => this.extractAddressAfterOwner(html, $),
      () => this.extractFromAddressSection(html, $)
    ];

    const address = this.executeStrategies(strategies);
    return this.cleanAddress(address);
  }

  /**
   * Determine ownership type for motivation scoring
   */
  extractOwnershipType(html, $) {
    const ownerName = this.extractOwnerName(html, $);
    
    if (!ownerName || ownerName === 'OWNER NAME NOT FOUND') {
      return 'UNKNOWN';
    }

    return this.classifyOwnershipType(ownerName);
  }

  /**
   * Classify ownership type based on owner name patterns
   * Patent Claim: Ownership entity classification algorithm
   */
  classifyOwnershipType(ownerName) {
    const patterns = {
      TRUST: /\b(TRUST|TRUSTEE|TR)\b/i,
      LLC: /\bLLC\b/i,
      CORPORATION: /\b(CORP|INC|CORPORATION|CO)\b/i,
      PARTNERSHIP: /\b(PARTNERSHIP|LLP|LP)\b/i,
      ESTATE: /\b(ESTATE|EST)\b/i,
      INDIVIDUAL: /^[A-Z\s]+ [A-Z\s]+$/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(ownerName)) {
        return type;
      }
    }

    // Default classification logic
    if (ownerName.includes('&') || ownerName.includes(' AND ')) {
      return 'JOINT';
    }

    return 'INDIVIDUAL';
  }

  /**
   * Extract data from Dallas CAD search results table
   * Enhanced to handle the actual CAD table structure:
   * Column 0: Record number 
   * Column 1: Property address (link to AcctDetailRes.aspx)
   * Column 2: City
   * Column 3: Owner name 
   * Column 4: Total value
   * Column 5: Property type
   */
  extractFromDADSearchResults($, field) {
    let result = null;
    
    console.log(`🔍 Enhanced CAD Search Results Parser - Looking for field: ${field}`);
    
    // Look for the SearchResults1_dgResults table or similar structure
    $('table[id*="dgResults"], table').each((tableIndex, table) => {
      const $table = $(table);
      
      $table.find('tr').each((i, row) => {
        const cells = $(row).find('td');
        
        // Skip header rows and empty rows
        if (cells.length < 5) return;
        
        // Check if this is a property data row by looking for the AcctDetailRes.aspx link
        const addressCell = cells.eq(1);
        const cityCell = cells.eq(2); 
        const ownerCell = cells.eq(3);
        const valueCell = cells.eq(4);
        const typeCell = cells.eq(5);
        
        const addressLink = addressCell.find('a[href*="AcctDetailRes.aspx"]');
        const isPropertyRow = addressLink.length > 0;
        
        if (isPropertyRow) {
          console.log(`  ✅ Found property data row in table ${tableIndex}, row ${i}`);
          
          // Extract the requested field
          switch(field) {
            case 'owner':
              const ownerSpan = ownerCell.find('span').first();
              const ownerName = ownerSpan.length ? ownerSpan.text().trim() : ownerCell.text().trim();
              console.log(`    Owner text: "${ownerName}"`);
              if (ownerName && ownerName !== '') {
                result = ownerName;
                console.log(`    ✅ Owner extracted: "${result}"`);
                return false;
              }
              break;
              
            case 'value':
              const valueSpan = valueCell.find('span').first();
              const value = valueSpan.length ? valueSpan.text().trim() : valueCell.text().trim();
              console.log(`    Value text: "${value}"`);
              if (value && (value.includes('$') || /\d/.test(value))) {
                result = value.replace(/[^\d,.$]/g, ''); // Clean but preserve $ and commas
                console.log(`    ✅ Value extracted: "${result}"`);
                return false;
              }
              break;
              
            case 'type':
              const typeSpan = typeCell.find('span').first();  
              const type = typeSpan.length ? typeSpan.text().trim() : typeCell.text().trim();
              console.log(`    Type text: "${type}"`);
              if (type && type !== '') {
                result = type;
                console.log(`    ✅ Type extracted: "${result}"`);
                return false;
              }
              break;
              
            case 'address':
              const address = addressLink.text().trim();
              console.log(`    Address link text: "${address}"`);
              if (address && address !== '') {
                result = address;
                console.log(`    ✅ Address extracted: "${result}"`);
                return false;
              }
              break;
              
            case 'city':
              const city = cityCell.text().trim();
              console.log(`    City text: "${city}"`);
              if (city && city !== '') {
                result = city;
                console.log(`    ✅ City extracted: "${result}"`);
                return false;
              }
              break;
              
            case 'account_id':
              const href = addressLink.attr('href');
              const idMatch = href ? href.match(/ID=([^&]+)/) : null;
              if (idMatch) {
                result = idMatch[1];
                console.log(`    ✅ Account ID extracted: "${result}"`);
                return false;
              }
              break;
          }
        }
      });
    });
    
    console.log(`🔍 Enhanced CAD Parser - Final result for ${field}: "${result}"`);
    return result;
  }

  /**
   * Execute multiple extraction strategies until one succeeds
   */
  executeStrategies(strategies) {
    console.log(`🔧 executeStrategies: Running ${strategies.length} strategies`);
    
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      try {
        console.log(`  Strategy ${i + 1}: Executing...`);
        const result = strategy();
        console.log(`  Strategy ${i + 1}: Result = "${result}"`);
        
        if (result && result.trim() && result !== 'undefined') {
          console.log(`  ✅ Strategy ${i + 1} succeeded with: "${result.trim()}"`);
          return result.trim();
        } else {
          console.log(`  ❌ Strategy ${i + 1} failed: result is empty/undefined`);
        }
      } catch (error) {
        console.log(`  ❌ Strategy ${i + 1} threw error: ${error.message}`);
        // Continue to next strategy
      }
    }
    
    console.log(`  🚫 All strategies failed, returning null`);
    return null;
  }

  /**
   * Extract data using regex patterns
   */
  extractWithPatterns(html, patterns) {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Extract from table cells using keyword matching
   */
  extractFromTableCell($, keyword) {
    const regex = new RegExp(keyword, 'i');
    
    $('td, th').each((i, element) => {
      const cellText = $(element).text();
      if (regex.test(cellText)) {
        const nextCell = $(element).next('td');
        if (nextCell.length) {
          return nextCell.text().trim();
        }
      }
    });
    
    return null;
  }

  /**
   * Extract from CSS selectors
   */
  extractFromSelector($, selector) {
    const element = $(selector).first();
    return element.length ? element.text().trim() : null;
  }

  /**
   * Parse monetary values removing currency symbols and commas
   */
  parseMoneyValue(value) {
    if (!value) return 0;
    
    const cleanValue = value.replace(/[\$,\s]/g, '');
    const parsed = parseInt(cleanValue, 10);
    
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Clean and standardize address format
   */
  cleanAddress(address) {
    if (!address) return null;
    
    return address
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s,.-]/g, '')
      .trim()
      .toUpperCase();
  }

  /**
   * Normalize tax status to standard values
   */
  normalizeTaxStatus(status) {
    if (!status) return 'UNKNOWN';
    
    const normalized = status.toUpperCase().trim();
    
    if (['CURRENT', 'PAID', 'UP TO DATE'].includes(normalized)) {
      return 'CURRENT';
    } else if (['DELINQUENT', 'UNPAID', 'OVERDUE'].includes(normalized)) {
      return 'DELINQUENT';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Count non-null extracted fields
   */
  countNonNullFields(data = this.lastExtractedData) {
    if (!data) return 0;
    
    let count = 0;
    const countObject = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          countObject(value, fullPath);
        } else if (value !== null && value !== undefined && value !== '' && value !== 'NOT FOUND') {
          count++;
        }
      }
    };
    
    countObject(data);
    return count;
  }

  /**
   * Get total expected field count
   */
  getTotalFieldCount() {
    return 15; // Expected fields: address, owner, property value, tax amount, year built, etc.
  }

  /**
   * Assess quality of data extraction
   */
  assessExtractionQuality(data = this.lastExtractedData) {
    const extractedFields = this.countNonNullFields(data);
    const totalFields = this.getTotalFieldCount();
    
    return Math.round((extractedFields / totalFields) * 100);
  }

  /**
   * Validate if extraction was successful
   */
  isValidExtraction(data) {
    const requiredFields = ['ownership.ownerName', 'address'];
    
    return requiredFields.every(field => {
      const value = _.get(data, field);
      return value && value !== 'NOT FOUND' && value !== 'UNKNOWN';
    });
  }

  /**
   * Clean and validate all extracted data
   */
  cleanAndValidateData(data) {
    // Remove empty strings and null values
    const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
      if (value === '' || value === null || value === undefined) {
        return null;
      }
      return value;
    }));

    return cleaned;
  }

  /**
   * Create error response for failed extractions
   */
  createErrorResponse(error, originalData) {
    return {
      error: true,
      message: error.message,
      address: originalData.address || 'UNKNOWN',
      extractedAt: new Date().toISOString(),
      extractionQuality: 0
    };
  }

  /**
   * Extract land value from Dallas CAD HTML
   */
  extractLandValue(html, $) {
    const landValuePatterns = [
      /Land\s*Value\s*:?\s*\$?([\d,]+)/i,
      /Land\s*:?\s*\$?([\d,]+)/i,
      /"land[_-]?value"[^>]*>\$?([\d,]+)/i
    ];
    
    return this.extractWithPatterns(html, landValuePatterns) || this.extractFromTableCell($, 'land') || '0';
  }

  /**
   * Extract improvement value from Dallas CAD HTML
   */
  extractImprovementValue(html, $) {
    const improvementPatterns = [
      /Improvement\s*Value\s*:?\s*\$?([\d,]+)/i,
      /Improvements\s*:?\s*\$?([\d,]+)/i,
      /"improvement[_-]?value"[^>]*>\$?([\d,]+)/i
    ];
    
    return this.extractWithPatterns(html, improvementPatterns) || this.extractFromTableCell($, 'improvement') || '0';
  }

  /**
   * Extract market value from Dallas CAD HTML
   */
  extractMarketValue(html, $) {
    const marketValuePatterns = [
      /Market\s*Value\s*:?\s*\$?([\d,]+)/i,
      /Appraised\s*Value\s*:?\s*\$?([\d,]+)/i,
      /"market[_-]?value"[^>]*>\$?([\d,]+)/i
    ];
    
    return this.extractWithPatterns(html, marketValuePatterns) || this.extractFromTableCell($, 'market') || '0';
  }

  /**
   * Extract tax amount from Dallas CAD HTML
   */
  extractTaxAmount(html, $) {
    const taxPatterns = [
      /Tax\s*Amount\s*:?\s*\$?([\d,]+)/i,
      /Annual\s*Tax\s*:?\s*\$?([\d,]+)/i,
      /"tax[_-]?amount"[^>]*>\$?([\d,]+)/i
    ];
    
    return this.extractWithPatterns(html, taxPatterns) || this.extractFromTableCell($, 'tax') || '0';
  }

  /**
   * Extract tax year from Dallas CAD HTML
   */
  extractTaxYear(html, $) {
    const taxYearPatterns = [
      /Tax\s*Year\s*:?\s*(\d{4})/i,
      /Year\s*:?\s*(\d{4})/i,
      /"tax[_-]?year"[^>]*>(\d{4})/i
    ];
    
    return this.extractWithPatterns(html, taxYearPatterns) || new Date().getFullYear().toString();
  }

  /**
   * Extract tax status from Dallas CAD HTML
   */
  extractTaxStatus(html, $) {
    return this.extractWithPatterns(html, this.patterns.taxStatus) || 'UNKNOWN';
  }

  /**
   * Extract exemptions from Dallas CAD HTML
   */
  extractExemptions(html, $) {
    const exemptionPatterns = [
      /Exemption\s*:?\s*([A-Z\s,]+)/i,
      /Exemptions\s*:?\s*([A-Z\s,]+)/i,
      /"exemption[s]?"[^>]*>([^<]+)/i
    ];
    
    const exemption = this.extractWithPatterns(html, exemptionPatterns);
    return exemption ? exemption.split(',').map(e => e.trim()) : [];
  }

  /**
   * Extract year built from Dallas CAD HTML
   */
  extractYearBuilt(html, $) {
    const yearBuiltPatterns = [
      /Year\s*Built\s*:?\s*(\d{4})/i,
      /Built\s*:?\s*(\d{4})/i,
      /"year[_-]?built"[^>]*>(\d{4})/i
    ];
    
    return this.extractWithPatterns(html, yearBuiltPatterns) || '';
  }

  /**
   * Extract square footage from Dallas CAD HTML
   */
  extractSquareFootage(html, $) {
    const sqftPatterns = [
      /Square\s*Feet\s*:?\s*([\d,]+)/i,
      /Sq\.?\s*Ft\.?\s*:?\s*([\d,]+)/i,
      /"sq[_-]?ft"[^>]*>([\d,]+)/i
    ];
    
    return this.extractWithPatterns(html, sqftPatterns) || '';
  }

  /**
   * Extract lot size from Dallas CAD HTML
   */
  extractLotSize(html, $) {
    const lotSizePatterns = [
      /Lot\s*Size\s*:?\s*([\d,]+)/i,
      /Acres\s*:?\s*([\d,.]+)/i,
      /"lot[_-]?size"[^>]*>([\d,]+)/i
    ];
    
    return this.extractWithPatterns(html, lotSizePatterns) || '';
  }

  /**
   * Extract property type from Dallas CAD HTML
   */
  extractPropertyType(html, $) {
    const strategies = [
      () => this.extractFromDADSearchResults($, 'type'),
      () => {
        const propertyTypePatterns = [
          /Property\s*Type\s*:?\s*([A-Za-z\s]+)/i,
          /Use\s*Code\s*:?\s*([A-Za-z\s]+)/i,
          /"property[_-]?type"[^>]*>([^<]+)/i
        ];
        return this.extractWithPatterns(html, propertyTypePatterns);
      }
    ];
    
    return this.executeStrategies(strategies) || 'Single Family Residential';
  }

  /**
   * Extract bedrooms from Dallas CAD HTML
   */
  extractBedrooms(html, $) {
    const bedroomPatterns = [
      /Bedrooms\s*:?\s*(\d+)/i,
      /Beds\s*:?\s*(\d+)/i,
      /"bedrooms?"[^>]*>(\d+)/i
    ];
    
    return this.extractWithPatterns(html, bedroomPatterns) || '';
  }

  /**
   * Extract bathrooms from Dallas CAD HTML
   */
  extractBathrooms(html, $) {
    const bathroomPatterns = [
      /Bathrooms\s*:?\s*([\d.]+)/i,
      /Baths\s*:?\s*([\d.]+)/i,
      /"bathrooms?"[^>]*>([\d.]+)/i
    ];
    
    return this.extractWithPatterns(html, bathroomPatterns) || '';
  }

  /**
   * Extract owner address from Dallas CAD HTML
   */
  extractOwnerAddress(html, $) {
    const ownerAddressPatterns = [
      /Owner\s*Address\s*:?\s*([^<\n]+)/i,
      /Mailing\s*Address\s*:?\s*([^<\n]+)/i,
      /"owner[_-]?address"[^>]*>([^<]+)/i
    ];
    
    return this.extractWithPatterns(html, ownerAddressPatterns) || '';
  }

  /**
   * Extract ownership type from Dallas CAD HTML
   */
  extractOwnershipType(html, $) {
    const name = this.extractOwnerName(html, $);
    if (!name) return 'unknown';
    
    if (/\b(TRUST|TR)\b/i.test(name)) return 'trust';
    if (/\b(ESTATE|DECEASED)\b/i.test(name)) return 'estate';
    if (/\b(LLC|INC|CORP|LTD|COMPANY)\b/i.test(name)) return 'corporation';
    if (/\b(AND|&)\b/i.test(name)) return 'joint';
    
    return 'individual';
  }

  /**
   * Extract last sale date from Dallas CAD HTML
   */
  extractLastSaleDate(html, $) {
    const saleDatePatterns = [
      /Last\s*Sale\s*Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /Sale\s*Date\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /"sale[_-]?date"[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})/i
    ];
    
    return this.extractWithPatterns(html, saleDatePatterns) || '';
  }

  /**
   * Extract last sale price from Dallas CAD HTML
   */
  extractLastSalePrice(html, $) {
    const salePricePatterns = [
      /Last\s*Sale\s*Price\s*:?\s*\$?([\d,]+)/i,
      /Sale\s*Price\s*:?\s*\$?([\d,]+)/i,
      /"sale[_-]?price"[^>]*>\$?([\d,]+)/i
    ];
    
    return this.extractWithPatterns(html, salePricePatterns) || '';
  }

  /**
   * Calculate ownership duration from Dallas CAD HTML
   */
  calculateOwnershipDuration(html, $) {
    const saleDate = this.extractLastSaleDate(html, $);
    if (!saleDate) return null;
    
    try {
      const saleDateObj = new Date(saleDate);
      const currentDate = new Date();
      const diffTime = Math.abs(currentDate - saleDateObj);
      const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
      return diffYears;
    } catch (error) {
      return null;
    }
  }

  /**
   * Infer property condition from available data
   */
  inferPropertyCondition(html, $) {
    const age = this.calculatePropertyAge(html, $);
    const exemptions = this.extractExemptions(html, $);
    
    // Simple heuristic based on age and exemptions
    if (age > 50) return 'needs_renovation';
    if (age > 30) return 'dated';
    if (exemptions.includes('HOMESTEAD')) return 'well_maintained';
    return 'average';
  }

  /**
   * Calculate property age from year built
   */
  calculatePropertyAge(html, $) {
    const yearBuilt = this.extractYearBuilt(html, $);
    if (!yearBuilt) return null;
    
    const currentYear = new Date().getFullYear();
    const year = parseInt(yearBuilt, 10);
    
    return isNaN(year) ? null : currentYear - year;
  }

  /**
   * Extract tax delinquency status
   */
  extractDelinquencyStatus(html, $) {
    const delinquencyPatterns = [
      /delinquent/i,
      /overdue/i,
      /unpaid/i,
      /past.?due/i
    ];
    
    for (const pattern of delinquencyPatterns) {
      if (pattern.test(html)) {
        return 'DELINQUENT';
      }
    }
    
    return 'CURRENT';
  }

  /**
   * Extract prior owners information
   */
  extractPriorOwners(html, $) {
    // This would require access to detailed property history
    // For now, return empty array
    return [];
  }

  /**
   * Extract transfer history
   */
  extractTransferHistory(html, $) {
    // This would require access to detailed property history
    // For now, return empty array
    return [];
  }

  /**
   * Determine neighborhood from location data
   */
  determineNeighborhood(html, $) {
    const city = this.extractFromDADSearchResults($, 'city');
    if (!city) return 'Dallas';
    
    // Map common Dallas area locations to neighborhoods
    const neighborhoodMap = {
      'HIGHLAND PARK': 'Highland Park',
      'UNIVERSITY PARK': 'University Park', 
      'DALLAS': 'Dallas'
    };
    
    return neighborhoodMap[city.trim().toUpperCase()] || city.trim();
  }

  /**
   * Extract school district information
   */
  extractSchoolDistrict(html, $) {
    const city = this.extractFromDADSearchResults($, 'city');
    if (!city) return 'Dallas ISD';
    
    // Map cities to school districts
    const schoolDistrictMap = {
      'HIGHLAND PARK': 'Highland Park ISD',
      'UNIVERSITY PARK': 'Highland Park ISD',
      'DALLAS': 'Dallas ISD'
    };
    
    return schoolDistrictMap[city.trim().toUpperCase()] || 'Dallas ISD';
  }

  /**
   * Determine market area for investment analysis
   */
  determineMarketArea(html, $) {
    const neighborhood = this.determineNeighborhood(html, $);
    
    // Classify market areas for investment purposes
    const premiumAreas = ['Highland Park', 'University Park'];
    const emergingAreas = ['Deep Ellum', 'Bishop Arts', 'Lower Greenville'];
    
    if (premiumAreas.includes(neighborhood)) {
      return 'premium';
    } else if (emergingAreas.includes(neighborhood)) {
      return 'emerging';
    } else {
      return 'standard';
    }
  }

  /**
   * Get extraction statistics
   */
  getStats() {
    return {
      totalAttempts: this.extractionAttempts,
      successfulExtractions: this.successfulExtractions,
      successRate: this.extractionAttempts > 0 ? 
        (this.successfulExtractions / this.extractionAttempts) : 0
    };
  }
}

module.exports = HTMLParser;