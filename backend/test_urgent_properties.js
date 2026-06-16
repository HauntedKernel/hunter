/**
 * Test Highland Park urgent properties with CAD enhancement
 */

const HighlandParkUrgencyService = require('./src/services/HighlandParkUrgencyService');

async function testUrgentProperties() {
  const service = new HighlandParkUrgencyService();
  
  try {
    console.log('🎯 Fetching most urgent Highland Park tax delinquent properties...\n');
    
    // Get top 25 most urgent properties with CAD data for top 5
    const urgentProperties = await service.getUrgentHighlandParkProperties({
      limit: 25,
      minAmount: 500,
      enhanceWithCAD: false  // Set to true to enable CAD lookups (slower)
    });
    
    console.log(`📊 Found ${urgentProperties.length} urgent Highland Park properties\n`);
    
    // Display top 10 in detail
    console.log('🔥 TOP 10 MOST URGENT HIGHLAND PARK PROPERTIES:\n');
    console.log('=' .repeat(80));
    
    urgentProperties.slice(0, 10).forEach((property, index) => {
      console.log(`\n#${index + 1}. ${property.address || 'Address Not Available'}`);
      console.log('─'.repeat(60));
      
      // Owner info
      console.log(`   👤 Owner: ${property.ownerName}`);
      if (property.ownerAddress) {
        console.log(`   📬 Owner Address: ${property.ownerAddress}`);
      }
      
      // Location
      console.log(`   📍 Location: ${property.city}, ${property.state} ${property.zipCode}`);
      console.log(`   🏷️ Account: ${property.accountId}`);
      
      // Financial details
      console.log(`\n   💰 FINANCIAL DETAILS:`);
      console.log(`      Amount Owed: $${property.delinquentAmount?.toFixed(2) || '0.00'}`);
      console.log(`      Total Due Now: $${property.totalAmountDue?.toFixed(2) || '0.00'}`);
      console.log(`      Due in 30 days: $${property.totalAmountDue30?.toFixed(2) || '0.00'}`);
      console.log(`      Due in 60 days: $${property.totalAmountDue60?.toFixed(2) || '0.00'}`);
      console.log(`      Due in 90 days: $${property.totalAmountDue90?.toFixed(2) || '0.00'}`);
      
      if (property.courtCost > 0) {
        console.log(`      Court Costs: $${property.courtCost.toFixed(2)}`);
      }
      
      // Status
      console.log(`\n   📊 STATUS:`);
      console.log(`      Years Delinquent: ${property.yearsDelinquent || 'N/A'}`);
      console.log(`      Payment Status: ${property.paymentStatus}`);
      console.log(`      Due Date: ${property.dueDate || 'N/A'}`);
      
      if (property.paymentAgreement) {
        console.log(`      ⚠️ Has Payment Agreement`);
      }
      if (property.attorneyDateSet) {
        console.log(`      ⚠️ Attorney Date Set - Legal Action Initiated`);
      }
      
      // Exemptions
      if (property.exemptions) {
        console.log(`      Exemptions: ${property.exemptions}`);
      }
      
      // Urgency Score
      console.log(`\n   🚨 URGENCY ANALYSIS:`);
      console.log(`      Urgency Score: ${property.urgencyScore}/100`);
      console.log(`      Urgency Level: ${property.urgencyLevel}`);
      console.log(`      Key Factors:`);
      property.urgencyFactors?.forEach(factor => {
        console.log(`         • ${factor}`);
      });
      
      // CAD Data (if available)
      if (property.enhanced && property.cadData) {
        console.log(`\n   🏠 PROPERTY DETAILS (from CAD):`);
        console.log(`      Market Value: ${property.cadData.marketValue || 'N/A'}`);
        console.log(`      Year Built: ${property.cadData.yearBuilt || 'N/A'}`);
        console.log(`      Property Type: ${property.cadData.propertyType || 'N/A'}`);
        console.log(`      Building Size: ${property.cadData.buildingSqFt || 'N/A'}`);
        console.log(`      Lot Size: ${property.cadData.lotSize || 'N/A'}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    
    // Summary statistics
    console.log('\n📈 SUMMARY STATISTICS:');
    
    const totalOwed = urgentProperties.reduce((sum, p) => sum + (p.delinquentAmount || 0), 0);
    const avgOwed = totalOwed / urgentProperties.length;
    const maxOwed = Math.max(...urgentProperties.map(p => p.delinquentAmount || 0));
    const criticalCount = urgentProperties.filter(p => p.urgencyLevel === 'CRITICAL').length;
    const highCount = urgentProperties.filter(p => p.urgencyLevel === 'HIGH').length;
    
    console.log(`   Total Properties: ${urgentProperties.length}`);
    console.log(`   Total Amount Owed: $${totalOwed.toFixed(2)}`);
    console.log(`   Average Amount Owed: $${avgOwed.toFixed(2)}`);
    console.log(`   Maximum Amount Owed: $${maxOwed.toFixed(2)}`);
    console.log(`   Critical Urgency: ${criticalCount} properties`);
    console.log(`   High Urgency: ${highCount} properties`);
    
    // Property type breakdown
    const nonHomestead = urgentProperties.filter(p => !p.homesteadExemption).length;
    const withPaymentAgreement = urgentProperties.filter(p => p.paymentAgreement).length;
    const withLegalAction = urgentProperties.filter(p => p.attorneyDateSet).length;
    
    console.log(`\n   Property Types:`);
    console.log(`      Non-Homestead (Investment): ${nonHomestead} properties`);
    console.log(`      With Payment Agreements: ${withPaymentAgreement} properties`);
    console.log(`      With Legal Action: ${withLegalAction} properties`);
    
    await service.close();
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testUrgentProperties();