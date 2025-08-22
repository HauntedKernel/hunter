const HomeScreen = ({ onNavigate }) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
      position: 'relative',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
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
                }}>Address</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Type property address</div>
              </div>
            </div>
            
            <div 
              className="option-button secondary" 
              style={{
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
                overflow: 'hidden',
                cursor: 'pointer'
              }}
              onClick={() => onNavigate('ar-camera')}
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
              }}>📱</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>Scan</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Use AR to identify location</div>
              </div>
            </div>
            
            <div 
              className="option-button tertiary" 
              style={{
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
                overflow: 'hidden',
                cursor: 'pointer'
              }}
              onClick={() => onNavigate('documents')}
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
              }}>📄</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>Doc</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Get disclosures only</div>
              </div>
            </div>
            
            <div 
              className="option-button seller-intelligence" 
              style={{
                background: 'linear-gradient(135deg, rgba(16,163,74,0.1), rgba(59,130,246,0.1))',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(16,163,74,0.3)',
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
              onClick={() => onNavigate('seller_intelligence_area')}
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
              }}>🎯</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>Sellers Hub</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Campaigns & lead generation</div>
              </div>
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '12px',
                background: '#16a34a',
                color: 'white',
                fontSize: '10px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '12px',
                letterSpacing: '0.5px'
              }}>NEW</div>
            </div>
            
            <div 
              className="option-button clients" 
              style={{
                background: 'rgba(254,240,138,0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(245,158,11,0.3)',
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
              onClick={() => onNavigate('clients')}
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
              }}>👥</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>Clients</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Manage your clients</div>
              </div>
            </div>
            
            <div 
              className="option-button sets" 
              style={{
                background: 'rgba(209,250,229,0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(16,185,129,0.3)',
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
              onClick={() => onNavigate('cmas')}
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
              }}>📊</div>
              <div className="option-text">
                <div className="option-title" style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '4px',
                  letterSpacing: '-0.2px'
                }}>My Sets</div>
                <div className="option-desc" style={{
                  fontSize: '13px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>CMAs & Discovery sets</div>
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