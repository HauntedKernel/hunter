/**
 * Process a larger sample of tax roll data for testing
 */

const TaxRollProcessor = require('./src/processors/TaxRollProcessor');
const fs = require('fs').promises;
const path = require('path');

async function processSampleData() {
  const processor = new TaxRollProcessor();
  
  try {
    console.log('🔄 Processing sample tax roll data for testing...');
    
    // Initialize database
    await processor.initializeDatabase();
    
    // Read the main data file - process first 50,000 lines for testing
    const dataFile = path.join(__dirname, 'src/data/flat404.DALLASCOUNTY.20250825.701243');
    const readStream = require('fs').createReadStream(dataFile, { encoding: 'ascii' });
    
    let content = '';
    let lineCount = 0;
    let processedCount = 0;
    let delinquentCount = 0;
    let highlandParkCount = 0;
    
    console.log('📖 Reading and processing tax roll data...');
    
    // Begin transaction for better performance
    await processor.db.exec('BEGIN TRANSACTION');
    
    try {
      for await (const chunk of readStream) {
        content += chunk;
        
        // Process complete lines
        while (content.includes('\n')) {
          const lineEnd = content.indexOf('\n');
          const line = content.substring(0, lineEnd);
          content = content.substring(lineEnd + 1);
          
          if (line.trim() && lineCount < 50000) { // Process first 50k lines
            const record = processor.parseDataLine(line);
            
            if (record) {
              await processor.insertTaxRecord(record);
              processedCount++;
              
              if (record.is_delinquent && !record.suit_pending && !record.bankruptcy_filed) {
                delinquentCount++;
              }
              
              if (record.city && record.city.toUpperCase().includes('HIGHLAND PARK')) {
                highlandParkCount++;
              }
              
              // Log progress every 10,000 records
              if (processedCount % 10000 === 0) {
                console.log(`   Processed ${processedCount} records... (${delinquentCount} delinquent, ${highlandParkCount} Highland Park)`);
              }
            }
          }
          
          lineCount++;
          if (lineCount >= 50000) break;
        }
        
        if (lineCount >= 50000) break;
      }
      
      // Commit transaction
      await processor.db.exec('COMMIT');
      
      console.log('\n📊 Processing Summary:');
      console.log(`   Total lines processed: ${lineCount}`);
      console.log(`   Successfully parsed: ${processedCount}`);
      console.log(`   Delinquent properties: ${delinquentCount}`);
      console.log(`   Highland Park properties: ${highlandParkCount}`);
      
      // Test searches
      console.log('\n🔍 Testing searches...');
      
      // Search Dallas area
      const dallasResults = await processor.searchDelinquentProperties('DALLAS', { limit: 5 });
      console.log(`   Found ${dallasResults.length} delinquent properties in Dallas`);
      
      // Search Highland Park
      const hpResults = await processor.searchDelinquentProperties('HIGHLAND PARK', { limit: 5 });
      console.log(`   Found ${hpResults.length} delinquent properties in Highland Park`);
      
      // Show sample result if available
      if (dallasResults.length > 0) {
        console.log('\n📋 Sample Dallas property:');
        const sample = dallasResults[0];
        console.log(`   Address: ${sample.address}`);
        console.log(`   Owner: ${sample.ownerName}`);
        console.log(`   Amount Owed: $${sample.amountOwed}`);
        console.log(`   Years Delinquent: ${sample.yearsDelinquent}`);
        console.log(`   Motivation Score: ${sample.motivationScore}`);
        console.log(`   Payment Status: ${sample.paymentStatus}`);
        console.log(`   Exemptions: ${sample.exemptions}`);
      }
      
      // Get database stats
      const stats = await processor.getStats();
      console.log('\n📈 Database Statistics:');
      console.log(`   Total properties: ${stats.total_properties}`);
      console.log(`   Delinquent properties: ${stats.delinquent_properties}`);
      console.log(`   Average delinquent amount: $${stats.avg_delinquent_amount ? stats.avg_delinquent_amount.toFixed(2) : '0'}`);
      console.log(`   Last updated: ${stats.last_updated}`);
      
    } catch (error) {
      // Rollback on error
      await processor.db.exec('ROLLBACK');
      throw error;
    }
    
    // Close database
    await processor.close();
    
    console.log('\n✅ Sample data processing completed successfully!');
    
  } catch (error) {
    console.error('❌ Sample data processing failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the processing
processSampleData();