/**
 * Quick Test - Direct component testing without HTML parsing
 */

const MotivationScorer = require('../scoring/MotivationScorer');
const NameProcessor = require('../processors/NameProcessor');
const GeographicClusterer = require('../clustering/GeographicClusterer');

console.log('\n========================================');
console.log('🚀 Dallas CAD Integration - Quick Test');
console.log('========================================\n');

async function testMotivationScoring() {
  console.log('📊 TESTING MOTIVATION SCORING');
  console.log('--------------------------------');
  
  const scorer = new MotivationScorer();
  
  // Test Highland Park tax delinquent property
  const highMotivationProperty = {
    address: '4300 Beverly Dr, Highland Park, TX 75205',
    currentValue: 2500000,
    taxAmount: 52000,
    delinquentAmount: 75000, // High delinquency
    lastSaleDate: '2005-03-15', // Long ownership
    yearBuilt: 1955, // Old property
    processedOwners: {
      ownerType: 'trust',
      ownershipDuration: 19
    },
    correlationId: 'test_001'
  };
  
  console.log(`\n🏠 Analyzing: ${highMotivationProperty.address}`);
  const analysis = await scorer.calculateMotivationScore(highMotivationProperty);
  
  console.log(`✅ Motivation Score: ${analysis.totalScore}/100`);
  console.log(`📈 Classification: ${analysis.isMotivatedSeller ? 'MOTIVATED SELLER' : 'Not Motivated'} (${analysis.motivationLevel})`);
  console.log(`🎯 Confidence: ${analysis.confidence}%`);
  
  console.log('\n🔥 Top Motivation Factors:');
  analysis.factors
    .filter(f => f.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .forEach(factor => {
      console.log(`   • ${factor.description}: +${factor.points} points`);
    });
  
  return analysis;
}

async function testNameProcessing() {
  console.log('\n\n👤 TESTING NAME PROCESSING');
  console.log('--------------------------------');
  
  const processor = new NameProcessor();
  
  const testOwners = [
    'JOHNSON FAMILY TRUST',
    'SMITH ESTATE',
    'ABC PROPERTIES LLC', 
    'WILSON, ROBERT AND JANE'
  ];
  
  for (const ownerName of testOwners) {
    console.log(`\n📋 Processing: ${ownerName}`);
    
    const result = await processor.processOwnerData({
      name: ownerName
    }, { correlationId: 'test_name' });
    
    console.log(`   Entity Type: ${result.ownerType}`);
    console.log(`   Motivation Level: ${result.motivationLevel}`);
    console.log(`   Risk Level: ${result.overallRisk || 'low'}`);
  }
}

async function testGeographicClustering() {
  console.log('\n\n📍 TESTING GEOGRAPHIC CLUSTERING');
  console.log('--------------------------------');
  
  const clusterer = new GeographicClusterer();
  
  // Test Highland Park property
  const testProperty = {
    address: '4300 Beverly Dr, Highland Park, TX 75205',
    coordinates: { lat: 32.8345, lng: -96.7901 }
  };
  
  console.log(`\n🗺️  Analyzing: ${testProperty.address}`);
  
  const geoAnalysis = await clusterer.analyzeGeographicContext(testProperty);
  
  console.log(`📍 Neighborhood: ${geoAnalysis.neighborhood}`);
  console.log(`🚗 Accessibility Score: ${geoAnalysis.accessibilityScore}/100`);
  console.log(`📈 Growth Potential: ${geoAnalysis.growthPotential}/100`);
  console.log(`🏆 Investment Grade: ${geoAnalysis.investmentGrade}`);
  
  if (geoAnalysis.accessibilityFactors.length > 0) {
    console.log('\n   Accessibility Factors:');
    geoAnalysis.accessibilityFactors.forEach(factor => {
      console.log(`   • ${factor}`);
    });
  }
  
  return geoAnalysis;
}

async function testIntegratedAnalysis() {
  console.log('\n\n🔄 TESTING INTEGRATED ANALYSIS');
  console.log('--------------------------------');
  
  const scorer = new MotivationScorer();
  const processor = new NameProcessor();
  const clusterer = new GeographicClusterer();
  
  // High-value motivated seller scenario
  const property = {
    address: '4300 Beverly Dr, Highland Park, TX 75205',
    currentValue: 2500000,
    taxAmount: 52000,
    delinquentAmount: 75000, // $75k delinquent (3% of value)
    lastSaleDate: '2005-03-15', // 19 years ownership
    yearBuilt: 1955, // 69 years old
    ownerName: 'JOHNSON FAMILY TRUST',
    coordinates: { lat: 32.8345, lng: -96.7901 }
  };
  
  console.log(`\n🏠 Complete Analysis: ${property.address}`);
  console.log(`💰 Value: $${property.currentValue.toLocaleString()}`);
  console.log(`📋 Owner: ${property.ownerName}`);
  
  // Step 1: Process owner
  const ownerAnalysis = await processor.processOwnerData({
    name: property.ownerName
  });
  
  // Step 2: Score motivation
  const motivationAnalysis = await scorer.calculateMotivationScore({
    ...property,
    processedOwners: ownerAnalysis
  });
  
  // Step 3: Analyze geography
  const geoAnalysis = await clusterer.analyzeGeographicContext(property);
  
  // Compile results
  console.log('\n📊 INTEGRATED RESULTS:');
  console.log(`🎯 Motivation Score: ${motivationAnalysis.totalScore}/100`);
  console.log(`📈 Motivated Seller: ${motivationAnalysis.isMotivatedSeller ? '✅ YES' : '❌ NO'}`);
  console.log(`👤 Owner Type: ${ownerAnalysis.ownerType} (${ownerAnalysis.motivationLevel} motivation)`);
  console.log(`📍 Location: ${geoAnalysis.neighborhood} (Grade: ${geoAnalysis.investmentGrade})`);
  console.log(`🚗 Accessibility: ${geoAnalysis.accessibilityScore}/100`);
  
  console.log('\n🔥 Key Success Factors:');
  const topFactors = motivationAnalysis.factors
    .filter(f => f.points > 10)
    .sort((a, b) => b.points - a.points);
  
  topFactors.forEach(factor => {
    console.log(`   • ${factor.description}: +${factor.points} points`);
  });
  
  if (topFactors.length === 0) {
    console.log('   • No major motivation factors detected');
  }
  
  // Investment recommendation
  const totalScore = motivationAnalysis.totalScore;
  let recommendation;
  
  if (totalScore >= 70) {
    recommendation = '🚀 HIGH PRIORITY - Contact immediately';
  } else if (totalScore >= 45) {
    recommendation = '📈 MEDIUM PRIORITY - Include in outreach campaign';
  } else if (totalScore >= 25) {
    recommendation = '📋 LOW PRIORITY - Monitor for changes';
  } else {
    recommendation = '⏳ WATCH LIST - Not currently motivated';
  }
  
  console.log(`\n💡 RECOMMENDATION: ${recommendation}`);
  
  return {
    property,
    ownerAnalysis,
    motivationAnalysis,
    geoAnalysis,
    recommendation
  };
}

async function runAllTests() {
  try {
    const results = {};
    
    // Run individual component tests
    results.motivation = await testMotivationScoring();
    await testNameProcessing();
    results.geographic = await testGeographicClustering();
    
    // Run integrated test
    results.integrated = await testIntegratedAnalysis();
    
    // Display final statistics
    console.log('\n\n========================================');
    console.log('📈 SYSTEM PERFORMANCE SUMMARY');
    console.log('========================================');
    
    const scorer = new MotivationScorer();
    const stats = scorer.getStats();
    
    console.log(`✅ Properties Analyzed: ${stats.totalScored}`);
    console.log(`📊 Average Score: ${stats.averageScore.toFixed(1)}/100`);
    console.log(`⚡ Average Processing Time: ${stats.averageProcessingTime}ms`);
    console.log(`🏆 High Motivation Rate: ${(stats.highMotivationRate * 100).toFixed(1)}%`);
    
    console.log('\n🔧 System Components:');
    console.log('   ✅ MotivationScorer - Operational');
    console.log('   ✅ NameProcessor - Operational');
    console.log('   ✅ GeographicClusterer - Operational');
    console.log('   ✅ Integrated Analysis - Operational');
    
    console.log('\n========================================');
    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('========================================\n');
    
    return results;
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Run tests
runAllTests().then(() => {
  console.log('Test execution completed.');
  process.exit(0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});