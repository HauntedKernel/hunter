/**
 * RateLimiter - Adaptive rate limiting for respectful web scraping
 * 
 * Implements intelligent delay management that adapts to server performance
 * and maintains ethical scraping practices for Dallas CAD integration.
 */

class RateLimiter {
  constructor(options = {}) {
    this.baseDelay = options.delay || 2000; // 2 second default delay
    this.currentDelay = this.baseDelay;
    this.maxDelay = options.maxDelay || 10000; // 10 second max
    this.minDelay = options.minDelay || 1000; // 1 second min
    this.adaptationHistory = [];
    this.maxHistorySize = options.maxHistorySize || 50;
    this.adaptationEnabled = options.adaptationEnabled !== false;
    this.successRate = 1.0;
    this.lastRequestTime = 0;
  }

  /**
   * Adaptive wait method - core patent-worthy algorithm
   * Automatically adjusts delays based on server performance patterns
   */
  async adaptiveWait() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Ensure minimum delay between requests
    if (timeSinceLastRequest < this.currentDelay) {
      const remainingWait = this.currentDelay - timeSinceLastRequest;
      await this.sleep(remainingWait);
    }

    // Update performance metrics if adaptation is enabled
    if (this.adaptationEnabled && this.adaptationHistory.length > 5) {
      this.updateAdaptiveDelay();
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Record request performance metrics for adaptation
   */
  recordRequestMetrics(responseTime, success, statusCode) {
    const metrics = {
      timestamp: Date.now(),
      responseTime,
      success,
      statusCode,
      delay: this.currentDelay
    };

    this.adaptationHistory.push(metrics);
    
    // Maintain history size limit
    if (this.adaptationHistory.length > this.maxHistorySize) {
      this.adaptationHistory.shift();
    }

    // Update success rate
    this.updateSuccessRate();
  }

  /**
   * Update adaptive delay based on recent performance patterns
   * Patent Claim: Performance-based delay optimization
   */
  updateAdaptiveDelay() {
    const recentMetrics = this.getRecentMetrics(10);
    const avgResponseTime = this.calculateAverageResponseTime(recentMetrics);
    const errorRate = this.calculateErrorRate(recentMetrics);
    const serverLoadIndicator = this.detectServerLoadPattern(recentMetrics);

    // Calculate optimal delay using proprietary algorithm
    let optimalDelay = this.calculateOptimalDelay(avgResponseTime, errorRate, serverLoadIndicator);
    
    // Apply adaptive adjustments
    if (errorRate > 0.1) {
      // High error rate - increase delay
      optimalDelay *= 1.5;
    } else if (errorRate === 0 && avgResponseTime < 1000) {
      // Perfect performance - slightly decrease delay
      optimalDelay *= 0.9;
    }

    // Ensure delay stays within bounds
    this.currentDelay = Math.max(this.minDelay, Math.min(this.maxDelay, optimalDelay));
  }

  /**
   * Calculate optimal delay based on performance indicators
   */
  calculateOptimalDelay(avgResponseTime, errorRate, serverLoadIndicator) {
    // Base delay calculation considering response time
    let baseDelay = this.baseDelay;
    
    // Adjust based on average response time
    if (avgResponseTime > 3000) {
      baseDelay *= 1.3; // Slow server - increase delay
    } else if (avgResponseTime < 500) {
      baseDelay *= 0.8; // Fast server - can be more aggressive
    }

    // Server load pattern adjustments
    const loadMultiplier = this.getLoadMultiplier(serverLoadIndicator);
    baseDelay *= loadMultiplier;

    return Math.round(baseDelay);
  }

  /**
   * Detect server load patterns from response times
   * Novel algorithm for inferring server capacity
   */
  detectServerLoadPattern(metrics) {
    if (metrics.length < 5) return 'unknown';

    const responseTimes = metrics.map(m => m.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const variance = this.calculateVariance(responseTimes, avgResponseTime);

    // Pattern detection logic
    if (variance > 1000000) { // High variance
      return 'unstable';
    } else if (avgResponseTime > 3000) {
      return 'high-load';
    } else if (avgResponseTime < 500) {
      return 'low-load';
    } else {
      return 'normal';
    }
  }

  /**
   * Get load multiplier based on detected server pattern
   */
  getLoadMultiplier(loadPattern) {
    const multipliers = {
      'high-load': 1.8,
      'unstable': 2.0,
      'normal': 1.0,
      'low-load': 0.7,
      'unknown': 1.0
    };
    return multipliers[loadPattern] || 1.0;
  }

  /**
   * Get recent metrics for analysis
   */
  getRecentMetrics(count) {
    return this.adaptationHistory.slice(-count);
  }

  /**
   * Calculate average response time from metrics
   */
  calculateAverageResponseTime(metrics) {
    if (metrics.length === 0) return 1000; // Default 1 second
    
    const totalTime = metrics.reduce((sum, metric) => sum + metric.responseTime, 0);
    return totalTime / metrics.length;
  }

  /**
   * Calculate error rate from recent requests
   */
  calculateErrorRate(metrics) {
    if (metrics.length === 0) return 0;
    
    const errors = metrics.filter(metric => !metric.success).length;
    return errors / metrics.length;
  }

  /**
   * Calculate statistical variance
   */
  calculateVariance(values, mean) {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    return squaredDifferences.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Update overall success rate
   */
  updateSuccessRate() {
    if (this.adaptationHistory.length === 0) return;

    const recentMetrics = this.getRecentMetrics(20);
    const successes = recentMetrics.filter(metric => metric.success).length;
    this.successRate = successes / recentMetrics.length;
  }

  /**
   * Sleep utility function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current performance statistics
   */
  getStats() {
    return {
      currentDelay: this.currentDelay,
      baseDelay: this.baseDelay,
      successRate: this.successRate,
      totalRequests: this.adaptationHistory.length,
      avgResponseTime: this.calculateAverageResponseTime(this.adaptationHistory),
      errorRate: this.calculateErrorRate(this.adaptationHistory)
    };
  }

  /**
   * Reset rate limiter to initial state
   */
  reset() {
    this.currentDelay = this.baseDelay;
    this.adaptationHistory = [];
    this.successRate = 1.0;
    this.lastRequestTime = 0;
  }
}

module.exports = RateLimiter;