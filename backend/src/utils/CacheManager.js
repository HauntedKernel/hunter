/**
 * CacheManager - Intelligent caching system for Dallas CAD data
 * 
 * Implements multi-level caching with motivation-aware TTL and smart eviction
 * policies optimized for property record analysis performance.
 */

class CacheManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 86400000; // 24 hours
    this.cache = new Map();
    this.accessTimes = new Map();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    this.cleanupInterval = null;
    
    // Start periodic cleanup
    this.startCleanupProcess(options.cleanupInterval || 300000); // 5 minutes
  }

  /**
   * Get cached data with LRU update
   * 
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  get(key) {
    const normalizedKey = this.normalizeKey(key);
    const entry = this.cache.get(normalizedKey);
    
    if (!entry) {
      this.missCount++;
      return null;
    }
    
    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(normalizedKey);
      this.accessTimes.delete(normalizedKey);
      this.missCount++;
      return null;
    }
    
    // Update access time for LRU
    this.accessTimes.set(normalizedKey, Date.now());
    this.hitCount++;
    
    return entry.data;
  }

  /**
   * Set cached data with motivation-aware TTL
   * Patent Claim: Intelligence-based cache TTL calculation
   * 
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {Object} options - Caching options
   */
  set(key, data, options = {}) {
    const normalizedKey = this.normalizeKey(key);
    const now = Date.now();
    
    // Calculate intelligent TTL based on data characteristics
    const ttl = this.calculateIntelligentTTL(data, options);
    const priority = this.calculateCachePriority(data, options);
    
    const entry = {
      data,
      createdAt: now,
      expiresAt: now + ttl,
      priority,
      accessCount: 1,
      motivationScore: data.motivationScore || 0,
      taxStatus: data.taxation?.taxStatus || 'UNKNOWN'
    };
    
    // Ensure cache doesn't exceed size limit
    this.ensureCacheSize();
    
    this.cache.set(normalizedKey, entry);
    this.accessTimes.set(normalizedKey, now);
  }

  /**
   * Calculate intelligent TTL based on property data characteristics
   * High-motivation properties get shorter cache times for frequent updates
   * 
   * @param {Object} data - Property data
   * @param {Object} options - Additional options
   * @returns {number} TTL in milliseconds
   */
  calculateIntelligentTTL(data, options = {}) {
    let baseTTL = options.ttl || this.defaultTTL;
    
    // Motivation-based TTL adjustment
    const motivationScore = data.motivationScore || 0;
    if (motivationScore > 80) {
      // High motivation = shorter cache (more frequent updates needed)
      baseTTL *= 0.25; // 6 hours instead of 24
    } else if (motivationScore > 60) {
      baseTTL *= 0.5; // 12 hours
    } else if (motivationScore < 30) {
      // Low motivation = longer cache (less frequent updates)
      baseTTL *= 2; // 48 hours
    }
    
    // Tax status urgency multiplier
    if (data.taxation?.taxStatus === 'DELINQUENT') {
      baseTTL *= 0.25; // Very short cache for tax delinquent properties
    }
    
    // Property value consideration
    if (data.valuation?.assessedValue > 1000000) {
      baseTTL *= 0.75; // High-value properties need more frequent updates
    }
    
    // Ensure minimum and maximum TTL bounds
    return Math.max(3600000, Math.min(172800000, baseTTL)); // 1 hour min, 48 hours max
  }

  /**
   * Calculate cache priority for eviction decisions
   * Higher priority entries are retained longer
   */
  calculateCachePriority(data, options = {}) {
    let priority = 50; // Base priority
    
    // Motivation score influence
    const motivationScore = data.motivationScore || 0;
    priority += motivationScore * 0.5; // Up to +50 for score of 100
    
    // Tax delinquency boost
    if (data.taxation?.taxStatus === 'DELINQUENT') {
      priority += 30;
    }
    
    // High-value property boost
    if (data.valuation?.assessedValue > 1000000) {
      priority += 20;
    }
    
    // Trust/estate ownership boost
    if (data.ownership?.ownershipType === 'TRUST' || 
        data.ownership?.ownershipType === 'ESTATE') {
      priority += 15;
    }
    
    return Math.min(100, priority);
  }

  /**
   * Ensure cache doesn't exceed size limit using intelligent eviction
   */
  ensureCacheSize() {
    if (this.cache.size >= this.maxSize) {
      const evictionCount = Math.max(1, Math.floor(this.maxSize * 0.1)); // Remove 10%
      this.evictLowPriorityEntries(evictionCount);
    }
  }

  /**
   * Evict low-priority entries based on multiple factors
   * Patent Claim: Motivation-aware cache eviction
   */
  evictLowPriorityEntries(count) {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
      lastAccess: this.accessTimes.get(key) || 0
    }));

    // Sort by eviction score (lower = evict first)
    entries.sort((a, b) => {
      const scoreA = this.calculateEvictionScore(a);
      const scoreB = this.calculateEvictionScore(b);
      return scoreA - scoreB;
    });

    // Remove lowest scoring entries
    for (let i = 0; i < count && i < entries.length; i++) {
      const key = entries[i].key;
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.evictionCount++;
    }
  }

  /**
   * Calculate eviction score (lower = more likely to evict)
   */
  calculateEvictionScore(cacheItem) {
    const { entry, lastAccess } = cacheItem;
    const now = Date.now();
    
    // Base score from cache priority
    let score = entry.priority || 50;
    
    // Recent access boost
    const timeSinceAccess = now - lastAccess;
    const hoursSinceAccess = timeSinceAccess / 3600000;
    
    if (hoursSinceAccess < 1) {
      score += 20; // Recently accessed
    } else if (hoursSinceAccess > 24) {
      score -= 20; // Long time since access
    }
    
    // Access frequency consideration
    score += (entry.accessCount || 1) * 2;
    
    // Expiration proximity penalty
    const timeToExpiry = entry.expiresAt - now;
    if (timeToExpiry < 3600000) { // Less than 1 hour
      score -= 15; // About to expire anyway
    }
    
    return score;
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(entry) {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Normalize cache keys for consistency
   */
  normalizeKey(key) {
    return key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Clear expired entries (called periodically)
   */
  clearExpired() {
    const now = Date.now();
    let clearedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        clearedCount++;
      }
    }
    
    return clearedCount;
  }

  /**
   * Start periodic cleanup process
   */
  startCleanupProcess(interval = 300000) {
    this.cleanupInterval = setInterval(() => {
      this.clearExpired();
    }, interval);
  }

  /**
   * Stop cleanup process
   */
  stopCleanupProcess() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) : 0,
      evictionCount: this.evictionCount,
      averagePriority: this.calculateAveragePriority(),
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Calculate average cache priority
   */
  calculateAveragePriority() {
    if (this.cache.size === 0) return 0;
    
    let totalPriority = 0;
    for (const entry of this.cache.values()) {
      totalPriority += entry.priority || 50;
    }
    
    return Math.round(totalPriority / this.cache.size);
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  estimateMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Rough estimate: key size + JSON string size
      totalSize += key.length * 2; // Characters as bytes
      totalSize += JSON.stringify(entry.data).length * 2;
    }
    
    return {
      bytes: totalSize,
      kilobytes: Math.round(totalSize / 1024),
      megabytes: Math.round(totalSize / (1024 * 1024))
    };
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  /**
   * Get all cached keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    const normalizedKey = this.normalizeKey(key);
    const entry = this.cache.get(normalizedKey);
    
    return entry && !this.isExpired(entry);
  }

  /**
   * Delete specific cache entry
   */
  delete(key) {
    const normalizedKey = this.normalizeKey(key);
    const deleted = this.cache.delete(normalizedKey);
    
    if (deleted) {
      this.accessTimes.delete(normalizedKey);
    }
    
    return deleted;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopCleanupProcess();
    this.clear();
  }
}

module.exports = CacheManager;