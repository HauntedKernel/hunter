import { useState, useEffect } from 'react'
import HomeScreen from './components/screens/HomeScreen'
import AddressInputScreen from './components/screens/AddressInputScreen'
import ARCameraScreen from './components/screens/ARCameraScreen'
import DocumentScreen from './components/screens/DocumentScreen'
import AnalysisTransitionScreen from './components/screens/AnalysisTransitionScreen'
import PropertyCardScreen from './components/screens/PropertyCardScreen'
import ResultsScreen from './components/screens/ResultsScreen'
import ShareViewScreen from './components/screens/ShareViewScreen'
import UserMenu from './components/UserMenu'
import { ProfileScreen, ClientsScreen, CMAsScreen, SettingsScreen } from './components/screens/MenuScreens'
import SellersDashboardScreen from './components/screens/SellersDashboardScreen'
import SellerIntelligenceResultsScreen from './components/screens/SellerIntelligenceResultsScreen'
import CampaignDetailsScreen from './components/screens/CampaignDetailsScreen'
import PropertyIntelligenceScreen from './components/screens/PropertyIntelligenceScreen'

function App() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [previousScreen, setPreviousScreen] = useState(null)
  const [analysisMode, setAnalysisMode] = useState('discovery') // 'discovery' or 'cma'
  const [shareId, setShareId] = useState(null)
  const [navigationParams, setNavigationParams] = useState({})
  const [userProfile, setUserProfile] = useState({
    firstName: 'Jane',
    lastName: 'Doe',
    initials: 'JD',
    company: 'Rocket Realty',
    email: 'jane.doe@rocketrealty.com'
  })

  // Check for share URLs on app load
  useEffect(() => {
    const path = window.location.pathname
    const shareMatch = path.match(/^\/share\/(.+)$/)
    
    if (shareMatch) {
      const id = shareMatch[1]
      setShareId(id)
      setCurrentScreen('share')
    }
  }, [])

  const navigateTo = (screen, params = null) => {
    setPreviousScreen(currentScreen)
    setCurrentScreen(screen)
    if (params) {
      if (params.mode) {
        setAnalysisMode(params.mode)
      }
      setNavigationParams(params)
    } else {
      setNavigationParams({})
    }
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={navigateTo} />
      case 'address':
        return <AddressInputScreen onNavigate={navigateTo} onModeChange={setAnalysisMode} />
      case 'ar-camera':
        return <ARCameraScreen onNavigate={navigateTo} />
      case 'documents':
        return <DocumentScreen onNavigate={navigateTo} />
      case 'analysis':
        return <AnalysisTransitionScreen onNavigate={navigateTo} />
      case 'property':
        return <PropertyCardScreen onNavigate={navigateTo} />
      case 'results':
        return <ResultsScreen onNavigate={navigateTo} mode={analysisMode} />
      case 'share':
        return <ShareViewScreen shareId={shareId} />
      case 'profile':
        return <ProfileScreen onNavigate={navigateTo} />
      case 'clients':
        return <ClientsScreen onNavigate={navigateTo} />
      case 'cmas':
        return <CMAsScreen onNavigate={navigateTo} />
      case 'settings':
        return <SettingsScreen onNavigate={navigateTo} />
      case 'sellers_dashboard':
      case 'seller_intelligence_area':
        return <SellersDashboardScreen onNavigate={navigateTo} />
      case 'seller_intelligence_results':
        return <SellerIntelligenceResultsScreen onNavigate={navigateTo} searchParams={navigationParams} />
      case 'campaign_details':
        return <CampaignDetailsScreen onNavigate={navigateTo} campaignId={navigationParams?.campaignId} />
      case 'property_intelligence':
        return <PropertyIntelligenceScreen onNavigate={navigateTo} />
      default:
        return <HomeScreen onNavigate={navigateTo} />
    }
  }

  // Don't show header on certain screens
  const screensWithoutHeader = ['ar-camera', 'analysis', 'property', 'results', 'share', 'documents']

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
          
          {/* Header with Menu */}
          {!screensWithoutHeader.includes(currentScreen) && (
            <div style={{
              position: 'relative',
              zIndex: 1000
            }}>
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
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                  onClick={() => setCurrentScreen('home')}
                >
                  FlashStack
                </div>
                <UserMenu onNavigate={navigateTo} />
              </div>
            </div>
          )}
          
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