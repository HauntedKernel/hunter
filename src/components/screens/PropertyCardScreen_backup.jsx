import { useState, useEffect, useCallback } from 'react'
import { GestureProvider } from '../../contexts/GestureContext'
import SwipeableCard from '../SwipeableCard'

const PropertyCardScreen = ({ onNavigate }) => {
  const [currentPropertyIndex, setCurrentPropertyIndex] = useState(0)
  const [propertySelections, setPropertySelections] = useState({})
  const [showDetail, setShowDetail] = useState(false)
  
  // Mock properties data with color coding
  const properties = [
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
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      thumbnail: 'linear-gradient(45deg, #667eea, #764ba2)',
      lifestyleAnalysis: {
        tags: ['Entertainment Focused', 'Open Concept', 'Outdoor Living', 'Gourmet Kitchen', 'Master Suite'],
        description: 'Perfect for entertaining with open concept living and gourmet kitchen flowing to covered patio. Master suite with spa-like bathroom and walk-in closet. Premium finishes throughout including hardwood floors and granite countertops.'
      }
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
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      thumbnail: 'linear-gradient(45deg, #f093fb, #f5576c)',
      lifestyleAnalysis: {
        tags: ['Modern Design', 'Updated Kitchen', 'Garden View', 'Smart Home', 'Energy Efficient'],
        description: 'Contemporary home with smart technology and energy-efficient features. Updated kitchen with quartz countertops and stainless appliances. Private garden with mature landscaping perfect for relaxation.'
      }
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
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      thumbnail: 'linear-gradient(45deg, #4facfe, #00f2fe)',
      lifestyleAnalysis: {
        tags: ['Luxury Living', 'Home Office', 'Walk-in Pantry', 'Multiple Living Areas', 'Premium Finishes'],
        description: 'Luxury new construction featuring high-end finishes and flexible living spaces. Dedicated home office and multiple living areas. Walk-in pantry and premium appliances throughout.'
      }
    },
    {
      id: 4,
      address: '654 Elm Court',
      city: 'Dallas, TX',
      price: 399000,
      beds: 3,
      baths: 2,
      sqft: 1950,
      yearBuilt: 2019,
      status: 'ACTIVE',
      daysOnMarket: 22,
      pricePerSqft: 205,
      match: 81,
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      thumbnail: 'linear-gradient(45deg, #a8edea, #fed6e3)',
      lifestyleAnalysis: {
        tags: ['First-Time Buyer', 'Low Maintenance', 'Open Floor Plan', 'Two-Car Garage', 'Community Pool'],
        description: 'Perfect starter home with open floor plan and low-maintenance living. Community amenities include pool and playground. Ideal for first-time buyers seeking modern convenience.'
      }
    },
    {
      id: 5,
      address: '987 Cedar Lane',
      city: 'Dallas, TX',
      price: 575000,
      beds: 5,
      baths: 4,
      sqft: 3100,
      yearBuilt: 2017,
      status: 'SOLD',
      daysOnMarket: 14,
      pricePerSqft: 185,
      match: 79,
      gradient: 'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)',
      thumbnail: 'linear-gradient(45deg, #fad0c4, #ffd1ff)',
      lifestyleAnalysis: {
        tags: ['Family Home', 'Large Lot', 'Game Room', 'Study', 'Three-Car Garage'],
        description: 'Spacious family home on large lot with room to grow. Dedicated study and game room for family activities. Three-car garage and extensive storage throughout.'
      }
    }
  ]
  
  const currentProperty = properties[currentPropertyIndex]
  
  const handlePropertySelection = useCallback((action) => {
    const propertyId = currentProperty.id
    console.log('handlePropertySelection called:', { action, propertyId, currentPropertyIndex })
    
    setPropertySelections(prev => {
      const newSelections = {
        ...prev,
        [propertyId]: action
      }
      console.log('Updated selections:', newSelections)
      return newSelections
    })
    
    // Move to next property if not at the end
    if (currentPropertyIndex < properties.length - 1) {
      console.log('Moving to next property:', currentPropertyIndex + 1)
      setCurrentPropertyIndex(currentPropertyIndex + 1)
    } else {
      console.log('Already at last property')
    }
  }, [currentProperty.id, currentPropertyIndex, properties.length])
  
  // Touch handlers for swipe detection
  const handleTouchStart = (e) => {
    console.log('Touch start event triggered!')
    e.preventDefault()
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
    console.log('Touch start X:', e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e) => {
    console.log('Touch move event triggered!')
    e.preventDefault()
    setTouchEnd(e.targetTouches[0].clientX)
    console.log('Touch move X:', e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    console.log('Touch end event triggered!')
    if (!touchStart || !touchEnd) {
      console.log('Touch end - missing data:', { touchStart, touchEnd })
      return
    }
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 30  // Reduced from 50 to 30
    const isRightSwipe = distance < -30 // Reduced from 50 to 30
    
    console.log('Touch end - Start:', touchStart, 'End:', touchEnd, 'Distance:', distance)

    if (isLeftSwipe) {
      console.log('Left swipe detected - declining property')
      handlePropertySelection('declined')
    } else if (isRightSwipe) {
      console.log('Right swipe detected - selecting property')
      handlePropertySelection('selected')
    } else {
      console.log('No swipe detected - distance too small')
    }
  }

  // Mouse handlers for desktop testing
  const handleMouseDown = (e) => {
    console.log('Mouse down event triggered!')
    setTouchEnd(null)
    setTouchStart(e.clientX)
    console.log('Mouse down X:', e.clientX)
  }

  const handleMouseMove = (e) => {
    if (touchStart !== null) {
      console.log('Mouse move event triggered!')
      setTouchEnd(e.clientX)
      console.log('Mouse move X:', e.clientX)
    }
  }

  const handleMouseUp = () => {
    console.log('Mouse up event triggered!')
    if (!touchStart || !touchEnd) {
      console.log('Mouse up - missing data:', { touchStart, touchEnd })
      return
    }
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 30  // Reduced from 50 to 30
    const isRightSwipe = distance < -30 // Reduced from 50 to 30
    
    console.log('Mouse up - Start:', touchStart, 'End:', touchEnd, 'Distance:', distance)

    if (isLeftSwipe) {
      console.log('Left drag detected - declining property')
      handlePropertySelection('declined')
    } else if (isRightSwipe) {
      console.log('Right drag detected - selecting property')
      handlePropertySelection('selected')
    } else {
      console.log('No drag detected - distance too small')
    }
    
    setTouchStart(null)
    setTouchEnd(null)
  }
  
  const getThumbnailColor = (property) => {
    const selection = propertySelections[property.id]
    if (selection === 'selected') {
      return '#16a34a' // Green for selected
    } else if (selection === 'declined') {
      return '#dc2626' // Red for declined
    }
    return property.thumbnail // Default color
  }

  // Add keyboard shortcuts for testing
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'ArrowLeft') {
        handlePropertySelection('declined')
      } else if (event.key === 'ArrowRight') {
        handlePropertySelection('selected')
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [handlePropertySelection])

  // Test function to manually trigger selection
  window.testSelection = (action) => {
    handlePropertySelection(action)
  }
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
          color: '#1e293b',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>Select</div>
        <div style={{ width: '36px' }}></div>
      </div>
      
      {/* Property Thumbnails Navigation Bar */}
      <div style={{
        background: 'white',
        padding: '12px 20px',
        borderBottom: '1px solid rgba(226,232,240,0.5)',
        position: 'sticky',
        top: '120px',
        zIndex: 20
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {properties.map((property, index) => (
            <div
              key={property.id}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: getThumbnailColor(property),
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: index === currentPropertyIndex ? '2px solid #3b82f6' : '2px solid transparent',
                transform: index === currentPropertyIndex ? 'scale(1.1)' : 'scale(1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => setCurrentPropertyIndex(index)}
            >
              {/* Property number */}
              <div style={{
                position: 'absolute',
                top: '2px',
                left: '2px',
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                fontSize: '10px',
                fontWeight: '700',
                padding: '2px 4px',
                borderRadius: '4px',
                minWidth: '14px',
                textAlign: 'center'
              }}>
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div 
        style={{
          flex: '1',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
        {/* Property Card */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => console.log('Property card clicked!')}
          style={{
            background: 'white',
            margin: '20px',
            borderRadius: '24px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
            border: propertySelections[currentProperty.id] === 'selected' ? '3px solid #16a34a' :
                    propertySelections[currentProperty.id] === 'declined' ? '3px solid #dc2626' :
                    'none',
            overflow: 'hidden',
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none' // This should help with touch events
          }}
        >
          {/* Selection Status Banner */}
          {propertySelections[currentProperty.id] && (
            <div style={{
              background: propertySelections[currentProperty.id] === 'selected' ? '#16a34a' : '#dc2626',
              color: 'white',
              padding: '8px 16px',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: '700'
            }}>
              {propertySelections[currentProperty.id] === 'selected' ? '✓ SELECTED' : '✗ DECLINED'}
            </div>
          )}
          
          
          {/* Property Image */}
          <div style={{
            height: '280px',
            background: currentProperty.gradient,
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
                background: currentProperty.status === 'SOLD' ? 'rgba(16,185,129,0.9)' : 
                           currentProperty.status === 'ACTIVE' ? 'rgba(59,130,246,0.9)' : 'rgba(245,158,11,0.9)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                backdropFilter: 'blur(10px)'
              }}>{currentProperty.status}</div>
              <div style={{
                background: 'rgba(59,130,246,0.9)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                backdropFilter: 'blur(10px)'
              }}>{currentProperty.match}% match</div>
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
              }}>${currentProperty.price.toLocaleString()}</div>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                opacity: '0.9',
                textShadow: '0 1px 4px rgba(0,0,0,0.5)'
              }}>
                {currentProperty.status === 'SOLD' ? `Sold ${currentProperty.daysOnMarket} days ago` : 
                 currentProperty.status === 'ACTIVE' ? `Active for ${currentProperty.daysOnMarket} days` :
                 `Pending for ${currentProperty.daysOnMarket} days`}
              </div>
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
            }}>{currentProperty.address}, {currentProperty.city}</div>
            
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
                <span>{currentProperty.beds} BR</span>
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
                <span>{currentProperty.baths} BA</span>
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
                <span>{currentProperty.sqft.toLocaleString()} sq ft</span>
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
                <span>Built {currentProperty.yearBuilt}</span>
              </div>
            </div>
            
            {/* Lifestyle Analysis in Card */}
            <div style={{
              background: 'linear-gradient(135deg, #dbeafe, #dcfce7)',
              borderRadius: '16px',
              padding: '20px',
              border: '1px solid #3b82f6'
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '800',
                color: '#1d4ed8',
                marginBottom: '12px',
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
                gap: '6px',
                marginBottom: '12px'
              }}>
                {currentProperty.lifestyleAnalysis.tags.map((tag, index) => (
                  <div key={index} style={{
                    background: '#3b82f6',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>{tag}</div>
                ))}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#374151',
                lineHeight: '1.5',
                fontStyle: 'italic'
              }}>
                {currentProperty.lifestyleAnalysis.description}
              </div>
            </div>
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
          marginBottom: '100px'
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
        </div>
      </div>
      
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
          onClick={() => onNavigate('analysis')}
        >
          Continue
        </div>
      </div>
    </div>
  )
}

export default PropertyCardScreen