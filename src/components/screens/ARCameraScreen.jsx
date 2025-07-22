import { useState, useEffect } from 'react'
import { Camera, X, RotateCcw, Zap, MapPin, Loader } from 'lucide-react'

const ARCameraScreen = ({ onNavigate }) => {
  const [isScanning, setIsScanning] = useState(false)
  const [detectedProperty, setDetectedProperty] = useState(null)
  const [scanProgress, setScanProgress] = useState(0)

  // Simulate AR scanning process
  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        setScanProgress(prev => {
          const newProgress = prev + 2
          if (newProgress >= 100) {
            setIsScanning(false)
            setDetectedProperty({
              address: '456 Oak Avenue',
              city: 'Dallas, TX',
              confidence: 94
            })
            clearInterval(interval)
            return 100
          }
          return newProgress
        })
      }, 50)
      return () => clearInterval(interval)
    }
  }, [isScanning])

  const startScan = () => {
    setIsScanning(true)
    setScanProgress(0)
    setDetectedProperty(null)
  }

  const resetScan = () => {
    setIsScanning(false)
    setScanProgress(0)
    setDetectedProperty(null)
  }

  const confirmProperty = () => {
    onNavigate('property')
  }

  return (
    <div className="screen" style={{
      width: '100%',
      height: '100%',
      background: '#000000',
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
        color: 'white',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
        zIndex: 30
      }}>
        <span>9:41</span>
        <span>••••• </span>
        <span>100% 🔋</span>
      </div>
      
      {/* Header */}
      <div className="header-bar" style={{
        padding: '16px 20px',
        background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'absolute',
        top: '44px',
        left: 0,
        right: 0,
        zIndex: 30
      }}>
        <div 
          className="back-button" 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
          onClick={() => onNavigate('home')}
        >
          <X size={18} color="white" />
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: 'white',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)'
        }}>AR Property Scan</div>
        <div 
          className="reset-button" 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
          onClick={resetScan}
        >
          <RotateCcw size={18} color="white" />
        </div>
      </div>
      
      {/* Camera Placeholder */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: 'linear-gradient(45deg, #1a1a1a, #2a2a2a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Camera Feed Simulation */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          opacity: 0.3
        }}></div>
        
        {/* Scanning Grid Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
          animation: isScanning ? 'pulse 2s infinite' : 'none',
          zIndex: 10
        }}></div>
        
        {/* Center Viewfinder */}
        <div style={{
          width: '240px',
          height: '180px',
          border: '2px solid rgba(59,130,246,0.8)',
          borderRadius: '16px',
          position: 'relative',
          zIndex: 20,
          animation: isScanning ? 'scan-pulse 1.5s infinite' : 'none'
        }}>
          {/* Corner markers */}
          {[
            { top: '-2px', left: '-2px', borderTop: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6' },
            { top: '-2px', right: '-2px', borderTop: '4px solid #3b82f6', borderRight: '4px solid #3b82f6' },
            { bottom: '-2px', left: '-2px', borderBottom: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6' },
            { bottom: '-2px', right: '-2px', borderBottom: '4px solid #3b82f6', borderRight: '4px solid #3b82f6' }
          ].map((style, index) => (
            <div key={index} style={{
              position: 'absolute',
              width: '16px',
              height: '16px',
              ...style
            }}></div>
          ))}
          
          {/* Center crosshair */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '20px',
            height: '20px',
            border: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: isScanning ? 'pulse 1s infinite' : 'none'
          }}></div>
        </div>
        
        {/* Scanning Progress */}
        {isScanning && (
          <div style={{
            position: 'absolute',
            bottom: '160px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            padding: '12px 20px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 25
          }}>
            <Loader size={16} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: '600'
            }}>Scanning... {scanProgress}%</span>
          </div>
        )}
        
        {/* Property Detection Result */}
        {detectedProperty && (
          <div style={{
            position: 'absolute',
            bottom: '120px',
            left: '20px',
            right: '20px',
            background: 'rgba(16,185,129,0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(16,185,129,0.3)',
            zIndex: 25,
            animation: 'slideUp 0.5s ease'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px'
            }}>
              <MapPin size={20} color="white" />
              <div style={{
                color: 'white',
                fontSize: '16px',
                fontWeight: '700'
              }}>Property Detected!</div>
            </div>
            <div style={{
              color: 'white',
              fontSize: '14px',
              marginBottom: '4px'
            }}>{detectedProperty.address}</div>
            <div style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: '12px',
              marginBottom: '12px'
            }}>{detectedProperty.city} • {detectedProperty.confidence}% confidence</div>
            <button 
              style={{
                width: '100%',
                background: 'white',
                color: '#16a34a',
                border: 'none',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              onClick={confirmProperty}
            >
              Continue with Property Analysis
            </button>
          </div>
        )}
      </div>
      
      {/* Bottom Controls */}
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '20px',
        right: '20px',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 30
      }}>
        {!isScanning && !detectedProperty && (
          <button 
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: '4px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
              transition: 'all 0.3s ease'
            }}
            onClick={startScan}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          >
            <Camera size={32} color="white" />
          </button>
        )}
      </div>
      
      {/* Instructions */}
      {!isScanning && !detectedProperty && (
        <div style={{
          position: 'absolute',
          bottom: '140px',
          left: '20px',
          right: '20px',
          textAlign: 'center',
          zIndex: 25
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
            padding: '16px 20px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              color: 'white',
              fontSize: '16px',
              fontWeight: '700',
              marginBottom: '4px'
            }}>Point camera at property</div>
            <div style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '14px'
            }}>Align the building within the viewfinder</div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes scan-pulse {
          0%, 100% { 
            box-shadow: 0 0 0 0 rgba(59,130,246,0.7);
          }
          50% { 
            box-shadow: 0 0 0 10px rgba(59,130,246,0);
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes slideUp {
          from { 
            transform: translateY(100%);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export default ARCameraScreen