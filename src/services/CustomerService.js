// Simple Customer Profile Service for FlashStack
// Uses localStorage for demo purposes - would use real database in production

class CustomerService {
  constructor() {
    this.customersKey = 'flashstack_customers'
    this.sessionsKey = 'flashstack_customer_sessions'
  }

  // Generate simple UUID for demo
  generateId() {
    return 'customer_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
  }

  // Get all customers for current agent
  getAgentCustomers(searchTerm = '') {
    const customers = this.getAllCustomers()
    const sessions = this.getAllSessions()
    
    // Add session count to each customer
    const customersWithSessionCount = customers.map(customer => ({
      ...customer,
      session_count: sessions.filter(session => session.customer_id === customer.id).length
    }))
    
    // Filter by search term if provided
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return customersWithSessionCount.filter(customer => 
        customer.name.toLowerCase().includes(term) || 
        (customer.email && customer.email.toLowerCase().includes(term))
      )
    }
    
    return customersWithSessionCount.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Create or find customer
  createCustomer(customerData) {
    const customers = this.getAllCustomers()
    
    // Check if customer exists by email
    if (customerData.email) {
      const existing = customers.find(c => 
        c.email && c.email.toLowerCase() === customerData.email.toLowerCase()
      )
      if (existing) {
        return existing.id
      }
    }
    
    // Create new customer
    const newCustomer = {
      id: this.generateId(),
      name: customerData.name || 'Unknown Customer',
      email: customerData.email || '',
      phone: customerData.phone || '',
      created_at: new Date().toISOString(),
      notes: customerData.notes || ''
    }
    
    customers.push(newCustomer)
    localStorage.setItem(this.customersKey, JSON.stringify(customers))
    
    return newCustomer.id
  }

  // Get customer by ID
  getCustomer(customerId) {
    const customers = this.getAllCustomers()
    return customers.find(c => c.id === customerId)
  }

  // Update customer
  updateCustomer(customerId, updates) {
    const customers = this.getAllCustomers()
    const index = customers.findIndex(c => c.id === customerId)
    
    if (index !== -1) {
      customers[index] = { ...customers[index], ...updates }
      localStorage.setItem(this.customersKey, JSON.stringify(customers))
      return customers[index]
    }
    
    return null
  }

  // Get customer sessions
  getCustomerSessions(customerId) {
    const sessions = this.getAllSessions()
    return sessions
      .filter(session => session.customer_id === customerId && session.status === 'active')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  // Save a new session
  saveSession(customerId, sessionData) {
    const sessions = this.getAllSessions()
    
    const newSession = {
      id: this.generateId(),
      customer_id: customerId,
      session_type: sessionData.sessionType || 'discovery',
      title: sessionData.title || `Session - ${new Date().toLocaleDateString()}`,
      share_url: sessionData.shareUrl || '',
      property_count: sessionData.propertyCount || 0,
      created_at: new Date().toISOString(),
      status: 'active'
    }
    
    sessions.push(newSession)
    localStorage.setItem(this.sessionsKey, JSON.stringify(sessions))
    
    return newSession
  }

  // Archive a session
  archiveSession(sessionId) {
    const sessions = this.getAllSessions()
    const index = sessions.findIndex(s => s.id === sessionId)
    
    if (index !== -1) {
      sessions[index].status = 'archived'
      localStorage.setItem(this.sessionsKey, JSON.stringify(sessions))
      return sessions[index]
    }
    
    return null
  }

  // Private methods
  getAllCustomers() {
    const stored = localStorage.getItem(this.customersKey)
    return stored ? JSON.parse(stored) : []
  }

  getAllSessions() {
    const stored = localStorage.getItem(this.sessionsKey)
    return stored ? JSON.parse(stored) : []
  }

  // Utility methods
  generateSessionTitle(sessionType, propertyAddress = '') {
    const date = new Date().toLocaleDateString()
    const titles = {
      discovery: `Discovery Report - ${date}`,
      cma: `CMA Analysis - ${date}`,
      sales: `Sales Report - ${date}`,
      rental: `Rental Analysis - ${date}`
    }
    
    let title = titles[sessionType] || `Session - ${date}`
    if (propertyAddress) {
      title += ` (${propertyAddress})`
    }
    
    return title
  }

  getSessionIcon(sessionType) {
    const icons = {
      discovery: '🏠',
      cma: '📊',
      sales: '💰',
      rental: '🏡'
    }
    return icons[sessionType] || '📄'
  }

  formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now - date)
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Create sample data for demo
  createSampleData() {
    // Create sample customers
    const sampleCustomers = [
      {
        id: 'customer_sample_001',
        name: 'John & Jane Smith',
        email: 'john.smith@email.com',
        phone: '(214) 555-0123',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'First time buyers, looking in Dallas area'
      },
      {
        id: 'customer_sample_002', 
        name: 'Michael & Sarah Johnson',
        email: 'mjohnson@email.com',
        phone: '(214) 555-0456',
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Investment property buyers'
      },
      {
        id: 'customer_sample_003',
        name: 'Williams Estate',
        email: 'contact@williamsestate.com', 
        phone: '(214) 555-0789',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Luxury property portfolio'
      }
    ]

    // Create sample sessions
    const sampleSessions = [
      {
        id: 'session_sample_001',
        customer_id: 'customer_sample_001',
        session_type: 'discovery',
        title: 'Discovery Report - Highland Park Area',
        share_url: window.location.origin + '/share/sample_discovery_001',
        property_count: 6,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      },
      {
        id: 'session_sample_002',
        customer_id: 'customer_sample_001', 
        session_type: 'cma',
        title: 'CMA Analysis - 456 Oak Avenue',
        share_url: window.location.origin + '/share/sample_cma_001',
        property_count: 3,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      },
      {
        id: 'session_sample_003',
        customer_id: 'customer_sample_002',
        session_type: 'rental',
        title: 'Rental Analysis - Investment Properties',
        share_url: window.location.origin + '/share/sample_rental_001', 
        property_count: 8,
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active'
      }
    ]

    localStorage.setItem(this.customersKey, JSON.stringify(sampleCustomers))
    localStorage.setItem(this.sessionsKey, JSON.stringify(sampleSessions))
  }
}

export const customerService = new CustomerService()
export default CustomerService