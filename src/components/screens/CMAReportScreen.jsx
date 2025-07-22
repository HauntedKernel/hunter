import { useState, useEffect } from 'react'
import StatusBar from '../ui/StatusBar'
import Header from '../ui/Header'
import { FileText, Download, Share2, Check } from 'lucide-react'

const CMAReportScreen = ({ selectedProperties, onComplete, onBack }) => {
  const [isGenerating, setIsGenerating] = useState(true)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsGenerating(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  const avgPrice = Math.round(
    selectedProperties.reduce((sum, prop) => sum + prop.price, 0) / selectedProperties.length
  )

  const avgSqft = Math.round(
    selectedProperties.reduce((sum, prop) => sum + prop.sqft, 0) / selectedProperties.length
  )

  const avgPricePerSqft = Math.round(avgPrice / avgSqft)

  return (
    <div className="screen">
      <StatusBar />
      <Header title="CMA Report" onBack={onBack} />
      
      <div className="content" style={{ padding: 20 }}>
        {isGenerating ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60vh',
            gap: 24
          }}>
            <FileText size={64} color="#2563eb" style={{ animation: 'pulse 2s infinite' }} />
            <h2 style={{ fontSize: 20, color: '#333' }}>Generating CMA Report...</h2>
          </div>
        ) : (
          <div className="slide-up">
            <div style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              borderRadius: 20,
              padding: 24,
              marginBottom: 24,
              color: 'white',
              textAlign: 'center'
            }}>
              <Check size={48} style={{ marginBottom: 16 }} />
              <h2 style={{ fontSize: 24, marginBottom: 8 }}>
                CMA Report Ready
              </h2>
              <p style={{ fontSize: 16, opacity: 0.9 }}>
                Professional analysis complete
              </p>
            </div>

            <div style={{
              background: '#f8f9fa',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24
            }}>
              <h3 style={{ fontSize: 18, marginBottom: 16 }}>Market Summary</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingBottom: 16,
                  borderBottom: '1px solid #e5e5e5'
                }}>
                  <span style={{ color: '#666' }}>Properties Analyzed</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedProperties.length}</span>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingBottom: 16,
                  borderBottom: '1px solid #e5e5e5'
                }}>
                  <span style={{ color: '#666' }}>Average Price</span>
                  <span style={{ fontWeight: 'bold' }}>${avgPrice.toLocaleString()}</span>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingBottom: 16,
                  borderBottom: '1px solid #e5e5e5'
                }}>
                  <span style={{ color: '#666' }}>Average Size</span>
                  <span style={{ fontWeight: 'bold' }}>{avgSqft.toLocaleString()} sqft</span>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ color: '#666' }}>Price per Sqft</span>
                  <span style={{ fontWeight: 'bold' }}>${avgPricePerSqft}</span>
                </div>
              </div>
            </div>

            <div style={{
              background: '#e3f2fd',
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
              textAlign: 'center'
            }}>
              <p style={{ fontSize: 14, color: '#1976d2', lineHeight: 1.6 }}>
                Your comprehensive CMA report includes detailed property comparisons, 
                market trends, and pricing recommendations based on AI analysis.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <button
                style={{
                  flex: 1,
                  padding: 16,
                  background: 'white',
                  border: '2px solid #2563eb',
                  borderRadius: 12,
                  color: '#2563eb',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                <Download size={20} />
                Download PDF
              </button>
              
              <button
                style={{
                  flex: 1,
                  padding: 16,
                  background: 'white',
                  border: '2px solid #2563eb',
                  borderRadius: 12,
                  color: '#2563eb',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                <Share2 size={20} />
                Share Report
              </button>
            </div>

            <button onClick={onComplete} className="button">
              View Full Report
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  )
}

export default CMAReportScreen