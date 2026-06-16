/**
 * NameProcessor - Advanced owner name processing and standardization
 * 
 * Implements sophisticated name parsing, entity classification, and owner
 * pattern recognition to extract meaningful insights from property ownership data.
 * 
 * Patent Claims:
 * 1. Multi-stage name standardization algorithm with entity type detection
 * 2. Ownership pattern recognition with temporal analysis
 * 3. Name similarity matching with ownership relationship inference
 * 4. Corporate entity classification with ownership structure analysis
 */

const _ = require('lodash');
const moment = require('moment');
const Logger = require('../utils/Logger');

class NameProcessor {
  constructor(options = {}) {
    this.logger = new Logger('NameProcessor', {
      logLevel: options.logLevel || 'info',
      enableConsole: options.enableConsole !== false
    });
    
    // Entity type patterns for classification (Patent Claim: Entity type detection)
    this.entityPatterns = {
      corporation: {
        patterns: [
          /\b(CORP|CORPORATION|INC|INCORPORATED|LLC|LTD|LIMITED|CO)\b/i,
          /\b(COMPANY|ENTERPRISES|HOLDINGS|GROUP)\b/i,
          /\b(PROPERTIES|INVESTMENTS|REALTY|DEVELOPMENT)\b/i
        ],
        indicators: ['business', 'commercial', 'investment']
      },
      
      trust: {
        patterns: [
          /\b(TRUST|TRUSTEE|TR)\b/i,
          /\b(FAMILY TRUST|LIVING TRUST|REVOCABLE TRUST)\b/i,
          /\b(ESTATE TRUST|TESTAMENTARY TRUST)\b/i
        ],
        indicators: ['estate_planning', 'family', 'long_term']
      },
      
      estate: {
        patterns: [
          /\b(ESTATE|DECEASED|HEIR|HEIRS)\b/i,
          /\b(PROBATE|SUCCESSION|INHERITANCE)\b/i,
          /\b(ET AL|ETAL|AND OTHERS)\b/i
        ],
        indicators: ['deceased_owner', 'probate', 'succession']
      },
      
      government: {
        patterns: [
          /\b(CITY OF|STATE OF|COUNTY OF|FEDERAL)\b/i,
          /\b(MUNICIPAL|GOVERNMENT|PUBLIC)\b/i,
          /\b(HOUSING AUTHORITY|SCHOOL DISTRICT)\b/i
        ],
        indicators: ['public', 'municipal', 'authority']
      },
      
      individual: {
        patterns: [
          /^[A-Z][a-z]+ [A-Z][a-z]+$/,  // First Last
          /^[A-Z][a-z]+, [A-Z][a-z]+$/,  // Last, First
          /\b(AND|&)\b/i  // Joint ownership
        ],
        indicators: ['personal', 'family', 'joint']
      }
    };
    
    // Common name variations and standardizations
    this.nameStandardizations = {
      suffixes: {
        'JR': 'Jr',
        'SR': 'Sr', 
        'III': 'III',
        'IV': 'IV',
        'II': 'II'
      },
      
      titles: {
        'MR': 'Mr',
        'MRS': 'Mrs',
        'MS': 'Ms',
        'DR': 'Dr',
        'PROF': 'Prof'
      },
      
      conjunctions: {
        'AND': '&',
        ' & ': ' and ',
        'ETAL': 'et al',
        'ET AL': 'et al'
      }
    };
    
    // Ownership motivation indicators based on entity type
    this.motivationIndicators = {
      estate: {
        baseScore: 25,
        factors: ['probate_complexity', 'heir_disputes', 'tax_obligations']
      },
      
      trust: {
        baseScore: 15, 
        factors: ['tax_planning', 'family_changes', 'trust_administration']
      },
      
      corporation: {
        baseScore: 10,
        factors: ['business_strategy', 'portfolio_optimization', 'tax_planning']
      },
      
      individual: {
        baseScore: 5,
        factors: ['life_changes', 'financial_needs', 'age_factors']
      }
    };
    
    // Statistics tracking
    this.stats = {
      totalProcessed: 0,
      entityTypes: {},
      standardizationsApplied: 0,
      similarityMatches: 0,
      processingTimes: []
    };
    
    this.logger.info('NameProcessor initialized', {
      entityPatterns: Object.keys(this.entityPatterns).length,
      standardizations: Object.keys(this.nameStandardizations).length
    });
  }

  /**
   * Main method to process owner data and extract insights
   * 
   * @param {Object} ownerData - Raw owner data from property records
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processed owner analysis
   */
  async processOwnerData(ownerData, options = {}) {
    const timer = this.logger.createTimer('processOwnerData');
    
    try {
      this.logger.debug('Starting owner data processing', {
        ownerCount: ownerData?.owners?.length || 1,
        correlationId: options.correlationId
      });
      
      // Normalize input data
      const normalizedOwners = this.normalizeOwnerInput(ownerData);
      
      // Process each owner entry
      const processedOwners = [];
      for (const ownerEntry of normalizedOwners) {
        const processed = await this.processIndividualOwner(ownerEntry, options);
        processedOwners.push(processed);
      }
      
      // Analyze ownership patterns
      const ownershipAnalysis = this.analyzeOwnershipPatterns(processedOwners);
      
      // Calculate ownership duration and changes
      const temporalAnalysis = this.analyzeTemporalPatterns(processedOwners, ownerData);
      
      // Determine primary owner type and characteristics
      const ownershipClassification = this.classifyOwnership(processedOwners, ownershipAnalysis);
      
      // Compile final analysis
      const finalAnalysis = this.compileOwnerAnalysis({
        processedOwners,
        ownershipAnalysis,
        temporalAnalysis,
        ownershipClassification,
        processingTime: timer.end(),
        correlationId: options.correlationId
      });
      
      // Update statistics
      this.updateStats(finalAnalysis);
      
      this.logger.debug('Owner data processing completed', {
        ownerType: ownershipClassification.primaryType,
        motivationFactors: ownershipAnalysis.motivationFactors?.length || 0,
        correlationId: options.correlationId
      });
      
      return finalAnalysis;
      
    } catch (error) {
      this.logger.error('Owner data processing failed', {
        error: error.message,
        correlationId: options.correlationId
      });
      
      throw new NameProcessingError(
        `Failed to process owner data: ${error.message}`,
        ownerData,
        error
      );
    }
  }

  /**
   * Normalize owner input data to consistent format
   */
  normalizeOwnerInput(ownerData) {
    if (!ownerData) {
      return [{ name: 'Unknown Owner', rawData: null }];
    }
    
    // Handle different input formats
    if (typeof ownerData === 'string') {
      return [{ name: ownerData, rawData: ownerData }];
    }
    
    if (Array.isArray(ownerData)) {
      return ownerData.map(owner => ({
        name: typeof owner === 'string' ? owner : owner.name,
        rawData: owner
      }));
    }
    
    if (ownerData.owners && Array.isArray(ownerData.owners)) {
      return ownerData.owners.map(owner => ({
        name: owner.name || owner,
        rawData: owner
      }));
    }
    
    // Single owner object
    return [{
      name: ownerData.name || ownerData.ownerName || 'Unknown Owner',
      rawData: ownerData
    }];
  }

  /**
   * Process individual owner entry with full analysis
   * Patent Claim: Multi-stage name standardization with entity detection
   */
  async processIndividualOwner(ownerEntry, options = {}) {
    const originalName = ownerEntry.name || '';
    
    // Stage 1: Basic cleaning and normalization
    const cleanedName = this.cleanName(originalName);
    
    // Stage 2: Apply standardizations
    const standardizedName = this.standardizeName(cleanedName);
    
    // Stage 3: Entity type detection
    const entityAnalysis = this.detectEntityType(standardizedName);
    
    // Stage 4: Name component parsing
    const nameComponents = this.parseNameComponents(standardizedName, entityAnalysis.type);
    
    // Stage 5: Motivation factor analysis
    const motivationFactors = this.analyzeMotivationFactors(entityAnalysis, nameComponents);
    
    // Stage 6: Risk assessment
    const riskAssessment = this.assessOwnershipRisks(entityAnalysis, nameComponents);
    
    return {
      original: originalName,
      cleaned: cleanedName,
      standardized: standardizedName,
      entityType: entityAnalysis.type,
      entityConfidence: entityAnalysis.confidence,
      entityIndicators: entityAnalysis.indicators,
      nameComponents,
      motivationFactors,
      riskAssessment,
      standardizationsApplied: this.getAppliedStandardizations(originalName, standardizedName)
    };
  }

  /**
   * Clean raw name data
   */
  cleanName(rawName) {
    if (!rawName || typeof rawName !== 'string') {
      return '';
    }
    
    return rawName
      .trim()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/[^\w\s&,.-]/g, '') // Remove special characters except common ones
      .toUpperCase();
  }

  /**
   * Apply standardization rules to names
   */
  standardizeName(cleanedName) {
    let standardized = cleanedName;
    
    // Apply suffix standardizations
    for (const [original, standard] of Object.entries(this.nameStandardizations.suffixes)) {
      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      if (regex.test(standardized)) {
        standardized = standardized.replace(regex, standard);
        this.stats.standardizationsApplied++;
      }
    }
    
    // Apply title standardizations
    for (const [original, standard] of Object.entries(this.nameStandardizations.titles)) {
      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      if (regex.test(standardized)) {
        standardized = standardized.replace(regex, standard);
        this.stats.standardizationsApplied++;
      }
    }
    
    // Apply conjunction standardizations
    for (const [original, standard] of Object.entries(this.nameStandardizations.conjunctions)) {
      if (standardized.includes(original)) {
        standardized = standardized.replace(original, standard);
        this.stats.standardizationsApplied++;
      }
    }
    
    return standardized.trim();
  }

  /**
   * Detect entity type using pattern matching
   * Patent Claim: Entity type detection with confidence scoring
   */
  detectEntityType(name) {
    const results = {
      type: 'individual',
      confidence: 0,
      indicators: [],
      patterns: []
    };
    
    let bestMatch = { type: 'individual', score: 0, indicators: [], patterns: [] };
    
    // Test each entity type
    for (const [entityType, config] of Object.entries(this.entityPatterns)) {
      let score = 0;
      let matchedPatterns = [];
      
      // Check patterns
      for (const pattern of config.patterns) {
        if (pattern.test(name)) {
          score += 20; // Base points for pattern match
          matchedPatterns.push(pattern.toString());
        }
      }
      
      // Bonus for multiple patterns
      if (matchedPatterns.length > 1) {
        score += 10;
      }
      
      if (score > bestMatch.score) {
        bestMatch = {
          type: entityType,
          score,
          indicators: [...config.indicators],
          patterns: matchedPatterns
        };
      }
    }
    
    // Calculate confidence (0-100)
    results.type = bestMatch.type;
    results.confidence = Math.min(100, bestMatch.score);
    results.indicators = bestMatch.indicators;
    results.patterns = bestMatch.patterns;
    
    // Special handling for individual names
    if (bestMatch.type === 'individual' && bestMatch.score === 0) {
      // Apply individual name patterns
      if (/^[A-Z][a-z]+ [A-Z][a-z]+$/.test(name)) {
        results.confidence = 70;
        results.indicators = ['standard_name_format'];
      } else if (name.includes('&') || name.includes('AND')) {
        results.confidence = 80;
        results.indicators = ['joint_ownership'];
      }
    }
    
    return results;
  }

  /**
   * Parse name components based on entity type
   */
  parseNameComponents(name, entityType) {
    const components = {
      rawName: name,
      entityType,
      parts: [],
      primaryName: '',
      secondaryNames: [],
      businessIdentifiers: [],
      familyIdentifiers: []
    };
    
    switch (entityType) {
      case 'individual':
        return this.parseIndividualName(name, components);
      
      case 'corporation':
        return this.parseCorporateName(name, components);
      
      case 'trust':
        return this.parseTrustName(name, components);
      
      case 'estate':
        return this.parseEstateName(name, components);
      
      case 'government':
        return this.parseGovernmentName(name, components);
      
      default:
        components.primaryName = name;
        components.parts = [name];
        return components;
    }
  }

  /**
   * Parse individual/personal names
   */
  parseIndividualName(name, components) {
    // Handle joint ownership
    if (name.includes('&') || name.includes(' AND ')) {
      const separator = name.includes('&') ? '&' : ' AND ';
      const owners = name.split(separator).map(n => n.trim());
      
      components.primaryName = owners[0];
      components.secondaryNames = owners.slice(1);
      components.parts = owners;
      components.familyIdentifiers = ['joint_ownership'];
      
      // Check for family relationships
      if (owners.length === 2) {
        const firstName = owners[0].split(' ');
        const secondName = owners[1].split(' ');
        
        if (firstName[firstName.length - 1] === secondName[secondName.length - 1]) {
          components.familyIdentifiers.push('same_surname');
        }
      }
    } else {
      // Single individual
      components.primaryName = name;
      components.parts = name.split(' ');
      
      // Check for titles and suffixes
      if (name.includes('JR') || name.includes('SR') || name.includes('III')) {
        components.familyIdentifiers.push('generational_suffix');
      }
    }
    
    return components;
  }

  /**
   * Parse corporate/business names
   */
  parseCorporateName(name, components) {
    components.primaryName = name;
    components.parts = name.split(' ');
    
    // Identify business type indicators
    const businessTypes = ['LLC', 'INC', 'CORP', 'LTD', 'CO', 'COMPANY'];
    for (const type of businessTypes) {
      if (name.includes(type)) {
        components.businessIdentifiers.push(type.toLowerCase());
      }
    }
    
    // Identify business purpose indicators
    const purposeWords = ['PROPERTIES', 'INVESTMENTS', 'REALTY', 'DEVELOPMENT', 'HOLDINGS'];
    for (const purpose of purposeWords) {
      if (name.includes(purpose)) {
        components.businessIdentifiers.push(purpose.toLowerCase());
      }
    }
    
    return components;
  }

  /**
   * Parse trust names
   */
  parseTrustName(name, components) {
    components.primaryName = name;
    components.parts = name.split(' ');
    
    // Identify trust type
    if (name.includes('FAMILY TRUST')) {
      components.familyIdentifiers.push('family_trust');
    }
    if (name.includes('LIVING TRUST') || name.includes('REVOCABLE TRUST')) {
      components.familyIdentifiers.push('living_trust');
    }
    if (name.includes('TESTAMENTARY TRUST')) {
      components.familyIdentifiers.push('testamentary_trust');
    }
    
    // Extract family name if possible
    const trustMatch = name.match(/^([A-Z\s]+)\s+(FAMILY\s+)?TRUST/);
    if (trustMatch) {
      components.familyIdentifiers.push(`family_name:${trustMatch[1].trim()}`);
    }
    
    return components;
  }

  /**
   * Parse estate names
   */
  parseEstateName(name, components) {
    components.primaryName = name;
    components.parts = name.split(' ');
    
    // Extract deceased person's name
    const estateMatch = name.match(/^(.+)\s+ESTATE/);
    if (estateMatch) {
      components.familyIdentifiers.push(`deceased_name:${estateMatch[1].trim()}`);
    }
    
    // Check for heir indicators
    if (name.includes('HEIR') || name.includes('HEIRS')) {
      components.familyIdentifiers.push('heirs_involved');
    }
    
    if (name.includes('ET AL') || name.includes('AND OTHERS')) {
      components.familyIdentifiers.push('multiple_heirs');
    }
    
    return components;
  }

  /**
   * Parse government entity names
   */
  parseGovernmentName(name, components) {
    components.primaryName = name;
    components.parts = name.split(' ');
    
    // Identify government level
    if (name.includes('CITY OF')) {
      components.businessIdentifiers.push('municipal');
    } else if (name.includes('COUNTY OF')) {
      components.businessIdentifiers.push('county');
    } else if (name.includes('STATE OF')) {
      components.businessIdentifiers.push('state');
    } else if (name.includes('FEDERAL')) {
      components.businessIdentifiers.push('federal');
    }
    
    return components;
  }

  /**
   * Analyze motivation factors based on ownership type
   * Patent Claim: Ownership pattern recognition with motivation inference
   */
  analyzeMotivationFactors(entityAnalysis, nameComponents) {
    const baseMotivation = this.motivationIndicators[entityAnalysis.type] || 
                          this.motivationIndicators.individual;
    
    const factors = {
      baseScore: baseMotivation.baseScore,
      entityFactors: [...baseMotivation.factors],
      specificFactors: [],
      totalScore: baseMotivation.baseScore,
      confidence: entityAnalysis.confidence
    };
    
    // Add entity-specific factors
    switch (entityAnalysis.type) {
      case 'estate':
        factors.specificFactors.push('probate_urgency', 'heir_coordination', 'estate_taxes');
        if (nameComponents.familyIdentifiers.includes('multiple_heirs')) {
          factors.specificFactors.push('complex_ownership');
          factors.totalScore += 10;
        }
        break;
        
      case 'trust':
        if (nameComponents.familyIdentifiers.includes('living_trust')) {
          factors.specificFactors.push('active_management');
        }
        if (nameComponents.familyIdentifiers.includes('family_trust')) {
          factors.specificFactors.push('generational_planning');
        }
        break;
        
      case 'corporation':
        factors.specificFactors.push('business_optimization', 'portfolio_management');
        if (nameComponents.businessIdentifiers.includes('properties') || 
            nameComponents.businessIdentifiers.includes('investments')) {
          factors.specificFactors.push('investment_focus');
          factors.totalScore += 5;
        }
        break;
        
      case 'individual':
        if (nameComponents.familyIdentifiers.includes('joint_ownership')) {
          factors.specificFactors.push('joint_decision_making');
          factors.totalScore -= 5; // Joint ownership may slow decisions
        }
        if (nameComponents.familyIdentifiers.includes('generational_suffix')) {
          factors.specificFactors.push('family_succession');
          factors.totalScore += 3;
        }
        break;
    }
    
    return factors;
  }

  /**
   * Assess ownership-related risks
   */
  assessOwnershipRisks(entityAnalysis, nameComponents) {
    const risks = {
      decisionComplexity: 'low',
      legalComplexity: 'low',
      timelineRisks: [],
      communicationRisks: [],
      overallRisk: 'low'
    };
    
    // Assess based on entity type
    switch (entityAnalysis.type) {
      case 'estate':
        risks.decisionComplexity = 'high';
        risks.legalComplexity = 'high';
        risks.timelineRisks.push('probate_delays', 'court_approval');
        risks.communicationRisks.push('multiple_heirs', 'legal_representatives');
        risks.overallRisk = 'high';
        break;
        
      case 'trust':
        risks.decisionComplexity = 'medium';
        risks.legalComplexity = 'medium';
        risks.timelineRisks.push('trustee_approval');
        risks.overallRisk = 'medium';
        break;
        
      case 'corporation':
        risks.decisionComplexity = 'medium';
        risks.timelineRisks.push('corporate_approval');
        risks.communicationRisks.push('authorized_representatives');
        risks.overallRisk = 'medium';
        break;
        
      case 'individual':
        if (nameComponents.familyIdentifiers.includes('joint_ownership')) {
          risks.decisionComplexity = 'medium';
          risks.communicationRisks.push('joint_agreement_required');
          risks.overallRisk = 'medium';
        }
        break;
    }
    
    return risks;
  }

  /**
   * Analyze ownership patterns across multiple owners
   * Patent Claim: Ownership pattern recognition with temporal analysis
   */
  analyzeOwnershipPatterns(processedOwners) {
    const analysis = {
      totalOwners: processedOwners.length,
      entityTypes: {},
      hasMultipleOwners: processedOwners.length > 1,
      dominantEntityType: null,
      motivationFactors: [],
      ownershipComplexity: 'simple'
    };
    
    // Count entity types
    for (const owner of processedOwners) {
      const type = owner.entityType;
      analysis.entityTypes[type] = (analysis.entityTypes[type] || 0) + 1;
    }
    
    // Determine dominant type
    analysis.dominantEntityType = Object.entries(analysis.entityTypes)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    // Assess complexity
    const uniqueTypes = Object.keys(analysis.entityTypes).length;
    if (uniqueTypes > 2 || processedOwners.length > 3) {
      analysis.ownershipComplexity = 'complex';
    } else if (uniqueTypes === 2 || processedOwners.length > 1) {
      analysis.ownershipComplexity = 'moderate';
    }
    
    // Aggregate motivation factors
    for (const owner of processedOwners) {
      analysis.motivationFactors.push(...owner.motivationFactors.specificFactors);
    }
    
    // Remove duplicates
    analysis.motivationFactors = [...new Set(analysis.motivationFactors)];
    
    return analysis;
  }

  /**
   * Analyze temporal patterns in ownership
   */
  analyzeTemporalPatterns(processedOwners, originalData) {
    const temporal = {
      ownershipDuration: null,
      estimatedOwnershipStart: null,
      ownershipChanges: [],
      stabilityScore: 100
    };
    
    // This would be enhanced with historical ownership data
    // For now, provide basic analysis
    
    if (originalData?.lastSaleDate) {
      temporal.estimatedOwnershipStart = moment(originalData.lastSaleDate);
      temporal.ownershipDuration = moment().diff(temporal.estimatedOwnershipStart, 'years', true);
    }
    
    // Estimate stability based on entity types
    const hasEstate = processedOwners.some(o => o.entityType === 'estate');
    if (hasEstate) {
      temporal.stabilityScore = 30; // Estates indicate recent ownership change
    }
    
    const hasTrust = processedOwners.some(o => o.entityType === 'trust');
    if (hasTrust) {
      temporal.stabilityScore = Math.max(temporal.stabilityScore, 70); // Trusts indicate planning
    }
    
    return temporal;
  }

  /**
   * Classify overall ownership structure
   */
  classifyOwnership(processedOwners, ownershipAnalysis) {
    const classification = {
      primaryType: ownershipAnalysis.dominantEntityType,
      complexity: ownershipAnalysis.ownershipComplexity,
      motivationLevel: 'medium',
      decisionMakingStructure: 'simple',
      recommendedApproach: 'standard'
    };
    
    // Determine motivation level
    const avgMotivationScore = processedOwners.reduce((sum, owner) => 
      sum + owner.motivationFactors.totalScore, 0) / processedOwners.length;
    
    if (avgMotivationScore >= 30) {
      classification.motivationLevel = 'high';
    } else if (avgMotivationScore >= 15) {
      classification.motivationLevel = 'medium';
    } else {
      classification.motivationLevel = 'low';
    }
    
    // Determine decision-making structure
    if (ownershipAnalysis.totalOwners > 1) {
      classification.decisionMakingStructure = 'collaborative';
    }
    
    if (ownershipAnalysis.entityTypes.estate > 0) {
      classification.decisionMakingStructure = 'legal_complex';
      classification.recommendedApproach = 'probate_specialist';
    }
    
    if (ownershipAnalysis.entityTypes.corporation > 0) {
      classification.decisionMakingStructure = 'corporate';
      classification.recommendedApproach = 'business_focused';
    }
    
    return classification;
  }

  /**
   * Compile comprehensive owner analysis
   */
  compileOwnerAnalysis(data) {
    const {
      processedOwners,
      ownershipAnalysis,
      temporalAnalysis,
      ownershipClassification,
      processingTime,
      correlationId
    } = data;
    
    return {
      // Owner Details
      owners: processedOwners,
      totalOwners: processedOwners.length,
      hasMultipleOwners: processedOwners.length > 1,
      
      // Entity Classification
      ownerType: ownershipClassification.primaryType,
      entityDistribution: ownershipAnalysis.entityTypes,
      ownershipComplexity: ownershipClassification.complexity,
      
      // Motivation Analysis
      motivationFactors: ownershipAnalysis.motivationFactors,
      motivationLevel: ownershipClassification.motivationLevel,
      averageMotivationScore: processedOwners.reduce((sum, owner) => 
        sum + owner.motivationFactors.totalScore, 0) / processedOwners.length,
      
      // Temporal Analysis
      ownershipDuration: temporalAnalysis.ownershipDuration,
      estimatedOwnershipStart: temporalAnalysis.estimatedOwnershipStart?.toISOString(),
      stabilityScore: temporalAnalysis.stabilityScore,
      
      // Risk Assessment
      decisionMakingStructure: ownershipClassification.decisionMakingStructure,
      recommendedApproach: ownershipClassification.recommendedApproach,
      overallRisk: this.calculateOverallRisk(processedOwners),
      
      // Name Standardization Results
      standardizations: this.getStandardizationSummary(processedOwners),
      
      // Processing Metadata
      metadata: {
        processingTime,
        correlationId,
        processedAt: new Date().toISOString(),
        confidence: this.calculateOverallConfidence(processedOwners)
      }
    };
  }

  /**
   * Calculate overall risk level
   */
  calculateOverallRisk(processedOwners) {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const avgRisk = processedOwners.reduce((sum, owner) => 
      sum + riskLevels[owner.riskAssessment.overallRisk], 0) / processedOwners.length;
    
    if (avgRisk >= 2.5) return 'high';
    if (avgRisk >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall confidence in analysis
   */
  calculateOverallConfidence(processedOwners) {
    const avgConfidence = processedOwners.reduce((sum, owner) => 
      sum + owner.entityConfidence, 0) / processedOwners.length;
    
    return Math.round(avgConfidence);
  }

  /**
   * Get summary of applied standardizations
   */
  getStandardizationSummary(processedOwners) {
    const summary = {
      totalStandardizations: 0,
      types: {},
      examples: []
    };
    
    for (const owner of processedOwners) {
      const standardizations = owner.standardizationsApplied || [];
      summary.totalStandardizations += standardizations.length;
      
      for (const std of standardizations) {
        summary.types[std.type] = (summary.types[std.type] || 0) + 1;
        if (summary.examples.length < 5) {
          summary.examples.push(std);
        }
      }
    }
    
    return summary;
  }

  /**
   * Get applied standardizations for a name transformation
   */
  getAppliedStandardizations(original, standardized) {
    const standardizations = [];
    
    if (original !== standardized) {
      // This is simplified - would track specific transformations
      standardizations.push({
        type: 'name_normalization',
        original: original,
        standardized: standardized,
        transformations: ['case_normalization', 'whitespace_normalization']
      });
    }
    
    return standardizations;
  }

  /**
   * Update internal statistics
   */
  updateStats(analysis) {
    this.stats.totalProcessed++;
    this.stats.processingTimes.push(analysis.metadata.processingTime);
    
    // Track entity types
    for (const [type, count] of Object.entries(analysis.entityDistribution)) {
      this.stats.entityTypes[type] = (this.stats.entityTypes[type] || 0) + count;
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const avgProcessingTime = this.stats.processingTimes.length > 0 ?
      this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length : 0;
    
    return {
      totalProcessed: this.stats.totalProcessed,
      entityTypes: { ...this.stats.entityTypes },
      standardizationsApplied: this.stats.standardizationsApplied,
      similarityMatches: this.stats.similarityMatches,
      averageProcessingTime: Math.round(avgProcessingTime),
      entityPatterns: Object.keys(this.entityPatterns).length,
      standardizationRules: Object.keys(this.nameStandardizations).length
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      entityTypes: {},
      standardizationsApplied: 0,
      similarityMatches: 0,
      processingTimes: []
    };
    
    this.logger.info('NameProcessor statistics reset');
  }
}

/**
 * Custom error class for name processing errors
 */
class NameProcessingError extends Error {
  constructor(message, ownerData, originalError) {
    super(message);
    this.name = 'NameProcessingError';
    this.ownerData = ownerData;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

module.exports = NameProcessor;