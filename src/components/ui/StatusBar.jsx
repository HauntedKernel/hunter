import { Battery, Wifi, Signal } from 'lucide-react'

const StatusBar = () => {
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span>{currentTime}</span>
      </div>
      <div className="status-bar-right">
        <Signal size={16} />
        <Wifi size={16} />
        <Battery size={16} />
        <span>100%</span>
      </div>
    </div>
  )
}

export default StatusBar