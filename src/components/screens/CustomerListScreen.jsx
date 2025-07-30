import { useState, useEffect } from 'react'
import { customerService } from '../../services/CustomerService'

const CustomerListScreen = ({ onNavigate, onSelectCustomer }) => {
  const [customers, setCustomers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomers()
  }, [searchTerm])

  const loadCustomers = () => {
    try {
      // Create sample data on first load if none exists
      const existingCustomers = customerService.getAgentCustomers()
      if (existingCustomers.length === 0) {
        customerService.createSampleData()
      }
      
      const customerList = customerService.getAgentCustomers(searchTerm)
      setCustomers(customerList)
    } catch (error) {
      console.error('Failed to load customers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openCustomerProfile = (customer) => {
    if (onSelectCustomer) {
      onSelectCustomer(customer)
    }
  }

  const createNewCustomer = () => {
    // For now, navigate to address input to create a session which will create a customer
    onNavigate('address')
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        fontSize: '16px',
        color: '#64748b'
      }}>
        Loading customers...
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>

      {/* Search and Actions */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderBottom: '1px solid rgba(226,232,240,0.5)'
      }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <input 
            type="text" 
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '500',
              background: 'rgba(255,255,255,0.9)',
              outline: 'none',
              transition: 'border-color 0.3s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
          <div 
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '700',
              color: 'white',
              cursor: 'pointer',
              flexShrink: 0
            }}
            onClick={createNewCustomer}
          >+</div>
        </div>
      </div>

      {/* Customer List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px 20px 20px'
      }}>
        {customers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>👥</div>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '8px'
            }}>
              {searchTerm ? 'No customers found' : 'No customers yet'}
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              marginBottom: '24px'
            }}>
              {searchTerm 
                ? 'Try adjusting your search term'
                : 'Create your first session to add customers'
              }
            </p>
            {!searchTerm && (
              <button 
                onClick={createNewCustomer}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Create First Session
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {customers.map(customer => (
              <CustomerCard 
                key={customer.id} 
                customer={customer}
                onClick={() => openCustomerProfile(customer)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const CustomerCard = ({ customer, onClick }) => {
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        border: '1px solid transparent'
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.target.style.transform = 'translateY(-2px)'
        e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'
        e.target.style.borderColor = '#3b82f6'
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = 'translateY(0)'
        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
        e.target.style.borderColor = 'transparent'
      }}
    >
      {/* Customer Avatar */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: '700',
        fontSize: '16px',
        flexShrink: 0
      }}>
        {getInitials(customer.name)}
      </div>

      {/* Customer Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{
          margin: '0 0 4px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1e293b',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {customer.name}
        </h3>
        {customer.email && (
          <p style={{
            margin: '0 0 2px 0',
            fontSize: '13px',
            color: '#64748b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {customer.email}
          </p>
        )}
        <p style={{
          margin: 0,
          fontSize: '12px',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>📊 {customer.session_count} session{customer.session_count !== 1 ? 's' : ''}</span>
          {customer.created_at && (
            <span>• Created {customerService.formatDate(customer.created_at)}</span>
          )}
        </p>
      </div>

      {/* Arrow */}
      <div style={{
        fontSize: '18px',
        color: '#94a3b8',
        flexShrink: 0
      }}>
        →
      </div>
    </div>
  )
}

export default CustomerListScreen