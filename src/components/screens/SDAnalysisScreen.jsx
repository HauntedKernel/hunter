import StatusBar from '../ui/StatusBar'
import Header from '../ui/Header'
import { Brain, TrendingUp, Home, Users } from 'lucide-react'

const SDAnalysisScreen = ({ selectedProperties, onContinue, onBack }) => {
  const insights = {
    marketTrend: 'Strong Seller\'s Market',
    avgPriceChange: '+4.8%',
    demandLevel: 'High',
    inventoryStatus: 'Low',
    recommendations: [
      'Price competitively - market is moving fast',
      'Highlight unique features in listing',
      'Consider staging for maximum appeal',
      'Be prepared for multiple offers'
    ]
  }

  return (
    <div className="screen">
      <StatusBar />
      <Header title="Semantic Analysis" onBack={onBack} />
      
      <div className="content" style={{ padding: 20 }}>
        <div className="slide-up">
          <div style={{
            background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
            borderRadius: 20,
            padding: 24,
            marginBottom: 24,
            textAlign: 'center'
          }}>
            <Brain size={48} color="#2563eb" style={{ marginBottom: 16 }} />
            <h2 style={{ fontSize: 24, marginBottom: 8, color: '#1e40af' }}>
              AI Analysis Complete
            </h2>
            <p style={{ fontSize: 16, color: '#3730a3' }}>
              {selectedProperties.length} properties analyzed
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            marginBottom: 24
          }}>
            <div style={{
              background: '#f0fdf4',
              padding: 20,
              borderRadius: 16,
              textAlign: 'center'
            }}>
              <TrendingUp size={32} color="#16a34a" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#16a34a' }}>
                {insights.avgPriceChange}
              </p>
              <p style={{ fontSize: 12, color: '#666' }}>Avg Price Change</p>
            </div>
            
            <div style={{
              background: '#fef3c7',
              padding: 20,
              borderRadius: 16,
              textAlign: 'center'
            }}>
              <Home size={32} color="#d97706" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#d97706' }}>
                {insights.inventoryStatus}
              </p>
              <p style={{ fontSize: 12, color: '#666' }}>Inventory</p>
            </div>
            
            <div style={{
              background: '#fee2e2',
              padding: 20,
              borderRadius: 16,
              textAlign: 'center'
            }}>
              <Users size={32} color="#dc2626" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#dc2626' }}>
                {insights.demandLevel}
              </p>
              <p style={{ fontSize: 12, color: '#666' }}>Demand</p>
            </div>
            
            <div style={{
              background: '#f3e8ff',
              padding: 20,
              borderRadius: 16,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
              <p style={{ fontSize: 18, fontWeight: 'bold', color: '#7c3aed' }}>
                {insights.marketTrend}
              </p>
            </div>
          </div>

          <div style={{
            background: '#f8f9fa',
            borderRadius: 16,
            padding: 24,
            marginBottom: 24
          }}>
            <h3 style={{ fontSize: 18, marginBottom: 16 }}>
              AI Recommendations
            </h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {insights.recommendations.map((rec, index) => (
                <li key={index} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 12
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: 24,
                    height: 24,
                    background: '#2563eb',
                    color: 'white',
                    borderRadius: 12,
                    textAlign: 'center',
                    lineHeight: '24px',
                    fontSize: 12,
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </span>
                  <p style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>
                    {rec}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <button onClick={onContinue} className="button">
            Generate CMA Report
          </button>
        </div>
      </div>
    </div>
  )
}

export default SDAnalysisScreen