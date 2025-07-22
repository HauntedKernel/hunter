const HomeScreen = ({ onNavigate }) => {
  return (
    <div className="screen" style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
      borderRadius: '41px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="status-bar" style={{
        height: '44px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1e293b'
      }}>
        <span>9:41</span>
        <span>••••• </span>
        <span>100% 🔋</span>
      </div>
      
      <div className="header" style={{
        padding: '24px 20px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        margin: '0',
        borderRadius: '0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div className="logo" style={{
          fontSize: '32px',
          fontWeight: '900',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '20px',
          letterSpacing: '-0.5px'
        }}>FlashStack</div>
        <div className="agent-info" style={{
          background: 'rgba(248,250,252,0.8)',
          backdropFilter: 'blur(10px)',
          padding: '14px 18px',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1px solid rgba(226,232,240,0.5)'
        }}>
          <div className="agent-avatar" style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '700',
            fontSize: '16px'
          }}>JD</div>
          <div className="agent-details" style={{ flex: '1' }}>
            <div className="agent-name" style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#1e293b'
            }}>Jane Doe</div>
            <div className="agent-company" style={{
              fontSize: '12px',
              color: '#64748b'
            }}>Rocket Realty</div>
          </div>
        </div>
      </div>
      
      <div className="main-content" style={{
        padding: '24px 20px 40px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        flex: '1',
        overflowY: 'auto'
      }}>
        <div className="cta-section" style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '28px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
          textAlign: 'center',
          border: '1px solid rgba(226,232,240,0.5)'
        }}>
          <div className="cma-options" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div 
              className="option-button primary" 
              style={{
                background: 'rgba(219,234,254,0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(59,130,246,0.3)',
                borderRadius: '20px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
                textAlign: 'left',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
              onClick={() => onNavigate('address')}
            >
              <div className="option-icon" style={{
                fontSize: '24px',
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(10px)'
              }}>📍</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>Enter Address</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Type property address</div>
              </div>
            </div>
            
            <div className="option-button secondary" style={{
              background: 'rgba(237,233,254,0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '20px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className="option-icon" style={{
                fontSize: '24px',
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(10px)'
              }}>📱</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>Scan Property</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Use AR to identify location</div>
              </div>
            </div>
            
            <div className="option-button tertiary" style={{
              background: 'rgba(254,243,199,0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '20px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className="option-icon" style={{
                fontSize: '24px',
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(10px)'
              }}>📄</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>Document Retrieval</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Get disclosures only</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="recent-section" style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
          border: '1px solid rgba(226,232,240,0.5)'
        }}>
          <div className="section-title" style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '16px',
            letterSpacing: '-0.2px'
          }}>Recent CMAs + SD</div>
          <div className="recent-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div className="recent-icon" style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }}>🏠</div>
            <div className="recent-info" style={{ flex: '1' }}>
              <div className="recent-title" style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#1e293b'
              }}>123 Main St, Dallas</div>
              <div className="recent-subtitle" style={{
                fontSize: '10px',
                color: '#64748b'
              }}>Johnson Family</div>
            </div>
            <div className="recent-time" style={{
              fontSize: '10px',
              color: '#94a3b8'
            }}>2 hours ago</div>
          </div>
          <div className="recent-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div className="recent-icon" style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }}>🏘️</div>
            <div className="recent-info" style={{ flex: '1' }}>
              <div className="recent-title" style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#1e293b'
              }}>456 Oak Ave, Plano</div>
              <div className="recent-subtitle" style={{
                fontSize: '10px',
                color: '#64748b'
              }}>Smith Investment</div>
            </div>
            <div className="recent-time" style={{
              fontSize: '10px',
              color: '#94a3b8'
            }}>Yesterday</div>
          </div>
          <div className="recent-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0'
          }}>
            <div className="recent-icon" style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }}>🏡</div>
            <div className="recent-info" style={{ flex: '1' }}>
              <div className="recent-title" style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#1e293b'
              }}>789 Pine Rd, Frisco</div>
              <div className="recent-subtitle" style={{
                fontSize: '10px',
                color: '#64748b'
              }}>Williams Estate</div>
            </div>
            <div className="recent-time" style={{
              fontSize: '10px',
              color: '#94a3b8'
            }}>3 days ago</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeScreen