import { useState, useEffect } from 'react'
import { customerService } from '../../services/CustomerService'

const CustomerProfileScreen = ({ customer, onNavigate, onBack }) => {
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (customer) {
      loadCustomerSessions()
    }
  }, [customer])

  const loadCustomerSessions = async () => {
    try {
      const customerSessions = customerService.getCustomerSessions(customer.id)
      setSessions(customerSessions)
    } catch (error) {
      console.error('Failed to load customer sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }


  const goBack = () => {
    if (onBack) {
      onBack()
    }
  }

  if (!customer) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        fontSize: '16px',
        color: '#64748b'
      }}>
        Customer not found
      </div>
    )
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
      {/* Back Button */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderBottom: '1px solid rgba(226,232,240,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(248,250,252,0.8)',
            padding: '8px 16px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={goBack}
          onMouseEnter={(e) => {
            e.target.style.background = '#e2e8f0'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(248,250,252,0.8)'
          }}
        >
          <span style={{ fontSize: '18px' }}>←</span>
          Back to Customers
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px 20px 20px'
      }}>
        {/* Customer Info Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          {/* Customer Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '700',
              fontSize: '24px'
            }}>
              {getInitials(customer.name)}
            </div>
            <div>
              <h2 style={{
                margin: '0 0 4px 0',
                fontSize: '24px',
                fontWeight: '700',
                color: '#1e293b'
              }}>
                {customer.name}
              </h2>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#64748b'
              }}>
                Customer since {customerService.formatDate(customer.created_at)}
              </p>
            </div>
          </div>

          {/* Customer Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {customer.email && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#64748b'
                }}>Email:</span>
                <span style={{
                  fontSize: '14px',
                  color: '#1e293b',
                  fontWeight: '500'
                }}>
                  {customer.email}
                </span>
              </div>
            )}
            
            {customer.phone && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#64748b'
                }}>Phone:</span>
                <span style={{
                  fontSize: '14px',
                  color: '#1e293b',
                  fontWeight: '500'
                }}>
                  {customer.phone}
                </span>
              </div>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0'
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#64748b'
              }}>Total Sessions:</span>
              <span style={{
                fontSize: '16px',
                color: '#3b82f6',
                fontWeight: '700'
              }}>
                {sessions.length}
              </span>
            </div>
          </div>
        </div>

        {/* Sessions Section */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <h3 style={{
            margin: '0 0 20px 0',
            fontSize: '20px',
            fontWeight: '700',
            color: '#1e293b'
          }}>
            Previous Sessions
          </h3>

          {isLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#64748b'
            }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              background: '#f8fafc',
              borderRadius: '12px'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>📄</div>
              <h4 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '8px'
              }}>
                No sessions yet
              </h4>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                lineHeight: '1.5'
              }}>
                Sessions will appear here when you save Discovery reports or CMA analyses for {customer.name}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {sessions.map(session => (
                <SessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const SessionCard = ({ session }) => {
  const viewSession = () => {
    window.open(session.share_url, '_blank')
  }

  const shareSession = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: session.title,
          text: `Check out this ${session.session_type} report`,
          url: session.share_url
        })
      } catch (error) {
        console.error('Share failed:', error)
        copyLink()
      }
    } else {
      copyLink()
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(session.share_url)
      alert('Link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy link:', error)
      alert('Failed to copy link')
    }
  }

  const downloadSession = () => {
    // Create a downloadable link - in a real app this might generate a PDF
    const link = document.createElement('a')
    link.href = session.share_url
    link.download = `${session.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getSessionTypeColor = (type) => {
    const colors = {
      discovery: '#3b82f6',
      cma: '#10b981',
      sales: '#f59e0b',
      rental: '#8b5cf6'
    }
    return colors[type] || '#64748b'
  }

  const getSessionHighlights = (type, propertyCount) => {
    const highlights = {
      discovery: [
        `${propertyCount} properties analyzed`,
        'Lifestyle matching included',
        'Market comparisons provided'
      ],
      cma: [
        `${propertyCount} comparables analyzed`,
        'Price recommendations included',
        'Negotiation intelligence provided'
      ],
      sales: [
        `${propertyCount} properties evaluated`,
        'Sales strategy included',
        'Market timing analysis'
      ],
      rental: [
        `${propertyCount} rental comparisons`,
        'Rental yield analysis',
        'Market trends included'
      ]
    }
    return highlights[type] || [`${propertyCount} properties`, 'Analysis included', 'Report generated']
  }

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      transition: 'all 0.3s ease'
    }}>
      {/* Session Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        marginBottom: '16px'
      }}>
        {/* Session Icon */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: getSessionTypeColor(session.session_type),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          color: 'white',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {customerService.getSessionIcon(session.session_type)}
        </div>

        {/* Session Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            margin: '0 0 6px 0',
            fontSize: '18px',
            fontWeight: '700',
            color: '#1e293b',
            lineHeight: '1.3'
          }}>
            {session.title}
          </h4>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <span style={{
              background: getSessionTypeColor(session.session_type),
              color: 'white',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {session.session_type}
            </span>
            <span style={{
              fontSize: '13px',
              color: '#64748b',
              fontWeight: '500'
            }}>
              {customerService.formatDate(session.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Session Highlights */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <h5 style={{
          margin: '0 0 12px 0',
          fontSize: '14px',
          fontWeight: '600',
          color: '#374151'
        }}>
          Session Highlights
        </h5>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {getSessionHighlights(session.session_type, session.property_count).map((highlight, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: '#64748b'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: getSessionTypeColor(session.session_type),
                flexShrink: 0
              }}></div>
              {highlight}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px'
      }}>
        <button 
          onClick={viewSession}
          style={{
            padding: '12px 8px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-1px)'
            e.target.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = 'none'
          }}
        >
          👁️ View
        </button>
        
        <button 
          onClick={shareSession}
          style={{
            padding: '12px 8px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-1px)'
            e.target.style.boxShadow = '0 4px 12px rgba(16,185,129,0.3)'
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = 'none'
          }}
        >
          📤 Share
        </button>
        
        <button 
          onClick={downloadSession}
          style={{
            padding: '12px 8px',
            background: 'white',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = '#f9fafb'
            e.target.style.borderColor = '#9ca3af'
            e.target.style.color = '#374151'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'white'
            e.target.style.borderColor = '#d1d5db'
            e.target.style.color = '#6b7280'
          }}
        >
          📥 Download
        </button>
      </div>
    </div>
  )
}

export default CustomerProfileScreen