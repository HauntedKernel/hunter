/**
 * FlashStack Share Session Service
 * Manages secure shareable web links for property reports
 */

// Using crypto.randomUUID() instead of uuid package for better compatibility
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export class ShareSessionService {
  constructor() {
    // In a real app, this would connect to your backend API
    this.baseUrl = window.location.origin
    this.apiUrl = '/api/share' // Backend API endpoint
  }

  /**
   * Generate a secure shareable link for a property report
   * @param {Object} reportData - The complete report data to share
   * @param {Object} options - Sharing options (expiration, password, etc.)
   * @returns {Promise<Object>} Share session data with URL
   */
  async createShareSession(reportData, options = {}) {
    try {
      // Generate unique share ID
      const shareId = this.generateShareId()
      
      // Prepare session data
      const sessionData = {
        shareId,
        reportData,
        createdAt: new Date().toISOString(),
        expiresAt: this.calculateExpiration(options.expirationDays || 30),
        accessCount: 0,
        maxAccess: options.maxAccess || null,
        password: options.password || null,
        createdBy: reportData.agentName || 'FlashStack User',
        reportType: reportData.reportType || 'discovery',
        metadata: {
          propertyAddress: reportData.subjectProperty?.address || reportData.targetProperty?.address,
          customerName: reportData.customerName,
          agentInfo: {
            name: reportData.agentName,
            company: reportData.agentCompany,
            email: reportData.agentEmail,
            phone: reportData.agentPhone
          }
        }
      }

      // For demo purposes, store in localStorage
      // In production, this would be sent to your backend
      await this.storeSession(sessionData)

      // Generate shareable URL
      const shareUrl = `${this.baseUrl}/share/${shareId}`

      return {
        success: true,
        shareId,
        shareUrl,
        expiresAt: sessionData.expiresAt,
        qrCode: await this.generateQRCode(shareUrl),
        shortUrl: await this.generateShortUrl(shareUrl)
      }

    } catch (error) {
      console.error('Failed to create share session:', error)
      return {
        success: false,
        error: 'Failed to create shareable link'
      }
    }
  }

  /**
   * Retrieve shared report data by share ID
   * @param {string} shareId - The share session ID
   * @param {string} password - Optional password for protected links
   * @returns {Promise<Object>} Report data or error
   */
  async getSharedReport(shareId, password = null) {
    try {
      const session = await this.getSession(shareId)
      
      if (!session) {
        return {
          success: false,
          error: 'Share link not found or expired'
        }
      }

      // Check expiration
      if (new Date() > new Date(session.expiresAt)) {
        return {
          success: false,
          error: 'Share link has expired'
        }
      }

      // Check access limits
      if (session.maxAccess && session.accessCount >= session.maxAccess) {
        return {
          success: false,
          error: 'Share link access limit reached'
        }
      }

      // Check password
      if (session.password && session.password !== password) {
        return {
          success: false,
          error: 'Incorrect password'
        }
      }

      // Update access count
      await this.incrementAccessCount(shareId)

      return {
        success: true,
        reportData: session.reportData,
        metadata: session.metadata,
        accessCount: session.accessCount + 1
      }

    } catch (error) {
      console.error('Failed to retrieve shared report:', error)
      return {
        success: false,
        error: 'Failed to load shared report'
      }
    }
  }

  /**
   * Delete a share session
   * @param {string} shareId - The share session ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteShareSession(shareId) {
    try {
      localStorage.removeItem(`flashstack_share_${shareId}`)
      return true
    } catch (error) {
      console.error('Failed to delete share session:', error)
      return false
    }
  }

  /**
   * List all share sessions for current user
   * @returns {Promise<Array>} List of share sessions
   */
  async getUserShareSessions() {
    try {
      const sessions = []
      const keys = Object.keys(localStorage)
      
      for (const key of keys) {
        if (key.startsWith('flashstack_share_')) {
          const sessionData = JSON.parse(localStorage.getItem(key))
          sessions.push({
            shareId: sessionData.shareId,
            createdAt: sessionData.createdAt,
            expiresAt: sessionData.expiresAt,
            accessCount: sessionData.accessCount,
            reportType: sessionData.reportType,
            propertyAddress: sessionData.metadata.propertyAddress,
            customerName: sessionData.metadata.customerName
          })
        }
      }

      return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } catch (error) {
      console.error('Failed to get user share sessions:', error)
      return []
    }
  }

  // PRIVATE METHODS

  /**
   * Generate a secure share ID
   * @returns {string} Unique share ID
   */
  generateShareId() {
    const uuid = generateUUID().replace(/-/g, '')
    const timestamp = Date.now().toString(36)
    return `fs_${timestamp}_${uuid.substring(0, 8)}`
  }

  /**
   * Calculate expiration date
   * @param {number} days - Number of days until expiration
   * @returns {string} ISO date string
   */
  calculateExpiration(days) {
    const expiration = new Date()
    expiration.setDate(expiration.getDate() + days)
    return expiration.toISOString()
  }

  /**
   * Store session data
   * @param {Object} sessionData - Session data to store
   * @returns {Promise<void>}
   */
  async storeSession(sessionData) {
    // In demo, use localStorage
    // In production, send to backend API
    localStorage.setItem(
      `flashstack_share_${sessionData.shareId}`, 
      JSON.stringify(sessionData)
    )
  }

  /**
   * Retrieve session data
   * @param {string} shareId - Share session ID
   * @returns {Promise<Object|null>} Session data or null
   */
  async getSession(shareId) {
    try {
      const sessionData = localStorage.getItem(`flashstack_share_${shareId}`)
      return sessionData ? JSON.parse(sessionData) : null
    } catch (error) {
      console.error('Failed to get session:', error)
      return null
    }
  }

  /**
   * Increment access count for a session
   * @param {string} shareId - Share session ID
   * @returns {Promise<void>}
   */
  async incrementAccessCount(shareId) {
    try {
      const session = await this.getSession(shareId)
      if (session) {
        session.accessCount = (session.accessCount || 0) + 1
        await this.storeSession(session)
      }
    } catch (error) {
      console.error('Failed to increment access count:', error)
    }
  }

  /**
   * Generate QR code for share URL (placeholder)
   * @param {string} url - URL to encode
   * @returns {Promise<string>} QR code data URL
   */
  async generateQRCode(url) {
    // In production, you'd use a QR code library like qrcode
    // For demo, return a placeholder
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-family="Arial" font-size="8" fill="%23666">QR Code</text></svg>`
  }

  /**
   * Generate short URL (placeholder)
   * @param {string} url - URL to shorten
   * @returns {Promise<string>} Shortened URL
   */
  async generateShortUrl(url) {
    // In production, you'd use a URL shortening service
    // For demo, return a mock short URL
    const shareId = url.split('/').pop()
    return `${this.baseUrl}/s/${shareId.substring(0, 8)}`
  }
}

// Utility functions for building report data
export const buildShareableReportData = (mode, properties, subjectProperty, additionalData = {}) => {
  const baseData = {
    reportType: mode,
    date: new Date().toLocaleDateString(),
    customerName: additionalData.customerName || 'John & Jane Smith',
    agentName: additionalData.agentName || 'Sarah Johnson',
    agentCompany: additionalData.agentCompany || 'Premier Realty',
    agentEmail: additionalData.agentEmail || 'sarah@premierrealty.com',
    agentPhone: additionalData.agentPhone || '(214) 555-0123',
    selectedProperties: properties || [],
    subjectProperty: subjectProperty || null,
    timestamp: new Date().toISOString()
  }

  // Add mode-specific data
  switch (mode) {
    case 'discovery':
      return {
        ...baseData,
        discoveryResults: {
          totalFound: properties?.length || 0,
          averageMatch: properties?.length ? 
            Math.round(properties.reduce((acc, p) => acc + (p.match || 85), 0) / properties.length) : 0,
          priceRange: properties?.length ? {
            min: Math.min(...properties.map(p => p.price || 0)),
            max: Math.max(...properties.map(p => p.price || 0))
          } : null
        }
      }
    
    case 'cma':
      return {
        ...baseData,
        targetProperty: subjectProperty,
        comparables: additionalData.comparables || properties,
        priceRecommendation: additionalData.priceRecommendation || {
          low: 465000,
          recommended: 485000,
          high: 505000
        },
        marketStats: additionalData.marketStats || {
          avgDaysOnMarket: 23,
          saleToListRatio: 98.2,
          pricePerSqFt: 205
        },
        negotiationIntelligence: additionalData.negotiationIntelligence || {
          neighborhoodStats: {
            avgDaysOnMarket: 18,
            medianPrice: 485000,
            priceGrowth: 3.2,
            marketPace: 'Fast'
          },
          sellerMotivation: {
            score: 88,
            factors: [
              { icon: '🏠', text: 'Already purchased replacement home' },
              { icon: '📅', text: 'Carrying two mortgages for 45 days' },
              { icon: '💰', text: 'Motivated to close quickly' },
              { icon: '🔧', text: 'Disclosed roof issues suggest transparency' }
            ]
          },
          issues: [],
          totalOpportunity: 0
        }
      }
    
    case 'rental':
      return {
        ...baseData,
        targetProperty: subjectProperty,
        rentalEstimate: additionalData.rentalEstimate || {
          monthly: 2800,
          annual: 33600
        },
        investmentMetrics: additionalData.investmentMetrics || {
          capRate: 6.2,
          cashOnCash: 8.2,
          paybackPeriod: 12
        }
      }
    
    default:
      return baseData
  }
}

// Create singleton instance
export const shareSessionService = new ShareSessionService()
export default shareSessionService