import { useState } from 'react'
import { Home, TrendingUp, Calendar, DollarSign, Users, Download, Share, Filter, MapPin, Building } from 'lucide-react'

const ResultsScreen = ({ onNavigate, mode = 'discovery' }) => {
  const [selectedType, setSelectedType] = useState('sale') // sale, rental

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
                {/* Market Summary */}
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
                    <TrendingUp size={24} />
                    Market Analysis
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
                        color: '#1d4ed8'
                      }}>{cmaData.propertiesAnalyzed}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#1e40af'
                      }}>Properties Analyzed</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#1d4ed8'
                      }}>${cmaData.averagePrice.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#1e40af'
                      }}>Average Price</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#1d4ed8'
                      }}>{cmaData.averageSize.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#1e40af'
                      }}>Average Size (sqft)</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#1d4ed8'
                      }}>${cmaData.averagePricePerSqft}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#1e40af'
                      }}>Price per sqft</div>
                    </div>
                  </div>
                </div>

                {/* Market Insights */}
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
                  }}>Market Insights</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      background: '#f0fdf4',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '900',
                        color: '#16a34a'
                      }}>{cmaData.marketTrend}</div>
                      <div style={{
                        fontSize: '11px',
                        color: '#16a34a'
                      }}>Price Growth</div>
                    </div>
                    <div style={{
                      background: '#fef3c7',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '900',
                        color: '#d97706'
                      }}>{cmaData.averageDaysOnMarket}</div>
                      <div style={{
                        fontSize: '11px',
                        color: '#d97706'
                      }}>Avg Days</div>
                    </div>
                    <div style={{
                      background: '#fee2e2',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '900',
                        color: '#dc2626'
                      }}>Fast</div>
                      <div style={{
                        fontSize: '11px',
                        color: '#dc2626'
                      }}>Market</div>
                    </div>
                  </div>
                </div>

                {/* Motivation Tools */}
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
                    🎯 Client Motivation Tools
                  </h3>
                  
                  {/* Market Urgency */}
                  <div style={{
                    background: '#fef3c7',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    border: '1px solid #f59e0b'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#d97706',
                      marginBottom: '8px'
                    }}>⚡ Market Urgency</h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#92400e',
                      lineHeight: '1.5'
                    }}>
                      "Properties are selling in just {cmaData.averageDaysOnMarket} days on average. 
                      With {cmaData.marketTrend} price growth, waiting could cost you 
                      ${Math.round(cmaData.averagePrice * 0.048 / 12).toLocaleString()} per month."
                    </p>
                  </div>

                  {/* Investment Opportunity */}
                  <div style={{
                    background: '#dcfce7',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    border: '1px solid #16a34a'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#16a34a',
                      marginBottom: '8px'
                    }}>💰 Investment Opportunity</h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#166534',
                      lineHeight: '1.5'
                    }}>
                      "Based on current trends, a ${cmaData.averagePrice.toLocaleString()} investment 
                      could appreciate ${Math.round(cmaData.averagePrice * 0.048).toLocaleString()} 
                      annually. That's ${Math.round(cmaData.averagePrice * 0.048 / 365).toLocaleString()} 
                      per day in potential equity."
                    </p>
                  </div>

                  {/* Competitive Advantage */}
                  <div style={{
                    background: '#dbeafe',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #3b82f6'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1d4ed8',
                      marginBottom: '8px'
                    }}>🏆 Competitive Advantage</h4>
                    <p style={{
                      fontSize: '14px',
                      color: '#1e40af',
                      lineHeight: '1.5'
                    }}>
                      "Only {cmaData.propertiesAnalyzed} comparable properties available. 
                      Limited inventory means less choice for buyers - secure your ideal home now."
                    </p>
                  </div>
                </div>

                {/* Negotiation Tools */}
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
                    🤝 Negotiation Strategies
                  </h3>

                  {/* Price Positioning */}
                  <div style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '12px'
                    }}>💵 Price Positioning</h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '12px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '900',
                          color: '#dc2626'
                        }}>${(cmaData.averagePrice * 0.95).toLocaleString()}</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>Aggressive Offer</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '900',
                          color: '#3b82f6'
                        }}>${cmaData.averagePrice.toLocaleString()}</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>Market Value</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '900',
                          color: '#16a34a'
                        }}>${(cmaData.averagePrice * 1.05).toLocaleString()}</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>Strong Offer</div>
                      </div>
                    </div>
                  </div>

                  {/* Negotiation Scripts */}
                  <div style={{
                    background: '#f8fafc',
                    padding: '16px',
                    borderRadius: '12px'
                  }}>
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '12px'
                    }}>💬 Key Talking Points</h4>
                    {[
                      'Market data shows homes selling in ' + cmaData.averageDaysOnMarket + ' days - act quickly',
                      'Price growth of ' + cmaData.marketTrend + ' means costs are rising',
                      'Limited inventory gives you fewer options to choose from',
                      'Pre-approval shows you\'re a serious, qualified buyer'
                    ].map((point, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          background: '#10b981',
                          color: 'white',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: '700',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}>✓</div>
                        <div style={{
                          fontSize: '13px',
                          color: '#374151',
                          lineHeight: '1.5'
                        }}>{point}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Recommendations */}
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
                    🧠 AI Strategy Recommendations
                  </h3>
                  {cmaData.recommendations.map((rec, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        background: '#3b82f6',
                        color: 'white',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '700',
                        flexShrink: 0
                      }}>{index + 1}</div>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151',
                        lineHeight: '1.5'
                      }}>{rec}</div>
                    </div>
                  ))}
                </div>
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