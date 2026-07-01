import { useState, useEffect } from 'react'
import CatalogService from './services/CatalogService'
import LandingScreen from './components/screens/LandingScreen'
import SellersDashboardScreen from './components/screens/SellersDashboardScreen'
import SellerIntelligenceResultsScreen from './components/screens/SellerIntelligenceResultsScreen'
import CampaignDetailsScreen from './components/screens/CampaignDetailsScreen'
import MarketplaceScreen from './components/screens/MarketplaceScreen'

// Hunter — an off-market property finder for realtors. Single-purpose web app:
// search a Dallas County area → ranked motivated-seller leads → enrich → export.
function App() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [navigationParams, setNavigationParams] = useState({})
  const [banner, setBanner] = useState(null)   // { kind, text }

  const navigateTo = (screen, params = null) => {
    setCurrentScreen(screen)
    setNavigationParams(params || {})
    window.scrollTo(0, 0)
  }

  // Handle the return from Stripe Checkout (success_url carries ?purchase=…&session_id=…).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const purchase = p.get('purchase')
    if (!purchase) return
    const clean = () => window.history.replaceState({}, '', window.location.pathname)
    if (purchase === 'cancelled') { setBanner({ kind: 'info', text: 'Checkout cancelled — your territory is still available.' }); clean(); return }
    if (purchase === 'success') {
      setCurrentScreen('marketplace')
      const sid = p.get('session_id')
      if (sid) {
        CatalogService.confirm(sid)
          .then(r => setBanner(r.paid
            ? { kind: 'ok', text: `Welcome aboard — ${r.category ? r.category + ' in ' : ''}${r.zip?.zip || ''} is now yours. Your first list is on the way.` }
            : { kind: 'info', text: 'Payment is processing — your territory will lock in momentarily.' }))
          .catch(() => setBanner({ kind: 'ok', text: 'Thank you — your subscription is confirmed.' }))
      } else setBanner({ kind: 'ok', text: 'Thank you — your subscription is confirmed.' })
      clean()
    }
  }, [])

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
      case 'marketplace':
        return <MarketplaceScreen onNavigate={navigateTo} />
      default:
        return <LandingScreen onNavigate={navigateTo} />
    }
  }

  const isMarket = currentScreen === 'marketplace'

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="brand" onClick={() => navigateTo('home')}>Hunter</div>
        <div className="app-bar-right">
          <span className="scope-chip">Dallas County</span>
          <button className={`nav-link ${isMarket ? 'active' : ''}`} onClick={() => navigateTo('marketplace')}>Territories</button>
          <button className="btn btn-sm btn-primary" onClick={() => navigateTo('sellers_dashboard')}>Open tool</button>
        </div>
      </header>
      {banner && (
        <div className={`app-banner app-banner-${banner.kind}`} role="status">
          <span>{banner.text}</span>
          <button className="btn-ghost" style={{ padding: 2 }} onClick={() => setBanner(null)}>✕</button>
        </div>
      )}
      <main className="app-main">
        {renderScreen()}
      </main>
      <div id="portal-root"></div>
    </div>
  )
}

export default App
