/**
 * Check for Highland Park properties in our database
 */

const TaxRollProcessor = require('./src/processors/TaxRollProcessor');

async function checkHighlandPark() {
  const processor = new TaxRollProcessor();
  
  try {
    console.log('🔍 Checking for Highland Park properties in database...');
    
    // Initialize database
    await processor.initializeDatabase();
    
    // Search for all Highland Park properties (not just delinquent)
    const allHP = await processor.db.all(`
      SELECT COUNT(*) as total_count 
      FROM tax_roll 
      WHERE city LIKE ?
    `, ['%HIGHLAND PARK%']);
    
    console.log(`📊 Total Highland Park properties in database: ${allHP[0].total_count}`);
    
    // Search for delinquent Highland Park properties
    const delinquentHP = await processor.db.all(`
      SELECT COUNT(*) as delinquent_count 
      FROM tax_roll 
      WHERE city LIKE ? AND is_delinquent = 1
    `, ['%HIGHLAND PARK%']);
    
    console.log(`📊 Delinquent Highland Park properties: ${delinquentHP[0].delinquent_count}`);
    
    // Get sample cities to see what we have
    const cities = await processor.db.all(`
      SELECT city, COUNT(*) as count 
      FROM tax_roll 
      WHERE city IS NOT NULL AND city != '' 
      GROUP BY city 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    console.log('\n📍 Top 10 cities in our database:');
    cities.forEach(city => {
      console.log(`   ${city.city}: ${city.count} properties`);
    });
    
    // Check if there are any properties with 'HIGHLAND' or 'PARK' in city name
    const highland = await processor.db.all(`
      SELECT city, COUNT(*) as count 
      FROM tax_roll 
      WHERE city LIKE '%HIGHLAND%' OR city LIKE '%PARK%' 
      GROUP BY city 
      ORDER BY count DESC
    `);
    
    if (highland.length > 0) {
      console.log('\n🏞️ Cities containing "HIGHLAND" or "PARK":');
      highland.forEach(city => {
        console.log(`   ${city.city}: ${city.count} properties`);
      });
    } else {
      console.log('\n❌ No cities found containing "HIGHLAND" or "PARK"');
    }
    
    // Close database
    await processor.close();
    
    console.log('\n✅ Highland Park check completed!');
    
  } catch (error) {
    console.error('❌ Highland Park check failed:', error.message);
  }
}

// Run the check
checkHighlandPark();