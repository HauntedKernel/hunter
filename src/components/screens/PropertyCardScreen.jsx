import { useState } from 'react'

const PropertyCardScreen = ({ onNavigate }) => {
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
      {/* Status Bar */}
      <div className="status-bar" style={{
        height: '44px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1e293b',
        position: 'sticky',
        top: 0,
        background: 'white',
        zIndex: 20
      }}>
        <span>9:41</span>
        <span>••••• </span>
        <span>100% 🔋</span>
      </div>
      
      {/* Header */}
      <div className="header-bar" style={{
        padding: '16px 20px',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(226,232,240,0.5)',
        position: 'sticky',
        top: '44px',
        zIndex: 20
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
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('address')}
        >←</div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b'
        }}>Property Analysis</div>
        <div style={{
          background: '#dcfce7',
          color: '#16a34a',
          padding: '6px 12px',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: '600'
        }}>92% match</div>
      </div>
      
      {/* Scrollable Content */}
      <div style={{
        flex: '1',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {/* Property Card */}
        <div style={{
          background: 'white',
          margin: '20px',
          borderRadius: '24px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* Property Image */}
          <div style={{
            height: '280px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Image Overlay */}
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)'
            }}></div>
            
            {/* Badges */}
            <div style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              right: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div style={{
                background: 'rgba(16,185,129,0.9)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                backdropFilter: 'blur(10px)'
              }}>SOLD</div>
              <div style={{
                background: 'rgba(59,130,246,0.9)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                backdropFilter: 'blur(10px)'
              }}>92% match</div>
            </div>
            
            {/* Price */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '28px',
                fontWeight: '900',
                marginBottom: '4px',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)'
              }}>$489,900</div>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                opacity: '0.9',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)'
              }}>Sold 32 days ago</div>
            </div>
          </div>
          
          {/* Property Info */}
          <div style={{
            padding: '24px'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '8px',
              lineHeight: '1.3'
            }}>456 Oak Avenue, Dallas</div>
            
            {/* Specs */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: '#64748b',
                fontWeight: '500'
              }}>
                <span style={{ fontSize: '14px' }}>🛏️</span>
                <span>4 BR</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: '#64748b',
                fontWeight: '500'
              }}>
                <span style={{ fontSize: '14px' }}>🚿</span>
                <span>3 BA</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: '#64748b',
                fontWeight: '500'
              }}>
                <span style={{ fontSize: '14px' }}>📐</span>
                <span>2,380 sq ft</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '13px',
                color: '#64748b',
                fontWeight: '500'
              }}>
                <span style={{ fontSize: '14px' }}>📅</span>
                <span>Built 2018</span>
              </div>
            </div>
            
            {/* Market Insights */}
            <div style={{
              background: 'rgba(245,158,11,0.1)',
              borderRadius: '12px',
              padding: '12px 16px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '700',
                color: '#d97706',
                marginBottom: '6px'
              }}>Market Insights</div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>18</div>
                  <div style={{
                    fontSize: '10px',
                    color: '#64748b',
                    fontWeight: '500'
                  }}>Days on Market</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>$206</div>
                  <div style={{
                    fontSize: '10px',
                    color: '#64748b',
                    fontWeight: '500'
                  }}>Per Sq Ft</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>0.4 mi</div>
                  <div style={{
                    fontSize: '10px',
                    color: '#64748b',
                    fontWeight: '500'
                  }}>Distance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Lifestyle Analysis Section */}
        <div style={{
          background: 'linear-gradient(135deg, #dbeafe, #dcfce7)',
          margin: '20px',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid #3b82f6'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '800',
            color: '#1d4ed8',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>🧠</span>
            <span>Lifestyle Analysis</span>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '16px'
          }}>
            {['Entertainment Focused', 'Open Concept', 'Outdoor Living', 'Gourmet Kitchen', 'Master Suite'].map((tag, index) => (
              <div key={index} style={{
                background: '#3b82f6',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600'
              }}>{tag}</div>
            ))}
          </div>
          <div style={{
            fontSize: '15px',
            color: '#374151',
            lineHeight: '1.6',
            fontStyle: 'italic'
          }}>
            Perfect for <span style={{
              background: '#fef3c7',
              padding: '2px 4px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>entertaining</span> with open concept living and <span style={{
              background: '#fef3c7',
              padding: '2px 4px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>gourmet kitchen</span> flowing to covered patio. Master suite with <span style={{
              background: '#fef3c7',
              padding: '2px 4px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>spa-like bathroom</span> and walk-in closet. Premium finishes throughout including hardwood floors and granite countertops.
          </div>
        </div>
        
        {/* Property Highlights Section */}
        <div style={{
          margin: '20px',
          background: '#f8fafc',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '12px'
          }}>Property Highlights</div>
          <div style={{
            fontSize: '14px',
            color: '#374151',
            lineHeight: '1.6'
          }}>
            This stunning home showcases modern luxury with thoughtful design elements. The chef's kitchen features top-of-the-line appliances and flows seamlessly into the family room, making it ideal for both intimate gatherings and large-scale entertaining. Premium finishes and attention to detail throughout.
          </div>
        </div>
        
        {/* Neighborhood Context Section */}
        <div style={{
          margin: '20px',
          background: '#f8fafc',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '12px'
          }}>Neighborhood Context</div>
          <div style={{
            fontSize: '14px',
            color: '#374151',
            lineHeight: '1.6'
          }}>
            Located in prestigious Highland Park with tree-lined streets and mature landscaping. Walking distance to parks, boutique shopping, and award-winning restaurants. Top-rated schools and family-friendly community amenities make this an ideal location for families.
          </div>
        </div>
        
        {/* Photo Gallery Section */}
        <div style={{
          margin: '20px',
          marginBottom: '60px'
        }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '16px'
          }}>Property Gallery</div>
          
          {[
            { gradient: 'linear-gradient(45deg, #667eea, #764ba2)', caption: 'Living Room - Open Concept Design' },
            { gradient: 'linear-gradient(45deg, #f093fb, #f5576c)', caption: 'Gourmet Kitchen - Chef\'s Paradise' },
            { gradient: 'linear-gradient(45deg, #4facfe, #00f2fe)', caption: 'Master Suite - Spa-Like Retreat' },
            { gradient: 'linear-gradient(45deg, #a8edea, #fed6e3)', caption: 'Covered Patio - Outdoor Entertainment' },
            { gradient: 'linear-gradient(45deg, #fad0c4, #ffd1ff)', caption: 'Front Exterior - Curb Appeal' },
            { gradient: 'linear-gradient(45deg, #a18cd1, #fbc2eb)', caption: 'Dining Area - Formal Entertainment' },
            { gradient: 'linear-gradient(45deg, #ffecd2, #fcb69f)', caption: 'Master Bathroom - Spa Experience' },
            { gradient: 'linear-gradient(45deg, #8fd3f4, #84fab0)', caption: 'Backyard - Private Oasis' }
          ].map((photo, index) => (
            <div key={index} style={{
              width: '100%',
              height: '200px',
              background: '#e5e7eb',
              borderRadius: '12px',
              marginBottom: '16px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: photo.gradient
              }}></div>
              <div style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                color: 'white',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '600'
              }}>{photo.caption}</div>
            </div>
          ))}
          
          {/* Continue Analysis Button */}
          <div style={{
            margin: '20px',
            marginTop: '32px'
          }}>
            <div 
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '16px',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 8px 24px rgba(59,130,246,0.4)'
              }}
              onClick={() => onNavigate('analysis')}
            >
              Continue with Deep Analysis
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PropertyCardScreen