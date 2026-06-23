import { useState } from 'react'
import SellersDashboardScreen from './components/screens/SellersDashboardScreen'
import SellerIntelligenceResultsScreen from './components/screens/SellerIntelligenceResultsScreen'
import CampaignDetailsScreen from './components/screens/CampaignDetailsScreen'

// Hunter — an off-market property finder for realtors. Single-purpose web app:
// search a Dallas County area → ranked motivated-seller leads → enrich → export.
function App() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [navigationParams, setNavigationParams] = useState({})

  const navigateTo = (screen, params = null) => {
    setCurrentScreen(screen)
    setNavigationParams(params || {})
    window.scrollTo(0, 0)
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
    <div className="app-shell">
      <header className="app-bar">
        <div className="brand" onClick={() => navigateTo('home')}>Hunter</div>
        <span className="scope-chip">📍 Dallas County</span>
      </header>
      <main className="app-main">
        {renderScreen()}
      </main>
      <div id="portal-root"></div>
    </div>
  )
}

export default App
