import { useState, useEffect } from 'react'
import { Building, Calendar, User, Phone, Mail, MapPin, TrendingUp, DollarSign, Clock } from 'lucide-react'
import { shareSessionService } from '../../services/ShareSessionService.js'

const ShareViewScreen = ({ shareId }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [accessCount, setAccessCount] = useState(0)

  useEffect(() => {
    loadSharedReport()
  }, [shareId])

  const loadSharedReport = async () => {
    try {
      setLoading(true)
      const result = await shareSessionService.getSharedReport(shareId)
      
      if (result.success) {
        setReportData(result.reportData)
        setMetadata(result.metadata)
        setAccessCount(result.accessCount)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load shared report')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <div style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
          }}>Loading report...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🔗</div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '8px'
          }}>Link Not Available</h2>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '24px'
          }}>{error}</p>
          <div style={{
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '12px',
            color: '#64748b'
          }}>
            If you believe this is an error, please contact the person who shared this link.
          </div>
        </div>
      </div>
    )
  }

  const PropertyCard = ({ property, index }) => (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          background: `linear-gradient(45deg, ${['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'][index % 5]}, ${['#764ba2', '#f5576c', '#00f2fe', '#84fab0', '#ff9472'][index % 5]})`,
          borderRadius: '8px',
          flexShrink: 0
        }}></div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '4px'
          }}>{property.address}</div>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            marginBottom: '8px'
          }}>
            {property.beds} bed • {property.baths} bath • {property.sqft?.toLocaleString()} sq ft
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#1e293b'
            }}>
              ${property.price?.toLocaleString()}
            </div>
            {property.match && (
              <div style={{
                background: '#e0f2fe',
                color: '#0284c7',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600'
              }}>
                {property.match}% match
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '20px',
              fontWeight: '700'
            }}>FS</div>
            <div>
              <h1 style={{
                fontSize: '24px',
                fontWeight: '800',
                color: '#1e293b',
                margin: 0
              }}>
                FlashStack {reportData.reportType === 'discovery' ? 'Property Discovery' : 
                          reportData.reportType === 'rental' ? 'Rental Analysis' : 'CMA Report'}
              </h1>
              <div style={{
                fontSize: '14px',
                color: '#64748b'
              }}>
                {metadata?.propertyAddress || 'Property Report'}
              </div>
            </div>
          </div>

          {/* Agent Info */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '8px',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <User size={16} color="#64748b" />
              <div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>Prepared by</div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>{metadata?.agentInfo?.name}</div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>{metadata?.agentInfo?.company}</div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Phone size={16} color="#64748b" />
              <div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>Contact</div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>{metadata?.agentInfo?.phone}</div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>{metadata?.agentInfo?.email}</div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Calendar size={16} color="#64748b" />
              <div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>Report Date</div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>{reportData.date}</div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748b'
                }}>For {metadata?.customerName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        {reportData.reportType === 'discovery' && (
          <div>
            {/* Discovery Summary */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>Discovery Results</h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#3b82f6'
                  }}>{reportData.discoveryResults?.totalFound || reportData.selectedProperties?.length || 0}</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Properties Found</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#10b981'
                  }}>{reportData.discoveryResults?.averageMatch || 85}%</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Average Match</div>
                </div>
                {reportData.discoveryResults?.priceRange && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#f59e0b'
                    }}>${(reportData.discoveryResults.priceRange.min / 1000).toFixed(0)}K - ${(reportData.discoveryResults.priceRange.max / 1000).toFixed(0)}K</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>Price Range</div>
                  </div>
                )}
              </div>
            </div>

            {/* Properties List */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>Matching Properties</h3>
              {reportData.selectedProperties?.map((property, index) => (
                <PropertyCard key={index} property={property} index={index} />
              ))}
            </div>
          </div>
        )}

        {reportData.reportType === 'cma' && (
          <div>
            {/* CMA Summary */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>Market Analysis Summary</h2>
              
              {/* Price Recommendation */}
              {reportData.priceRecommendation && (
                <div style={{
                  background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1d4ed8',
                    marginBottom: '12px'
                  }}>Price Recommendation</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#64748b'
                      }}>${reportData.priceRecommendation.low?.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>Conservative</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '900',
                        color: '#1d4ed8'
                      }}>${reportData.priceRecommendation.recommended?.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#1d4ed8',
                        fontWeight: '600'
                      }}>RECOMMENDED</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#64748b'
                      }}>${reportData.priceRecommendation.high?.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>Optimistic</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Stats */}
              {reportData.marketStats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '16px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#3b82f6'
                    }}>{reportData.marketStats.avgDaysOnMarket}</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>Avg Days on Market</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#10b981'
                    }}>{reportData.marketStats.saleToListRatio}%</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>Sale to List Ratio</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#f59e0b'
                    }}>${reportData.marketStats.pricePerSqFt}</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>Price per Sq Ft</div>
                  </div>
                </div>
              )}
            </div>

            {/* Comparable Properties */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
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
                Comparable Properties
                <span style={{
                  background: '#e0f2fe',
                  color: '#0284c7',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>{reportData.comparables?.length || reportData.selectedProperties?.length || 0} properties</span>
              </h3>
              {(reportData.comparables || reportData.selectedProperties)?.map((property, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px 0',
                  borderBottom: index < ((reportData.comparables || reportData.selectedProperties)?.length - 1) ? '1px solid #e5e7eb' : 'none'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: `linear-gradient(45deg, ${['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#667eea'][index % 6]}, ${['#764ba2', '#f5576c', '#00f2fe', '#84fab0', '#ff9472', '#764ba2'][index % 6]})`,
                    borderRadius: '8px',
                    flexShrink: 0
                  }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b',
                      marginBottom: '2px'
                    }}>{property.address}</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      marginBottom: '4px'
                    }}>{property.specs || `${property.beds} bed • ${property.baths} bath • ${property.sqft?.toLocaleString()} sq ft`}</div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px'
                    }}>
                      <div style={{
                        width: '6px',
                        height: '6px',
                        background: '#10b981',
                        borderRadius: '3px'
                      }}></div>
                      <span style={{ color: '#64748b' }}>{property.condition || `${property.status} • ${property.date || property.daysOnMarket + ' days on market'}`}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#1e293b',
                      marginBottom: '2px'
                    }}>${property.price?.toLocaleString()}</div>
                    <div style={{
                      fontSize: '11px',
                      color: '#64748b'
                    }}>{property.date || `$${property.pricePerSqFt}/sqft`}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Negotiation Intelligence */}
            {reportData.negotiationIntelligence && (
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '16px'
                }}>Negotiation Intelligence</h3>
                
                {/* Neighborhood Stats */}
                {reportData.negotiationIntelligence.neighborhoodStats && (
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
                    }}>Highland Park Neighborhood Intelligence</h4>
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
                        }}>{reportData.negotiationIntelligence.neighborhoodStats.avgDaysOnMarket} days</div>
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
                        }}>${(reportData.negotiationIntelligence.neighborhoodStats.medianPrice / 1000).toFixed(0)}K</div>
                        <div style={{
                          fontSize: '11px',
                          color: '#64748b'
                        }}>Median Price</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          fontSize: '20px',
                          fontWeight: '900',
                          color: '#f59e0b'
                        }}>{reportData.negotiationIntelligence.neighborhoodStats.priceGrowth}%</div>
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
                        }}>{reportData.negotiationIntelligence.neighborhoodStats.marketPace}</div>
                        <div style={{
                          fontSize: '11px',
                          color: '#64748b'
                        }}>Market Pace</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seller Motivation */}
                {reportData.negotiationIntelligence.sellerMotivation && (
                  <div style={{
                    background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '20px',
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
                      }}>{reportData.negotiationIntelligence.sellerMotivation.score}%</div>
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b'
                        }}>Seller Motivation Score</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#78716c',
                          fontWeight: '600'
                        }}>HIGH MOTIVATION</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {reportData.negotiationIntelligence.sellerMotivation.factors?.map((factor, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '12px',
                          color: '#78716c'
                        }}>
                          <span style={{ fontSize: '14px' }}>{factor.icon}</span>
                          <span>{factor.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issues & Opportunities */}
                {reportData.negotiationIntelligence.totalOpportunity > 0 && (
                  <>
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1))',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#dc2626'
                      }}>${reportData.negotiationIntelligence.totalOpportunity?.toLocaleString()}</div>
                      <div style={{
                        fontSize: '14px',
                        color: '#374151'
                      }}>Total Negotiation Opportunity</div>
                    </div>
                    {reportData.negotiationIntelligence.issues?.map((issue, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        borderLeft: '4px solid #dc2626'
                      }}>
                        <div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1e293b'
                          }}>{issue.category}</div>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b'
                          }}>{issue.description}</div>
                        </div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#dc2626'
                        }}>-${issue.cost?.toLocaleString()}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {reportData.reportType === 'rental' && (
          <div>
            {/* Rental Summary */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>Investment Analysis</h2>
              
              {/* Rental Income */}
              {reportData.rentalEstimate && (
                <div style={{
                  background: 'linear-gradient(135df, #f0fdf4, #ecfdf5)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#047857',
                    marginBottom: '12px'
                  }}>Rental Income Projection</h3>
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
                      }}>${reportData.rentalEstimate.monthly?.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Monthly Rent</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>${reportData.rentalEstimate.annual?.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Annual Income</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Investment Metrics */}
              {reportData.investmentMetrics && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '16px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#3b82f6'
                    }}>{reportData.investmentMetrics.capRate}%</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>Cap Rate</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#10b981'
                    }}>{reportData.investmentMetrics.cashOnCash}%</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>Cash on Cash</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#f59e0b'
                    }}>{reportData.investmentMetrics.paybackPeriod} yrs</div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b'
                    }}>Payback Period</div>
                  </div>
                </div>
              )}
            </div>

            {/* Comparable Rentals */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>Comparable Rentals</h3>
              {reportData.selectedProperties?.map((property, index) => (
                <PropertyCard key={index} property={property} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '20px'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            marginBottom: '8px'
          }}>
            Report generated by FlashStack • View #{accessCount}
          </div>
          <div style={{
            fontSize: '10px',
            color: '#9ca3af'
          }}>
            This report contains confidential market analysis and should not be distributed without permission.
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default ShareViewScreen