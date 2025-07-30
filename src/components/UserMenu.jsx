import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { User, Settings, Users, FileText, LogOut } from 'lucide-react'

const UserMenu = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        left: rect.right - 200 // Align dropdown to right edge
      })
    }
    setIsOpen(!isOpen)
  }

  const handleMenuClick = (screen) => {
    setIsOpen(false)
    if (screen === 'signout') {
      // Clear any stored data and navigate to home
      localStorage.clear()
      onNavigate('home')
    } else {
      onNavigate(screen)
    }
  }

  const menuItems = [
    { icon: User, label: 'My Profile', screen: 'profile' },
    { icon: Settings, label: 'Settings', screen: 'settings' },
    { divider: true },
    { icon: LogOut, label: 'Sign Out', screen: 'signout', danger: true }
  ]

  const dropdown = isOpen && (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        width: '200px',
        padding: '8px',
        zIndex: 9999,
        animation: 'slideDown 0.2s ease',
      }}
    >
      {menuItems.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={index}
              style={{
                height: '1px',
                background: '#e5e7eb',
                margin: '8px 0'
              }}
            />
          )
        }

        const Icon = item.icon
        return (
          <button
            key={item.screen}
            onClick={() => handleMenuClick(item.screen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: item.danger ? '#dc2626' : '#1f2937',
              transition: 'all 0.2s ease',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = item.danger 
                ? 'rgba(220, 38, 38, 0.1)' 
                : 'rgba(59, 130, 246, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        )
      })}

      {/* User Info */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid #e5e7eb',
        marginTop: '8px'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          marginBottom: '4px'
        }}>
          Signed in as
        </div>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: '#1f2937'
        }}>
          jane.doe@rocketrealty.com
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* User Avatar Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          fontSize: '14px',
          fontWeight: '700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          ...(isOpen && { 
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
            transform: 'scale(1.05)'
          })
        }}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        JD
      </button>

      {/* Render dropdown using portal */}
      {createPortal(dropdown, document.body)}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}

export default UserMenu