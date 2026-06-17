/**
 * MotivationScorer - Advanced motivation scoring algorithm for motivated seller identification
 * 
 * Implements patent-worthy multi-factor weighted scoring system that combines
 * financial distress indicators, time-based factors, and behavioral patterns
 * to predict seller motivation with high accuracy.
 * 
 * Patent Claims:
 * 1. Multi-factor weighted scoring algorithm with dynamic threshold adjustment
 * 2. Time-decay calculations for ownership duration impact
 * 3. Financial distress quantification with severity levels
 * 4. Behavioral pattern recognition from property data
 */

const _ = require('lodash');
const moment = require('moment');
const Logger = require('../utils/Logger');

class MotivationScorer {
  constructor(options = {}) {
    this.logger = new Logger('MotivationScorer', {
      logLevel: options.logLevel || 'info',
      enableConsole: options.enableConsole !== false
    });

    // Arrest/legal signal is OFF unless explicitly enabled (see STRATEGY.md §6).
    // Flip via `new MotivationScorer({ enableArrestSignal: true })` only after a
    // real arrest data feed exists and legal review has signed off.
    this.enableArrestSignal = options.enableArrestSignal === true;

    // Core scoring weights (Patent Claim: Multi-factor weighted algorithm)
    this.scoringWeights = {
      // Financial Distress Factors (60% of total score)
      taxDelinquency: 40,        // Tax delinquency is strongest predictor
      taxBurdenRatio: 15,        // High taxes relative to value
      valueDeclining: 5,         // Declining property values
      
      // Ownership Duration Factors (25% of total score)
      longTermOwnership: 25,     // 15+ years ownership
      
      // Property Condition Factors (10% of total score)  
      ageDeterioration: 5,       // Very old properties needing work
      maintenanceNeglect: 5,     // Signs of deferred maintenance
      
      // Market Position Factors (5% of total score)
      marketOutlier: 3,          // Property significantly over/under market
      liquidityPressure: 2,      // Market conditions favoring quick sales

      // Legal-event signals (added — see STRATEGY.md §3)
      preForeclosure: 35,        // Notice of Trustee Sale / lis pendens — strongest "about to sell or lose it" signal

      // Life-stage / ownership signals (added — see STRATEGY.md §2)
      absenteeOwner: 12,         // Mailing address != property: tired landlord / out-of-state heir
      elderlyOwner: 10,          // Over-65 or disability exemption: downsizer / estate

      // Legal-event signal (GATED OFF by default — see STRATEGY.md §6).
      // Public record, but high legal/reputational risk: requires an arrest
      // data feed AND legal review before enabling. Contributes 0 until then.
      arrestRecord: 15
    };
    
    // Scoring thresholds for classification
    this.motivationThresholds = {
      high: 70,        // 70+ points = High motivation
      medium: 45,      // 45-69 points = Medium motivation  
      low: 25          // 25-44 points = Low motivation
      // 0-24 points = No significant motivation
    };
    
    // Time decay factors for ownership duration (Patent Claim: Time-decay calculations)
    this.ownershipTimeFactors = {
      immediate: { years: 1, multiplier: 0.5 },    // Recent purchase, low motivation
      shortTerm: { years: 5, multiplier: 0.7 },    // 1-5 years, building motivation
      mediumTerm: { years: 10, multiplier: 0.9 },  // 5-10 years, moderate motivation
      longTerm: { years: 15, multiplier: 1.0 },    // 10-15 years, full motivation
      veryLongTerm: { years: 25, multiplier: 1.2 }, // 15-25 years, high motivation
      generational: { years: 999, multiplier: 1.5 } // 25+ years, maximum motivation
    };
    
    // Financial distress severity levels (Patent Claim: Financial distress quantification)
    this.distressLevels = {
      critical: { threshold: 0.15, multiplier: 2.0 },  // >15% of value in back taxes
      severe: { threshold: 0.10, multiplier: 1.5 },    // 10-15% of value
      moderate: { threshold: 0.05, multiplier: 1.2 },  // 5-10% of value
      mild: { threshold: 0.02, multiplier: 1.0 }       // 2-5% of value
    };
    
    // Statistics tracking
    this.stats = {
      totalScored: 0,
      highMotivationCount: 0,
      averageScore: 0,
      totalScore: 0,
      factorFrequency: {},
      processingTimes: []
    };
    
    this.logger.info('MotivationScorer initialized', {
      totalWeights: Object.values(this.scoringWeights).reduce((a, b) => a + b, 0),
      thresholds: this.motivationThresholds
    });
  }

  /**
   * Main method to calculate comprehensive motivation score
   * 
   * @param {Object} propertyData - Complete property data from scraping
   * @returns {Promise<Object>} Detailed motivation analysis
   */
  async calculateMotivationScore(propertyData) {
    const timer = this.logger.createTimer('calculateMotivationScore');
    
    try {
      this.logger.debug('Starting motivation scoring', {
        address: propertyData.address,
        correlationId: propertyData.correlationId
      });
      
      // Initialize scoring context
      const scoringContext = this.initializeScoringContext(propertyData);
      
      // Calculate individual factor scores
      const factorScores = await this.calculateAllFactors(scoringContext);
      
      // Apply time-based adjustments
      const timeAdjustedScores = this.applyTimeFactors(factorScores, scoringContext);
      
      // Calculate final motivation score
      const finalScore = this.calculateFinalScore(timeAdjustedScores);
      
      // Determine motivation classification
      const classification = this.classifyMotivation(finalScore);
      
      // Identify risk factors and confidence level
      const riskAnalysis = this.analyzeRisks(scoringContext, factorScores);
      
      // Compile comprehensive analysis
      const motivationAnalysis = this.compileMotivationAnalysis({
        finalScore,
        classification,
        factorScores: timeAdjustedScores,
        riskAnalysis,
        scoringContext,
        processingTime: timer.end()
      });
      
      // Update statistics
      this.updateStats(motivationAnalysis);
      
      this.logger.debug('Motivation scoring completed', {
        address: propertyData.address,
        score: finalScore,
        classification: classification.level,
        correlationId: propertyData.correlationId
      });
      
      return motivationAnalysis;
      
    } catch (error) {
      this.logger.error('Motivation scoring failed', {
        address: propertyData.address,
        error: error.message,
        correlationId: propertyData.correlationId
      });
      
      throw new MotivationScoringError(
        `Failed to score property motivation: ${error.message}`,
        propertyData,
        error
      );
    }
  }

  /**
   * Initialize scoring context with normalized data
   */
  initializeScoringContext(propertyData) {
    const currentDate = moment();
    const lastSaleDate = moment(propertyData.lastSaleDate);
    const yearBuilt = parseInt(propertyData.yearBuilt) || currentDate.year();
    
    // Extract current value from nested property structure
    const currentValue = propertyData.valuation?.totalValue || 
                        propertyData.taxation?.totalValue || 
                        parseFloat(propertyData.currentValue) || 0;
    
    return {
      // Property basics - enhanced with new structure support
      address: propertyData.address,
      currentValue: currentValue,
      taxAmount: propertyData.taxation?.taxAmount || parseFloat(propertyData.taxAmount) || 0,
      delinquentAmount: propertyData.taxDelinquency?.amountOwed || parseFloat(propertyData.delinquentAmount) || 0,
      
      // NEW: Include complete property data for enhanced scoring
      propertyData: propertyData,
      
      // Time calculations
      ownershipYears: lastSaleDate.isValid() ? currentDate.diff(lastSaleDate, 'years') : 0,
      propertyAge: currentDate.year() - yearBuilt,
      lastSaleDate: lastSaleDate,
      
      // Owner data - enhanced with new structure
      processedOwners: propertyData.processedOwners || {},
      ownerType: propertyData.ownership?.ownershipType || propertyData.processedOwners?.ownerType || 'individual',

      // Life-stage / legal signals (see STRATEGY.md). `signals.arrest` is null
      // until an arrest data feed is wired.
      isAbsentee: !!propertyData.signals?.absenteeOwner,
      isElderly: !!propertyData.signals?.elderlyOwner,
      preForeclosure: propertyData.signals?.preForeclosure || null,
      arrest: propertyData.signals?.arrest || null,
      
      // Market context
      neighborhoodData: propertyData.geographicContext || {},
      valueHistory: propertyData.valueHistory || [],
      
      // Metadata
      correlationId: propertyData.correlationId,
      extractionQuality: propertyData.metadata?.extractionQuality || 'medium'
    };
  }

  /**
   * Calculate all motivation factors
   */
  async calculateAllFactors(context) {
    const factors = {};
    
    // Financial distress factors
    factors.taxDelinquency = this.calculateTaxDelinquencyScore(context);
    factors.taxBurdenRatio = this.calculateTaxBurdenScore(context);
    factors.valueDeclining = this.calculateValueDeclineScore(context);
    
    // Ownership duration factors
    factors.longTermOwnership = this.calculateOwnershipDurationScore(context);
    
    // Property condition factors
    factors.ageDeterioration = this.calculateAgeDeteriorationScore(context);
    factors.maintenanceNeglect = this.calculateMaintenanceNeglectScore(context);
    
    // Market position factors
    factors.marketOutlier = this.calculateMarketOutlierScore(context);
    factors.liquidityPressure = this.calculateLiquidityPressureScore(context);

    // Legal-event signals
    factors.preForeclosure = this.calculatePreForeclosureScore(context);

    // Life-stage / ownership signals
    factors.absenteeOwner = this.calculateAbsenteeScore(context);
    factors.elderlyOwner = this.calculateElderlyScore(context);

    // Legal-event signal (gated)
    factors.arrestRecord = this.calculateArrestScore(context);

    return factors;
  }

  /**
   * Pre-foreclosure / lis-pendens — the strongest "about to sell or lose it"
   * signal. A pending trustee sale especially means a fast, motivated exit.
   * context.preForeclosure = { eventType, saleDate } | null
   */
  calculatePreForeclosureScore(context) {
    const pf = context.preForeclosure;
    if (!pf) {
      return { score: 0, factor: 'No pre-foreclosure / lis-pendens filing', category: 'legal' };
    }
    const isForeclosure = pf.eventType !== 'lis_pendens';
    // Lis pendens (pending suit, not necessarily a sale) weighs a bit less than
    // an active trustee-sale notice.
    const base = isForeclosure ? this.scoringWeights.preForeclosure : Math.round(this.scoringWeights.preForeclosure * 0.75);
    const label = isForeclosure ? 'Pre-foreclosure (Notice of Trustee Sale)' : 'Lis pendens (pending suit affecting title)';
    const saleSuffix = pf.saleDate ? ` — sale ${pf.saleDate}` : '';
    return {
      score: base,
      factor: `${label}${saleSuffix}`,
      category: 'legal',
      severity: 'high'
    };
  }

  /**
   * Absentee owner — mailing address differs from the property. Strong
   * motivation signal (tired landlord, out-of-state heir).
   */
  calculateAbsenteeScore(context) {
    if (!context.isAbsentee) {
      return { score: 0, factor: 'Owner-occupied (not absentee)', category: 'ownership' };
    }
    return {
      score: this.scoringWeights.absenteeOwner,
      factor: 'Absentee owner — mailing address differs from property',
      category: 'ownership',
      severity: 'medium'
    };
  }

  /**
   * Elderly / disabled owner — over-65 or disability homestead exemption.
   * Correlates with downsizing, estate sales, aging-in-place transitions.
   */
  calculateElderlyScore(context) {
    if (!context.isElderly) {
      return { score: 0, factor: 'No over-65/disability exemption', category: 'life-stage' };
    }
    return {
      score: this.scoringWeights.elderlyOwner,
      factor: 'Elderly/disabled owner (over-65 or disability exemption)',
      category: 'life-stage',
      severity: 'medium'
    };
  }

  /**
   * Arrest / legal-event signal. GATED: contributes nothing unless
   * `enableArrestSignal` is set AND an arrest record is attached. See
   * STRATEGY.md §6 — public record, but high legal/reputational risk.
   * Event-based: more recent arrests weigh more.
   */
  calculateArrestScore(context) {
    if (!this.enableArrestSignal) {
      return { score: 0, factor: 'Arrest signal disabled', category: 'legal', disabled: true };
    }
    const arrest = context.arrest;
    if (!arrest) {
      return { score: 0, factor: 'No arrest record on file', category: 'legal' };
    }
    // Recency-weighted: full weight within 90 days, decaying to ~half by a year.
    const daysAgo = typeof arrest.daysAgo === 'number' ? arrest.daysAgo : 0;
    const recency = daysAgo <= 90 ? 1 : Math.max(0.4, 1 - (daysAgo - 90) / 365);
    const score = Math.round(this.scoringWeights.arrestRecord * recency);
    return {
      score,
      factor: `Arrest record${daysAgo ? ` (${daysAgo}d ago)` : ''}`,
      category: 'legal',
      severity: 'high'
    };
  }

  /**
   * Tax delinquency scoring - strongest motivation predictor
   * Patent Claim: Financial distress quantification with severity levels
   */
  calculateTaxDelinquencyScore(context) {
    // Enhanced to work with new TaxDelinquencyDetector data structure
    const taxDelinquency = context.propertyData?.taxDelinquency;
    
    // Check both old and new data structures for backward compatibility
    const delinquentAmount = taxDelinquency?.amountOwed || context.delinquentAmount || 0;
    const isDelinquent = taxDelinquency?.isDelinquent || (delinquentAmount > 0);
    
    if (!isDelinquent || delinquentAmount <= 0) {
      return { 
        score: 0, 
        factor: 'No tax delinquency detected', 
        severity: 'none',
        timeAdjusted: false
      };
    }
    
    // Use urgency score from TaxDelinquencyDetector if available
    if (taxDelinquency?.urgencyScore && taxDelinquency.urgencyScore > 0) {
      // Convert urgency score (0-100) to motivation points (0-40)
      const score = Math.round((taxDelinquency.urgencyScore / 100) * this.scoringWeights.taxDelinquency);
      
      let severity = 'mild';
      if (taxDelinquency.urgencyScore > 75) severity = 'critical';
      else if (taxDelinquency.urgencyScore > 50) severity = 'severe';
      else if (taxDelinquency.urgencyScore > 25) severity = 'moderate';
      
      const years = taxDelinquency.yearsDelinquent || 0;
      const yearsSuffix = years > 0 ? ` (${years} years)` : '';
      
      return {
        score,
        factor: `Tax delinquency: $${delinquentAmount.toLocaleString()}${yearsSuffix}`,
        severity,
        delinquencyAmount: delinquentAmount,
        urgencyScore: taxDelinquency.urgencyScore,
        yearsDelinquent: years,
        timeAdjusted: false
      };
    }
    
    // Fallback to legacy calculation if urgency score not available
    const currentValue = context.currentValue || 100000; // Reasonable default
    const delinquencyRatio = delinquentAmount / currentValue;
    let severity = 'mild';
    let multiplier = 1.0;
    
    // Determine severity level
    if (this.distressLevels) {
      for (const [level, config] of Object.entries(this.distressLevels)) {
        if (delinquencyRatio >= config.threshold) {
          severity = level;
          multiplier = config.multiplier;
          break;
        }
      }
    }
    
    // Calculate base score
    const baseScore = Math.min(this.scoringWeights.taxDelinquency, 
      (delinquencyRatio * 1000) // Scale ratio to meaningful score
    );
    
    const finalScore = Math.round(baseScore * multiplier);
    
    return {
      score: finalScore,
      factor: `Tax delinquent: $${delinquentAmount.toLocaleString()} (${(delinquencyRatio * 100).toFixed(1)}% of value)`,
      severity,
      delinquencyAmount: delinquentAmount,
      delinquencyRatio
    };
  }

  /**
   * Tax burden ratio scoring - high taxes relative to property value
   */
  calculateTaxBurdenScore(context) {
    if (!context.taxAmount || !context.currentValue || context.currentValue <= 0) {
      return { score: 0, factor: 'Tax burden data unavailable', ratio: 0 };
    }
    
    const taxRatio = context.taxAmount / context.currentValue;
    const normalTaxRate = 0.025; // 2.5% typical tax rate for Dallas area
    
    if (taxRatio <= normalTaxRate) {
      return { score: 0, factor: 'Normal tax burden', ratio: taxRatio };
    }
    
    // Score increases exponentially with tax burden
    const excessRatio = taxRatio - normalTaxRate;
    const score = Math.min(this.scoringWeights.taxBurdenRatio,
      (excessRatio * 300) // Scale to meaningful score
    );
    
    return {
      score: Math.round(score),
      factor: `High tax burden: ${(taxRatio * 100).toFixed(2)}% of value`,
      ratio: taxRatio,
      excessBurden: excessRatio
    };
  }

  /**
   * Property value decline scoring
   */
  calculateValueDeclineScore(context) {
    if (!context.valueHistory || context.valueHistory.length < 2) {
      return { score: 0, factor: 'Insufficient value history', trend: 'unknown' };
    }
    
    // Calculate multi-year trend
    const recentValues = context.valueHistory.slice(-3); // Last 3 years
    const oldValue = recentValues[0]?.value || context.currentValue;
    const currentValue = context.currentValue;
    
    if (currentValue >= oldValue) {
      return { score: 0, factor: 'Property value stable/increasing', trend: 'positive' };
    }
    
    const declineRatio = (oldValue - currentValue) / oldValue;
    const score = Math.min(this.scoringWeights.valueDeclining,
      (declineRatio * 50) // Scale decline to score points
    );
    
    return {
      score: Math.round(score),
      factor: `Value declined ${(declineRatio * 100).toFixed(1)}% over ${recentValues.length} years`,
      trend: 'declining',
      declineRatio
    };
  }

  /**
   * Long-term ownership scoring with time decay
   * Patent Claim: Time-decay calculations for ownership duration impact
   */
  calculateOwnershipDurationScore(context) {
    if (!context.ownershipYears || context.ownershipYears < 1) {
      return { score: 0, factor: 'Recent ownership', duration: context.ownershipYears };
    }
    
    // Find appropriate time factor
    let timeFactor = this.ownershipTimeFactors.immediate;
    for (const [category, factor] of Object.entries(this.ownershipTimeFactors)) {
      if (context.ownershipYears >= factor.years) {
        timeFactor = factor;
      } else {
        break;
      }
    }
    
    // Calculate score with time-based multiplier
    const baseScore = this.scoringWeights.longTermOwnership;
    const score = Math.round(baseScore * timeFactor.multiplier);
    
    return {
      score,
      factor: `${context.ownershipYears} years ownership (${Object.keys(this.ownershipTimeFactors).find(k => this.ownershipTimeFactors[k] === timeFactor)})`,
      duration: context.ownershipYears,
      category: Object.keys(this.ownershipTimeFactors).find(k => this.ownershipTimeFactors[k] === timeFactor),
      multiplier: timeFactor.multiplier
    };
  }

  /**
   * Age deterioration scoring - very old properties needing work
   */
  calculateAgeDeteriorationScore(context) {
    if (!context.propertyAge || context.propertyAge < 30) {
      return { score: 0, factor: 'Property age acceptable', age: context.propertyAge };
    }
    
    // Properties over 50 years typically need significant maintenance
    if (context.propertyAge >= 50) {
      const score = this.scoringWeights.ageDeterioration;
      return {
        score,
        factor: `Property very old: ${context.propertyAge} years (likely needs major updates)`,
        age: context.propertyAge,
        category: 'very-old'
      };
    }
    
    // Properties 30-50 years may need updates
    const score = Math.round(this.scoringWeights.ageDeterioration * 0.6);
    return {
      score,
      factor: `Property aging: ${context.propertyAge} years (may need updates)`,
      age: context.propertyAge,
      category: 'aging'
    };
  }

  /**
   * Maintenance neglect scoring - inferred from data patterns
   */
  calculateMaintenanceNeglectScore(context) {
    let neglectIndicators = 0;
    let score = 0;
    const factors = [];
    
    // Check for neglect indicators
    if (context.taxAmount === 0 && context.currentValue > 0) {
      neglectIndicators++;
      factors.push('No property taxes paid');
    }
    
    if (context.ownerType === 'estate' || context.processedOwners?.hasEstate) {
      neglectIndicators++;
      factors.push('Estate ownership (possible neglect)');
    }
    
    if (context.propertyAge > 40 && context.currentValue < 100000) {
      neglectIndicators++;
      factors.push('Old property with very low value');
    }
    
    // Score based on number of indicators
    if (neglectIndicators >= 2) {
      score = this.scoringWeights.maintenanceNeglect;
    } else if (neglectIndicators === 1) {
      score = Math.round(this.scoringWeights.maintenanceNeglect * 0.5);
    }
    
    return {
      score,
      factor: factors.length > 0 ? factors.join(', ') : 'No maintenance neglect indicators',
      indicators: neglectIndicators,
      details: factors
    };
  }

  /**
   * Market outlier scoring - properties significantly over/under market
   */
  calculateMarketOutlierScore(context) {
    // This would integrate with market data - placeholder implementation
    const marketData = context.neighborhoodData?.marketTrends || {};
    
    if (!marketData.averageValue || !context.currentValue) {
      return { score: 0, factor: 'Market data unavailable', position: 'unknown' };
    }
    
    const valueRatio = context.currentValue / marketData.averageValue;
    
    // Properties significantly undervalued may indicate distress
    if (valueRatio < 0.7) {
      return {
        score: this.scoringWeights.marketOutlier,
        factor: `Property undervalued: ${(valueRatio * 100).toFixed(0)}% of market average`,
        position: 'undervalued',
        ratio: valueRatio
      };
    }
    
    return { score: 0, factor: 'Property valued appropriately', position: 'normal' };
  }

  /**
   * Liquidity pressure scoring - market conditions
   */
  calculateLiquidityPressureScore(context) {
    // Placeholder - would integrate with real market data
    const marketConditions = context.neighborhoodData?.marketTrends || {};
    
    if (marketConditions.daysOnMarket > 90) {
      return {
        score: this.scoringWeights.liquidityPressure,
        factor: `Slow market: ${marketConditions.daysOnMarket} days average`,
        condition: 'slow'
      };
    }
    
    return { score: 0, factor: 'Normal market liquidity', condition: 'normal' };
  }

  /**
   * Apply time-based adjustments to factor scores
   */
  applyTimeFactors(factorScores, context) {
    // Most factors remain as-is, but some get time adjustments
    const adjusted = { ...factorScores };
    
    // Recent ownership reduces most motivation factors
    if (context.ownershipYears < 2) {
      const reductionFactors = ['taxBurdenRatio', 'valueDeclining', 'maintenanceNeglect'];
      for (const factor of reductionFactors) {
        adjusted[factor] = {
          ...adjusted[factor],
          score: Math.round(adjusted[factor].score * 0.7),
          timeAdjusted: true
        };
      }
    }
    
    return adjusted;
  }

  /**
   * Calculate final weighted score
   */
  calculateFinalScore(factorScores) {
    const total = Object.values(factorScores).reduce((sum, factor) => sum + factor.score, 0);
    // Cap at 100: total available weight now exceeds 100 with the added signals.
    return Math.min(100, total);
  }

  /**
   * Classify motivation level based on score
   */
  classifyMotivation(score) {
    if (score >= this.motivationThresholds.high) {
      return { level: 'high', description: 'Highly motivated seller - strong indicators', confidence: 'high' };
    } else if (score >= this.motivationThresholds.medium) {
      return { level: 'medium', description: 'Moderately motivated seller - some indicators', confidence: 'medium' };
    } else if (score >= this.motivationThresholds.low) {
      return { level: 'low', description: 'Potentially motivated seller - few indicators', confidence: 'low' };
    } else {
      return { level: 'minimal', description: 'No significant motivation indicators', confidence: 'high' };
    }
  }

  /**
   * Analyze risk factors and confidence
   */
  analyzeRisks(context, factorScores) {
    const risks = [];
    const strengths = [];
    let confidenceFactors = [];
    
    // Data quality risks
    if (context.extractionQuality === 'low') {
      risks.push('Low data extraction quality may affect accuracy');
      confidenceFactors.push(-10);
    }
    
    // Insufficient data risks
    if (!context.lastSaleDate.isValid()) {
      risks.push('No ownership duration data available');
      confidenceFactors.push(-5);
    }
    
    // Strong indicators
    if (factorScores.taxDelinquency.score > 20) {
      strengths.push('Strong tax delinquency indicator');
      confidenceFactors.push(15);
    }
    
    if (factorScores.longTermOwnership.score > 20) {
      strengths.push('Long-term ownership supports motivation');
      confidenceFactors.push(10);
    }
    
    // Calculate overall confidence
    const baseConfidence = 70;
    const confidenceAdjustment = confidenceFactors.reduce((sum, factor) => sum + factor, 0);
    const confidence = Math.max(0, Math.min(100, baseConfidence + confidenceAdjustment));
    
    return {
      risks,
      strengths,
      confidence,
      confidenceFactors
    };
  }

  /**
   * Compile comprehensive motivation analysis
   */
  compileMotivationAnalysis(data) {
    const { finalScore, classification, factorScores, riskAnalysis, scoringContext, processingTime } = data;
    
    return {
      // Core Results
      totalScore: finalScore,
      maxPossibleScore: Object.values(this.scoringWeights).reduce((a, b) => a + b, 0),
      isMotivatedSeller: finalScore >= this.motivationThresholds.medium,
      motivationLevel: classification.level,
      confidence: riskAnalysis.confidence,
      
      // Detailed Factor Analysis
      factors: Object.entries(factorScores).map(([name, data]) => ({
        type: name,
        points: data.score,
        maxPoints: this.scoringWeights[name] || 0,
        description: data.factor,
        severity: data.severity || null,
        category: data.category || null,
        timeAdjusted: data.timeAdjusted || false
      })),
      
      // Risk Assessment
      riskFactors: riskAnalysis.risks,
      strengths: riskAnalysis.strengths,
      
      // Time-based Analysis
      timeFactors: {
        ownershipYears: scoringContext.ownershipYears,
        propertyAge: scoringContext.propertyAge,
        ownershipCategory: factorScores.longTermOwnership.category
      },
      
      // Financial Analysis
      financialFactors: {
        currentValue: scoringContext.currentValue,
        taxAmount: scoringContext.taxAmount,
        delinquentAmount: scoringContext.delinquentAmount,
        taxBurdenRatio: factorScores.taxBurdenRatio.ratio,
        delinquencyRatio: factorScores.taxDelinquency.delinquencyRatio
      },
      
      // Classification Details
      classification: {
        ...classification,
        thresholds: this.motivationThresholds,
        scorePercentage: (finalScore / Object.values(this.scoringWeights).reduce((a, b) => a + b, 0)) * 100
      },
      
      // Processing Metadata
      metadata: {
        scoringVersion: '1.0',
        processingTime,
        scoredAt: new Date().toISOString(),
        correlationId: scoringContext.correlationId
      }
    };
  }

  /**
   * Update internal statistics
   */
  updateStats(analysis) {
    this.stats.totalScored++;
    this.stats.totalScore += analysis.totalScore;
    this.stats.averageScore = this.stats.totalScore / this.stats.totalScored;
    this.stats.processingTimes.push(analysis.metadata.processingTime);
    
    if (analysis.motivationLevel === 'high') {
      this.stats.highMotivationCount++;
    }
    
    // Track factor frequency
    for (const factor of analysis.factors) {
      if (factor.points > 0) {
        this.stats.factorFrequency[factor.type] = 
          (this.stats.factorFrequency[factor.type] || 0) + 1;
      }
    }
  }

  /**
   * Get scoring statistics
   */
  getStats() {
    const avgProcessingTime = this.stats.processingTimes.length > 0 ?
      this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length : 0;
    
    return {
      totalScored: this.stats.totalScored,
      averageScore: Math.round(this.stats.averageScore * 100) / 100,
      highMotivationRate: this.stats.totalScored > 0 ? 
        this.stats.highMotivationCount / this.stats.totalScored : 0,
      averageProcessingTime: Math.round(avgProcessingTime),
      factorFrequency: { ...this.stats.factorFrequency },
      scoringWeights: { ...this.scoringWeights },
      thresholds: { ...this.motivationThresholds }
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalScored: 0,
      highMotivationCount: 0,
      averageScore: 0,
      totalScore: 0,
      factorFrequency: {},
      processingTimes: []
    };
    
    this.logger.info('MotivationScorer statistics reset');
  }
}

/**
 * Custom error class for motivation scoring errors
 */
class MotivationScoringError extends Error {
  constructor(message, propertyData, originalError) {
    super(message);
    this.name = 'MotivationScoringError';
    this.propertyData = propertyData;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

module.exports = MotivationScorer;