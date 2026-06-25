/**
 * Property Intelligence API - FlashStack Integration
 * Provides REST endpoints for the Dallas CAD Integration system
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { PropertyIntelligenceService } = require('../services/PropertyIntelligenceService');
const CADResultCache = require('../cache/CADResultCache');
const SkipTraceService = require('../services/SkipTraceService');

const router = express.Router();

// Lazy SkipTraceService bound to the tax-roll DB (where the contacts table lives).
let _skipTraceSvc = null;
async function getSkipTrace() {
  if (!_skipTraceSvc) {
    const db = await open({
      filename: path.join(__dirname, '..', 'data', 'tax_roll.db'),
      driver: sqlite3.Database
    });
    await db.exec(`CREATE TABLE IF NOT EXISTS contacts (
      account_id TEXT PRIMARY KEY, owner_name TEXT, phones TEXT, emails TEXT,
      source TEXT, dnc_checked_at TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    _skipTraceSvc = new SkipTraceService(db);
  }
  return _skipTraceSvc;
}

// Initialize the intelligence service
const intelligenceService = new PropertyIntelligenceService({
  logLevel: 'info',
  enableConsole: true
});

// Persistent cache for CAD enrichment results (survives restarts), so repeat
// bulk-enrich requests for the same addresses return instantly.
const cadCache = new CADResultCache();

const MAX_BULK_ENRICH = 100;

/**
 * Normalize the scraper's parsed CAD data into the compact enrichment shape the
 * frontend consumes (matches SellerIntelligenceService.enrichLeadWithCAD).
 */
function normalizeEnrichment(parsed, fallbackAddress) {
  const p = parsed || {};
  const owner = p.ownership?.ownerName;
  return {
    fullAddress: p.location?.address || fallbackAddress,
    accountId: p.accountId || null,
    bedrooms: p.property?.bedrooms ?? null,
    bathrooms: p.property?.bathrooms ?? null,
    sqft: p.property?.squareFootage ?? null,
    yearBuilt: p.property?.yearBuilt ?? null,
    propertyType: p.property?.propertyType || null,
    cadValue: p.valuation?.totalValue || null,
    ownerName: owner && owner !== 'Unknown Owner' ? owner : null,
    ownerAddress: p.ownership?.ownerAddress || null
  };
}

// Enable CORS for all routes
router.use(cors());

/**
 * POST /api/property/analyze - Analyze a single property
 */
router.post('/analyze', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({
        error: 'Address is required',
        code: 'MISSING_ADDRESS'
      });
    }

    console.log(`🏠 Analyzing property: ${address}`);
    
    // Create basic property data structure for Dallas CAD scraping
    const propertyData = {
      address: address,
      correlationId: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Run Dallas CAD analysis pipeline for motivation scoring
    const analysis = await intelligenceService.analyzeProperty(propertyData);
    
    // Format response for frontend
    const response = formatAnalysisResponse(analysis);
    
    console.log(`✅ Analysis completed - Score: ${response.motivation.totalScore}/100`);
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Property analysis failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'ANALYSIS_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/property/delinquent - Find delinquent properties in an area
 */
router.post('/delinquent', async (req, res) => {
  try {
    const { area, options = {} } = req.body;
    
    if (!area) {
      return res.status(400).json({
        error: 'Area is required (e.g., "Highland Park", "Dallas", "75205")',
        code: 'MISSING_AREA'
      });
    }

    console.log(`🔍 Searching for delinquent properties in: ${area}`);
    
    // Find delinquent properties in the area and enhance with CAD data
    const result = await intelligenceService.findDelinquentPropertiesInArea(area, options);
    
    // Format response
    const response = {
      statistics: result.statistics,
      delinquentProperties: result.delinquentProperties.map(formatAnalysisResponse),
      allResults: result.allResults.map(formatAnalysisResponse), // Same as delinquent since all are delinquent
      failures: result.failures,
      metadata: result.metadata
    };
    
    console.log(`✅ Found ${result.statistics.totalFound} delinquent properties in ${area}`);
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Delinquent property search failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DELINQUENT_SEARCH_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/property/contact - Fetch skip-traced contact info (phone/email) for
 * leads, with the DNC compliance gate applied. Body: { accountIds: [...] }.
 * Returns provider-configured flags + per-account contacts. Phones are only
 * `callable` when DNC-scrubbed and clear (fail-closed).
 */
router.post('/contact', async (req, res) => {
  try {
    const { accountIds } = req.body;
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ success: false, error: 'accountIds[] is required', code: 'MISSING_ACCOUNTS' });
    }
    const svc = await getSkipTrace();
    const contacts = await svc.getContacts(accountIds.slice(0, 200));
    res.json({
      success: true,
      configured: svc.providerStatus(),
      contacts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Contact lookup failed:', error);
    res.status(500).json({ success: false, error: error.message, code: 'CONTACT_LOOKUP_FAILED' });
  }
});

/**
 * POST /api/property/bulk-enrich - Enrich many leads with CAD detail at once.
 *
 * Body: { addresses: ["4300 BEVERLY DR", ...] }  OR  { leads: [{ address }] }
 *
 * For each address: serve from the persistent cache if present (instant),
 * otherwise scrape + cache. Processed sequentially because the CAD scraper is
 * rate-limited (parallel calls would just queue on the backend anyway).
 * Returns one result per input address plus cache/fetch stats.
 */
router.post('/bulk-enrich', async (req, res) => {
  try {
    let { addresses, leads } = req.body;
    if (!Array.isArray(addresses) && Array.isArray(leads)) {
      addresses = leads.map(l => l.address || l.fullAddress);
    }
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide a non-empty addresses[] (or leads[] with address)',
        code: 'MISSING_ADDRESSES'
      });
    }

    const list = addresses.slice(0, MAX_BULK_ENRICH);
    const truncated = addresses.length > MAX_BULK_ENRICH;
    if (truncated) {
      console.warn(`⚠️ bulk-enrich: ${addresses.length} requested, capping at ${MAX_BULK_ENRICH}`);
    }

    console.log(`🔎 bulk-enrich: processing ${list.length} addresses`);

    const results = [];
    let cached = 0, fetched = 0, failed = 0;

    for (const address of list) {
      if (!address || !String(address).trim()) {
        results.push({ address: address || '', cached: false, error: 'empty address' });
        failed++;
        continue;
      }

      const hit = await cadCache.get(address);
      if (hit) {
        results.push({ address, cached: true, ...hit });
        cached++;
        continue;
      }

      try {
        const parsed = await intelligenceService.scraper.getPropertyDetails({ address });
        const enrichment = normalizeEnrichment(parsed, address);
        await cadCache.set(address, enrichment);
        results.push({ address, cached: false, ...enrichment });
        fetched++;
      } catch (err) {
        console.error(`bulk-enrich failed for "${address}":`, err.message);
        results.push({ address, cached: false, error: err.message });
        failed++;
      }
    }

    console.log(`✅ bulk-enrich done: ${cached} cached, ${fetched} fetched, ${failed} failed`);

    res.json({
      success: true,
      results,
      stats: { total: list.length, cached, fetched, failed, truncated },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('bulk-enrich failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'BULK_ENRICH_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/property/delinquent - Find delinquent properties in an area (GET version)
 */
router.get('/delinquent', async (req, res) => {
  try {
    const { area, limit = 50, minAmount = 0 } = req.query;
    
    if (!area) {
      return res.status(400).json({
        error: 'Area parameter is required (e.g., ?area=Highland Park)',
        code: 'MISSING_AREA'
      });
    }

    console.log(`🔍 GET Searching for delinquent properties in: ${area}`);
    
    const options = {
      limit: parseInt(limit),
      minAmount: parseFloat(minAmount)
    };
    
    // Find delinquent properties in the area and enhance with CAD data
    const result = await intelligenceService.findDelinquentPropertiesInArea(area, options);
    
    // Format response
    const response = {
      statistics: result.statistics,
      delinquentProperties: result.delinquentProperties.map(formatAnalysisResponse),
      failures: result.failures,
      metadata: result.metadata
    };
    
    console.log(`✅ Found ${result.statistics.totalFound} delinquent properties in ${area}`);
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Delinquent property search failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DELINQUENT_SEARCH_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/property/batch - Analyze multiple properties
 */
router.post('/batch', async (req, res) => {
  try {
    const { addresses, options = {} } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        error: 'Addresses array is required',
        code: 'MISSING_ADDRESSES'
      });
    }

    if (addresses.length > 20) {
      return res.status(400).json({
        error: 'Maximum 20 properties per batch request',
        code: 'BATCH_TOO_LARGE'
      });
    }

    console.log(`📦 Batch analyzing ${addresses.length} properties`);
    
    // Create property data array for real Dallas CAD scraping
    const propertyDataArray = addresses.map(address => ({
      address: address,
      correlationId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
    
    // Run batch analysis
    const batchResult = await intelligenceService.analyzeBatch(propertyDataArray, {
      concurrency: 3,
      prioritizeHighValue: true,
      ...options
    });
    
    // Format response
    const response = {
      statistics: batchResult.statistics,
      motivatedSellers: batchResult.motivatedSellers.map(formatAnalysisResponse),
      allResults: batchResult.allResults.map(formatAnalysisResponse),
      failures: batchResult.failures,
      geographic: batchResult.geographic,
      metadata: batchResult.metadata
    };
    
    console.log(`✅ Batch completed - ${batchResult.statistics.motivatedSellers} motivated sellers found`);
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Batch analysis failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'BATCH_ANALYSIS_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/property/recommendations - Get property recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const {
      minimumScore = 60,
      maxResults = 50,
      sortBy = 'motivationScore'
    } = req.query;
    
    const recommendations = await intelligenceService.getPropertyRecommendations({
      minimumScore: parseInt(minimumScore),
      maxResults: parseInt(maxResults),
      sortBy
    });
    
    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to get recommendations:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'RECOMMENDATIONS_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/property/stats - Get system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = intelligenceService.getStats();
    
    res.json({
      success: true,
      data: {
        system: {
          uptime: stats.uptime,
          propertiesProcessed: stats.propertiesProcessed,
          motivatedSellersFound: stats.motivatedSellersFound,
          averageMotivationScore: Math.round(stats.averageMotivationScore * 100) / 100,
          motivatedSellerRate: Math.round(stats.motivatedSellerRate * 100 * 100) / 100,
          averageProcessingTime: Math.round(stats.averageProcessingTime)
        },
        components: {
          scraper: {
            totalRequests: stats.scraper?.totalRequests || 0,
            successRate: Math.round((stats.scraper?.successRate || 0) * 100),
            cacheHitRate: Math.round((stats.scraper?.cacheHitRate || 0) * 100),
            currentDelay: stats.scraper?.rateLimiter?.currentDelay || 0
          }
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to get stats:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STATS_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/property/health - Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = await intelligenceService.healthCheck();
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'HEALTH_CHECK_FAILED',
      timestamp: new Date().toISOString()
    });
  }
});

// Mock data functions removed - now using real Dallas CAD scraping

/**
 * Format analysis response for frontend consumption
 */
function formatAnalysisResponse(analysis) {
  // Extract enhanced CAD data if available
  const cadData = analysis.metadata?.rawCADData || {};
  
  return {
    property: {
      address: analysis.property?.address,
      accountId: cadData.accountId || analysis.property?.accountId,
      currentValue: cadData.valuation?.totalValue || analysis.taxation?.totalValue || analysis.financial?.currentValue,
      yearBuilt: cadData.property?.yearBuilt || analysis.property?.yearBuilt,
      squareFeet: cadData.property?.squareFootage || analysis.property?.squareFeet,
      propertyType: cadData.property?.propertyType || analysis.property?.propertyType || 'RESIDENTIAL',
      bedrooms: cadData.property?.bedrooms || analysis.property?.bedrooms,
      bathrooms: cadData.property?.bathrooms || analysis.property?.bathrooms,
      condition: cadData.property?.condition || analysis.property?.condition,
      age: cadData.property?.age || analysis.property?.age
    },
    location: {
      address: cadData.location?.address || analysis.location?.address,
      city: cadData.location?.city || analysis.location?.city,
      county: cadData.location?.county || analysis.location?.county || 'Dallas',
      state: cadData.location?.state || analysis.location?.state || 'TX'
    },
    ownership: {
      ownerName: cadData.ownership?.ownerName || analysis.ownership?.ownerName || 'Unknown Owner',
      ownerAddress: cadData.ownership?.ownerAddress || analysis.ownership?.ownerAddress,
      ownershipType: cadData.ownership?.ownershipType || analysis.ownership?.ownershipType || 'individual',
      ownershipDuration: cadData.ownership?.ownershipDuration || analysis.ownership?.ownershipDuration,
      decisionComplexity: cadData.ownership?.decisionComplexity || analysis.ownership?.decisionComplexity || 'low'
    },
    taxation: {
      totalValue: analysis.taxation?.totalValue,
      assessedValue: analysis.taxation?.assessedValue,
      landValue: analysis.taxation?.landValue,
      improvementValue: analysis.taxation?.improvementValue,
      marketValue: analysis.taxation?.marketValue,
      taxYear: analysis.taxation?.taxYear,
      taxAmount: analysis.taxation?.taxAmount,
      taxStatus: analysis.taxation?.taxStatus,
      delinquencyStatus: analysis.taxation?.delinquencyStatus,
      exemptions: analysis.taxation?.exemptions
    },
    taxDelinquency: {
      status: analysis.taxDelinquency?.status || 'UNKNOWN',
      isDelinquent: analysis.taxDelinquency?.isDelinquent || false,
      amountOwed: analysis.taxDelinquency?.amountOwed || 0,
      urgencyScore: analysis.taxDelinquency?.urgencyScore || 0,
      yearsDelinquent: analysis.taxDelinquency?.yearsDelinquent || 0,
      lastPaymentDate: analysis.taxDelinquency?.lastPaymentDate,
      foreclosureRisk: analysis.taxDelinquency?.foreclosureRisk || 'LOW',
      paymentStatus: analysis.taxDelinquency?.paymentStatus || 'UNKNOWN',
      detectedAt: analysis.taxDelinquency?.detectedAt,
      error: analysis.taxDelinquency?.error
    },
    motivation: {
      totalScore: analysis.motivation?.totalScore || 0,
      isMotivatedSeller: analysis.motivation?.isMotivatedSeller || false,
      motivationLevel: analysis.motivation?.motivationLevel || 'minimal',
      confidence: analysis.motivation?.confidence || 50,
      factors: analysis.motivation?.factors || [],
      sellProbability: analysis.motivation?.sellProbability ?? null,
      sellProbabilityPct: analysis.motivation?.sellProbabilityPct ?? null,
      sellProbabilityLift: analysis.motivation?.sellProbabilityLift ?? null,
      sellProbabilityDrivers: analysis.motivation?.sellProbabilityDrivers || []
    },
    geographic: {
      neighborhood: analysis.geographic?.neighborhood || 'Dallas',
      schoolDistrict: analysis.geographic?.schoolDistrict,
      marketArea: analysis.geographic?.marketArea,
      accessibilityScore: analysis.geographic?.accessibilityScore || 50,
      growthPotential: analysis.geographic?.growthPotential || 50,
      investmentGrade: analysis.geographic?.investmentGrade || 'B',
      marketVelocity: analysis.geographic?.marketVelocity || 'medium'
    },
    financial: {
      currentValue: analysis.financial?.currentValue || analysis.taxation?.totalValue || 0,
      taxAmount: analysis.taxation?.taxAmount || 0,
      delinquentAmount: analysis.taxation?.delinquentAmount || 0,
      taxBurdenRatio: analysis.motivation?.financialFactors?.taxBurdenRatio || 0.02
    },
    metadata: analysis.metadata || {}
  };
}

module.exports = router;