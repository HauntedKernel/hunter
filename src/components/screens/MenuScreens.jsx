import { useState } from 'react'
import { ArrowLeft, Mail, Key, Save, Plus, Search, Phone, Calendar, Trash2, Eye, Download, Filter } from 'lucide-react'

// Profile Screen
export const ProfileScreen = ({ onNavigate }) => {
  const [profile, setProfile] = useState({
    firstName: 'Jane',
    lastName: 'Doe',
    company: 'Rocket Realty',
    phone: '(555) 123-4567',
    email: 'jane.doe@rocketrealty.com',
    license: 'CA-DRE-12345678',
    mlsId: '',
    mlsPassword: ''
  })

  const [emailConnected, setEmailConnected] = useState(false)

  const handleSave = () => {
    // Save profile data
    localStorage.setItem('userProfile', JSON.stringify(profile))
    alert('Profile saved successfully!')
  }

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '600px', 
      margin: '0 auto',
      height: '100%',
      overflow: 'auto'
    }}>
      {/* Back Button */}
      <button
        onClick={() => onNavigate('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          fontSize: '16px',
          fontWeight: '600',
          color: '#3b82f6',
          cursor: 'pointer',
          marginBottom: '24px'
        }}
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>My Profile</h1>

      {/* Profile Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              First Name
            </label>
            <input
              type="text"
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Last Name
            </label>
            <input
              type="text"
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
            Company
          </label>
          <input
            type="text"
            value={profile.company}
            onChange={(e) => setProfile({ ...profile, company: e.target.value })}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Phone
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              License #
            </label>
            <input
              type="text"
              value={profile.license}
              onChange={(e) => setProfile({ ...profile, license: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {/* MLS Credentials Section */}
        <div style={{
          background: '#f8fafc',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key size={18} />
            MLS Credentials
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              placeholder="MLS ID"
              value={profile.mlsId}
              onChange={(e) => setProfile({ ...profile, mlsId: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            <input
              type="password"
              placeholder="MLS Password"
              value={profile.mlsPassword}
              onChange={(e) => setProfile({ ...profile, mlsPassword: e.target.value })}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {/* Email Integration Section */}
        <div style={{
          background: '#f8fafc',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={18} />
            Email Integration
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>{profile.email}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                {emailConnected ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <button
              onClick={() => setEmailConnected(!emailConnected)}
              style={{
                padding: '8px 16px',
                background: emailConnected ? '#dc2626' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {emailConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          style={{
            padding: '12px 24px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Save size={20} />
          Save Profile
        </button>
      </div>
    </div>
  )
}

// Clients Screen
export const ClientsScreen = ({ onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [clients] = useState([
    { id: 1, name: 'Sarah Johnson', email: 'sarah.j@email.com', phone: '(555) 234-5678', lastCMA: '2025-07-15', status: 'Active' },
    { id: 2, name: 'Michael Chen', email: 'mchen@email.com', phone: '(555) 345-6789', lastCMA: '2025-07-20', status: 'Active' },
    { id: 3, name: 'Emily Rodriguez', email: 'emily.r@email.com', phone: '(555) 456-7890', lastCMA: '2025-06-30', status: 'Inactive' },
    { id: 4, name: 'David Kim', email: 'dkim@email.com', phone: '(555) 567-8901', lastCMA: '2025-07-25', status: 'Active' },
    { id: 5, name: 'Lisa Thompson', email: 'lisa.t@email.com', phone: '(555) 678-9012', lastCMA: '2025-07-10', status: 'Active' }
  ])

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: '100%', overflow: 'auto' }}>
      {/* Back Button */}
      <button
        onClick={() => onNavigate('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          fontSize: '16px',
          fontWeight: '600',
          color: '#3b82f6',
          cursor: 'pointer',
          marginBottom: '24px'
        }}
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Clients</h1>
        <button
          style={{
            padding: '10px 20px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={18} />
          Add Client
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
        <input
          type="text"
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 12px 12px 44px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Client List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredClients.map(client => (
          <div
            key={client.id}
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{client.name}</h3>
              <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={14} />
                  {client.email}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={14} />
                  {client.phone}
                </span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                Last CMA: {new Date(client.lastCMA).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                padding: '4px 12px',
                background: client.status === 'Active' ? '#dcfce7' : '#fee2e2',
                color: client.status === 'Active' ? '#16a34a' : '#dc2626',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {client.status}
              </span>
              <button
                style={{
                  padding: '8px',
                  background: 'transparent',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  // Delete client logic
                }}
              >
                <Trash2 size={16} color="#dc2626" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// CMAs Screen
export const CMAsScreen = ({ onNavigate }) => {
  const [filter, setFilter] = useState('all')
  const [cmas] = useState([
    { id: 1, address: '123 Main St, Austin, TX', client: 'Sarah Johnson', date: '2025-07-25', status: 'completed', type: 'buyer' },
    { id: 2, address: '456 Oak Ave, Austin, TX', client: 'Michael Chen', date: '2025-07-24', status: 'draft', type: 'seller' },
    { id: 3, address: '789 Pine Rd, Austin, TX', client: 'Emily Rodriguez', date: '2025-07-23', status: 'completed', type: 'buyer' },
    { id: 4, address: '321 Elm St, Austin, TX', client: 'David Kim', date: '2025-07-22', status: 'sent', type: 'seller' },
    { id: 5, address: '654 Maple Dr, Austin, TX', client: 'Lisa Thompson', date: '2025-07-21', status: 'completed', type: 'rental' },
    { id: 6, address: 'Downtown Austin Discovery', client: 'Multiple', date: '2025-07-29', status: 'active', type: 'discovery' }
  ])

  const filteredCMAs = filter === 'all' ? cmas : cmas.filter(cma => cma.type === filter)

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return { bg: '#dcfce7', color: '#16a34a' }
      case 'sent': return { bg: '#dbeafe', color: '#3b82f6' }
      case 'draft': return { bg: '#fef3c7', color: '#f59e0b' }
      default: return { bg: '#f3f4f6', color: '#6b7280' }
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', height: '100%', overflow: 'auto' }}>
      {/* Back Button */}
      <button
        onClick={() => onNavigate('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          fontSize: '16px',
          fontWeight: '600',
          color: '#3b82f6',
          cursor: 'pointer',
          marginBottom: '24px'
        }}
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>My Sets</h1>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['all', 'buyer', 'seller', 'rental', 'discovery'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: '8px 16px',
              background: filter === type ? '#3b82f6' : 'transparent',
              color: filter === type ? 'white' : '#64748b',
              border: `1px solid ${filter === type ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {type === 'all' ? 'All Sets' : type}
          </button>
        ))}
      </div>

      {/* CMA List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredCMAs.map(cma => {
          const statusStyle = getStatusColor(cma.status)
          return (
            <div
              key={cma.id}
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{cma.address}</h3>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                  Client: {cma.client}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
                  <span>{new Date(cma.date).toLocaleDateString()}</span>
                  <span style={{ textTransform: 'capitalize' }}>{cma.type === 'discovery' ? 'Discovery Set' : `${cma.type} CMA`}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  padding: '4px 12px',
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  textTransform: 'capitalize'
                }}>
                  {cma.status}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={{
                      padding: '8px',
                      background: 'transparent',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      // View CMA logic
                    }}
                  >
                    <Eye size={16} color="#3b82f6" />
                  </button>
                  <button
                    style={{
                      padding: '8px',
                      background: 'transparent',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Download CMA logic
                    }}
                  >
                    <Download size={16} color="#10b981" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Settings Screen
export const SettingsScreen = ({ onNavigate }) => {
  const [settings, setSettings] = useState({
    notifications: true,
    autoSave: true,
    darkMode: false,
    compactView: false,
    defaultCMAType: 'buyer',
    dataRetention: '90'
  })

  const handleSave = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings))
    alert('Settings saved successfully!')
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', height: '100%', overflow: 'auto' }}>
      {/* Back Button */}
      <button
        onClick={() => onNavigate('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          fontSize: '16px',
          fontWeight: '600',
          color: '#3b82f6',
          cursor: 'pointer',
          marginBottom: '24px'
        }}
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>Settings</h1>

      {/* Settings Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* General Settings */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>General</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Push Notifications</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Receive alerts for new CMAs and client updates
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
            </label>
            
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Auto-save CMAs</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Automatically save work in progress
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
            </label>
          </div>
        </div>

        {/* Appearance */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Appearance</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Dark Mode</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Use dark theme for better visibility
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
            </label>
            
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Compact View</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Show more content in less space
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.compactView}
                onChange={(e) => setSettings({ ...settings, compactView: e.target.checked })}
                style={{ width: '20px', height: '20px' }}
              />
            </label>
          </div>
        </div>

        {/* CMA Preferences */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>CMA Preferences</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                Default CMA Type
              </label>
              <select
                value={settings.defaultCMAType}
                onChange={(e) => setSettings({ ...settings, defaultCMAType: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white'
                }}
              >
                <option value="buyer">Buyer CMA</option>
                <option value="seller">Seller CMA</option>
                <option value="rental">Rental CMA</option>
              </select>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                Data Retention (days)
              </label>
              <select
                value={settings.dataRetention}
                onChange={(e) => setSettings({ ...settings, dataRetention: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white'
                }}
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          style={{
            padding: '12px 24px',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <Save size={20} />
          Save Settings
        </button>
      </div>
    </div>
  )
}