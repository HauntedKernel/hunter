import { useState } from 'react'
import LandingScreen from './components/screens/LandingScreen'
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
      case 'landing':
        return <LandingScreen onNavigate={navigateTo} />
      case 'sellers_dashboard':
      case 'seller_intelligence_area':
        return <SellersDashboardScreen onNavigate={navigateTo} />
      case 'seller_intelligence_results':
        return <SellerIntelligenceResultsScreen onNavigate={navigateTo} searchParams={navigationParams} />
      case 'campaign_details':
        return <CampaignDetailsScreen onNavigate={navigateTo} campaignId={navigationParams?.campaignId} />
      default:
        return <LandingScreen onNavigate={navigateTo} />
    }
  }

  const onLanding = currentScreen === 'home' || currentScreen === 'landing'

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="brand" onClick={() => navigateTo('home')}>Hunter</div>
        <div className="app-bar-right">
          <span className="scope-chip">📍 Dallas County</span>
          {onLanding
            ? <button className="btn btn-sm btn-primary" onClick={() => navigateTo('sellers_dashboard')}>Open tool</button>
            : <button className="btn btn-sm btn-ghost" onClick={() => navigateTo('home')}>← Home</button>}
        </div>
      </header>
      <main className="app-main">
        {renderScreen()}
      </main>
      <div id="portal-root"></div>
    </div>
  )
}

export default App
