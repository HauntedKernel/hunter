import { useEffect, useState } from 'react'
import StatusBar from '../ui/StatusBar'
import Logo from '../ui/Logo'
import { Loader2, Home, TrendingUp, Brain, FileText } from 'lucide-react'

const LoadingScreen = ({ stage, onComplete }) => {
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  const stages = {
    analyzing: {
      title: 'Analyzing Market Data',
      steps: [
        { icon: Home, text: 'Searching nearby properties...' },
        { icon: TrendingUp, text: 'Analyzing market trends...' },
        { icon: Brain, text: 'Calculating property matches...' }
      ]
    },
    preparing: {
      title: 'Preparing Your Report',
      steps: [
        { icon: Brain, text: 'Running semantic analysis...' },
        { icon: FileText, text: 'Generating CMA report...' },
        { icon: TrendingUp, text: 'Finalizing recommendations...' }
      ]
    }
  }

  const currentStage = stages[stage] || stages.analyzing

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(onComplete, 500)
          return 100
        }
        return prev + 2
      })
    }, 50)

    return () => clearInterval(interval)
  }, [onComplete])

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % currentStage.steps.length)
    }, 2000)

    return () => clearInterval(stepInterval)
  }, [currentStage.steps.length])

  return (
    <div className="screen">
      <StatusBar />
      <div className="content" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 40
      }}>
        <Logo size="small" />
        
        <div style={{ textAlign: 'center', width: '100%' }}>
          <h2 style={{ fontSize: 24, marginBottom: 8, color: '#1a1a1a' }}>
            {currentStage.title}
          </h2>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 32,
            marginBottom: 40,
            height: 60
          }}>
            <Loader2 
              size={32} 
              color="#2563eb" 
              style={{ animation: 'spin 1s linear infinite' }}
            />
            <p style={{ 
              fontSize: 16, 
              color: '#666',
              animation: 'fadeIn 0.5s ease-in'
            }}>
              {currentStage.steps[currentStep].text}
            </p>
          </div>

          <div style={{
            width: '100%',
            height: 8,
            background: '#e5e5e5',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 12
          }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
                transition: 'width 0.3s ease',
                borderRadius: 4
              }}
            />
          </div>
          
          <p style={{ fontSize: 14, color: '#999' }}>
            {progress}% complete
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          width: '100%',
          maxWidth: 300
        }}>
          {currentStage.steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div
                key={index}
                style={{
                  padding: 16,
                  background: currentStep === index ? '#e3f2fd' : '#f5f5f5',
                  borderRadius: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.3s ease',
                  transform: currentStep === index ? 'scale(1.05)' : 'scale(1)'
                }}
              >
                <Icon 
                  size={24} 
                  color={currentStep === index ? '#2563eb' : '#999'} 
                />
                <span style={{ 
                  fontSize: 10, 
                  color: currentStep === index ? '#1976d2' : '#666',
                  textAlign: 'center'
                }}>
                  Step {index + 1}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

export default LoadingScreen