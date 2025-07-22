import { useState } from 'react'
import HomeScreen from './components/screens/HomeScreen'
import AddressInputScreen from './components/screens/AddressInputScreen'
import ARCameraScreen from './components/screens/ARCameraScreen'
import DocumentScreen from './components/screens/DocumentScreen'
import AnalysisTransitionScreen from './components/screens/AnalysisTransitionScreen'
import PropertyCardScreen from './components/screens/PropertyCardScreen'
import ResultsScreen from './components/screens/ResultsScreen'

function App() {
  const [currentScreen, setCurrentScreen] = useState('home')

  const navigateTo = (screen) => {
    setCurrentScreen(screen)
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={navigateTo} />
      case 'address':
        return <AddressInputScreen onNavigate={navigateTo} />
      case 'ar-camera':
        return <ARCameraScreen onNavigate={navigateTo} />
      case 'documents':
        return <DocumentScreen onNavigate={navigateTo} />
      case 'analysis':
        return <AnalysisTransitionScreen onNavigate={navigateTo} />
      case 'property':
        return <PropertyCardScreen onNavigate={navigateTo} />
      case 'results':
        return <ResultsScreen onNavigate={navigateTo} />
      default:
        return <HomeScreen onNavigate={navigateTo} />
    }
  }

  return (
    <div className="app">
      <div className="phone-frame">
        {renderScreen()}
      </div>
    </div>
  )
}

export default App