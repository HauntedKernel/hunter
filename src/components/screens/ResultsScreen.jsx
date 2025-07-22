import { useState } from 'react'
import { Home, TrendingUp, Calendar, DollarSign, Users, Download, Share, Filter, MapPin, Building } from 'lucide-react'

const ResultsScreen = ({ onNavigate, mode = 'discovery' }) => {
  const [selectedType, setSelectedType] = useState('sale') // sale, rental
  const [cmaTab, setCmaTab] = useState('subject') // subject, comparables, motivation, negotiation

  // Mock data for different modes
  const discoveryProperties = [
    {
      id: 1,
      address: '456 Oak Avenue',
      city: 'Dallas, TX',
      price: 489900,
      beds: 4,
      baths: 3,
      sqft: 2380,
      yearBuilt: 2018,
      status: 'SOLD',
      daysOnMarket: 18,
      pricePerSqft: 206,
      match: 92,
      image: 'linear-gradient(45deg, #667eea, #764ba2)'
    },
    {
      id: 2,
      address: '789 Pine Street',
      city: 'Dallas, TX',
      price: 445000,
      beds: 3,
      baths: 2,
      sqft: 2100,
      yearBuilt: 2015,
      status: 'ACTIVE',
      daysOnMarket: 12,
      pricePerSqft: 212,
      match: 88,
      image: 'linear-gradient(45deg, #f093fb, #f5576c)'
    },
    {
      id: 3,
      address: '321 Maple Drive',
      city: 'Dallas, TX',
      price: 525000,
      beds: 4,
      baths: 4,
      sqft: 2650,
      yearBuilt: 2020,
      status: 'PENDING',
      daysOnMarket: 8,
      pricePerSqft: 198,
      match: 85,
      image: 'linear-gradient(45deg, #4facfe, #00f2fe)'
    }
  ]

  const cmaData = {
    propertiesAnalyzed: 24,
    averagePrice: 467633,
    averageSize: 2377,
    averagePricePerSqft: 205,
    marketTrend: '+4.8%',
    averageDaysOnMarket: 15,
    priceRange: { min: 395000, max: 595000 },
    recommendations: [
      'Price competitively - market is moving fast',
      'Highlight unique features in listing', 
      'Consider staging for maximum appeal',
      'Be prepared for multiple offers'
    ]
  }

  const rentalData = {
    averageRent: 2850,
    rentPerSqft: 1.35,
    vacancyRate: 4.2,
    averageLease: 12,
    yieldEstimate: 6.8,
    comparableRentals: [
      { address: '123 Oak St', rent: 2750, sqft: 2200 },
      { address: '456 Pine Ave', rent: 2950, sqft: 2400 },
      { address: '789 Elm Dr', rent: 2800, sqft: 2350 }
    ]
  }

  const PropertyCard = ({ property }) => (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      overflow: 'hidden',
      marginBottom: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      {/* Property Image */}
      <div style={{
        height: '140px',
        background: property.image,
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <div style={{
            background: property.status === 'SOLD' ? 'rgba(16,185,129,0.9)' : 
                       property.status === 'ACTIVE' ? 'rgba(59,130,246,0.9)' : 'rgba(245,158,11,0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: '700'
          }}>{property.status}</div>
          <div style={{
            background: 'rgba(59,130,246,0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: '700'
          }}>{property.match}% match</div>
        </div>
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '900' }}>
            ${property.price.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Property Info */}
      <div style={{ padding: '16px' }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '8px'
        }}>{property.address}</div>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          marginBottom: '12px'
        }}>{property.city}</div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <span>{property.beds} bed, {property.baths} bath</span>
          <span>{property.sqft.toLocaleString()} sq ft</span>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#64748b',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <span>{property.daysOnMarket} days</span>
          <span>${property.pricePerSqft}/sqft</span>
          <span>Built {property.yearBuilt}</span>
        </div>
      </div>
    </div>
  )

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
        color: '#1e293b'
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
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('analysis')}
        >←</div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b'
        }}>
          {mode === 'discovery' ? 'Property Discovery' : 'CMA Results'}
        </div>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(248,250,252,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <Filter size={18} />
        </div>
      </div>


      {/* Content */}
      <div style={{
        flex: '1',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {mode === 'discovery' ? (
          // DISCOVERY MODE
          <div style={{ padding: '20px' }}>
            {/* Summary Stats */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>Active Properties Found</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#3b82f6'
                  }}>{discoveryProperties.length}</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Properties</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#10b981'
                  }}>
                    {Math.round(discoveryProperties.reduce((acc, p) => acc + p.match, 0) / discoveryProperties.length)}%
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Avg Match</div>
                </div>
              </div>
            </div>

            {/* Property List */}
            {discoveryProperties.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
            
            {/* Action Buttons for Discovery */}
            <div style={{ marginTop: '32px', marginBottom: '40px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                <button style={{
                  background: 'linear-gradient(135deg, #10b981, #047857)',
                  color: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <Download size={18} />
                  Save Properties
                </button>
                <button style={{
                  background: 'white',
                  color: '#10b981',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '2px solid #10b981',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <Share size={18} />
                  Share List
                </button>
              </div>
            </div>
          </div>
        ) : (
          // CMA MODE
          <div style={{ padding: '20px' }}>
            {/* CMA Type Toggle */}
            <div style={{
              display: 'flex',
              background: 'white',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedType === 'sale' ? '#3b82f6' : 'transparent',
                  color: selectedType === 'sale' ? 'white' : '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedType('sale')}
              >
                Sales CMA
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedType === 'rental' ? '#3b82f6' : 'transparent',
                  color: selectedType === 'rental' ? 'white' : '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedType('rental')}
              >
                Rental CMA
              </button>
            </div>

            {selectedType === 'sale' ? (
              // SALES CMA
              <>
                {/* CMA Tab Navigation */}
                <div style={{
                  display: 'flex',
                  background: 'white',
                  borderRadius: '12px',
                  padding: '4px',
                  marginBottom: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  {[
                    { id: 'subject', label: 'Subject Property', icon: '🏠' },
                    { id: 'comparables', label: 'Comparables', icon: '📋' },
                    { id: 'negotiation', label: 'Intelligence', icon: '🤝' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: cmaTab === tab.id ? '#3b82f6' : 'transparent',
                        color: cmaTab === tab.id ? 'white' : '#64748b',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      onClick={() => setCmaTab(tab.id)}
                    >
                      <span style={{ fontSize: '14px' }}>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {cmaTab === 'subject' && (
                  // SUBJECT PROPERTY TAB
                  <>
                    {/* Executive Summary */}
                    <div style={{
                      background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
                      borderRadius: '20px',
                      padding: '24px',
                      marginBottom: '20px',
                      border: '1px solid #3b82f6'
                    }}>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '800',
                        color: '#1d4ed8',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        📊 Executive Summary
                      </h3>
                      <div style={{
                        textAlign: 'center',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: '900',
                          color: '#1d4ed8',
                          marginBottom: '4px'
                        }}>$465,000 - $495,000</div>
                        <div style={{
                          fontSize: '14px',
                          color: '#1e40af',
                          marginBottom: '8px'
                        }}>High confidence • 6 comparables analyzed</div>
                        <div style={{
                          background: '#fef3c7',
                          color: '#d97706',
                          padding: '8px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>⚠️</span>
                          <span>Roof condition requires attention</span>
                        </div>
                      </div>
                    </div>

                    {/* Property Details */}
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          background: 'linear-gradient(45deg, #667eea, #764ba2)',
                          borderRadius: '12px',
                          flexShrink: 0
                        }}></div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#1e293b',
                            marginBottom: '4px'
                          }}>456 Oak Avenue, Dallas, TX</div>
                          <div style={{
                            fontSize: '14px',
                            color: '#64748b',
                            marginBottom: '8px'
                          }}>4 BR • 3 BA • 2,380 sq ft • Built 2018</div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              background: '#f59e0b',
                              borderRadius: '4px'
                            }}></div>
                            <span style={{ color: '#d97706', fontWeight: '600' }}>Seller's disclosure analyzed</span>
                          </div>
                        </div>
                      </div>

                      {/* Disclosure Analysis */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '12px'
                        }}>🔍 Disclosure Analysis</h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {[
                            { icon: '⚠️', type: 'warning', title: 'Roof Condition Alert', desc: 'Seller disclosed roof leak repairs in 2023. Age: 6 years. Recommend inspection.' },
                            { icon: 'ℹ️', type: 'info', title: 'HVAC System', desc: 'New HVAC installed 2022. Good condition with warranty remaining.' },
                            { icon: '✓', type: 'good', title: 'Foundation', desc: 'No foundation issues disclosed. Recent engineering report clean.' }
                          ].map((item, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px'
                            }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '10px',
                                background: item.type === 'warning' ? '#fef3c7' :
                                           item.type === 'info' ? '#dbeafe' : '#dcfce7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>{item.icon}</div>
                              <div>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#1e293b',
                                  marginBottom: '2px'
                                }}>{item.title}</div>
                                <div style={{
                                  fontSize: '12px',
                                  color: '#64748b',
                                  lineHeight: '1.4'
                                }}>{item.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Seller Motivation Analysis */}
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        🎯 Subject Property Seller Motivation
                        <span style={{
                          background: '#dcfce7',
                          color: '#16a34a',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>AI-Powered</span>
                      </h3>

                      {/* High Motivation Property */}
                      <div style={{
                        background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
                        borderRadius: '16px',
                        padding: '20px',
                        border: '2px solid #f59e0b'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            fontSize: '32px',
                            fontWeight: '900',
                            color: '#dc2626'
                          }}>88%</div>
                          <div>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>456 Oak Avenue (Subject)</div>
                            <div style={{
                              fontSize: '12px',
                              color: '#78716c',
                              fontWeight: '600'
                            }}>HIGH MOTIVATION</div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {[
                            { icon: '🏠', text: 'Already purchased replacement home' },
                            { icon: '📅', text: 'Carrying two mortgages for 45 days' },
                            { icon: '💰', text: 'Motivated to close quickly' },
                            { icon: '🔧', text: 'Disclosed roof issues suggest transparency' }
                          ].map((indicator, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              color: '#78716c'
                            }}>
                              <span style={{ fontSize: '14px' }}>{indicator.icon}</span>
                              <span>{indicator.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {cmaTab === 'comparables' && (
                  // COMPARABLES TAB
                  <>
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        📋 Selected Comparables
                        <span style={{
                          background: '#e0f2fe',
                          color: '#0284c7',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>6 properties</span>
                      </h3>

                      {[
                        { address: '458 Oak Avenue', specs: '4 BR • 3 BA • 2,420 sq ft', condition: 'Excellent condition • New roof 2023', price: '$515,000', date: 'Sold 15 days ago', dot: '#10b981' },
                        { address: '442 Elm Street', specs: '4 BR • 2.5 BA • 2,290 sq ft', condition: 'Good condition • Original roof (12 years)', price: '$478,000', date: 'Sold 28 days ago', dot: '#f59e0b' },
                        { address: '523 Pine Road', specs: '3 BR • 3 BA • 2,340 sq ft', condition: 'Good condition • Recent updates', price: '$465,000', date: 'Sold 45 days ago', dot: '#10b981' },
                        { address: '612 Maple Drive', specs: '4 BR • 3 BA • 2,450 sq ft', condition: 'Fair condition • Needs cosmetic work', price: '$445,000', date: 'Sold 38 days ago', dot: '#f59e0b' },
                        { address: '789 Cedar Lane', specs: '4 BR • 2.5 BA • 2,380 sq ft', condition: 'Excellent condition • Move-in ready', price: '$495,000', date: 'Sold 22 days ago', dot: '#10b981' },
                        { address: '334 Birch Street', specs: '3 BR • 3 BA • 2,180 sq ft', condition: 'Good condition • Minor repairs needed', price: '$458,000', date: 'Sold 33 days ago', dot: '#10b981' }
                      ].map((comp, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '16px 0',
                          borderBottom: index < 5 ? '1px solid #e5e7eb' : 'none'
                        }}>
                          <div style={{
                            width: '60px',
                            height: '60px',
                            background: `linear-gradient(45deg, ${comp.dot}, ${comp.dot}90)`,
                            borderRadius: '8px',
                            flexShrink: 0
                          }}></div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>{comp.address}</div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b',
                              marginBottom: '4px'
                            }}>{comp.specs}</div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '11px'
                            }}>
                              <div style={{
                                width: '6px',
                                height: '6px',
                                background: comp.dot,
                                borderRadius: '3px'
                              }}></div>
                              <span style={{ color: '#64748b' }}>{comp.condition}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>{comp.price}</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>{comp.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {cmaTab === 'negotiation' && (
                  // NEGOTIATION INTELLIGENCE TAB
                  <>
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        🤝 Negotiation Intelligence
                        <span style={{
                          background: '#fef3c7',
                          color: '#d97706',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>Deal Optimizer</span>
                      </h3>

                      {/* Neighborhood Intelligence */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '12px'
                        }}>🧠 Highland Park Neighborhood Intelligence</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '12px'
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#16a34a'
                            }}>18 days</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>Avg Days on Market</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#3b82f6'
                            }}>$485K</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>Median Price ($450-520K)</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#f59e0b'
                            }}>3.2%</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>YoY Price Growth</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#dc2626'
                            }}>Fast</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>Market Pace</div>
                          </div>
                        </div>
                      </div>

                      {/* Natural Language Parser */}
                      <div style={{
                        background: 'rgba(139,92,246,0.05)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        border: '1px solid rgba(139,92,246,0.2)'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          🤖 AI Issue Parser
                          <span style={{
                            background: '#8b5cf6',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '10px',
                            fontWeight: '600'
                          }}>BETA</span>
                        </h4>
                        
                        <div style={{
                          background: '#ffffff',
                          border: '2px dashed #d1d5db',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '12px'
                        }}>
                          <textarea
                            placeholder="Describe issues or preferences (e.g., 'needs new roof', 'wants different paint', 'foundation concerns', 'outdated kitchen')..."
                            style={{
                              width: '100%',
                              minHeight: '60px',
                              border: 'none',
                              outline: 'none',
                              fontSize: '13px',
                              color: '#374151',
                              backgroundColor: 'transparent',
                              resize: 'vertical'
                            }}
                          />
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '12px'
                        }}>
                          {[
                            'needs new roof',
                            'foundation issues', 
                            'wants modern paint',
                            'outdated kitchen',
                            'carpet replacement',
                            'electrical upgrade'
                          ].map((phrase, index) => (
                            <button
                              key={index}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                background: '#f9fafb',
                                fontSize: '11px',
                                color: '#4b5563',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >{phrase}</button>
                          ))}
                        </div>

                        {/* Parsed Results Preview */}
                        <div style={{
                          background: 'rgba(139,92,246,0.1)',
                          borderRadius: '8px',
                          padding: '12px',
                          fontSize: '12px'
                        }}>
                          <div style={{
                            fontWeight: '600',
                            color: '#7c3aed',
                            marginBottom: '8px'
                          }}>🎯 Auto-Parsed Example:</div>
                          <div style={{ display: 'grid', gap: '4px' }}>
                            <div style={{ color: '#dc2626' }}>
                              • <strong>Objective</strong>: "needs new roof" → -$18,500 (2,380 sqft × $7.75/sqft + labor)
                            </div>
                            <div style={{ color: '#8b5cf6' }}>
                              • <strong>Subjective</strong>: "wants modern paint" → -$7,100 (2,380 sqft × $3/sqft interior)
                            </div>
                            <div style={{ color: '#f59e0b' }}>
                              • <strong>Context</strong>: Highland Park 2018 build suggests premium materials/labor
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Total Opportunity */}
                      <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1))',
                        borderRadius: '12px',
                        marginBottom: '20px'
                      }}>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: '900',
                          color: '#dc2626',
                          marginBottom: '4px'
                        }}>$23,500</div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '6px'
                        }}>Total Negotiation Opportunity</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>Objective Issues: $18,500 • Subjective Items: $5,000</div>
                      </div>

                      {/* Objective Issues */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        borderLeft: '4px solid #dc2626'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                          paddingBottom: '8px',
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ fontSize: '16px' }}>🔧</span>
                            <span style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>Objective Issues</span>
                          </div>
                          <span style={{
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#dc2626'
                          }}>$18,500</span>
                        </div>

                        <div style={{ display: 'grid', gap: '12px' }}>
                          {[
                            { name: 'Roof Condition', desc: '6-year-old roof with documented leak repairs in 2023', value: '-$12,000', impact: 'high' },
                            { name: 'Electrical Panel', desc: 'Original 2018 panel not upgraded to 200-amp', value: '-$4,500', impact: 'medium' },
                            { name: 'Window Efficiency', desc: 'Single-pane windows in secondary bedrooms', value: '-$2,000', impact: 'low' }
                          ].map((issue, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              background: '#ffffff',
                              borderRadius: '8px',
                              borderLeft: `4px solid ${issue.impact === 'high' ? '#dc2626' : issue.impact === 'medium' ? '#f59e0b' : '#6b7280'}`
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#1e293b',
                                  marginBottom: '2px'
                                }}>{issue.name}</div>
                                <div style={{
                                  fontSize: '11px',
                                  color: '#64748b',
                                  lineHeight: '1.3'
                                }}>{issue.desc}</div>
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: '#dc2626',
                                flexShrink: 0
                              }}>{issue.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Subjective Preferences */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        borderLeft: '4px solid #8b5cf6'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                          paddingBottom: '8px',
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ fontSize: '16px' }}>🎨</span>
                            <span style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>Subjective Preferences</span>
                          </div>
                          <span style={{
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#8b5cf6'
                          }}>$5,000</span>
                        </div>

                        <div style={{ display: 'grid', gap: '12px' }}>
                          {[
                            { name: 'Interior Paint', desc: 'Bold accent walls and dated color schemes', value: '-$2,500' },
                            { name: 'Light Fixtures', desc: 'Builder-grade fixtures throughout', value: '-$1,500' },
                            { name: 'Carpet Replacement', desc: 'Beige carpet trending toward hardwood', value: '-$1,000' }
                          ].map((issue, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              background: '#ffffff',
                              borderRadius: '8px',
                              borderLeft: '4px solid #8b5cf6'
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#1e293b',
                                  marginBottom: '2px'
                                }}>{issue.name}</div>
                                <div style={{
                                  fontSize: '11px',
                                  color: '#64748b',
                                  lineHeight: '1.3'
                                }}>{issue.desc}</div>
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: '#8b5cf6',
                                flexShrink: 0
                              }}>{issue.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Strategy Recommendations */}
                      <div style={{
                        background: 'rgba(59,130,246,0.05)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid rgba(59,130,246,0.2)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <span style={{ fontSize: '16px' }}>🎯</span>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: '#1e293b'
                          }}>Recommended Strategy</span>
                        </div>

                        <div style={{ display: 'grid', gap: '8px' }}>
                          {[
                            { tag: 'Opening', text: 'Lead with roof concerns ($12K) + electrical ($4.5K) = $16.5K reduction', color: '#dc2626' },
                            { tag: 'Fallback', text: 'Accept $10K seller concession + roof inspection contingency', color: '#f59e0b' },
                            { tag: 'Final', text: 'Minimum: $8K adjustment for roof safety concerns only', color: '#16a34a' }
                          ].map((strategy, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              background: '#ffffff',
                              borderRadius: '8px',
                              border: `1px solid ${strategy.color}20`
                            }}>
                              <div style={{
                                background: strategy.color,
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '700',
                                flexShrink: 0
                              }}>{strategy.tag}</div>
                              <div style={{
                                fontSize: '12px',
                                color: '#374151',
                                lineHeight: '1.4'
                              }}>{strategy.text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              // RENTAL CMA
              <>
                {/* Rental Summary */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '20px',
                  border: '1px solid #10b981'
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#047857',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Building size={24} />
                    Rental Analysis
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>${rentalData.averageRent.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Average Rent</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>${rentalData.rentPerSqft}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Rent per sqft</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>{rentalData.vacancyRate}%</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Vacancy Rate</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>{rentalData.yieldEstimate}%</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Est. Yield</div>
                    </div>
                  </div>
                </div>

                {/* Comparable Rentals */}
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1e293b',
                    marginBottom: '16px'
                  }}>Comparable Rentals</h3>
                  {rentalData.comparableRentals.map((rental, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: index < rentalData.comparableRentals.length - 1 ? '1px solid #e5e7eb' : 'none'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>{rental.address}</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>{rental.sqft.toLocaleString()} sq ft</div>
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#10b981'
                      }}>${rental.rent.toLocaleString()}/mo</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div style={{ marginTop: '32px', marginBottom: '40px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                <button style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  padding: '16px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <Download size={18} />
                  Download PDF
                </button>
                <button style={{
                  background: 'white',
                  color: '#3b82f6',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '2px solid #3b82f6',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}>
                  <Share size={18} />
                  Share Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResultsScreen