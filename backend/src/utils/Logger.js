/**
 * Logger - Centralized logging system for Dallas CAD Integration
 * 
 * Provides structured logging with different levels, audit trails,
 * and performance monitoring for the scraping system.
 */

const moment = require('moment');

class Logger {
  constructor(component = 'System', options = {}) {
    this.component = component;
    this.logLevel = options.logLevel || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.auditMode = options.auditMode || false;
    this.logBuffer = [];
    this.maxBufferSize = options.maxBufferSize || 1000;
    
    // Log levels with numeric values for filtering
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.currentLogLevel = this.levels[this.logLevel] || this.levels.info;
  }

  /**
   * Log error messages
   */
  error(message, data = {}) {
    this.log('error', message, data);
  }

  /**
   * Log warning messages
   */
  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  /**
   * Log info messages
   */
  info(message, data = {}) {
    this.log('info', message, data);
  }

  /**
   * Log debug messages
   */
  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  /**
   * Log trace messages (most verbose)
   */
  trace(message, data = {}) {
    this.log('trace', message, data);
  }

  /**
   * Core logging method
   */
  log(level, message, data = {}) {
    const levelValue = this.levels[level] || this.levels.info;
    
    // Skip if log level is below threshold
    if (levelValue > this.currentLogLevel) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, data);
    
    // Add to buffer
    this.addToBuffer(logEntry);
    
    // Output to console if enabled
    if (this.enableConsole) {
      this.outputToConsole(logEntry);
    }
    
    // TODO: File logging implementation
    if (this.enableFile) {
      this.outputToFile(logEntry);
    }
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, data) {
    const entry = {
      timestamp: moment().toISOString(),
      level: level.toUpperCase(),
      component: this.component,
      message,
      data: this.sanitizeData(data),
      pid: process.pid,
      hostname: this.getHostname()
    };

    // Add correlation ID if available
    if (data.correlationId) {
      entry.correlationId = data.correlationId;
    }

    // Add request context if available
    if (data.requestContext) {
      entry.requestContext = data.requestContext;
    }

    return entry;
  }

  /**
   * Sanitize sensitive data before logging
   */
  sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'apiKey', 'token', 'secret', 'ssn'];
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Add log entry to buffer
   */
  addToBuffer(logEntry) {
    this.logBuffer.push(logEntry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  /**
   * Output log entry to console with formatting
   */
  outputToConsole(logEntry) {
    const timestamp = moment(logEntry.timestamp).format('YYYY-MM-DD HH:mm:ss.SSS');
    const level = logEntry.level.padEnd(5);
    const component = logEntry.component.padEnd(15);
    
    let output = `[${timestamp}] ${level} ${component} ${logEntry.message}`;
    
    // Add data if present and not empty
    if (logEntry.data && Object.keys(logEntry.data).length > 0) {
      output += ` | ${JSON.stringify(logEntry.data)}`;
    }

    // Color coding for console output
    switch (logEntry.level) {
      case 'ERROR':
        console.error('\x1b[31m' + output + '\x1b[0m'); // Red
        break;
      case 'WARN':
        console.warn('\x1b[33m' + output + '\x1b[0m'); // Yellow
        break;
      case 'INFO':
        console.info('\x1b[36m' + output + '\x1b[0m'); // Cyan
        break;
      case 'DEBUG':
        console.log('\x1b[90m' + output + '\x1b[0m'); // Gray
        break;
      case 'TRACE':
        console.log('\x1b[90m' + output + '\x1b[0m'); // Gray
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Output to file (placeholder for file logging implementation)
   */
  outputToFile(logEntry) {
    // TODO: Implement file logging with rotation
  }

  /**
   * Log scraping activity for audit purposes
   */
  logScrapingActivity(activity) {
    const auditData = {
      activity: 'scraping',
      url: this.sanitizeUrl(activity.url),
      success: activity.success,
      responseTime: activity.responseTime,
      statusCode: activity.statusCode,
      propertyAddress: activity.propertyAddress,
      cacheHit: activity.cacheHit || false,
      timestamp: new Date().toISOString()
    };

    if (activity.error) {
      auditData.error = activity.error.message;
      this.error('Scraping failed', auditData);
    } else {
      this.info('Scraping completed', auditData);
    }
  }

  /**
   * Log motivation scoring activity
   */
  logMotivationScoring(property, score, factors) {
    const scoringData = {
      activity: 'motivation_scoring',
      propertyAddress: property.address,
      motivationScore: score,
      factors: factors.map(f => `${f.type}: ${f.points}pts`),
      timestamp: new Date().toISOString()
    };

    this.info('Property motivation scored', scoringData);
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, metrics) {
    const performanceData = {
      activity: 'performance',
      operation,
      duration: metrics.duration,
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: new Date().toISOString()
    };

    if (metrics.duration > 5000) { // Log slow operations
      this.warn(`Slow operation detected: ${operation}`, performanceData);
    } else {
      this.debug(`Performance: ${operation}`, performanceData);
    }
  }

  /**
   * Log cache activity
   */
  logCacheActivity(action, key, hit = null) {
    const cacheData = {
      activity: 'cache',
      action, // 'get', 'set', 'evict', etc.
      key: this.sanitizeKey(key),
      hit,
      timestamp: new Date().toISOString()
    };

    this.debug(`Cache ${action}`, cacheData);
  }

  /**
   * Log rate limiting activity
   */
  logRateLimit(delay, reason) {
    const rateLimitData = {
      activity: 'rate_limit',
      delay,
      reason,
      timestamp: new Date().toISOString()
    };

    this.debug(`Rate limit applied: ${delay}ms`, rateLimitData);
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(count = 50, level = null) {
    let logs = [...this.logBuffer];
    
    if (level) {
      const levelValue = this.levels[level.toLowerCase()];
      logs = logs.filter(log => this.levels[log.level.toLowerCase()] <= levelValue);
    }
    
    return logs.slice(-count);
  }

  /**
   * Get error logs from buffer
   */
  getErrors(count = 20) {
    return this.logBuffer
      .filter(log => log.level === 'ERROR')
      .slice(-count);
  }

  /**
   * Get audit trail for specific property
   */
  getPropertyAuditTrail(propertyAddress) {
    return this.logBuffer.filter(log => 
      log.data.propertyAddress === propertyAddress ||
      log.message.includes(propertyAddress)
    );
  }

  /**
   * Clear log buffer
   */
  clearBuffer() {
    this.logBuffer = [];
  }

  /**
   * Get logging statistics
   */
  getStats() {
    const levelCounts = {};
    
    for (const level of Object.keys(this.levels)) {
      levelCounts[level] = this.logBuffer.filter(log => 
        log.level === level.toUpperCase()
      ).length;
    }

    return {
      totalLogs: this.logBuffer.length,
      levelCounts,
      bufferSize: this.maxBufferSize,
      currentLogLevel: this.logLevel,
      component: this.component
    };
  }

  /**
   * Change log level at runtime
   */
  setLogLevel(level) {
    if (this.levels[level] !== undefined) {
      this.logLevel = level;
      this.currentLogLevel = this.levels[level];
      this.info(`Log level changed to: ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}`);
    }
  }

  /**
   * Utility methods
   */
  sanitizeUrl(url) {
    if (!url) return url;
    // Remove sensitive query parameters
    return url.replace(/([?&])(api_key|token|password)=[^&]*/gi, '$1$2=[REDACTED]');
  }

  sanitizeKey(key) {
    if (!key) return key;
    // Truncate very long keys
    return key.length > 100 ? key.substring(0, 100) + '...' : key;
  }

  getHostname() {
    try {
      return require('os').hostname();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Create performance timer
   */
  createTimer(operation) {
    const startTime = Date.now();
    const logger = this;
    
    return {
      end: (additionalData = {}) => {
        const duration = Date.now() - startTime;
        logger.logPerformance(operation, { duration, ...additionalData });
        return duration;
      }
    };
  }

  /**
   * Create child logger with additional context
   */
  createChild(component, additionalContext = {}) {
    const childLogger = new Logger(`${this.component}:${component}`, {
      logLevel: this.logLevel,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      auditMode: this.auditMode
    });

    // Share buffer with parent for centralized logging
    childLogger.logBuffer = this.logBuffer;
    
    return childLogger;
  }
}

module.exports = Logger;