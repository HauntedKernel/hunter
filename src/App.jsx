import { useState } from 'react'
import HomeScreen from './components/screens/HomeScreen'
import AddressInputScreen from './components/screens/AddressInputScreen'
import ARCameraScreen from './components/screens/ARCameraScreen'
import DocumentScreen from './components/screens/DocumentScreen'
import AnalysisTransitionScreen from './components/screens/AnalysisTransitionScreen'
import PropertyCardScreen from './components/screens/PropertyCardScreen'
import ResultsScreen from './components/screens/ResultsScreen'
import UserMenu from './components/UserMenu'
import { ProfileScreen, ClientsScreen, CMAsScreen, SettingsScreen } from './components/screens/MenuScreens'

function App() {
  const [currentScreen, setCurrentScreen] = useState('home')
  const [previousScreen, setPreviousScreen] = useState(null)
  const [analysisMode, setAnalysisMode] = useState('discovery') // 'discovery' or 'cma'
  const [userProfile, setUserProfile] = useState({
    firstName: 'Jane',
    lastName: 'Doe',
    initials: 'JD',
    company: 'Rocket Realty',
    email: 'jane.doe@rocketrealty.com'
  })

  const navigateTo = (screen, mode = null) => {
    setPreviousScreen(currentScreen)
    setCurrentScreen(screen)
    if (mode) {
      setAnalysisMode(mode)
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
      case 'profile':
        return <ProfileScreen onNavigate={navigateTo} />
      case 'clients':
        return <ClientsScreen onNavigate={navigateTo} />
      case 'cmas':
        return <CMAsScreen onNavigate={navigateTo} />
      case 'settings':
        return <SettingsScreen onNavigate={navigateTo} />
      default:
        return <HomeScreen onNavigate={navigateTo} />
    }
  }

  // Don't show header on certain screens
  const screensWithoutHeader = ['ar-camera', 'analysis', 'property', 'results']

  return (
    <div className="app">
      <div className="phone-frame">
        <div className="screen" style={{
          width: '100%',
          height: '100%',
          background: '#fff',
          borderRadius: '32px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Status Bar */}
          <div style={{
            height: '44px',
            background: 'black',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 20px',
            fontSize: '14px',
            fontWeight: '600',
            flexShrink: 0
          }}>
            <span>9:41</span>
            <span>•••••</span>
            <span>100% 🔋</span>
          </div>
          
          {/* Header with Menu */}
          {!screensWithoutHeader.includes(currentScreen) && (
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
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                FlashStack
              </div>
              <UserMenu onNavigate={navigateTo} />
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
    </div>
  )
}

export default App