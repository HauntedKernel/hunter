import { ChevronLeft } from 'lucide-react'

const Header = ({ title, onBack, showBack = true, rightContent }) => {
  return (
    <div className="header">
      {showBack ? (
        <button className="back-button" onClick={onBack}>
          <ChevronLeft size={24} />
        </button>
      ) : (
        <div style={{ width: 40 }} />
      )}
      <h1 className="header-title">{title}</h1>
      <div style={{ width: 40 }}>
        {rightContent}
      </div>
    </div>
  )
}

export default Header