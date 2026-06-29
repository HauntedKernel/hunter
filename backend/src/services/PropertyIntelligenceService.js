/**
 * PropertyIntelligenceService - Core orchestration service for property intelligence
 * 
 * Coordinates between data extraction, motivation scoring, and business intelligence
 * to identify high-value motivated seller leads from Dallas CAD data.
 */

const { DallasCADScraper } = require('../scrapers/DallasCADScraper');
const MotivationScorer = require('../scoring/MotivationScorer');
const NameProcessor = require('../processors/NameProcessor');
const GeographicClusterer = require('../clustering/GeographicClusterer');
const TaxDelinquencyDetector = require('../detection/TaxDelinquencyDetector');
const Logger = require('../utils/Logger');
const { getConfig } = require('../config/scraper.config');

class PropertyIntelligenceService {
  constructor(options = {}) {
    this.config = getConfig();
    this.logger = new Logger('PropertyIntelligenceService', {
      logLevel: options.logLevel || this.config.logging.level,
      enableConsole: options.enableConsole !== false
    });
    
    // Initialize core components
    this.scraper = new DallasCADScraper({
      ...this.config.scraper,
      logLevel: this.config.logging.level
    });
    
    this.motivationScorer = new MotivationScorer({
      logLevel: this.config.logging.level
    });
    
    this.nameProcessor = new NameProcessor({
      logLevel: this.config.logging.level
    });
    
    this.geographicClusterer = new GeographicClusterer({
      logLevel: this.config.logging.level
    });
    
    // NEW: Initialize tax delinquency detector
    this.taxDelinquencyDetector = new TaxDelinquencyDetector(this.scraper);
    
    // Service statistics
    this.stats = {
      propertiesProcessed: 0,
      motivatedSellersFound: 0,
      totalMotivationPoints: 0,
      averageProcessingTime: 0,
      startTime: Date.now()
    };
    
    this.logger.info('PropertyIntelligenceService initialized', {
      environment: this.config.environment,
      components: ['DallasCADScraper', 'MotivationScorer', 'NameProcessor', 'GeographicClusterer', 'TaxDelinquencyDetector']
    });
  }

  /**
   * Main method to analyze a property and determine motivation level
   * 
   * @param {Object} propertyData - Property search parameters
   * @returns {Promise<Object>} Complete property intelligence report
   */
  async analyzeProperty(propertyData) {
    const timer = this.logger.createTimer('analyzeProperty');
    const correlationId = this.generateCorrelationId();
    
    try {
      this.logger.info('Starting property analysis', {
        address: propertyData.address,
        correlationId
      });
      
      // Step 1: Extract raw property data from Dallas CAD
      const rawPropertyData = await this.scraper.getPropertyDetails({
        ...propertyData,
        correlationId
      });
      
      // Step 2: NEW - Enhance with tax delinquency data
      const taxEnhancedData = await this.taxDelinquencyDetector.enhanceWithTaxStatus(rawPropertyData);
      
      // Step 3: Process and standardize owner names - Updated for enhanced data structure
      const ownerData = taxEnhancedData.ownership || { ownerName: 'Unknown Owner' };
      const processedOwners = await this.nameProcessor.processOwnerData(
        ownerData,
        { correlationId }
      );
      
      // Step 4: Enhanced motivation scoring with tax data
      const motivationAnalysis = await this.motivationScorer.calculateMotivationScore({
        ...taxEnhancedData,
        processedOwners,
        correlationId
      });
      
      // Step 5: Perform geographic analysis
      const geographicContext = await this.geographicClusterer.analyzeGeographicContext({
        address: propertyData.address,
        coordinates: taxEnhancedData.coordinates || rawPropertyData.coordinates,
        correlationId
      });
      
      // Step 6: Compile enhanced intelligence report with tax data
      const intelligenceReport = this.compileIntelligenceReport({
        rawData: taxEnhancedData,
        processedOwners,
        motivationAnalysis,
        geographicContext,
        correlationId,
        processingTime: timer.end()
      });
      
      // Update statistics
      this.updateStats(intelligenceReport);
      
      // Log final results
      this.logger.logMotivationScoring(
        propertyData,
        motivationAnalysis.totalScore,
        motivationAnalysis.factors
      );
      
      this.logger.info('Property analysis completed', {
        address: propertyData.address,
        motivationScore: motivationAnalysis.totalScore,
        isMotivatedSeller: motivationAnalysis.isMotivatedSeller,
        correlationId
      });
      
      return intelligenceReport;
      
    } catch (error) {
      this.stats.failedAnalyses = (this.stats.failedAnalyses || 0) + 1;
      
      this.logger.error('Property analysis failed', {
        address: propertyData.address,
        error: error.message,
        correlationId
      });
      
      throw new PropertyIntelligenceError(
        `Failed to analyze property: ${error.message}`,
        propertyData,
        error
      );
    }
  }

  /**
   * Find delinquent properties in a specific area and enhance with CAD data
   * 
   * @param {string} area - Area to search (e.g., "Highland Park", "Dallas", zip code)
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Delinquent properties with full property details
   */
  async findDelinquentPropertiesInArea(area, options = {}) {
    const timer = this.logger.createTimer('findDelinquentPropertiesInArea');
    const correlationId = this.generateCorrelationId();
    
    try {
      this.logger.info('Finding delinquent properties in area', { area, correlationId });
      
      // Step 1: Get all candidate properties in the area — any motivation signal
      // (delinquent OR elderly OR absentee), not just tax-delinquent ones.
      const delinquentProperties = await this.taxDelinquencyDetector.taxScraper.searchCandidatePropertiesByArea(area, options);
      
      if (delinquentProperties.length === 0) {
        this.logger.info('No delinquent properties found in area', { area });
        return {
          statistics: {
            totalFound: 0,
            totalProcessed: 0,
            successRate: 1,
            area: area
          },
          delinquentProperties: [],
          allResults: [],
          failures: [],
          metadata: {
            searchArea: area,
            processingTime: timer.end(),
            correlationId
          }
        };
      }
      
      this.logger.info(`Found ${delinquentProperties.length} delinquent properties, scoring in-process`);

      // Step 2: Score each property with the MotivationScorer. This is fully
      // in-process (no network), so an entire area scores in milliseconds.
      //
      // NOTE: We deliberately do NOT scrape dallascad.org per property here.
      // The tax roll already gives us owner, value, amount owed, years
      // delinquent and exemptions — everything needed for a lead. CAD
      // enrichment (house number, beds/baths/sqft) is deferred and runs lazily
      // via POST /api/property/analyze only when a single lead is opened. This
      // turned ~5 min, fragile, per-search scraping into an instant DB query.
      const enhancedProperties = [];
      const failures = [];

      for (const delinquentProperty of delinquentProperties) {
        try {
          const lead = await this.buildLeadFromTaxRecord(delinquentProperty, correlationId);
          enhancedProperties.push(lead);
        } catch (error) {
          this.logger.warn('Failed to score delinquent property', {
            address: delinquentProperty.address,
            error: error.message
          });
          failures.push({ property: delinquentProperty, error: error.message });
        }
      }

      // Rank by motivation, then urgency as the tiebreaker. Motivation often
      // clusters (many 1-year delinquencies score similarly), so urgency —
      // which weighs balance size, years behind and absentee ownership — is what
      // actually separates the best opportunities.
      enhancedProperties.sort((a, b) => {
        const m = (b.motivation?.totalScore || 0) - (a.motivation?.totalScore || 0);
        if (m !== 0) return m;
        return (b.taxDelinquency?.urgencyScore || 0) - (a.taxDelinquency?.urgencyScore || 0);
      });

      this.logger.info(`Scored ${enhancedProperties.length} delinquent properties from tax roll DB`);

      return {
        statistics: {
          totalFound: delinquentProperties.length,
          totalProcessed: enhancedProperties.length,
          successRate: enhancedProperties.length / delinquentProperties.length,
          area: area,
          averageAmountOwed: enhancedProperties.reduce((sum, p) => sum + (p.taxDelinquency?.amountOwed || 0), 0) / (enhancedProperties.length || 1)
        },
        delinquentProperties: enhancedProperties,
        allResults: enhancedProperties, // All results are delinquent
        failures: failures,
        metadata: {
          searchArea: area,
          processingTime: timer.end(),
          correlationId,
          source: 'tax_roll_db',
          enriched: false, // CAD enrichment is lazy, per-lead
          sources: [...new Set(delinquentProperties.map(p => p.source))]
        }
      };
      
    } catch (error) {
      this.logger.error('Failed to find delinquent properties in area', {
        area,
        error: error.message,
        correlationId
      });
      
      throw new PropertyIntelligenceError(
        `Failed to find delinquent properties in ${area}: ${error.message}`,
        { area },
        error
      );
    }
  }

  /**
   * Build a scored lead from a single tax-roll record, with no network calls.
   *
   * Maps the tax-roll fields into the shape expected by both the MotivationScorer
   * and the API response formatter, then runs the multi-factor motivation score.
   *
   * @param {Object} dp - Formatted delinquent property from TaxRollProcessor
   * @param {string} correlationId
   * @returns {Promise<Object>} Analysis object (consumed by formatAnalysisResponse)
   */
  async buildLeadFromTaxRecord(dp, correlationId) {
    const currentValue = dp.totalValue || 0;

    // Patent-worthy multi-factor scoring — runs in-process from tax data alone.
    const motivation = await this.motivationScorer.calculateMotivationScore({
      address: dp.address,
      correlationId,
      taxation: { totalValue: currentValue, taxAmount: dp.taxAmount, totalAmountDue: dp.totalAmountDue },
      taxDelinquency: {
        isDelinquent: true,
        amountOwed: dp.amountOwed,
        yearsDelinquent: dp.yearsDelinquent
      },
      ownerName: dp.ownerName,
      // Ownership tenure (years held), from the DCAD appraisal file. Drives the
      // tenure prior + the long-tenure×elderly free-and-clear proxy in the scorer.
      tenureYears: dp.tenureYears != null ? dp.tenureYears : null,
      // Life-stage / legal signals (see STRATEGY.md). Absentee + elderly come
      // straight from the tax roll; pre-foreclosure is joined from legal_events;
      // arrest stays null until a feed is wired.
      signals: {
        absenteeOwner: !!dp.isAbsentee,
        elderlyOwner: !!(dp.over65Exemption || dp.disabledExemption),
        over65: !!dp.over65Exemption,
        disabled: !!dp.disabledExemption,
        emptyNester: !!dp.isEmptyNester,
        estate: !!dp.isEstate,
        taxSuit: !!dp.isTaxSuit,
        divorce: !!dp.isDivorce,
        freeAndClear: !!dp.isFreeAndClear,
        codeCompliance: !!dp.isCodeViolation,
        codeRequestType: dp.codeRequestType || null,
        tenureYears: dp.tenureYears != null ? dp.tenureYears : null,
        ownerAge: dp.ownerAge || null,
        preForeclosure: dp.isPreForeclosure
          ? { eventType: dp.legalEventType, saleDate: dp.legalSaleDate }
          : null,
        arrest: null
      }
    });

    return {
      property: {
        address: dp.address,
        accountId: dp.accountId,
        currentValue,
        propertyType: 'RESIDENTIAL'
      },
      ownership: {
        ownerName: dp.ownerName,
        ownerAddress: dp.ownerAddress
      },
      taxation: {
        totalValue: currentValue,
        taxAmount: dp.taxAmount,
        taxYear: dp.taxYear,
        exemptions: dp.exemptions
      },
      taxDelinquency: {
        status: dp.status || (dp.isDelinquent ? 'DELINQUENT' : 'CURRENT'),
        isDelinquent: !!dp.isDelinquent,
        amountOwed: dp.amountOwed || 0,
        yearsDelinquent: dp.yearsDelinquent || 0,
        foreclosureRisk: dp.foreclosureRisk,
        urgencyScore: dp.isDelinquent ? this.calculateUrgencyScore(dp) : 0,
        paymentStatus: dp.paymentStatus,
        detectedAt: new Date().toISOString()
      },
      motivation,
      geographic: {
        neighborhood: this.deriveNeighborhood(dp)
      },
      financial: {
        currentValue,
        taxAmount: dp.taxAmount,
        delinquentAmount: dp.amountOwed
      },
      metadata: {
        source: 'tax_roll_db',
        enriched: false, // CAD details available lazily via /api/property/analyze
        correlationId
      }
    };
  }

  /**
   * Urgency score (0-100): how time-sensitive this opportunity is. Larger
   * balances, more years behind, no homestead (likely non-owner-occupied) and
   * higher foreclosure risk all raise urgency.
   */
  calculateUrgencyScore(dp) {
    let score = 0;

    const owed = dp.amountOwed || 0;
    if (owed > 15000) score += 40;
    else if (owed > 7500) score += 32;
    else if (owed > 2500) score += 24;
    else if (owed > 1000) score += 16;
    else score += 8;

    const years = dp.yearsDelinquent || 0;
    if (years >= 3) score += 30;
    else if (years >= 2) score += 20;
    else score += 8;

    if (!dp.homesteadExemption) score += 15; // likely investment / absentee owner
    if (dp.foreclosureRisk === 'HIGH') score += 15;
    else if (dp.foreclosureRisk === 'MEDIUM') score += 8;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Best-effort neighborhood label from the property's ZIP prefix, falling back
   * to the recorded city.
   */
  deriveNeighborhood(dp) {
    const zip5 = String(dp.zipCode || '').slice(0, 5);
    const ZIP_NEIGHBORHOODS = {
      '75205': 'Highland Park / University Park',
      '75219': 'Highland Park / Oak Lawn',
      '75225': 'University Park / Preston Hollow',
      '75229': 'Preston Hollow',
      '75230': 'Preston Hollow',
      '75206': 'Lakewood / M Streets',
      '75214': 'Lakewood',
      '75208': 'Oak Cliff / Bishop Arts',
      '75201': 'Uptown / Downtown',
      '75204': 'Uptown',
      '75226': 'Deep Ellum'
    };
    return ZIP_NEIGHBORHOODS[zip5] || (dp.city ? this.titleCase(dp.city) : 'Dallas');
  }

  titleCase(str) {
    return String(str).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Analyze multiple properties in batch with intelligent prioritization
   * 
   * @param {Array} propertyList - List of properties to analyze
   * @param {Object} options - Batch processing options
   * @returns {Promise<Object>} Batch analysis results
   */
  async analyzeBatch(propertyList, options = {}) {
    const timer = this.logger.createTimer('analyzeBatch');
    const batchId = this.generateCorrelationId();
    const concurrency = options.concurrency || 3;
    const prioritizeHighValue = options.prioritizeHighValue !== false;
    
    this.logger.info('Starting batch analysis', {
      propertyCount: propertyList.length,
      concurrency,
      batchId
    });
    
    try {
      // Prioritize properties if requested
      let processedList = propertyList;
      if (prioritizeHighValue) {
        processedList = this.prioritizePropertiesForAnalysis(propertyList);
      }
      
      // Process in controlled batches to respect rate limits
      const results = [];
      const failures = [];
      
      for (let i = 0; i < processedList.length; i += concurrency) {
        const batch = processedList.slice(i, i + concurrency);
        
        this.logger.debug(`Processing batch ${Math.floor(i/concurrency) + 1}`, {
          batchSize: batch.length,
          remaining: processedList.length - i - concurrency,
          batchId
        });
        
        const batchPromises = batch.map(async (property) => {
          try {
            const result = await this.analyzeProperty(property);
            return { success: true, property, result };
          } catch (error) {
            return { success: false, property, error };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Separate successes and failures
        for (const batchResult of batchResults) {
          if (batchResult.success) {
            results.push(batchResult.result);
          } else {
            failures.push(batchResult);
          }
        }
        
        // Rate limiting between batches
        if (i + concurrency < processedList.length) {
          await this.delayBetweenBatches();
        }
      }
      
      // Compile batch results
      const batchReport = this.compileBatchReport(results, failures, {
        batchId,
        processingTime: timer.end(),
        originalCount: propertyList.length
      });
      
      this.logger.info('Batch analysis completed', {
        totalProperties: propertyList.length,
        successful: results.length,
        failed: failures.length,
        motivatedSellers: batchReport.motivatedSellers.length,
        averageScore: batchReport.statistics.averageMotivationScore,
        batchId
      });
      
      return batchReport;
      
    } catch (error) {
      this.logger.error('Batch analysis failed', {
        error: error.message,
        batchId
      });
      
      throw error;
    }
  }

  /**
   * Get property recommendations based on motivation scoring
   * 
   * @param {Object} criteria - Recommendation criteria
   * @returns {Promise<Array>} Prioritized property recommendations
   */
  async getPropertyRecommendations(criteria = {}) {
    const {
      minimumScore = 60,
      maxResults = 50,
      geographicFilters = {},
      ownerTypeFilters = [],
      sortBy = 'motivationScore' // 'motivationScore', 'potential', 'geographic'
    } = criteria;
    
    this.logger.info('Generating property recommendations', {
      minimumScore,
      maxResults,
      sortBy
    });
    
    try {
      // This would integrate with a database/cache of previously analyzed properties
      // For now, return a structured response format
      const recommendations = {
        highPriority: [], // Score 80+
        mediumPriority: [], // Score 60-79
        geographic: [], // Geographic clustering opportunities
        emergent: [], // Recently identified opportunities
        metadata: {
          criteria,
          generatedAt: new Date().toISOString(),
          totalCandidates: 0
        }
      };
      
      this.logger.info('Property recommendations generated', {
        highPriority: recommendations.highPriority.length,
        mediumPriority: recommendations.mediumPriority.length,
        geographic: recommendations.geographic.length
      });
      
      return recommendations;
      
    } catch (error) {
      this.logger.error('Failed to generate recommendations', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Compile comprehensive intelligence report
   */
  compileIntelligenceReport(data) {
    const {
      rawData,
      processedOwners,
      motivationAnalysis,
      geographicContext,
      correlationId,
      processingTime
    } = data;
    
    return {
      // Core Property Information - Enhanced with new CAD structure
      property: {
        address: rawData.address || rawData.location?.address,
        accountId: rawData.accountId || rawData.metadata?.cadAccountId,
        propertyType: rawData.property?.propertyType,
        yearBuilt: rawData.property?.yearBuilt,
        squareFeet: rawData.property?.squareFootage,
        lotSize: rawData.property?.lotSize,
        bedrooms: rawData.property?.bedrooms,
        bathrooms: rawData.property?.bathrooms,
        condition: rawData.property?.condition,
        age: rawData.property?.age,
        lastSaleDate: rawData.historical?.lastSaleDate,
        lastSalePrice: rawData.historical?.lastSalePrice
      },
      
      // Location Information - New structured data
      location: {
        address: rawData.location?.address,
        city: rawData.location?.city,
        county: rawData.location?.county || 'Dallas',
        state: rawData.location?.state || 'TX'
      },
      
      // Tax and Valuation Data - Enhanced with CAD structure
      taxation: {
        totalValue: rawData.valuation?.totalValue,
        assessedValue: rawData.valuation?.assessedValue,
        landValue: rawData.valuation?.landValue,
        improvementValue: rawData.valuation?.improvementValue,
        marketValue: rawData.valuation?.marketValue,
        taxYear: rawData.taxation?.taxYear,
        taxAmount: rawData.taxation?.taxAmount,
        taxStatus: rawData.taxation?.taxStatus,
        delinquencyStatus: rawData.taxation?.delinquencyStatus,
        exemptions: rawData.taxation?.exemptions
      },
      
      // Owner Intelligence - Enhanced with new structure
      ownership: {
        ownerName: rawData.ownership?.ownerName,
        ownerAddress: rawData.ownership?.ownerAddress,
        ownershipType: rawData.ownership?.ownershipType,
        ownershipDuration: rawData.ownership?.ownershipDuration,
        processedOwners: processedOwners,
        decisionComplexity: this.assessDecisionComplexity(rawData.ownership?.ownershipType)
      },
      
      // Historical Data - Enhanced
      historical: {
        lastSaleDate: rawData.historical?.lastSaleDate,
        lastSalePrice: rawData.historical?.lastSalePrice,
        priorOwners: rawData.historical?.priorOwners,
        transferHistory: rawData.historical?.transferHistory
      },
      
      // Motivation Analysis - Unchanged
      motivation: {
        totalScore: motivationAnalysis.totalScore,
        isMotivatedSeller: motivationAnalysis.isMotivatedSeller,
        motivationLevel: motivationAnalysis.motivationLevel,
        confidence: motivationAnalysis.confidence,
        factors: motivationAnalysis.factors
      },
      
      // Geographic Context - Enhanced with CAD data
      geographic: {
        neighborhood: rawData.geographic?.neighborhood || geographicContext?.neighborhood,
        schoolDistrict: rawData.geographic?.schoolDistrict,
        marketArea: rawData.geographic?.marketArea,
        accessibilityScore: geographicContext?.accessibilityScore || this.calculateAccessibilityScore(rawData),
        growthPotential: this.assessGrowthPotential(rawData.geographic),
        investmentGrade: this.calculateInvestmentGrade(rawData)
      },
      
      // Financial Analysis - New section
      financial: {
        currentValue: rawData.valuation?.totalValue,
        taxAmount: rawData.taxation?.taxAmount,
        delinquentAmount: this.calculateDelinquentAmount(rawData.taxation),
        taxBurdenRatio: this.calculateTaxBurdenRatio(rawData.taxation, rawData.valuation)
      },
      
      // Processing Metadata - Include raw CAD data for API access
      metadata: {
        correlationId,
        rawCADData: rawData, // Include the raw extracted CAD data
        processingTime,
        extractionQuality: rawData.metadata?.extractionQuality,
        dataCompleteness: this.calculateDataCompleteness(rawData),
        lastUpdated: new Date().toISOString(),
        sourceUrl: rawData.sourceUrl
      }
    };
  }

  /**
   * Compile batch processing results
   */
  compileBatchReport(results, failures, metadata) {
    const motivatedSellers = results.filter(r => r.motivation.isMotivatedSeller);
    const totalScore = results.reduce((sum, r) => sum + r.motivation.totalScore, 0);
    
    return {
      // Summary Statistics
      statistics: {
        totalProcessed: results.length,
        totalFailed: failures.length,
        successRate: results.length / (results.length + failures.length),
        motivatedSellers: motivatedSellers.length,
        motivatedSellerRate: motivatedSellers.length / results.length,
        averageMotivationScore: results.length > 0 ? totalScore / results.length : 0,
        averageProcessingTime: metadata.processingTime / (results.length + failures.length)
      },
      
      // Categorized Results
      motivatedSellers: motivatedSellers.sort((a, b) => b.motivation.totalScore - a.motivation.totalScore),
      allResults: results,
      failures: failures.map(f => ({
        property: f.property,
        error: f.error.message
      })),
      
      // Geographic Insights
      geographic: {
        neighborhoods: this.analyzeNeighborhoodDistribution(results),
        clusters: this.identifyGeographicClusters(motivatedSellers)
      },
      
      // Processing Metadata
      metadata: {
        ...metadata,
        completedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Utility Methods
   */
  prioritizePropertiesForAnalysis(properties) {
    // Prioritize based on address patterns that typically indicate higher value
    return properties.sort((a, b) => {
      const aScore = this.calculateInitialPriorityScore(a);
      const bScore = this.calculateInitialPriorityScore(b);
      return bScore - aScore;
    });
  }

  calculateInitialPriorityScore(property) {
    let score = 0;
    const address = property.address?.toLowerCase() || '';
    
    // High-value neighborhoods
    if (address.includes('highland park')) score += 20;
    if (address.includes('university park')) score += 18;
    if (address.includes('preston hollow')) score += 15;
    if (address.includes('lakewood')) score += 12;
    
    return score;
  }

  calculateDataCompleteness(rawData) {
    const fields = [
      'address', 'currentValue', 'taxAmount', 'ownerData',
      'propertyType', 'yearBuilt', 'lastSaleDate'
    ];
    
    const completedFields = fields.filter(field => rawData[field] != null).length;
    return Math.round((completedFields / fields.length) * 100);
  }

  analyzeNeighborhoodDistribution(results) {
    const neighborhoods = {};
    
    for (const result of results) {
      const neighborhood = result.geographic?.neighborhood || 'Unknown';
      if (!neighborhoods[neighborhood]) {
        neighborhoods[neighborhood] = {
          count: 0,
          averageScore: 0,
          motivatedCount: 0
        };
      }
      
      neighborhoods[neighborhood].count++;
      neighborhoods[neighborhood].averageScore += result.motivation.totalScore;
      if (result.motivation.isMotivatedSeller) {
        neighborhoods[neighborhood].motivatedCount++;
      }
    }
    
    // Calculate averages
    for (const neighborhood in neighborhoods) {
      neighborhoods[neighborhood].averageScore /= neighborhoods[neighborhood].count;
    }
    
    return neighborhoods;
  }

  identifyGeographicClusters(motivatedSellers) {
    // Simplified clustering - would be enhanced by GeographicClusterer
    return motivatedSellers.slice(0, 10).map(seller => ({
      address: seller.property.address,
      score: seller.motivation.totalScore,
      coordinates: seller.property.coordinates
    }));
  }

  async delayBetweenBatches() {
    const delay = this.config.scraper.rateLimit || 2000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  updateStats(report) {
    this.stats.propertiesProcessed++;
    this.stats.totalMotivationPoints += report.motivation.totalScore;
    
    if (report.motivation.isMotivatedSeller) {
      this.stats.motivatedSellersFound++;
    }
    
    // Update rolling average
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.propertiesProcessed - 1) + 
       report.metadata.processingTime) / this.stats.propertiesProcessed;
  }

  generateCorrelationId() {
    return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get service statistics and health
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    
    return {
      ...this.stats,
      uptime,
      averageMotivationScore: this.stats.propertiesProcessed > 0 ? 
        this.stats.totalMotivationPoints / this.stats.propertiesProcessed : 0,
      motivatedSellerRate: this.stats.propertiesProcessed > 0 ?
        this.stats.motivatedSellersFound / this.stats.propertiesProcessed : 0,
      
      // Component statistics
      scraper: this.scraper.getStats(),
      motivationScorer: this.motivationScorer?.getStats() || {},
      nameProcessor: this.nameProcessor?.getStats() || {},
      geographicClusterer: this.geographicClusterer?.getStats() || {}
    };
  }

  /**
   * Health check for service
   */
  async healthCheck() {
    try {
      const scraperHealth = await this.scraper.healthCheck();
      const stats = this.getStats();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: stats.uptime,
        propertiesProcessed: stats.propertiesProcessed,
        successRate: stats.propertiesProcessed > 0 ? 
          (stats.propertiesProcessed - (stats.failedAnalyses || 0)) / stats.propertiesProcessed : 1,
        components: {
          scraper: scraperHealth,
          motivationScorer: { status: 'ready' },
          nameProcessor: { status: 'ready' },
          geographicClusterer: { status: 'ready' }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Assess decision complexity based on ownership type
   */
  assessDecisionComplexity(ownershipType) {
    const complexityMap = {
      'individual': 'low',
      'joint': 'medium',
      'trust': 'medium', 
      'estate': 'high',
      'corporation': 'high',
      'llc': 'medium'
    };
    
    return complexityMap[ownershipType?.toLowerCase()] || 'medium';
  }

  /**
   * Calculate accessibility score based on location
   */
  calculateAccessibilityScore(rawData) {
    const neighborhood = rawData.geographic?.neighborhood;
    
    // Basic accessibility scores by area
    const accessibilityMap = {
      'Highland Park': 90,
      'University Park': 88,
      'Dallas': 75,
      'Uptown': 85,
      'Deep Ellum': 80
    };
    
    return accessibilityMap[neighborhood] || 70;
  }

  /**
   * Assess growth potential based on geographic data
   */
  assessGrowthPotential(geographic) {
    const neighborhood = geographic?.neighborhood;
    const marketArea = geographic?.marketArea;
    
    // Growth potential by area
    const growthMap = {
      'Highland Park': 85,
      'University Park': 82,
      'Deep Ellum': 90,
      'Bishop Arts': 88,
      'Lakewood': 80
    };
    
    let baseScore = growthMap[neighborhood] || 65;
    
    // Adjust based on market area
    if (marketArea === 'premium') baseScore += 5;
    if (marketArea === 'emerging') baseScore += 10;
    
    return Math.min(baseScore, 100);
  }

  /**
   * Calculate investment grade based on property data
   */
  calculateInvestmentGrade(rawData) {
    const neighborhood = rawData.geographic?.neighborhood;
    const propertyValue = rawData.valuation?.totalValue || 0;
    const propertyAge = rawData.property?.age || 0;
    
    // Base grade by neighborhood
    const gradeMap = {
      'Highland Park': 'A+',
      'University Park': 'A',
      'Uptown': 'A-',
      'Deep Ellum': 'B+',
      'Dallas': 'B'
    };
    
    let grade = gradeMap[neighborhood] || 'B';
    
    // Adjust based on value and age
    if (propertyValue > 2000000) {
      // Upgrade premium properties
      if (grade === 'A') grade = 'A+';
      if (grade === 'B+') grade = 'A-';
    }
    
    if (propertyAge > 60) {
      // Downgrade very old properties
      if (grade === 'A+') grade = 'A';
      if (grade === 'A') grade = 'A-';
    }
    
    return grade;
  }

  /**
   * Calculate delinquent tax amount
   */
  calculateDelinquentAmount(taxation) {
    if (taxation?.delinquencyStatus === 'DELINQUENT') {
      // Estimate based on tax amount - simple heuristic
      return Math.round((taxation.taxAmount || 0) * 0.5);
    }
    return 0;
  }

  /**
   * Calculate tax burden ratio (taxes as percentage of property value)
   */
  calculateTaxBurdenRatio(taxation, valuation) {
    const taxAmount = taxation?.taxAmount || 0;
    const propertyValue = valuation?.totalValue || valuation?.assessedValue || 0;
    
    if (propertyValue === 0) return 0;
    
    return Number((taxAmount / propertyValue).toFixed(4));
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.scraper.destroy();
    this.logger.info('PropertyIntelligenceService destroyed');
  }
}

/**
 * Custom error class for property intelligence errors
 */
class PropertyIntelligenceError extends Error {
  constructor(message, propertyData, originalError) {
    super(message);
    this.name = 'PropertyIntelligenceError';
    this.propertyData = propertyData;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

module.exports = { PropertyIntelligenceService, PropertyIntelligenceError };