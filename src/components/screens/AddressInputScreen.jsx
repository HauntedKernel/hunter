const AddressInputScreen = ({ onNavigate }) => {
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
      
      <div className="header-bar" style={{
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        borderBottom: '1px solid rgba(226,232,240,0.5)'
      }}>
        <div 
          className="back-button" 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(248,250,252,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={() => onNavigate('home')}
        >←</div>
        <div className="screen-title" style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b'
        }}>Client & Property Setup</div>
      </div>
      
      <div className="main-content" style={{
        flex: '1',
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <div className="input-section" style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '32px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
          border: '1px solid rgba(226,232,240,0.5)',
          marginBottom: '24px'
        }}>
          <div className="input-title" style={{
            fontSize: '20px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '8px',
            textAlign: 'center'
          }}>Select Client</div>
          <div className="input-subtitle" style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '28px',
            textAlign: 'center',
            fontWeight: '500'
          }}>Choose client for this CMA analysis</div>
          
          <div className="client-input-container" style={{
            position: 'relative',
            marginBottom: '20px'
          }}>
            <input 
              type="text" 
              className="client-input" 
              placeholder="Search clients or add new..."
              defaultValue="Johnson Family"
              style={{
                width: '100%',
                padding: '18px 60px 18px 24px',
                border: '2px solid #e2e8f0',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '500',
                background: 'rgba(255,255,255,0.9)',
                transition: 'all 0.3s ease'
              }}
            />
            <div className="client-add-btn" style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}>+</div>
          </div>
          
          <div className="client-suggestions" style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            border: '1px solid rgba(226,232,240,0.5)',
            overflow: 'hidden',
            marginBottom: '20px'
          }}>
            <div className="client-suggestion active" style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(59,130,246,0.1)',
              borderLeft: '4px solid #3b82f6'
            }}>
              <div className="client-avatar" style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '14px'
              }}>JF</div>
              <div className="client-info" style={{ flex: '1' }}>
                <div className="client-name" style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '4px'
                }}>Johnson Family</div>
                <div className="client-details" style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>Last CMA: 2 weeks ago • Family Profile</div>
              </div>
              <div className="client-status" style={{ fontSize: '20px' }}>👨‍👩‍👧‍👦</div>
            </div>
            <div className="client-suggestion" style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div className="client-avatar" style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '14px'
              }}>SI</div>
              <div className="client-info" style={{ flex: '1' }}>
                <div className="client-name" style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '4px'
                }}>Smith Investment LLC</div>
                <div className="client-details" style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>Last CMA: 1 month ago • Investment Profile</div>
              </div>
              <div className="client-status" style={{ fontSize: '20px' }}>💼</div>
            </div>
            <div className="client-suggestion" style={{
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div className="client-avatar" style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '14px'
              }}>WE</div>
              <div className="client-info" style={{ flex: '1' }}>
                <div className="client-name" style={{
                  fontSize: '15px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '4px'
                }}>Williams Estate</div>
                <div className="client-details" style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>Last CMA: 3 months ago • Luxury Profile</div>
              </div>
              <div className="client-status" style={{ fontSize: '20px' }}>🏰</div>
            </div>
          </div>
        </div>
        
        <div className="mode-section" style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
          border: '1px solid rgba(226,232,240,0.5)'
        }}>
          <div className="mode-title" style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '4px',
            textAlign: 'center'
          }}>Analysis Mode</div>
          <div className="mode-subtitle" style={{
            fontSize: '13px',
            color: '#64748b',
            marginBottom: '16px',
            textAlign: 'center',
            fontWeight: '500'
          }}>Choose your property search focus</div>
          
          <div className="mode-toggle" style={{
            display: 'flex',
            gap: '8px'
          }}>
            <div className="mode-option discovery active" style={{
              flex: '1',
              padding: '16px 12px',
              border: '2px solid #3b82f6',
              borderRadius: '12px',
              background: 'rgba(59,130,246,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}>
              <span className="mode-icon" style={{
                fontSize: '20px',
                flexShrink: '0'
              }}>🔍</span>
              <div className="mode-info" style={{
                flex: '1',
                textAlign: 'left'
              }}>
                <div className="mode-name" style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '2px'
                }}>Discovery</div>
                <div className="mode-desc" style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Active listings only</div>
              </div>
            </div>
            
            <div className="mode-option cma" style={{
              flex: '1',
              padding: '16px 12px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}>
              <span className="mode-icon" style={{
                fontSize: '20px',
                flexShrink: '0'
              }}>📊</span>
              <div className="mode-info" style={{
                flex: '1',
                textAlign: 'left'
              }}>
                <div className="mode-name" style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '2px'
                }}>CMA Analysis</div>
                <div className="mode-desc" style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontWeight: '500'
                }}>Active + sold properties</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="input-section" style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '32px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
          border: '1px solid rgba(226,232,240,0.5)'
        }}>
          <div className="input-title" style={{
            fontSize: '20px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '8px',
            textAlign: 'center'
          }}>Property Address</div>
          <div className="input-subtitle" style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '28px',
            textAlign: 'center',
            fontWeight: '500'
          }}>Enter the address for your CMA analysis</div>
          
          <div className="address-input-container" style={{
            position: 'relative',
            marginBottom: '20px'
          }}>
            <input 
              type="text" 
              className="address-input" 
              placeholder="123 Main Street, Dallas, TX"
              defaultValue="456 Oak Avenue, Dallas"
              style={{
                width: '100%',
                padding: '18px 24px',
                border: '2px solid #e2e8f0',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '500',
                background: 'rgba(255,255,255,0.9)',
                transition: 'all 0.3s ease'
              }}
            />
          </div>
          
          <div className="input-actions" style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <div className="input-action-btn voice-btn" style={{
              flex: '1',
              padding: '14px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '14px',
              fontWeight: '600',
              color: '#64748b'
            }}>
              <span>🎤</span>
              <span>Voice</span>
            </div>
            <div className="input-action-btn gps-btn" style={{
              flex: '1',
              padding: '14px 16px',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '14px',
              fontWeight: '600',
              color: '#64748b'
            }}>
              <span className="gps-icon">📍</span>
              <span>GPS</span>
            </div>
          </div>
          
          <div className="autocomplete-list" style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            border: '1px solid rgba(226,232,240,0.5)',
            overflow: 'hidden',
            marginBottom: '20px'
          }}>
            <div className="autocomplete-item" style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}>
              <div className="autocomplete-address" style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '4px'
              }}>456 Oak Avenue, Dallas, TX 75201</div>
              <div className="autocomplete-details" style={{
                fontSize: '12px',
                color: '#64748b'
              }}>Highland Park • Single Family • $489,900</div>
            </div>
            <div className="autocomplete-item" style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}>
              <div className="autocomplete-address" style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '4px'
              }}>458 Oak Avenue, Dallas, TX 75201</div>
              <div className="autocomplete-details" style={{
                fontSize: '12px',
                color: '#64748b'
              }}>Highland Park • Single Family • $525,000</div>
            </div>
            <div className="autocomplete-item" style={{
              padding: '16px 20px',
              cursor: 'pointer',
              transition: 'background 0.2s ease'
            }}>
              <div className="autocomplete-address" style={{
                fontSize: '15px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '4px'
              }}>460 Oak Avenue, Dallas, TX 75201</div>
              <div className="autocomplete-details" style={{
                fontSize: '12px',
                color: '#64748b'
              }}>Highland Park • Single Family • $475,000</div>
            </div>
          </div>
          
          <div className="property-preview" style={{
            background: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div className="preview-title" style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#3b82f6',
              marginBottom: '12px'
            }}>Property Found</div>
            <div className="preview-address" style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1e293b',
              marginBottom: '8px'
            }}>456 Oak Avenue, Dallas, TX 75201</div>
            <div className="preview-details" style={{
              display: 'flex',
              gap: '16px',
              fontSize: '13px',
              color: '#64748b'
            }}>
              <span>4 BR</span>
              <span>3 BA</span>
              <span>2,380 sq ft</span>
              <span>Built 2018</span>
            </div>
          </div>
          
          <div 
            className="start-cma-button" 
            style={{
              width: '100%',
              padding: '18px 24px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 8px 24px rgba(59,130,246,0.4), 0 2px 8px rgba(0,0,0,0.1)'
            }}
            onClick={() => onNavigate('property')}
          >
            Start Property Analysis
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
          <div className="recent-title" style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '16px'
          }}>Recent Addresses</div>
          
          <div className="recent-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0',
            borderBottom: '1px solid #f1f5f9',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
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
              <div className="recent-address" style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#1e293b'
              }}>123 Main St, Dallas, TX</div>
              <div className="recent-date" style={{
                fontSize: '11px',
                color: '#64748b'
              }}>Used 2 hours ago</div>
            </div>
          </div>
          
          <div className="recent-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0',
            borderBottom: '1px solid #f1f5f9',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
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
              <div className="recent-address" style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#1e293b'
              }}>789 Pine Rd, Frisco, TX</div>
              <div className="recent-date" style={{
                fontSize: '11px',
                color: '#64748b'
              }}>Used yesterday</div>
            </div>
          </div>
          
          <div className="recent-item" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 0',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
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
              <div className="recent-address" style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#1e293b'
              }}>555 Elm St, Plano, TX</div>
              <div className="recent-date" style={{
                fontSize: '11px',
                color: '#64748b'
              }}>Used last week</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddressInputScreen