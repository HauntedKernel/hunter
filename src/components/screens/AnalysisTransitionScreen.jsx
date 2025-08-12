import { useState, useEffect } from 'react'
import { Brain, Home, Search, TrendingUp, CheckCircle } from 'lucide-react'

const AnalysisTransitionScreen = ({ onNavigate, onComplete }) => {
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)

  const stages = [
    {
      id: 1,
      title: 'Analyzing Properties',
      subtitle: 'Gathering property data and market information',
      icon: Home,
      color: '#3b82f6',
      items: [
        'Property specifications',
        'Historical sales data',
        'Market comparables',
        'Neighborhood analysis'
      ]
    },
    {
      id: 2,
      title: 'Semantic Deep Dive',
      subtitle: 'AI-powered lifestyle and feature matching',
      icon: Brain,
      color: '#8b5cf6',
      items: [
        'Lifestyle analysis',
        'Feature extraction',
        'Preference matching',
        'Semantic scoring'
      ]
    },
    {
      id: 3,
      title: 'Finalizing Results',
      subtitle: 'Generating personalized property insights',
      icon: TrendingUp,
      color: '#10b981',
      items: [
        'Match calculations',
        'Ranking properties',
        'Creating insights',
        'Preparing recommendations'
      ]
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 1
        
        // Auto-advance stages based on progress
        if (newProgress === 33) setCurrentStage(1)
        if (newProgress === 66) setCurrentStage(2)
        if (newProgress >= 100) {
          clearInterval(timer)
          // Auto-navigate to results after completion
          setTimeout(() => onNavigate('results'), 500)
        }
        
        return Math.min(newProgress, 100)
      })
    }, 30) // Completes in ~3 seconds

    return () => clearInterval(timer)
  }, [onNavigate])

  const CircularProgress = ({ progress, size = 120 }) => {
    const radius = (size - 8) / 2
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#gradient)"
            strokeWidth="4"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: '900',
            color: stages[currentStage]?.color || '#3b82f6'
          }}>
            {Math.round(progress)}%
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      color: 'white'
    }}>
      
      {/* Header */}
      <div className="header-bar" style={{
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div 
          className="back-button" 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            cursor: 'pointer',
            color: 'white'
          }}
          onClick={() => onNavigate('address')}
        >←</div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: 'white'
        }}>Semantic Analysis</div>
        <div style={{ width: '36px' }}></div>
      </div>
      
      {/* Content */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        {/* Logo and Progress */}
        <div style={{ marginBottom: '40px' }}>
          <CircularProgress progress={progress} />
        </div>
        
        {/* Current Stage */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            {stages[currentStage] && (
              <>
                {(() => {
                  const IconComponent = stages[currentStage].icon
                  return (
                    <IconComponent 
                      size={32} 
                      color={stages[currentStage].color}
                      style={{
                        animation: 'pulse 2s infinite'
                      }}
                    />
                  )
                })()}
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: 'white',
                  margin: 0
                }}>
                  {stages[currentStage].title}
                </h2>
              </>
            )}
          </div>
          <p style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.7)',
            margin: 0
          }}>
            {stages[currentStage]?.subtitle}
          </p>
        </div>
        
        {/* Progress Bar */}
        <div style={{
          width: '100%',
          maxWidth: '280px',
          height: '8px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '32px'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${stages[currentStage]?.color || '#3b82f6'}, ${stages[Math.min(currentStage + 1, stages.length - 1)]?.color || '#10b981'})`,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              animation: 'shimmer 2s infinite'
            }}></div>
          </div>
        </div>
        
        {/* Analysis Items */}
        <div style={{
          width: '100%',
          maxWidth: '300px'
        }}>
          {stages[currentStage]?.items.map((item, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 0',
              opacity: progress > (currentStage * 33 + (index + 1) * 8) ? 1 : 0.3,
              transition: 'opacity 0.1s ease'
            }}>
              {progress > (currentStage * 33 + (index + 1) * 8) ? (
                <CheckCircle size={16} color="#10b981" />
              ) : (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%'
                }}></div>
              )}
              <span style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.9)'
              }}>
                {item}
              </span>
            </div>
          ))}
        </div>
        
        {progress >= 100 && (
          <div style={{
            marginTop: '32px',
            padding: '16px 24px',
            background: 'rgba(16,185,129,0.2)',
            borderRadius: '12px',
            border: '1px solid rgba(16,185,129,0.3)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '16px',
              fontWeight: '600',
              color: '#10b981'
            }}>
              <CheckCircle size={20} />
              Analysis Complete
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}

export default AnalysisTransitionScreen