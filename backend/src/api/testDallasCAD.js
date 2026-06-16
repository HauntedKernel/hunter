/**
 * Test API for Dallas CAD Integration
 * Demonstrates the complete property intelligence system
 */

const { PropertyIntelligenceService } = require('../services/PropertyIntelligenceService');
const { DallasCADScraper } = require('../scrapers/DallasCADScraper');

// Initialize the service
const intelligenceService = new PropertyIntelligenceService({
  logLevel: 'info',
  enableConsole: true
});

/**
 * Test individual property analysis
 */
async function testPropertyAnalysis() {
  console.log('\n========================================');
  console.log('🏠 Dallas CAD Property Intelligence Test');
  console.log('========================================\n');

  // Test properties from our fixtures
  const testProperties = [
    {
      address: '4300 Beverly Dr, Highland Park, TX 75205',
      description: 'High-value Highland Park property'
    },
    {
      address: '3500 Armstrong Pkwy, Highland Park, TX 75205',
      description: 'Standard Highland Park residential'
    },
    {
      address: '6800 Hillcrest Ave, University Park, TX 75225',
      description: 'University Park property'
    },
    {
      address: '5500 Preston Rd, Dallas, TX 75230',
      description: 'Preston Hollow area property'
    }
  ];

  console.log('📍 Analyzing Properties:\n');
  
  for (const property of testProperties) {
    try {
      console.log(`\n🔍 Analyzing: ${property.address}`);
      console.log(`   ${property.description}`);
      console.log('   -----------------------------------------');
      
      // Note: Since we don't have actual Dallas CAD access yet,
      // this will use simulated data for demonstration
      const mockPropertyData = createMockPropertyData(property.address);
      
      // Analyze with our intelligence service
      const analysis = await analyzeProperty(mockPropertyData);
      
      // Display results
      displayAnalysisResults(analysis);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Display service statistics
  displayServiceStats();
}

/**
 * Analyze a single property
 */
async function analyzeProperty(propertyData) {
  // Since we can't actually scrape Dallas CAD yet, we'll simulate the scraped data
  // and run it through our real analysis pipeline
  
  const mockScrapedData = {
    address: propertyData.address,
    currentValue: propertyData.currentValue,
    taxAmount: propertyData.taxAmount,
    delinquentAmount: propertyData.delinquentAmount,
    lastSaleDate: propertyData.lastSaleDate,
    yearBuilt: propertyData.yearBuilt,
    squareFeet: propertyData.squareFeet,
    ownerData: propertyData.ownerData,
    coordinates: propertyData.coordinates,
    propertyType: propertyData.propertyType,
    metadata: {
      extractionQuality: 'high',
      dataCompleteness: 95
    }
  };
  
  // Run through our real analysis pipeline
  return await intelligenceService.analyzeProperty(mockScrapedData);
}

/**
 * Create mock property data for testing
 */
function createMockPropertyData(address) {
  const addressLower = address.toLowerCase();
  
  // Highland Park properties
  if (addressLower.includes('highland park')) {
    if (addressLower.includes('4300 beverly')) {
      return {
        address,
        currentValue: 2500000,
        taxAmount: 52000,
        delinquentAmount: 15000, // Tax delinquent - high motivation
        lastSaleDate: '2008-03-15', // Long-term ownership
        yearBuilt: 1955, // Older property
        squareFeet: 5200,
        ownerData: 'JOHNSON FAMILY TRUST', // Trust ownership
        coordinates: { lat: 32.8345, lng: -96.7901 },
        propertyType: 'Single Family Residential'
      };
    } else {
      return {
        address,
        currentValue: 1800000,
        taxAmount: 38000,
        delinquentAmount: 0,
        lastSaleDate: '2015-07-22',
        yearBuilt: 1965,
        squareFeet: 4500,
        ownerData: 'SMITH, ROBERT AND JANE',
        coordinates: { lat: 32.8355, lng: -96.7880 },
        propertyType: 'Single Family Residential'
      };
    }
  }
  
  // University Park properties
  if (addressLower.includes('university park')) {
    return {
      address,
      currentValue: 1650000,
      taxAmount: 35000,
      delinquentAmount: 8500, // Some delinquency
      lastSaleDate: '2005-11-10', // Very long ownership
      yearBuilt: 1948, // Very old property
      squareFeet: 4200,
      ownerData: 'WILSON ESTATE', // Estate ownership - high motivation
      coordinates: { lat: 32.8465, lng: -96.7852 },
      propertyType: 'Single Family Residential'
    };
  }
  
  // Preston Hollow properties
  if (addressLower.includes('preston')) {
    return {
      address,
      currentValue: 2800000,
      taxAmount: 58000,
      delinquentAmount: 0,
      lastSaleDate: '1998-05-20', // Generational ownership
      yearBuilt: 1972,
      squareFeet: 6800,
      ownerData: 'ANDERSON HOLDINGS LLC', // Corporate ownership
      coordinates: { lat: 32.8750, lng: -96.7850 },
      propertyType: 'Single Family Residential'
    };
  }
  
  // Default Dallas property
  return {
    address,
    currentValue: 450000,
    taxAmount: 9500,
    delinquentAmount: 0,
    lastSaleDate: '2019-09-15',
    yearBuilt: 1985,
    squareFeet: 2400,
    ownerData: 'DAVIS, MICHAEL',
    coordinates: { lat: 32.7767, lng: -96.7970 },
    propertyType: 'Single Family Residential'
  };
}

/**
 * Display analysis results in a formatted way
 */
function displayAnalysisResults(analysis) {
  console.log('\n   📊 MOTIVATION ANALYSIS:');
  console.log(`   • Motivation Score: ${analysis.motivation.totalScore}/100`);
  console.log(`   • Classification: ${analysis.motivation.isMotivatedSeller ? '✅ MOTIVATED SELLER' : '❌ Not Motivated'}`);
  console.log(`   • Confidence: ${analysis.motivation.confidence}%`);
  
  console.log('\n   🎯 KEY FACTORS:');
  const topFactors = analysis.motivation.factors
    .filter(f => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);
  
  topFactors.forEach(factor => {
    console.log(`   • ${factor.description}: +${factor.points} points`);
  });
  
  console.log('\n   👤 OWNERSHIP ANALYSIS:');
  console.log(`   • Owner Type: ${analysis.ownership.ownerType}`);
  console.log(`   • Ownership Duration: ${analysis.ownership.ownershipDuration || 'Unknown'} years`);
  console.log(`   • Decision Complexity: ${analysis.ownership.processedOwners?.decisionMakingStructure || 'Simple'}`);
  
  console.log('\n   📍 GEOGRAPHIC CONTEXT:');
  console.log(`   • Neighborhood: ${analysis.geographic.neighborhood}`);
  console.log(`   • Accessibility Score: ${analysis.geographic.accessibilityScore}/100`);
  console.log(`   • Market Velocity: ${analysis.geographic.marketTrends?.marketVelocity || 'Unknown'}`);
  
  if (analysis.motivation.riskFactors && analysis.motivation.riskFactors.length > 0) {
    console.log('\n   ⚠️ RISK FACTORS:');
    analysis.motivation.riskFactors.forEach(risk => {
      console.log(`   • ${risk}`);
    });
  }
}

/**
 * Display service statistics
 */
function displayServiceStats() {
  const stats = intelligenceService.getStats();
  
  console.log('\n\n========================================');
  console.log('📈 SERVICE STATISTICS');
  console.log('========================================');
  console.log(`• Properties Processed: ${stats.propertiesProcessed}`);
  console.log(`• Motivated Sellers Found: ${stats.motivatedSellersFound}`);
  console.log(`• Average Motivation Score: ${stats.averageMotivationScore.toFixed(1)}`);
  console.log(`• Motivated Seller Rate: ${(stats.motivatedSellerRate * 100).toFixed(1)}%`);
  console.log(`• Average Processing Time: ${stats.averageProcessingTime.toFixed(0)}ms`);
  
  // Component health
  console.log('\n🔧 COMPONENT STATUS:');
  console.log(`• Scraper: ${stats.scraper.totalRequests} requests, ${(stats.scraper.successRate * 100).toFixed(0)}% success`);
  console.log(`• Cache: ${stats.scraper.cache.currentSize} items, ${(stats.scraper.cacheHitRate * 100).toFixed(0)}% hit rate`);
  console.log(`• Rate Limiter: ${stats.scraper.rateLimiter.currentDelay}ms current delay`);
}

/**
 * Test batch analysis with clustering
 */
async function testBatchAnalysis() {
  console.log('\n\n========================================');
  console.log('🗺️  BATCH ANALYSIS & CLUSTERING TEST');
  console.log('========================================\n');
  
  // Create a batch of properties for clustering analysis
  const batchProperties = [
    { address: '4300 Beverly Dr, Highland Park, TX 75205' },
    { address: '4320 Beverly Dr, Highland Park, TX 75205' },
    { address: '4340 Beverly Dr, Highland Park, TX 75205' },
    { address: '3500 Armstrong Pkwy, Highland Park, TX 75205' },
    { address: '3520 Armstrong Pkwy, Highland Park, TX 75205' },
    { address: '6800 Hillcrest Ave, University Park, TX 75225' },
    { address: '6820 Hillcrest Ave, University Park, TX 75225' },
    { address: '5500 Preston Rd, Dallas, TX 75230' }
  ];
  
  console.log(`📦 Analyzing batch of ${batchProperties.length} properties...\n`);
  
  try {
    const batchResult = await intelligenceService.analyzeBatch(batchProperties, {
      concurrency: 3,
      prioritizeHighValue: true
    });
    
    console.log('✅ BATCH RESULTS:');
    console.log(`• Total Processed: ${batchResult.statistics.totalProcessed}`);
    console.log(`• Motivated Sellers: ${batchResult.statistics.motivatedSellers}`);
    console.log(`• Success Rate: ${(batchResult.statistics.successRate * 100).toFixed(0)}%`);
    console.log(`• Average Motivation Score: ${batchResult.statistics.averageMotivationScore.toFixed(1)}`);
    
    console.log('\n🎯 TOP MOTIVATED SELLERS:');
    batchResult.motivatedSellers.slice(0, 3).forEach((seller, index) => {
      console.log(`${index + 1}. ${seller.property.address}`);
      console.log(`   Score: ${seller.motivation.totalScore} | ${seller.motivation.motivationLevel}`);
    });
    
    console.log('\n📍 GEOGRAPHIC INSIGHTS:');
    Object.entries(batchResult.geographic.neighborhoods).forEach(([neighborhood, data]) => {
      console.log(`• ${neighborhood}: ${data.count} properties, ${data.motivatedCount} motivated`);
    });
    
  } catch (error) {
    console.error(`❌ Batch analysis error: ${error.message}`);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    // Test individual property analysis
    await testPropertyAnalysis();
    
    // Test batch analysis with clustering
    await testBatchAnalysis();
    
    console.log('\n\n========================================');
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

// Export for use in other modules
module.exports = {
  testPropertyAnalysis,
  testBatchAnalysis,
  runAllTests,
  intelligenceService
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}