/**
 * Process the complete Dallas County Tax Roll file
 * Focus on Highland Park ZIP codes: 75205, 75219, 75206
 */

const TaxRollProcessor = require('./src/processors/TaxRollProcessor');
const fs = require('fs').promises;
const path = require('path');

async function processFullTaxRoll() {
  const processor = new TaxRollProcessor();
  
  try {
    console.log('🔄 Processing COMPLETE Dallas County Tax Roll (2.6GB)...');
    console.log('🎯 Focusing on Highland Park ZIP codes: 75205, 75219, 75206');
    
    // Initialize database - clear existing data for full refresh
    await processor.initializeDatabase();
    await processor.db.exec('DELETE FROM tax_roll');
    
    // Read the main data file. Pass an explicit path as argv[2], else auto-pick
    // the newest flat404.* file in src/data (the unzipped TRW export). The TRW
    // file ID changes each weekly release, so don't hardcode a name.
    const realFs = require('fs');
    const dataDir = path.join(__dirname, 'src/data');
    let dataFile = process.argv[2];
    if (!dataFile) {
      const matches = realFs.readdirSync(dataDir).filter(f => f.startsWith('flat404.'));
      if (!matches.length) {
        throw new Error('No flat404.* tax-roll file in src/data. Download the current ' +
          'TRW zip (URL on https://www.dallascounty.org/departments/tax/tax-roll.php) ' +
          'and unzip it into src/data first.');
      }
      matches.sort((a, b) => realFs.statSync(path.join(dataDir, b)).mtimeMs - realFs.statSync(path.join(dataDir, a)).mtimeMs);
      dataFile = path.join(dataDir, matches[0]);
    }
    console.log(`📄 Using tax-roll data file: ${dataFile}`);
    const readStream = realFs.createReadStream(dataFile, { encoding: 'ascii' });
    
    let content = '';
    let lineCount = 0;
    let processedCount = 0;
    let delinquentCount = 0;
    let highlandParkCount = 0;
    let highlandParkDelinquentCount = 0;
    
    const highlandParkZips = ['75205', '75219', '75206'];
    
    console.log('📖 Reading and processing complete tax roll data...');
    console.log('⏱️ This will take 10-15 minutes for 2.6GB file...');
    
    // Begin transaction for better performance
    await processor.db.exec('BEGIN TRANSACTION');
    
    const startTime = Date.now();
    let lastProgressTime = startTime;
    
    try {
      for await (const chunk of readStream) {
        content += chunk;
        
        // Process complete lines
        while (content.includes('\n')) {
          const lineEnd = content.indexOf('\n');
          const line = content.substring(0, lineEnd);
          content = content.substring(lineEnd + 1);
          
          if (line.trim()) {
            const record = processor.parseDataLine(line);
            
            if (record) {
              await processor.insertTaxRecord(record);
              processedCount++;
              
              if (record.is_delinquent && !record.suit_pending && !record.bankruptcy_filed) {
                delinquentCount++;
              }
              
              // Check for Highland Park properties
              const isHighlandPark = 
                (record.city && record.city.toUpperCase().includes('HIGHLAND PARK')) ||
                (record.zip_code && highlandParkZips.some(zip => record.zip_code.includes(zip)));
              
              if (isHighlandPark) {
                highlandParkCount++;
                if (record.is_delinquent && !record.suit_pending && !record.bankruptcy_filed) {
                  highlandParkDelinquentCount++;
                  console.log(`   🎯 Highland Park delinquent: ${record.property_address} - $${record.delinquent_amount} (ZIP: ${record.zip_code})`);
                }
              }
              
              // Log progress every 50,000 records
              if (processedCount % 50000 === 0) {
                const currentTime = Date.now();
                const elapsed = Math.round((currentTime - startTime) / 1000);
                const rate = Math.round(processedCount / elapsed);
                
                console.log(`   📊 Processed ${processedCount.toLocaleString()} records... (${elapsed}s elapsed, ${rate}/sec)`);
                console.log(`      💰 Delinquent: ${delinquentCount.toLocaleString()}`);
                console.log(`      🏠 Highland Park total: ${highlandParkCount}`);
                console.log(`      🎯 Highland Park delinquent: ${highlandParkDelinquentCount}`);
                
                // Commit periodically to avoid long transactions
                await processor.db.exec('COMMIT');
                await processor.db.exec('BEGIN TRANSACTION');
                
                lastProgressTime = currentTime;
              }
            }
          }
          
          lineCount++;
        }
      }
      
      // Commit final transaction
      await processor.db.exec('COMMIT');
      
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      const avgRate = Math.round(processedCount / totalTime);
      
      console.log('\n🎉 COMPLETE TAX ROLL PROCESSING SUMMARY:');
      console.log(`   📊 Total lines processed: ${lineCount.toLocaleString()}`);
      console.log(`   ✅ Successfully parsed: ${processedCount.toLocaleString()}`);
      console.log(`   💰 Total delinquent properties: ${delinquentCount.toLocaleString()}`);
      console.log(`   🏠 Highland Park properties: ${highlandParkCount}`);
      console.log(`   🎯 Highland Park delinquent: ${highlandParkDelinquentCount}`);
      console.log(`   ⏱️ Processing time: ${totalTime} seconds (${avgRate} records/sec)`);
      
      if (highlandParkDelinquentCount > 0) {
        console.log('\n🎯 Highland Park delinquent property details:');
        const hpResults = await processor.searchDelinquentProperties('75205', { limit: 50 });
        hpResults.forEach((property, index) => {
          console.log(`   ${index + 1}. ${property.address}`);
          console.log(`      Owner: ${property.ownerName}`);
          console.log(`      Amount Owed: $${property.amountOwed}`);
          console.log(`      Years Delinquent: ${property.yearsDelinquent}`);
          console.log(`      ZIP: ${property.zipCode}`);
          console.log(`      Motivation Score: ${property.motivationScore}`);
        });
      }
      
    } catch (error) {
      // Rollback on error
      await processor.db.exec('ROLLBACK');
      throw error;
    }
    
    // Get final database stats
    const stats = await processor.getStats();
    console.log('\n📈 Final Database Statistics:');
    console.log(`   Total properties: ${stats.total_properties?.toLocaleString()}`);
    console.log(`   Delinquent properties: ${stats.delinquent_properties?.toLocaleString()}`);
    console.log(`   Average delinquent amount: $${stats.avg_delinquent_amount ? stats.avg_delinquent_amount.toFixed(2) : '0'}`);
    console.log(`   Last updated: ${stats.last_updated}`);
    
    // Close database
    await processor.close();
    
    console.log('\n✅ Complete tax roll processing completed!');
    
  } catch (error) {
    console.error('❌ Complete tax roll processing failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the processing
processFullTaxRoll();