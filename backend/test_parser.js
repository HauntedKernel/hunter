/**
 * Test the updated parser with actual tax roll data
 */

const TaxRollProcessor = require('./src/processors/TaxRollProcessor');
const fs = require('fs').promises;
const path = require('path');

async function testParser() {
  const processor = new TaxRollProcessor();
  
  try {
    console.log('🧪 Testing Tax Roll parser...');
    
    // Initialize database
    await processor.initializeDatabase();
    
    // Read the main data file
    const dataFile = path.join(__dirname, 'src/data/flat404.DALLASCOUNTY.20250825.701243');
    
    // Read first few lines for testing
    const readStream = require('fs').createReadStream(dataFile, { encoding: 'ascii', start: 0, end: 10000 });
    let content = '';
    
    for await (const chunk of readStream) {
      content += chunk;
    }
    
    const lines = content.split('\n').slice(0, 5);
    console.log('\n📊 Testing parser on first 5 lines...');
    
    let parsedCount = 0;
    let delinquentCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      console.log(`\n🔍 Line ${i + 1} (${line.length} chars):`);
      console.log(`   Raw: ${line.substring(0, 100)}...`);
      
      const record = processor.parseDataLine(line);
      
      if (record) {
        console.log(`   ✅ Parsed successfully:`);
        console.log(`      Account: ${record.account_id}`);
        console.log(`      Year: ${record.tax_year}`);
        console.log(`      Owner: ${record.owner_name}`);
        console.log(`      Property: ${record.property_address}`);
        console.log(`      City: ${record.city}`);
        console.log(`      Tax Amount: $${record.tax_amount}`);
        console.log(`      Delinquent Amount: $${record.delinquent_amount}`);
        console.log(`      Is Delinquent: ${record.is_delinquent}`);
        console.log(`      Payment Status: ${record.payment_status}`);
        console.log(`      Exemptions: ${record.exemptions || 'None'}`);
        
        parsedCount++;
        if (record.is_delinquent) delinquentCount++;
      } else {
        console.log(`   ❌ Failed to parse`);
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total parsed: ${parsedCount}/${lines.length}`);
    console.log(`   Delinquent properties: ${delinquentCount}`);
    
    // Test Highland Park search
    console.log('\n🔍 Testing Highland Park search...');
    const highlandParkResults = await processor.searchDelinquentProperties('HIGHLAND PARK', { limit: 5 });
    console.log(`   Found ${highlandParkResults.length} delinquent properties in Highland Park`);
    
    if (highlandParkResults.length > 0) {
      console.log('\n📋 Sample Highland Park property:');
      const sample = highlandParkResults[0];
      console.log(`   Address: ${sample.address}`);
      console.log(`   Owner: ${sample.ownerName}`);
      console.log(`   Amount Owed: $${sample.amountOwed}`);
      console.log(`   Years Delinquent: ${sample.yearsDelinquent}`);
      console.log(`   Motivation Score: ${sample.motivationScore}`);
      console.log(`   Exemptions: ${sample.exemptions}`);
    }
    
    // Close database
    await processor.close();
    
    console.log('\n✅ Parser test completed successfully!');
    
  } catch (error) {
    console.error('❌ Parser test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testParser();