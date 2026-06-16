import { useState } from 'react'
import SellersDashboardScreen from './components/screens/SellersDashboardScreen'
import SellerIntelligenceResultsScreen from './components/screens/SellerIntelligenceResultsScreen'
import CampaignDetailsScreen from './components/screens/CampaignDetailsScreen'

// Hunter — an off-market property finder for realtors. Single-purpose app:
// search a Dallas County area → ranked motivated-seller leads → enrich → export.
function App() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [navigationParams, setNavigationParams] = useState({})

  const navigateTo = (screen, params = null) => {
    setCurrentScreen(screen)
    setNavigationParams(params || {})
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
      case 'sellers_dashboard':
      case 'seller_intelligence_area':
        return <SellersDashboardScreen onNavigate={navigateTo} />
      case 'seller_intelligence_results':
        return <SellerIntelligenceResultsScreen onNavigate={navigateTo} searchParams={navigationParams} />
      case 'campaign_details':
        return <CampaignDetailsScreen onNavigate={navigateTo} campaignId={navigationParams?.campaignId} />
      default:
        return <SellersDashboardScreen onNavigate={navigateTo} />
    }
  }

  return (
    <div className="app">
      <div className="phone-frame">
        <div className="screen" style={{
          width: '100%',
          height: '100%',
          background: '#fff',
          borderRadius: '32px',
          display: 'flex',
          flexDirection: 'column'
        }}>

          {/* Global Status Bar */}
          <div className="status-bar" style={{
            height: '44px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 20px',
            color: '#1e293b',
            background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
            borderRadius: '32px 32px 0 0',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            <span>9:41</span>
            <span>••••• </span>
            <span>100% 🔋</span>
          </div>

          {/* Header: Hunter brand + Dallas County scope */}
          <div style={{ position: 'relative', zIndex: 1000 }}>
            <div style={{
              height: '60px',
              background: 'white',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 20px',
              flexShrink: 0
            }}>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  cursor: 'pointer',
                  userSelect: 'none',
                  letterSpacing: '-0.5px'
                }}
                onClick={() => navigateTo('home')}
              >
                🎯 Hunter
              </div>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#15803d',
                background: 'rgba(22,163,74,0.1)',
                border: '1px solid rgba(22,163,74,0.25)',
                borderRadius: '12px',
                padding: '4px 10px'
              }}>
                📍 Dallas County
              </div>
            </div>
          </div>

          {/* Screen Content */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            background: '#f8fafc'
          }}>
            {renderScreen()}
          </div>
        </div>
      </div>

      {/* Portal container for dropdowns */}
      <div id="portal-root"></div>
    </div>
  )
}

export default App
