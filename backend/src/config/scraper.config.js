/**
 * Scraper Configuration
 * Environment-specific settings for Dallas CAD scraper
 */

const config = {
  development: {
    scraper: {
      rateLimit: 3000,        // 3 second delays for development
      timeout: 15000,         // 15 second timeout
      retryAttempts: 2,       // Less aggressive retries
      cacheSize: 100,         // Smaller cache for dev
      cacheTTL: 300000,       // 5 minute TTL for rapid testing
      maxDelay: 8000,         // Max 8 second delay
      minDelay: 1500          // Min 1.5 second delay
    },
    
    logging: {
      level: 'debug',
      console: true,
      file: false
    },
    
    testing: {
      enableRealRequests: false,  // Use mock data in development
      testDelay: 2000,            // Faster testing
      generateReports: true
    }
  },
  
  production: {
    scraper: {
      rateLimit: 2000,        // 2 second delays
      timeout: 30000,         // 30 second timeout
      retryAttempts: 3,       // More resilient retries
      cacheSize: 10000,       // Large cache for performance
      cacheTTL: 86400000,     // 24 hour TTL
      maxDelay: 10000,        // Max 10 second delay
      minDelay: 1000          // Min 1 second delay
    },
    
    logging: {
      level: 'info',
      console: false,
      file: true
    },
    
    testing: {
      enableRealRequests: true,   // Use real CAD requests
      testDelay: 3000,            // Respectful testing
      generateReports: true
    }
  },
  
  test: {
    scraper: {
      rateLimit: 1000,        // Fast for automated testing
      timeout: 10000,         // Quick timeout
      retryAttempts: 1,       // Single attempt for tests
      cacheSize: 50,          // Small cache
      cacheTTL: 60000,        // 1 minute TTL
      maxDelay: 2000,         // Max 2 second delay
      minDelay: 500           // Min 0.5 second delay
    },
    
    logging: {
      level: 'warn',          // Minimal logging for tests
      console: false,
      file: false
    },
    
    testing: {
      enableRealRequests: false,  // Mock data for unit tests
      testDelay: 100,             // Very fast testing
      generateReports: false
    }
  }
};

/**
 * Get configuration for current environment
 */
function getConfig() {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = config[env] || config.development;
  
  return {
    ...envConfig,
    environment: env,
    baseURL: 'https://www.dallascad.org',
    searchPath: '/AcctDetailSearch.aspx',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  };
}

/**
 * Update configuration at runtime
 */
function updateConfig(updates) {
  const env = process.env.NODE_ENV || 'development';
  if (config[env]) {
    Object.assign(config[env], updates);
  }
}

/**
 * Get performance-optimized configuration
 */
function getPerformanceConfig() {
  return {
    rateLimit: 1500,      // Aggressive but safe
    cacheSize: 5000,      // Medium cache
    cacheTTL: 43200000,   // 12 hour TTL
    timeout: 20000        // 20 second timeout
  };
}

/**
 * Get conservative configuration for high-load periods
 */
function getConservativeConfig() {
  return {
    rateLimit: 5000,      // Very respectful
    cacheSize: 20000,     // Large cache
    cacheTTL: 86400000,   // 24 hour TTL
    timeout: 45000,       // Long timeout
    maxDelay: 15000       // Higher max delay
  };
}

module.exports = {
  getConfig,
  updateConfig,
  getPerformanceConfig,
  getConservativeConfig,
  environments: Object.keys(config)
};