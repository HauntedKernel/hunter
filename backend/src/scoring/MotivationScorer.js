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
const SellProbabilityModel = require('./SellProbabilityModel');

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

    // Trained, calibrated sell-probability model (the analytics moat, STRATEGY.md
    // §0). Loaded defensively — if sell_model.json is absent, `available` is false
    // and we simply omit the probability (the weighted score still works).
    this.sellModel = new SellProbabilityModel();
    if (this.sellModel.available) {
      this.logger.info('Sell-probability model loaded', {
        auc: this.sellModel.auc, baseRate: this.sellModel.baseRate
      });
    }

    // Core scoring weights (Patent Claim: Multi-factor weighted algorithm)
    this.scoringWeights = {
      // Financial Distress Factors
      taxDelinquency: 22,        // RECALIBRATED 40 -> 22 (2026-06-29). The trained model
                                 // (RESEARCH §F) gives RAW delinquency a multivariate OR of
                                 // 0.88 — mildly *negative* once you control for suit status,
                                 // amount owed, and absentee. Its predictive value lives in its
                                 // escalations, not itself; those are captured by taxSuit (28),
                                 // the amount-scaled urgency inside calculateTaxDelinquencyScore,
                                 // and the delinquent+suit synergy. Down-weighted so it stays a
                                 // meaningful actionability signal without dominating the score.
                                 // (NOTE: model's strongest predictor is ABSENTEE, OR 2.05 — still
                                 // only weight 12 here; a future pass should bump it. See §4.)
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
      taxSuit: 28,               // Active tax-foreclosure suit (suit_pending). Measured 2.45x lift — the
                                 // strongest *single* tax-roll signal in the snapshot-diff backtest
                                 // (RESEARCH.md §B), above raw delinquency (1.43x). Just below mortgage
                                 // pre-foreclosure (a scheduled auction is more imminent than a filed suit).

      // Life-stage / ownership signals (added — see STRATEGY.md §2/§4)
      absenteeOwner: 12,         // Mailing address != property: tired landlord / out-of-state heir
      elderlyOwner: 6,           // Over-65/disability exemption (or voter age >= 65). NOTE: measured
                                 // standalone lift ~1.00x (none) on our own snapshot-diff backtest —
                                 // it's a *modifier*, not a trigger. Down-weighted from 10; most of its
                                 // value is realized via the absentee×elderly synergy below.
      emptyNester: 12,           // Voter file: mid/senior owner, no young adults in household (kids moved out)
      estate: 18,                // Owner deceased — held by an estate/heirs: a top-tier "death" sale signal
      divorce: 16,               // Divorce/family-law filing matched to the owner. One of the largest
                                 // mobility drivers in the literature (RESEARCH.md §A); the marital home
                                 // is commonly sold. Not yet backtested on our data — conservative weight.
      freeAndClear: 10,          // No open mortgage → no rate lock-in friction (RESEARCH.md §A). A
                                 // positive sellability MODIFIER, not a distress trigger — modest weight.
                                 // Most of its value is via the free-and-clear × elderly synergy below.
      codeCompliance: 12,        // Open Dallas 311 code-compliance request (substandard structure,
                                 // junk/debris, tall grass) → a neglected / over-extended owner. Distress
                                 // proxy; free feed (ingest_311.js). Not yet backtested on our data.
      recency: 14,               // RECENT purchase (short tenure) — MEASURED on our data (RESEARCH §G):
                                 // 0-1yr tenure ≈ 2.98x lift even among owner-occupied individuals (real
                                 // arm's-length resales, not flippers/paperwork). Owner forced out fast
                                 // (relocation, remorse, divorce, overextension). NOTE: this REPLACES the
                                 // old long-tenure prior, which measured NEGATIVE (0.72-0.90x) — the
                                 // literature was wrong for our ~10-mo window. Banded in the scorer.

      // Signal-synergy (interaction) bonuses — empirically derived from the
      // 2025-08 → 2026-06 snapshot-diff backtest on 675k Dallas real-property
      // accounts (base ownership-change rate ~6.3% / 10mo). The additive model
      // can't represent interaction; these capture it. See RESEARCH.md.
      absenteeElderlySynergy: 14, // absentee+elderly measured 3.07x lift (vs absentee 1.64x, elderly 1.00x)
      estateAbsenteeSynergy: 6,   // estate+absentee measured 1.87x lift (vs estate 1.60x)
      freeClearElderlySynergy: 8, // free-and-clear + elderly = the "natural downsizer" (no lock-in + life
                                  // stage). Literature-based (RESEARCH.md §A), not yet backtested on our data.
      recencyDelinquentSynergy: 12, // recent purchase + delinquent = an OVEREXTENDED owner cracking.
                                  // MEASURED 2.46x (owner-occ) / 3.73x (all) — RESEARCH §G. The standout:
                                  // delinquency ALONE is 1.00x, the interaction is the whole signal. No
                                  // filter tool surfaces "bought recently AND already behind" (a moat).
      recencySuitSynergy: 8,      // recent purchase + tax-suit = same overextended archetype, escalated.
                                  // MEASURED 2.16x (RESEARCH §G).
      delinquentSuitSynergy: 4,   // delinquent + suit-pending measured 2.80x (RESEARCH §B), and the trained
                                  // model confirms the interaction (delinq_x_suit OR 1.08). Kept MODEST on
                                  // purpose: the additive delinquency (≤40) + taxSuit (28) weights already
                                  // reward the pair, so this only acknowledges the escalation interaction
                                  // without double-dominating. (No delinquent+absentee+elderly *triple*
                                  // bonus: it measures 2.68x — LOWER than absentee+elderly alone (3.07x) —
                                  // so adding delinquency to that pair would push the wrong way. See §3 of
                                  // SIGNAL_GAPS.md and the negative raw-delinquency OR in RESEARCH §F.)

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
      // Raw fields the sell-probability model needs (match the training features).
      totalAmountDue: propertyData.taxation?.totalAmountDue != null
        ? propertyData.taxation.totalAmountDue
        : (propertyData.taxDelinquency?.amountOwed || 0),
      yearsDelinquent: propertyData.taxDelinquency?.yearsDelinquent || 0,
      
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
      isEmptyNester: !!propertyData.signals?.emptyNester,
      isEstate: !!propertyData.signals?.estate,
      isTaxSuit: !!propertyData.signals?.taxSuit,
      isDivorce: !!propertyData.signals?.divorce,
      isFreeAndClear: !!propertyData.signals?.freeAndClear,
      isCodeViolation: !!propertyData.signals?.codeCompliance,
      codeRequestType: propertyData.signals?.codeRequestType || null,
      tenureYears: propertyData.tenureYears != null
        ? propertyData.tenureYears
        : (propertyData.signals?.tenureYears != null ? propertyData.signals.tenureYears : null),
      ownerAge: propertyData.signals?.ownerAge || null,
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
    factors.taxSuit = this.calculateTaxSuitScore(context);
    factors.divorce = this.calculateDivorceScore(context);
    factors.freeAndClear = this.calculateFreeAndClearScore(context);
    factors.codeCompliance = this.calculateCodeComplianceScore(context);
    factors.recency = this.calculateRecencyScore(context);

    // Life-stage / ownership signals
    factors.absenteeOwner = this.calculateAbsenteeScore(context);
    factors.elderlyOwner = this.calculateElderlyScore(context);
    factors.emptyNester = this.calculateEmptyNesterScore(context);
    factors.estate = this.calculateEstateScore(context);

    // Multi-signal interaction bonuses (empirically measured — see RESEARCH.md)
    factors.signalSynergy = this.calculateSignalSynergyScore(context);

    // Legal-event signal (gated)
    factors.arrestRecord = this.calculateArrestScore(context);

    return factors;
  }

  /**
   * Signal-synergy (interaction) scoring. Some weak/moderate signals are far
   * more predictive together than the additive sum of their parts. These
   * bonuses are derived from our own snapshot-diff backtest (RESEARCH.md):
   *   - absentee + elderly  -> 3.07x lift (elderly alone is only ~1.00x)
   *   - estate   + absentee -> 1.87x lift
   * Fires only when the component signals co-occur on the same property.
   */
  calculateSignalSynergyScore(context) {
    // Age-data path uses 60+ (median TX seller is 63-64, below the 65 exemption —
    // RESEARCH §A.4). The exemption itself is still a hard 65 (county-granted).
    const byAge = context.ownerAge && context.ownerAge >= 60;
    const isElderly = context.isElderly || byAge;
    const isDelinquent = (context.delinquentAmount || 0) > 0 ||
      !!context.propertyData?.taxDelinquency?.isDelinquent;
    const bonuses = [];
    let score = 0;

    if (context.isAbsentee && isElderly) {
      score += this.scoringWeights.absenteeElderlySynergy;
      bonuses.push('absentee + elderly (≈3.07x measured lift)');
    }
    if (context.isEstate && context.isAbsentee) {
      score += this.scoringWeights.estateAbsenteeSynergy;
      bonuses.push('estate + absentee (≈1.87x measured lift)');
    }
    if (context.isFreeAndClear && isElderly) {
      score += this.scoringWeights.freeClearElderlySynergy;
      bonuses.push('free-and-clear + elderly (natural downsizer)');
    }
    // Recency × distress — the standout measured signal (RESEARCH §G). A RECENTLY
    // bought home (tenure < 2 yr) that's already delinquent / in suit = an
    // overextended owner cracking (2.46x / 2.16x), vs. ~0.94x for a long-held
    // delinquent. Delinquency alone is 1.00x — the interaction is the whole signal.
    const isRecent = context.tenureYears != null && context.tenureYears < 2;
    if (isRecent && isDelinquent) {
      score += this.scoringWeights.recencyDelinquentSynergy;
      bonuses.push('recent purchase + delinquent (≈2.46x measured — overextended owner)');
    }
    if (isRecent && context.isTaxSuit) {
      score += this.scoringWeights.recencySuitSynergy;
      bonuses.push('recent purchase + tax-suit (≈2.16x measured)');
    }
    if (isDelinquent && context.isTaxSuit) {
      // Escalation interaction: a *filed* tax-foreclosure suit on top of arrears
      // is more predictive than either alone (2.80x measured). Deliberately NOT
      // extended to a delinquent+absentee+elderly triple — that measures 2.68x,
      // below absentee+elderly's 3.07x, so delinquency *subtracts* from that pair.
      score += this.scoringWeights.delinquentSuitSynergy;
      bonuses.push('delinquent + tax-suit (≈2.80x measured lift)');
    }

    if (score === 0) {
      return { score: 0, factor: 'No multi-signal synergy', category: 'synergy' };
    }
    return {
      score,
      factor: `Signal synergy — ${bonuses.join('; ')}`,
      category: 'synergy',
      severity: 'high'
    };
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
   * Active tax-foreclosure suit (`suit_pending`). The county has filed suit to
   * foreclose for unpaid taxes — the owner is mid-process and highly motivated to
   * sell before the sheriff's sale. Measured 2.45x lift (RESEARCH.md §B), the
   * strongest single tax-roll signal. Distinct from mortgage pre-foreclosure.
   */
  calculateTaxSuitScore(context) {
    if (!context.isTaxSuit) {
      return { score: 0, factor: 'No active tax-foreclosure suit', category: 'legal' };
    }
    return {
      score: this.scoringWeights.taxSuit,
      factor: 'Active tax-foreclosure suit pending (delinquent taxes in litigation)',
      category: 'legal',
      severity: 'high'
    };
  }

  /**
   * Divorce / family-law filing matched to the owner. A divorcing couple commonly
   * sells the marital home; divorce is among the largest residential mobility
   * drivers in the literature (RESEARCH.md §A). Joined from divorce_events; null
   * until a feed is ingested. Not yet backtested on our own data.
   */
  calculateDivorceScore(context) {
    if (!context.isDivorce) {
      return { score: 0, factor: 'No divorce / family-law filing', category: 'life-stage' };
    }
    return {
      score: this.scoringWeights.divorce,
      factor: 'Divorce / family-law filing matched to owner',
      category: 'life-stage',
      severity: 'high'
    };
  }

  /**
   * Free-and-clear — the owner has no open mortgage, so they face no rate lock-in
   * friction (RESEARCH.md §A). A positive *sellability* modifier: free-and-clear
   * owners (especially long-tenure / elderly) can transact without giving up a
   * cheap mortgage. Joined from `liens`; null until a lien feed is ingested. Not a
   * distress trigger and not yet backtested on our own data.
   */
  calculateFreeAndClearScore(context) {
    if (!context.isFreeAndClear) {
      return { score: 0, factor: 'Mortgage status unknown or financed', category: 'financial' };
    }
    return {
      score: this.scoringWeights.freeAndClear,
      factor: 'Free-and-clear — no open mortgage (no rate lock-in)',
      category: 'financial',
      severity: 'medium'
    };
  }

  /**
   * Code-compliance / 311 distress — an open Dallas 311 code request (substandard
   * structure, junk/debris, tall grass, etc.) matched to this property. Signals a
   * neglected or over-extended owner. Joined from `code_violations`; null until a
   * 311 feed is ingested (ingest_311.js). Not yet backtested on our own data.
   */
  calculateCodeComplianceScore(context) {
    if (!context.isCodeViolation) {
      return { score: 0, factor: 'No open code-compliance / 311 request', category: 'distress' };
    }
    const type = context.codeRequestType ? ` — ${context.codeRequestType}` : '';
    return {
      score: this.scoringWeights.codeCompliance,
      factor: `Open code-compliance / 311 request${type}`,
      category: 'distress',
      severity: 'medium'
    };
  }

  /**
   * RECENCY — a recent purchase (short tenure) predicts a near-term resale. MEASURED
   * on our own data (RESEARCH.md §G): 0-1yr tenure ≈ 2.98x lift even among
   * owner-occupied individuals (genuine arm's-length resales, not flippers/paperwork) —
   * an owner forced out fast (relocation, remorse, divorce, overextension). This
   * REPLACES the old long-tenure prior, which measured negative. Tenure comes from the
   * DCAD appraisal file (appraisal_detail.tenure_years, current year − deed year);
   * null until ingest_appraisal.js / load_dcad_tenure.py loads the free DCAD file.
   */
  calculateRecencyScore(context) {
    const t = context.tenureYears;
    if (t == null || t >= 3) {
      return { score: 0, factor: 'Not a recent purchase (≥3 yr or unknown tenure)', category: 'ownership' };
    }
    // Band by measured lift: bought this year ≈ 3x, 1 yr ≈ 1.5x, 2 yr ≈ 1.2x.
    let frac, band;
    if (t <= 0) { frac = 1.0; band = 'bought <1 yr ago (~3x)'; }
    else if (t === 1) { frac = 0.5; band = '~1 yr ago'; }
    else { frac = 0.2; band = '~2 yr ago'; }
    return {
      score: Math.round(this.scoringWeights.recency * frac),
      factor: `Recent purchase — ${band}`,
      category: 'ownership',
      severity: t <= 0 ? 'high' : 'medium'
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
    // Fires on the tax over-65/disability exemption OR an age-data age >= 60. The
    // 60+ band (not 65) matches the median TX seller age 63-64 (RESEARCH §A.4); the
    // exemption path is still a hard county-granted 65.
    const byAge = context.ownerAge && context.ownerAge >= 60;
    if (!context.isElderly && !byAge) {
      return { score: 0, factor: 'No over-65 exemption and age under 60', category: 'life-stage' };
    }
    const detail = byAge ? `owner age ${context.ownerAge}` : 'over-65 or disability exemption';
    return {
      score: this.scoringWeights.elderlyOwner,
      factor: `Elderly/disabled owner (${detail})`,
      category: 'life-stage',
      severity: 'medium'
    };
  }

  /**
   * Empty-nester — voter file shows a mid-life/senior owner with no young adults
   * in a small current household (kids likely moved out). A downsizing lead.
   */
  calculateEmptyNesterScore(context) {
    if (!context.isEmptyNester) {
      return { score: 0, factor: 'Not an empty-nester profile', category: 'life-stage' };
    }
    const ageSuffix = context.ownerAge ? ` (owner age ${context.ownerAge})` : '';
    return {
      score: this.scoringWeights.emptyNester,
      factor: `Empty-nester — kids likely moved out${ageSuffix}`,
      category: 'life-stage',
      severity: 'medium'
    };
  }

  /**
   * Estate / inherited — the owner has died and the property is held by an
   * estate or heirs (owner name like "… ESTATE OF", "LIFE ESTATE", "HEIRS",
   * "ET AL"). One of the strongest seller signals: heirs commonly sell inherited
   * property they don't want, and a surviving spouse often downsizes.
   */
  calculateEstateScore(context) {
    if (!context.isEstate) {
      return { score: 0, factor: 'No estate/inheritance indicator', category: 'life-stage' };
    }
    return {
      score: this.scoringWeights.estate,
      factor: 'Estate / inherited — owner deceased, held by estate or heirs',
      category: 'life-stage',
      severity: 'high'
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

    // Calibrated sell-probability (the analytics moat). Features must match the
    // trained model (scripts/train_sell_model.js).
    const sell = this.sellModel.score({
      delinq: (scoringContext.delinquentAmount || 0) > 0,
      absentee: scoringContext.isAbsentee,
      elderly: scoringContext.isElderly,
      suit: scoringContext.isTaxSuit,
      estate: scoringContext.isEstate,
      // Back-trained recency feature: bought within ~2 years (leakage-clean OR≈1.20,
      // RESEARCH §G). Maps the trained "recent" band to live tenure.
      recent: scoringContext.tenureYears != null && scoringContext.tenureYears <= 2,
      dyears: scoringContext.yearsDelinquent,
      totalAmountDue: scoringContext.totalAmountDue,
      totalValue: scoringContext.currentValue
    });

    return {
      // Core Results
      totalScore: finalScore,
      // Calibrated probability the owner sells within the model window (0-1), the
      // ~base-rate-relative lift, and the top drivers. Null if no model loaded.
      sellProbability: sell ? sell.probability : null,
      sellProbabilityPct: sell ? Math.round(sell.probability * 1000) / 10 : null,
      sellProbabilityLift: sell && sell.lift != null ? Math.round(sell.lift * 100) / 100 : null,
      sellProbabilityDrivers: sell ? sell.drivers : [],
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
        scoringVersion: '1.1',
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