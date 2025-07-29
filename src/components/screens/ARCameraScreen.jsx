import { useState, useEffect, useRef } from 'react'
import { Camera, X, RotateCcw, Zap, MapPin, Loader, Mic, MicOff } from 'lucide-react'

const ARCameraScreen = ({ onNavigate }) => {
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
    // Store voice input
    const analysisData = {
      voiceInput: lifestyleInput,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('arAnalysisData', JSON.stringify(analysisData))
    onNavigate('property')
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#000',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Status Bar - Dark for camera */}
      <div style={{
        height: '44px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        fontSize: '14px',
        fontWeight: '600',
        flexShrink: 0,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50
      }}>
        <span>9:41</span>
        <span>•••••</span>
        <span>100% 🔋</span>
      </div>

      {/* Close Button */}
      <div 
        className="back-button" 
        style={{
          position: 'absolute',
          top: '60px',
          left: '20px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 50
        }}
        onClick={() => onNavigate('home')}
      >
        <X size={18} color="white" />
      </div>
      
      {/* Camera Feed */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#000', // Black background for camera area
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Real Camera Video */}
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
            zIndex: 0, // Put video at base layer
            display: cameraStream && !cameraError ? 'block' : 'none'
          }}
        />
        
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
        
        
        
        {/* Combined Bottom Controls */}
        <div style={{
          position: 'absolute',
          bottom: '50px',
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

      </div>
      
      
      
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