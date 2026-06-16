/**
 * DallasCADScraper - Main scraper class for Dallas County Appraisal District
 * 
 * Implements production-ready scraping with adaptive rate limiting, intelligent
 * caching, and comprehensive data extraction for motivated seller identification.
 */

const axios = require('axios');
const _ = require('lodash');
const RateLimiter = require('./RateLimiter');
const HTMLParser = require('./HTMLParser');
const CacheManager = require('../utils/CacheManager');
const Logger = require('../utils/Logger');

class DallasCADScraper {
  constructor(options = {}) {
    this.baseURL = 'https://www.dallascad.org';
    this.searchPath = '/SearchAddr.aspx';
    
    // Initialize components
    this.rateLimiter = new RateLimiter({
      delay: options.delay || 2000,
      maxDelay: options.maxDelay || 10000,
      adaptationEnabled: options.adaptationEnabled !== false
    });
    
    this.cache = new CacheManager({
      maxSize: options.cacheSize || 1000,
      defaultTTL: options.cacheTTL || 86400000 // 24 hours
    });
    
    this.parser = new HTMLParser();
    this.logger = new Logger('DallasCADScraper', {
      logLevel: options.logLevel || 'info',
      enableConsole: options.enableConsole !== false
    });
    
    // HTTP client configuration
    this.httpClient = axios.create({
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    // Performance tracking
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      cachedRequests: 0,
      failedRequests: 0,
      startTime: Date.now()
    };
    
    this.logger.info('DallasCADScraper initialized', { 
      baseURL: this.baseURL,
      cacheSize: options.cacheSize || 1000,
      rateLimit: options.delay || 2000
    });
  }

  /**
   * Main method to get property details
   * Implements caching, rate limiting, and error handling
   * 
   * @param {Object} propertyData - Property search parameters
   * @returns {Promise<Object>} Extracted property data
   */
  async getPropertyDetails(propertyData) {
    const timer = this.logger.createTimer('getPropertyDetails');
    const cacheKey = this.generateCacheKey(propertyData);
    
    try {
      // Check cache first
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        this.stats.cachedRequests++;
        this.logger.logCacheActivity('hit', cacheKey, true);
        timer.end({ cached: true });
        return cachedData;
      }
      
      this.logger.logCacheActivity('miss', cacheKey, false);
      
      // Perform scraping with rate limiting
      await this.rateLimiter.adaptiveWait();
      const rawData = await this.performCADSearch(propertyData);
      
      // Parse the HTML response
      const parsedData = this.parser.parseCADResponse(rawData.html, {
        ...propertyData,
        sourceUrl: rawData.url,
        startTime: Date.now()
      });

      // Follow the detail-page link to enrich with building characteristics
      // (beds/baths/sqft/year built). These are not on the search-results row —
      // they live on AcctDetailRes.aspx, reached by the account ID we just
      // parsed. One extra GET per property; only happens on a real (lazy) lookup.
      if (parsedData.accountId) {
        try {
          await this.rateLimiter.adaptiveWait();
          const detailHtml = await this.fetchPropertyDetailPage(parsedData.accountId);
          if (detailHtml) {
            const detail = this.parser.parseResidentialDetail(detailHtml);
            parsedData.property = { ...parsedData.property, ...detail };
            this.logger.debug('Enriched property with CAD detail page', {
              accountId: parsedData.accountId,
              bedrooms: detail.bedrooms,
              squareFootage: detail.squareFootage
            });
          }
        } catch (detailError) {
          this.logger.warn('CAD detail-page enrichment failed (continuing with results-row data)', {
            accountId: parsedData.accountId,
            error: detailError.message
          });
        }
      }

      // Cache the results with intelligent TTL
      this.cache.set(cacheKey, parsedData, { 
        motivationBased: true,
        originalRequest: propertyData 
      });
      
      this.stats.successfulRequests++;
      
      const duration = timer.end({ 
        cached: false, 
        extractionQuality: parsedData.metadata?.extractionQuality 
      });
      
      // Record performance metrics for rate limiting adaptation
      this.rateLimiter.recordRequestMetrics(duration, true, 200);
      
      this.logger.logScrapingActivity({
        url: rawData.url,
        success: true,
        responseTime: duration,
        statusCode: 200,
        propertyAddress: propertyData.address,
        cacheHit: false
      });
      
      return parsedData;
      
    } catch (error) {
      this.stats.failedRequests++;
      const duration = timer.end({ error: error.message });
      
      // Record failed request for rate limiting adaptation
      this.rateLimiter.recordRequestMetrics(duration, false, error.response?.status || 0);
      
      this.logger.logScrapingActivity({
        url: this.baseURL + this.searchPath,
        success: false,
        responseTime: duration,
        statusCode: error.response?.status || 0,
        propertyAddress: propertyData.address,
        error: error,
        cacheHit: false
      });
      
      throw new ScrapingError(error.message, propertyData, error);
    } finally {
      this.stats.totalRequests++;
    }
  }

  /**
   * Perform the actual CAD search request
   * 
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object>} Raw HTML response data
   */
  /**
   * Fetch a Dallas CAD residential detail page by account ID.
   * Plain GET (no session/cookie required) to AcctDetailRes.aspx?ID=...
   *
   * @param {string} accountId - DCAD account ID from the search results row
   * @returns {Promise<string|null>} Detail page HTML, or null on failure
   */
  async fetchPropertyDetailPage(accountId) {
    if (!accountId) return null;

    const detailUrl = `${this.baseURL}/AcctDetailRes.aspx?ID=${encodeURIComponent(accountId)}`;
    const response = await this.httpClient.get(detailUrl);

    if (response.status === 200 && response.data && response.data.length > 1000) {
      return response.data;
    }
    return null;
  }

  async performCADSearch(searchParams) {
    const { address, city, state, zipCode } = this.parseAddress(searchParams.address);
    const searchUrl = `${this.baseURL}${this.searchPath}`;
    
    this.logger.debug('Performing CAD search', { 
      address, 
      city, 
      normalizedCity: this.normalizeCity(city) 
    });
    
    try {
      // Step 1: GET the search page to obtain ViewState values
      this.logger.debug('Getting search form page for ViewState');
      const getResponse = await this.httpClient.get(searchUrl);
      
      if (getResponse.status !== 200) {
        throw new Error(`Failed to get search form: HTTP ${getResponse.status}`);
      }
      
      // Extract ASP.NET ViewState values
      const viewState = this.extractViewState(getResponse.data);

      // Capture the session cookie from the GET. ASP.NET WebForms ties the
      // VIEWSTATE/EVENTVALIDATION tokens to the session, so the POST MUST be
      // sent with the same ASP.NET_SessionId cookie — otherwise the server
      // rejects the postback and silently re-renders an empty "No Records"
      // form. Axios does not persist cookies on its own, so we forward them
      // manually (no extra dependency needed).
      const cookieHeader = this.extractCookieHeader(getResponse.headers['set-cookie']);

      // Step 2: Prepare search parameters for Dallas CAD with ViewState
      const formData = this.buildSearchFormData(address, city, state, zipCode, viewState);

      this.logger.debug('Submitting search form', { addressComponents: this.parseStreetAddress(address) });

      // Step 3: POST the search form
      const response = await this.httpClient.post(searchUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': searchUrl,
          'Origin': this.baseURL,
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
        }
      });
      
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.data || response.data.length < 1000) {
        throw new Error('Response too short, likely an error page');
      }
      
      // DEBUG: Log HTML structure for parser improvement
      this.debugHTMLResponse(response.data, address);
      
      return {
        html: response.data,
        url: searchUrl,
        status: response.status,
        headers: response.headers
      };
      
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - Dallas CAD server may be overloaded');
      } else if (error.response?.status === 503) {
        throw new Error('Dallas CAD server temporarily unavailable (503)');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limited by Dallas CAD server (429)');
      }
      
      throw error;
    }
  }

  /**
   * Parse address into components
   * 
   * @param {string} fullAddress - Full property address
   * @returns {Object} Address components
   */
  parseAddress(fullAddress) {
    if (!fullAddress) {
      throw new Error('Address is required for property lookup');
    }
    
    const normalized = fullAddress.trim().toUpperCase();
    
    // Extract ZIP code
    const zipMatch = normalized.match(/\b(\d{5}(-\d{4})?)\b/);
    const zipCode = zipMatch ? zipMatch[1] : '';
    
    // Extract state (TX)
    const stateMatch = normalized.match(/\b(TX|TEXAS)\b/i);
    const state = stateMatch ? 'TX' : 'TX'; // Default to TX
    
    // Extract city - common Dallas area cities
    const cityPatterns = [
      /\b(DALLAS|HIGHLAND PARK|UNIVERSITY PARK|PRESTON HOLLOW|LAKEWOOD|UPTOWN|OAK LAWN|DEEP ELLUM)\b/i
    ];
    
    let city = 'DALLAS'; // Default
    for (const pattern of cityPatterns) {
      const match = normalized.match(pattern);
      if (match) {
        city = match[1];
        break;
      }
    }
    
    // Extract street address (everything before city)
    let address = normalized;
    if (city !== 'DALLAS') {
      const cityIndex = normalized.indexOf(city);
      if (cityIndex > 0) {
        address = normalized.substring(0, cityIndex).trim();
      }
    }
    
    // Clean up address
    address = address
      .replace(/,.*$/, '') // Remove everything after first comma
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      address,
      city: city,  // Return the text city name, not normalized
      state,
      zipCode,
      fullAddress: normalized
    };
  }

  /**
   * Normalize city names for Dallas CAD compatibility
   * 
   * @param {string} city - Raw city name
   * @returns {string} Normalized city name
   */
  normalizeCity(city) {
    // Dallas CAD uses numeric values for cities, not city names
    const cityMappings = {
      'HIGHLAND PARK': '29',
      'UNIVERSITY PARK': '49', 
      'PRESTON HOLLOW': '12',  // Dallas
      'LAKEWOOD': '12',        // Dallas
      'UPTOWN': '12',          // Dallas
      'OAK LAWN': '12',        // Dallas
      'DEEP ELLUM': '12',      // Dallas
      'DALLAS': '12',          // Dallas
      'ADDISON': '2',
      'BALCH SPRINGS': '3', 
      'CARROLLTON': '6',
      'CEDAR HILL': '7',
      'COPPELL': '9',
      'DESOTO': '15',
      'DUNCANVILLE': '16',
      'FARMERS BRANCH': '17',
      'GARLAND': '20',
      'GRAND PRAIRIE': '24',
      'GRAPEVINE': '28',
      'HUTCHINS': '30',
      'IRVING': '31',
      'LANCASTER': '32',
      'LEWISVILLE': '33',
      'MESQUITE': '34',
      'RICHARDSON': '39',
      'ROWLETT': '40',
      'SACHSE': '42'
    };
    
    return cityMappings[city.toUpperCase()] || '12'; // Default to Dallas (12)
  }

  /**
   * Parse street address into components for Dallas CAD form
   * 
   * @param {string} streetAddress - Street address to parse
   * @returns {Object} Address components
   */
  parseStreetAddress(streetAddress) {
    if (!streetAddress) return {};
    
    const address = streetAddress.trim().toUpperCase();
    
    // Extract address number (first number sequence)
    const numberMatch = address.match(/^(\d+)/);
    const number = numberMatch ? numberMatch[1] : '';
    
    // Extract direction (N, S, E, W, NE, NW, SE, SW)
    const directionMatch = address.match(/\b(N|S|E|W|NE|NW|SE|SW)\b/);
    const direction = directionMatch ? directionMatch[1] : '';
    
    // Extract street name (remove number, direction, and common suffixes)
    let streetName = address
      .replace(/^\d+\s*/, '') // Remove leading number
      .replace(/\b(N|S|E|W|NE|NW|SE|SW)\b/g, '') // Remove direction
      .replace(/\b(ST|STREET|DR|DRIVE|AVE|AVENUE|RD|ROAD|LN|LANE|BLVD|BOULEVARD|CT|COURT|PL|PLACE|WAY|CIR|CIRCLE)\b/g, '') // Remove suffixes
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    return {
      number,
      direction,
      streetName,
      original: streetAddress
    };
  }

  /**
   * Extract ASP.NET ViewState values from HTML
   * 
   * @param {string} html - HTML content from GET request
   * @returns {Object} ViewState values
   */
  extractViewState(html) {
    const viewState = html.match(/__VIEWSTATE"[^>]*value="([^"]*)"/) || ['', ''];
    const viewStateGenerator = html.match(/__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/) || ['', ''];
    const eventValidation = html.match(/__EVENTVALIDATION"[^>]*value="([^"]*)"/) || ['', ''];
    
    return {
      viewState: viewState[1] || '',
      viewStateGenerator: viewStateGenerator[1] || '',
      eventValidation: eventValidation[1] || ''
    };
  }

  /**
   * Build a Cookie request header from a response's Set-Cookie header.
   * Keeps just the `name=value` pair of each cookie (drops path/expiry/flags),
   * which is what a client echoes back. Returns '' when there are no cookies.
   *
   * @param {string[]|string|undefined} setCookie - Set-Cookie header value(s)
   * @returns {string} Cookie header string (e.g. "ASP.NET_SessionId=abc")
   */
  extractCookieHeader(setCookie) {
    if (!setCookie) return '';
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return cookies
      .map(c => String(c).split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
  }

  /**
   * Build form data for CAD search
   * 
   * @param {string} address - Street address
   * @param {string} city - City name
   * @param {string} state - State code
   * @param {string} zipCode - ZIP code
   * @param {Object} viewState - ASP.NET ViewState values
   * @returns {URLSearchParams} Form data for POST request
   */
  buildSearchFormData(address, city, state, zipCode, viewState = {}) {
    const formData = new URLSearchParams();
    
    // Parse address components for Dallas CAD SearchAddr.aspx form
    const addressParts = this.parseStreetAddress(address);
    
    // ASP.NET ViewState fields (required for form submission)
    formData.append('__VIEWSTATE', viewState.viewState || '');
    formData.append('__VIEWSTATEGENERATOR', viewState.viewStateGenerator || '');
    formData.append('__EVENTVALIDATION', viewState.eventValidation || '');
    
    // Address components based on Dallas CAD SearchAddr.aspx form structure
    // Using actual field names found in HTML: txtAddrNum, listStDir, txtStName, etc.
    formData.append('txtAddrNum', addressParts.number || '');
    formData.append('listStDir', addressParts.direction || '');
    formData.append('txtStName', addressParts.streetName || '');
    formData.append('txtBldgID', '');
    formData.append('txtUnitID', '');
    // Search across ALL cities ([ALL] = empty value in the listCity dropdown).
    // We deliberately do NOT filter by city: our tax roll files many areas
    // (e.g. Highland Park, University Park) under city = DALLAS, while DCAD
    // files them under their own city code — so a city filter produces
    // "No Records". Street number + street name is specific enough on its own.
    formData.append('listCity', '');
    formData.append('cmdSubmit', 'Search');
    
    // DEBUG: Log the exact form data being sent
    const cityValue = this.normalizeCity(city);
    console.log('🔧 FORM DATA DEBUG:');
    console.log('  txtAddrNum:', addressParts.number || '');
    console.log('  listStDir:', addressParts.direction || '');
    console.log('  txtStName:', addressParts.streetName || '');
    console.log('  listCity:', cityValue);
    console.log('  Input city value:', city);
    console.log('  Normalized city:', cityValue);
    console.log('  Address parts:', addressParts);
    
    return formData;
  }

  /**
   * Generate cache key from property data
   * 
   * @param {Object} propertyData - Property search parameters
   * @returns {string} Cache key
   */
  generateCacheKey(propertyData) {
    const normalized = this.parseAddress(propertyData.address);
    // Temporarily disable cache to debug data flow
    return `property_${normalized.address}_${normalized.city}_${normalized.zipCode}_${Date.now()}`;
  }

  /**
   * Debug HTML response structure for parser improvement
   */
  debugHTMLResponse(html, address) {
    try {
      const fs = require('fs');
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      
      // Save full HTML to file for detailed analysis
      const filename = `debug_dallas_cad_${address.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.html`;
      const filepath = `./debug_html/${filename}`;
      
      // Create directory if it doesn't exist
      if (!fs.existsSync('./debug_html')) {
        fs.mkdirSync('./debug_html', { recursive: true });
      }
      
      fs.writeFileSync(filepath, html);
      
      // Log key HTML structure information
      console.log('\n🔍 DALLAS CAD HTML STRUCTURE DEBUG:');
      console.log('📁 Full HTML saved to:', filepath);
      console.log('📏 HTML Length:', html.length);
      console.log('🏷️  Title:', $('title').text().trim());
      
      // Look for common data patterns
      console.log('\n🔍 SEARCHING FOR DATA PATTERNS:');
      
      // Check for tables
      const tables = $('table');
      console.log('📊 Tables found:', tables.length);
      tables.each((i, table) => {
        const $table = $(table);
        const headers = $table.find('th, td:first-child').map((j, cell) => $(cell).text().trim()).get();
        if (headers.length > 0) {
          console.log(`  Table ${i + 1} headers/first cells:`, headers.slice(0, 5));
        }
      });
      
      // Check for common property-related text
      const propertyKeywords = ['owner', 'value', 'assessed', 'market', 'tax', 'property', 'account'];
      propertyKeywords.forEach(keyword => {
        const matches = html.toLowerCase().includes(keyword.toLowerCase());
        if (matches) {
          // Find elements containing this keyword
          const elements = $(`*:contains("${keyword}")`).filter(function() {
            return $(this).children().length === 0; // Only leaf elements
          });
          if (elements.length > 0) {
            console.log(`  "${keyword}" found in ${elements.length} elements`);
            elements.slice(0, 3).each((j, el) => {
              console.log(`    - "${$(el).text().trim().substring(0, 100)}"`);
            });
          }
        }
      });
      
      // Check for forms (might indicate no results or error)
      const forms = $('form');
      console.log('📝 Forms found:', forms.length);
      
      // Check for error messages
      const errorPatterns = ['error', 'not found', 'no results', 'invalid'];
      errorPatterns.forEach(pattern => {
        if (html.toLowerCase().includes(pattern)) {
          console.log(`⚠️  Potential error pattern "${pattern}" found`);
        }
      });
      
      console.log('🔍 END DEBUG\n');
      
    } catch (error) {
      console.error('❌ HTML Debug Error:', error.message);
    }
  }

  /**
   * Get comprehensive scraper statistics
   * 
   * @returns {Object} Performance and usage statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    
    return {
      // Request statistics
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests,
      cachedRequests: this.stats.cachedRequests,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests) : 0,
      cacheHitRate: this.stats.totalRequests > 0 ? 
        (this.stats.cachedRequests / this.stats.totalRequests) : 0,
      
      // Component statistics
      rateLimiter: this.rateLimiter.getStats(),
      cache: this.cache.getStats(),
      parser: this.parser.getStats(),
      
      // System statistics
      uptime: uptime,
      requestsPerMinute: this.stats.totalRequests / (uptime / 60000),
      
      // Memory usage
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      cachedRequests: 0,
      failedRequests: 0,
      startTime: Date.now()
    };
    
    this.rateLimiter.reset();
    this.logger.info('Statistics reset');
  }

  /**
   * Health check method
   * 
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const stats = this.getStats();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: stats.uptime,
      successRate: stats.successRate,
      cacheHitRate: stats.cacheHitRate,
      rateLimiterDelay: stats.rateLimiter.currentDelay,
      memoryUsage: stats.memoryUsage.heapUsed
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.cache.destroy();
    this.logger.info('DallasCADScraper destroyed');
  }
}

/**
 * Custom error class for scraping errors
 */
class ScrapingError extends Error {
  constructor(message, propertyData, originalError) {
    super(message);
    this.name = 'ScrapingError';
    this.propertyData = propertyData;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

module.exports = { DallasCADScraper, ScrapingError };