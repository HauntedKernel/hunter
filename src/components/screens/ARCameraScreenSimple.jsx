import { useState, useEffect, useRef } from 'react'
import { X, Zap, Mic, MicOff } from 'lucide-react'

const ARCameraScreen = ({ onNavigate }) => {
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [lifestyleInput, setLifestyleInput] = useState('')
  const [recognition, setRecognition] = useState(null)
  const videoRef = useRef(null)

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera not supported')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        })
        
        setCameraStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Camera error:', error)
        setCameraError('Camera access denied')
      }
    }

    initCamera()

    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

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
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }
        
        if (finalTranscript) {
          setLifestyleInput(prev => {
            const newText = prev + ' ' + finalTranscript
            console.log('Final transcript:', finalTranscript)
            return newText.trim()
          })
        }
      }
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
        if (event.error === 'not-allowed') {
          alert('Microphone permission denied. Please allow microphone access.')
        }
      }
      
      recognitionInstance.onend = () => {
        setIsRecording(false)
      }
      
      setRecognition(recognitionInstance)
    }
  }, [])

  const toggleRecording = () => {
    if (!recognition) {
      console.log('Speech recognition not available')
      alert('Speech recognition is not available in your browser')
      return
    }
    
    if (isRecording) {
      recognition.stop()
      setIsRecording(false)
    } else {
      try {
        recognition.start()
        setIsRecording(true)
        console.log('Started recording...')
      } catch (error) {
        console.error('Error starting recognition:', error)
        alert('Error starting voice recognition. Please check microphone permissions.')
      }
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%'
    }}>
      {/* Camera Video */}
      {cameraStream ? (
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
            objectFit: 'cover'
          }}
        />
      ) : (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}>
          {cameraError || 'Loading camera...'}
        </div>
      )}

      {/* Close button */}
      <button
        onClick={() => onNavigate('home')}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(0,0,0,0.5)',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <X size={20} color="white" />
      </button>

      {/* Bottom Controls */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '20px',
        right: '20px',
        background: 'rgba(0,0,0,0.7)',
        borderRadius: '12px',
        padding: '12px',
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
            padding: '10px',
            color: 'white',
            fontSize: '16px',
            outline: 'none'
          }}
        />
        
        <button
          onClick={toggleRecording}
          style={{
            background: isRecording ? '#ef4444' : '#3b82f6',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
            animation: isRecording ? 'pulse 1.5s infinite' : 'none'
          }}
        >
          {isRecording ? <MicOff size={20} color="white" /> : <Mic size={20} color="white" />}
          {isRecording && (
            <div style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '12px',
              height: '12px',
              background: '#ef4444',
              borderRadius: '50%',
              animation: 'pulse 1s infinite'
            }} />
          )}
        </button>
        
        <button
          onClick={() => onNavigate('property')}
          style={{
            background: '#16a34a',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Zap size={20} color="white" />
        </button>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}

export default ARCameraScreen