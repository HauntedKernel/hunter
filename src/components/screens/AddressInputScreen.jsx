import { useState, useEffect } from 'react'

const AddressInputScreen = ({ onNavigate, onModeChange }) => {
  const [lifestyleIntensities, setLifestyleIntensities] = useState({})
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')
  const [parsedInsights, setParsedInsights] = useState([])
  const [selectedMode, setSelectedMode] = useState('discovery')
  
  const lifestyleFeatures = [
    { id: 'entertainment', label: 'Entertainment Focused', icon: '🎉', category: 'social' },
    { id: 'open-concept', label: 'Open Concept', icon: '🏠', category: 'layout' },
    { id: 'outdoor-living', label: 'Outdoor Living', icon: '🌳', category: 'outdoor' },
    { id: 'gourmet-kitchen', label: 'Gourmet Kitchen', icon: '👨‍🍳', category: 'kitchen' },
    { id: 'master-suite', label: 'Master Suite', icon: '🛏️', category: 'bedroom' },
    { id: 'home-office', label: 'Home Office', icon: '💼', category: 'work' },
    { id: 'family-friendly', label: 'Family Friendly', icon: '👨‍👩‍👧‍👦', category: 'family' },
    { id: 'luxury-finishes', label: 'Luxury Finishes', icon: '✨', category: 'luxury' },
    { id: 'walk-in-closet', label: 'Walk-in Closet', icon: '👗', category: 'storage' },
    { id: 'multiple-living', label: 'Multiple Living Areas', icon: '🛋️', category: 'layout' },
    { id: 'downstairs-master', label: 'Downstairs Master', icon: '⬇️', category: 'accessibility' },
    { id: 'pool-spa', label: 'Pool/Spa', icon: '🏊‍♀️', category: 'outdoor' },
    { id: 'garage-space', label: 'Large Garage', icon: '🚗', category: 'storage' },
    { id: 'smart-home', label: 'Smart Home', icon: '📱', category: 'technology' },
    { id: 'energy-efficient', label: 'Energy Efficient', icon: '🌱', category: 'sustainability' },
    { id: 'wine-cellar', label: 'Wine Storage', icon: '🍷', category: 'luxury' }
  ]
  
  const updateLifestyleIntensity = (featureId, intensity) => {
    setLifestyleIntensities(prev => ({
      ...prev,
      [featureId]: intensity
    }))
  }
  
  const parseNaturalLanguage = (input) => {
    const text = input.toLowerCase()
    const insights = []
    
    // Simple parsing logic for demo
    if (text.includes('downstairs master') || text.includes('master downstairs')) {
      insights.push({ type: 'feature', value: 'downstairs-master', confidence: 95, intensity: 85 })
    }
    if (text.includes('entertaining') || text.includes('entertain')) {
      insights.push({ type: 'feature', value: 'entertainment', confidence: 90, intensity: 80 })
    }
    if (text.includes('office') || text.includes('work from home')) {
      insights.push({ type: 'feature', value: 'home-office', confidence: 85, intensity: 75 })
    }
    if (text.includes('family') || text.includes('kids') || text.includes('children')) {
      insights.push({ type: 'feature', value: 'family-friendly', confidence: 88, intensity: 80 })
    }
    if (text.includes('open') && (text.includes('concept') || text.includes('floor plan'))) {
      insights.push({ type: 'feature', value: 'open-concept', confidence: 92, intensity: 85 })
    }
    if (text.includes('outdoor') || text.includes('patio') || text.includes('deck')) {
      insights.push({ type: 'feature', value: 'outdoor-living', confidence: 87, intensity: 75 })
    }
    if (text.includes('luxury') || text.includes('high-end') || text.includes('premium')) {
      insights.push({ type: 'feature', value: 'luxury-finishes', confidence: 85, intensity: 70 })
    }
    if (text.includes('pool') || text.includes('spa')) {
      insights.push({ type: 'feature', value: 'pool-spa', confidence: 90, intensity: 80 })
    }
    
    setParsedInsights(insights)
    
    // Auto-set intensities for parsed features
    const newIntensities = { ...lifestyleIntensities }
    insights.forEach(insight => {
      newIntensities[insight.value] = insight.intensity
    })
    setLifestyleIntensities(newIntensities)
  }

  // Auto-parsing with debouncing
  useEffect(() => {
    if (naturalLanguageInput.trim().length > 10) {
      const timeoutId = setTimeout(() => {
        parseNaturalLanguage(naturalLanguageInput)
      }, 1000) // 1 second debounce
      
      return () => clearTimeout(timeoutId)
    }
  }, [naturalLanguageInput])
  
  const getIntensityColor = (intensity) => {
    if (intensity >= 80) return '#dc2626' // Red - Critical
    if (intensity >= 60) return '#f59e0b' // Orange - High
    if (intensity >= 40) return '#3b82f6' // Blue - Medium
    if (intensity >= 20) return '#10b981' // Green - Low
    return '#e5e7eb' // Gray - None
  }
  
  const getIntensityLabel = (intensity) => {
    if (intensity >= 80) return 'Critical'
    if (intensity >= 60) return 'High'
    if (intensity >= 40) return 'Medium'
    if (intensity >= 20) return 'Low'
    return 'None'
  }
  
  const activeFeatures = Object.entries(lifestyleIntensities).filter(([_, intensity]) => intensity > 0)
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
            fontSize: '18px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '28px',
            textAlign: 'center'
          }}>Client</div>
          
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
            fontSize: '18px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '16px',
            textAlign: 'center'
          }}>Mode</div>
          
          <div className="mode-toggle" style={{
            display: 'flex',
            gap: '8px'
          }}>
            <div 
              className="mode-option discovery" 
              style={{
                flex: '1',
                padding: '16px 12px',
                border: selectedMode === 'discovery' ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                borderRadius: '12px',
                background: selectedMode === 'discovery' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => {
                setSelectedMode('discovery')
                onModeChange('discovery')
              }}
            >
              <div className="mode-name" style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1e293b'
              }}>Discovery</div>
            </div>
            
            <div 
              className="mode-option cma" 
              style={{
                flex: '1',
                padding: '16px 12px',
                border: selectedMode === 'cma' ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                borderRadius: '12px',
                background: selectedMode === 'cma' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => {
                setSelectedMode('cma')
                onModeChange('cma')
              }}
            >
              <div className="mode-name" style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1e293b'
              }}>CMA</div>
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
            fontSize: '18px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '28px',
            textAlign: 'center'
          }}>Address</div>
          
          <div className="address-input-container" style={{
            position: 'relative',
            marginBottom: '24px'
          }}>
            <input 
              type="text" 
              className="address-input" 
              placeholder="123 Main Street, Dallas, TX"
              defaultValue="456 Oak Avenue, Dallas"
              style={{
                width: '100%',
                padding: '18px 80px 18px 24px',
                border: '2px solid #e2e8f0',
                borderRadius: '16px',
                fontSize: '16px',
                fontWeight: '500',
                background: 'rgba(255,255,255,0.9)',
                transition: 'all 0.3s ease'
              }}
            />
            {/* Inline Action Buttons */}
            <div style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: '4px'
            }}>
              <button style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(59,130,246,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '14px'
              }}>🎤</button>
              <button style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(59,130,246,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '14px'
              }}>📍</button>
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
        </div>
        
        {/* Lifestyle Section */}
        <div className="lifestyle-section" style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '28px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)',
          border: '1px solid rgba(226,232,240,0.5)',
          marginBottom: '24px'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '800',
            color: '#1e293b',
            marginBottom: '20px',
            textAlign: 'center'
          }}>Lifestyle</div>
          
          {/* Natural Language Input */}
          <div style={{
            position: 'relative',
            marginBottom: '16px'
          }}>
            <textarea
              value={naturalLanguageInput}
              onChange={(e) => setNaturalLanguageInput(e.target.value)}
              placeholder="Example: They're looking for a downstairs master, good for entertaining, open concept living with a home office..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '16px 20px',
                border: '2px solid #e2e8f0',
                borderRadius: '16px',
                fontSize: '15px',
                fontWeight: '500',
                background: 'rgba(255,255,255,0.9)',
                transition: 'all 0.3s ease',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
            />
          </div>
          
          
          {/* Feature Sliders */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {lifestyleFeatures.map(feature => {
              const intensity = lifestyleIntensities[feature.id] || 0
              return (
                <div key={feature.id} style={{
                  padding: '16px 20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.8)',
                  transition: 'all 0.3s ease'
                }}>
                  {/* Feature Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{ fontSize: '18px' }}>{feature.icon}</span>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>{feature.label}</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: getIntensityColor(intensity),
                        minWidth: '45px',
                        textAlign: 'right'
                      }}>
                        {intensity}%
                      </div>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: '600',
                        color: getIntensityColor(intensity),
                        background: `${getIntensityColor(intensity)}20`,
                        padding: '2px 6px',
                        borderRadius: '8px',
                        minWidth: '45px',
                        textAlign: 'center'
                      }}>
                        {getIntensityLabel(intensity)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Slider */}
                  <div style={{
                    position: 'relative',
                    height: '6px',
                    background: '#e5e7eb',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    {/* Progress Fill */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${intensity}%`,
                      background: `linear-gradient(90deg, #e5e7eb, ${getIntensityColor(intensity)})`,
                      borderRadius: '3px',
                      transition: 'all 0.3s ease'
                    }}></div>
                    
                    {/* Slider Input */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={intensity}
                      onChange={(e) => updateLifestyleIntensity(feature.id, parseInt(e.target.value))}
                      style={{
                        position: 'absolute',
                        top: '-2px',
                        left: 0,
                        width: '100%',
                        height: '10px',
                        background: 'transparent',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none'
                      }}
                    />
                  </div>
                  
                  {/* Intensity Guide */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '9px',
                    color: '#94a3b8'
                  }}>
                    <span>Not Important</span>
                    <span>Critical</span>
                  </div>
                </div>
              )
            })}
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
      
      {/* Custom Slider Styles */}
      <style jsx>{`
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        
        input[type="range"]::-webkit-slider-track {
          background: transparent;
          height: 6px;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          background: white;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          transition: all 0.2s ease;
        }
        
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        input[type="range"]::-moz-range-track {
          background: transparent;
          height: 6px;
          border: none;
        }
        
        input[type="range"]::-moz-range-thumb {
          background: white;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          border: 2px solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>
      
      {/* Floating Continue Button */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        right: '20px',
        zIndex: 30
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
            boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
            backdropFilter: 'blur(10px)'
          }}
          onClick={() => onNavigate('property')}
        >
          Continue
        </div>
      </div>
    </div>
  )
}

export default AddressInputScreen