const Logo = ({ size = 'large' }) => {
  const dimensions = size === 'large' ? { width: 200, height: 60 } : { width: 120, height: 36 }
  
  return (
    <div className="logo" style={{ 
      width: dimensions.width, 
      height: dimensions.height,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      borderRadius: 12,
      color: 'white',
      fontWeight: 'bold',
      fontSize: size === 'large' ? 28 : 18,
      letterSpacing: '-0.5px'
    }}>
      FlashStack
    </div>
  )
}

export default Logo