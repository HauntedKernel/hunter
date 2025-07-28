import { useState, useEffect, useRef } from 'react'
import { Camera, X, RotateCcw, Zap, MapPin, Loader, Mic, MicOff } from 'lucide-react'

const ARCameraScreen = ({ onNavigate }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [detectedFeatures, setDetectedFeatures] = useState([])
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [lifestyleInput, setLifestyleInput] = useState('')
  const [recognition, setRecognition] = useState(null)
  const [retryAttempts, setRetryAttempts] = useState(0)
  const videoRef = useRef(null)

  const retryCamera = () => {
    console.log('Manual camera retry...')
    setCameraError(null)
    setCameraStream(null)
    setRetryAttempts(prev => prev + 1)
  }

  // Initialize camera with multiple fallback attempts
  useEffect(() => {
    const initCamera = async () => {
      console.log('Attempting to initialize camera...')
      
      // Check if getUserMedia is supported with better detection
      if (!navigator.mediaDevices) {
        if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) {
          console.log('Using legacy getUserMedia')
          // Try legacy getUserMedia as fallback
          const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia
          try {
            const stream = await new Promise((resolve, reject) => {
              getUserMedia.call(navigator, { video: true }, resolve, reject)
            })
            setCameraStream(stream)
            setCameraError(null)
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              videoRef.current.onloadedmetadata = () => {
                videoRef.current.play().catch(e => console.log('Video play error:', e))
              }
            }
            return
          } catch (error) {
            console.error('Legacy camera failed:', error)
            setCameraError('Camera access failed - please allow permissions')
            return
          }
        } else {
          setCameraError('Camera not supported - try Chrome or Safari')
          return
        }
      }
      
      if (!navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API not available - check browser settings')
        return
      }

      try {
        // First attempt: back camera with specific constraints
        console.log('Trying back camera...')
        let stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        })
        
        console.log('Back camera success!')
        setCameraStream(stream)
        setCameraError(null)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Force video to load and play
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => console.log('Video play error:', e))
          }
        }
        return
        
      } catch (error) {
        console.error('Back camera failed:', error)
        
        try {
          // Second attempt: any camera
          console.log('Trying any camera...')
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            audio: false
          })
          
          console.log('Any camera success!')
          setCameraStream(stream)
          setCameraError(null)
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().catch(e => console.log('Video play error:', e))
            }
          }
          return
          
        } catch (error2) {
          console.error('Any camera failed:', error2)
          
          try {
            // Third attempt: basic video only
            console.log('Trying basic video...')
            const stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            })
            
            console.log('Basic video success!')
            setCameraStream(stream)
            setCameraError(null)
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              videoRef.current.onloadedmetadata = () => {
                videoRef.current.play().catch(e => console.log('Video play error:', e))
              }
            }
            return
            
          } catch (error3) {
            console.error('All camera attempts failed:', error3)
            setCameraError(`Camera error: ${error3.name} - ${error3.message}. Try refreshing or using a different browser.`)
          }
        }
      }
    }

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(initCamera, 100)

    // Cleanup camera on unmount
    return () => {
      clearTimeout(timer)
      if (cameraStream) {
        console.log('Cleaning up camera stream')
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [retryAttempts]) // Re-run when retry is triggered

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      
      recognitionInstance.continuous = true
      recognitionInstance.interimResults = true
      recognitionInstance.lang = 'en-US'
      
      recognitionInstance.onresult = (event) => {
        let finalTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          }
        }
        if (finalTranscript) {
          setLifestyleInput(prev => prev + ' ' + finalTranscript)
        }
      }
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
      }
      
      recognitionInstance.onend = () => {
        setIsRecording(false)
      }
      
      setRecognition(recognitionInstance)
    }
  }, [])

  // Simulate lifestyle analysis process
  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setAnalysisProgress(prev => {
          const newProgress = prev + 3
          if (newProgress >= 100) {
            setIsAnalyzing(false)
            setAnalysisComplete(true)
            // Simulate detected lifestyle features
            setDetectedFeatures([
              'Open concept layout',
              'Large kitchen island', 
              'Natural light',
              'Outdoor living space',
              'Modern finishes'
            ])
            clearInterval(interval)
            return 100
          }
          return newProgress
        })
      }, 80)
      return () => clearInterval(interval)
    }
  }, [isAnalyzing])

  const startAnalysis = () => {
    setIsAnalyzing(true)
    setAnalysisProgress(0)
    setAnalysisComplete(false)
    setDetectedFeatures([])
  }

  const resetAnalysis = () => {
    setIsAnalyzing(false)
    setAnalysisProgress(0) 
    setAnalysisComplete(false)
    setDetectedFeatures([])
  }

  const toggleRecording = () => {
    if (!recognition) return
    
    if (isRecording) {
      recognition.stop()
      setIsRecording(false)
    } else {
      recognition.start()
      setIsRecording(true)
    }
  }

  const findMatches = () => {
    // Store both voice input and detected visual features
    const analysisData = {
      voiceInput: lifestyleInput,
      visualFeatures: detectedFeatures,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('arAnalysisData', JSON.stringify(analysisData))
    onNavigate('property')
  }

  return (
    <div className="screen" style={{
      width: '100%',
      height: '100%',
      background: 'transparent', // Changed from black
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
        zIndex: 50
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
        zIndex: 50
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
        }}>AR Lifestyle Analysis</div>
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
          onClick={resetAnalysis}
        >
          <RotateCcw size={18} color="white" />
        </div>
      </div>
      
      {/* Camera Feed */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: 'transparent', // Changed from black to transparent
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Real Camera Video */}
        {cameraStream && !cameraError ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror the video for better UX
              zIndex: 0 // Put video at base layer
            }}
          />
        ) : (
          <>
            {/* Fallback Camera Simulation - Removed */}
            
            {/* Camera Error Message */}
            {cameraError && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(220, 38, 38, 0.9)',
                color: 'white',
                padding: '16px 20px',
                borderRadius: '12px',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: '600',
                zIndex: 15,
                maxWidth: '300px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  {cameraError}
                </div>
                <button
                  onClick={retryCamera}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginRight: '8px'
                  }}
                >
                  Retry Camera
                </button>
                <div style={{ 
                  marginTop: '8px', 
                  fontSize: '11px', 
                  opacity: 0.8 
                }}>
                  Attempts: {retryAttempts + 1}
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Scanning Grid Overlay - Removed for cleaner view */}
        {/* <div style={{
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
          animation: isAnalyzing ? 'pulse 2s infinite' : 'none',
          zIndex: 10
        }}></div> */}
        
        {/* Center Viewfinder - Removed for cleaner view */}
        {/* <div style={{
          width: '240px',
          height: '180px',
          border: '2px solid rgba(59,130,246,0.8)',
          borderRadius: '16px',
          position: 'relative',
          zIndex: 20,
          animation: isAnalyzing ? 'scan-pulse 1.5s infinite' : 'none'
        }}>
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
          
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '20px',
            height: '20px',
            border: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: isAnalyzing ? 'pulse 1s infinite' : 'none'
          }}></div>
        </div> */}
        
        {/* Analysis Progress */}
        {isAnalyzing && (
          <div style={{
            position: 'absolute',
            bottom: '300px',
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
            }}>Analyzing lifestyle features... {analysisProgress}%</span>
          </div>
        )}
        
        {/* Combined Bottom Controls */}
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <input
            type="text"
            value={lifestyleInput}
            onChange={(e) => setLifestyleInput(e.target.value)}
            placeholder={isRecording ? "Listening..." : "Describe preferences..."}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          
          <button
            onClick={toggleRecording}
            style={{
              background: isRecording ? '#ef4444' : '#3b82f6',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              animation: isRecording ? 'pulse 1.5s infinite' : 'none',
              flexShrink: 0
            }}
          >
            {isRecording ? <MicOff size={18} color="white" /> : <Mic size={18} color="white" />}
          </button>
          
          <button
            onClick={() => onNavigate('property')}
            style={{
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
              transition: 'all 0.3s ease',
              flexShrink: 0
            }}
          >
            <Zap size={18} color="white" />
          </button>
        </div>

        {/* Lifestyle Analysis Results */}
        {analysisComplete && (
          <div style={{
            position: 'absolute',
            bottom: '100px',
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
              marginBottom: '12px'
            }}>
              <Zap size={20} color="white" />
              <div style={{
                color: 'white',
                fontSize: '16px',
                fontWeight: '700'
              }}>Analysis Complete!</div>
            </div>
            
            <div style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: '12px',
              marginBottom: '12px'
            }}>Detected lifestyle features:</div>
            
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '12px'
            }}>
              {detectedFeatures.map((feature, index) => (
                <span key={index} style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {feature}
                </span>
              ))}
            </div>
            
            {lifestyleInput && (
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '8px 12px',
                marginBottom: '12px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.9)'
              }}>
                <strong>Voice input:</strong> {lifestyleInput.substring(0, 80)}{lifestyleInput.length > 80 ? '...' : ''}
              </div>
            )}
            
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
              onClick={findMatches}
            >
              Find Matching Properties
            </button>
          </div>
        )}
      </div>
      
      {/* Bottom spacing */}
      <div style={{ height: '80px' }}></div>
      
      
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