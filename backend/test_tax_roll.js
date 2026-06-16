/**
 * Test script to download and process Dallas County Tax Roll data
 */

const TaxRollProcessor = require('./src/processors/TaxRollProcessor');

async function testTaxRoll() {
  const processor = new TaxRollProcessor();
  
  try {
    console.log('🚀 Starting Tax Roll download and extraction...');
    
    // Initialize database
    await processor.initializeDatabase();
    
    // Download and extract only (don't clean up)
    const zipPath = await processor.downloadTaxRoll();
    const extractedFiles = await processor.unzipTaxRoll();
    
    console.log('📁 Extracted files:', extractedFiles);
    
    // Examine the first few lines of each data file
    const fs = require('fs').promises;
    for (const filePath of extractedFiles) {
      console.log(`\n📄 File: ${filePath}`);
      const stats = await fs.stat(filePath);
      console.log(`   Size: ${Math.round(stats.size / 1024 / 1024)}MB`);
      
      if (filePath.includes('.txt') || filePath.includes('layout')) {
        // Read text files completely
        const content = await fs.readFile(filePath, 'ascii');
        console.log('   Content (first 1000 chars):');
        console.log(content.substring(0, 1000));
      } else {
        // Read first few KB of large data files
        const readStream = require('fs').createReadStream(filePath, { encoding: 'ascii', start: 0, end: 10000 });
        let content = '';
        
        for await (const chunk of readStream) {
          content += chunk;
        }
        
        const lines = content.split('\n').slice(0, 5);
        console.log('   First 5 lines (first 10KB):');
        lines.forEach((line, i) => {
          console.log(`   ${i + 1}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
        });
      }
    }
    
    // Close database
    await processor.close();
    
    console.log('\n✅ Tax Roll examination completed!');
    
  } catch (error) {
    console.error('❌ Tax Roll processing failed:', error.message);
  }
}

// Run the test
testTaxRoll();