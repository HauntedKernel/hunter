import { useState } from 'react'
import { FileText, Download, Search, Filter, ArrowLeft, Eye, Calendar, Building, AlertCircle } from 'lucide-react'

const DocumentScreen = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState('all')
  
  const documentCategories = [
    { id: 'all', name: 'All', count: 12 },
    { id: 'disclosures', name: 'Disclosures', count: 4 },
    { id: 'reports', name: 'Reports', count: 3 },
    { id: 'legal', name: 'Legal', count: 3 },
    { id: 'financial', name: 'Financial', count: 2 }
  ]
  
  const mockDocuments = [
    {
      id: 1,
      title: 'Property Disclosure Statement',
      type: 'Disclosure',
      date: '2024-01-15',
      size: '2.3 MB',
      category: 'disclosures',
      status: 'completed',
      preview: 'Comprehensive disclosure covering all material facts about the property condition...'
    },
    {
      id: 2,
      title: 'Home Inspection Report',
      type: 'Report',
      date: '2024-01-14',
      size: '5.7 MB',
      category: 'reports',
      status: 'completed',
      preview: 'Professional inspection findings including structural, electrical, and plumbing systems...'
    },
    {
      id: 3,
      title: 'Title Insurance Policy',
      type: 'Legal',
      date: '2024-01-13',
      size: '1.8 MB',
      category: 'legal',
      status: 'completed',
      preview: 'Title insurance documentation protecting against title defects and claims...'
    },
    {
      id: 4,
      title: 'Appraisal Report',
      type: 'Financial',
      date: '2024-01-12',
      size: '3.2 MB',
      category: 'financial',
      status: 'completed',
      preview: 'Professional property valuation based on comparable sales and market analysis...'
    },
    {
      id: 5,
      title: 'Environmental Disclosure',
      type: 'Disclosure',
      date: '2024-01-11',
      size: '1.5 MB',
      category: 'disclosures',
      status: 'pending',
      preview: 'Environmental hazards and contamination disclosure statement...'
    },
    {
      id: 6,
      title: 'HOA Documents',
      type: 'Legal',
      date: '2024-01-10',
      size: '4.1 MB',
      category: 'legal',
      status: 'completed',
      preview: 'Homeowners association bylaws, covenants, and financial statements...'
    }
  ]
  
  const filteredDocuments = selectedCategory === 'all' 
    ? mockDocuments 
    : mockDocuments.filter(doc => doc.category === selectedCategory)

  return (
    <div className="screen" style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
      borderRadius: '41px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Status Bar */}
      <div className="status-bar" style={{
        height: '44px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 20px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#1e293b'
      }}>
        <span>9:41</span>
        <span>••••• </span>
        <span>100% 🔋</span>
      </div>
      
      {/* Header */}
      <div className="header-bar" style={{
        padding: '16px 20px',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(226,232,240,0.5)'
      }}>
        <div 
          className="back-button" 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(248,250,252,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('home')}
        >
          <ArrowLeft size={18} />
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b'
        }}>Document Retrieval</div>
        <div 
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(248,250,252,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Search size={18} />
        </div>
      </div>
      
      {/* Category Filter */}
      <div style={{
        background: 'white',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(226,232,240,0.5)'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch'
        }}>
          {documentCategories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: selectedCategory === category.id ? '#f59e0b' : '#f8fafc',
                color: selectedCategory === category.id ? 'white' : '#64748b',
                transition: 'all 0.2s ease'
              }}
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>
      </div>
      
      {/* Document List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '20px'
      }}>
        {filteredDocuments.map(document => (
          <div
            key={document.id}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid rgba(226,232,240,0.5)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              {/* Document Icon */}
              <div style={{
                width: '48px',
                height: '48px',
                background: document.status === 'completed' ? 
                  'linear-gradient(135deg, #f59e0b, #d97706)' : 
                  'linear-gradient(135deg, #94a3b8, #64748b)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={24} color="white" />
              </div>
              
              {/* Document Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>{document.title}</h3>
                  {document.status === 'pending' && (
                    <AlertCircle size={16} color="#f59e0b" />
                  )}
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '12px',
                  color: '#64748b',
                  marginBottom: '8px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building size={12} />
                    {document.type}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    {new Date(document.date).toLocaleDateString()}
                  </span>
                  <span>{document.size}</span>
                </div>
                
                <p style={{
                  fontSize: '13px',
                  color: '#64748b',
                  lineHeight: '1.4',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {document.preview}
                </p>
              </div>
              
              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                flexShrink: 0
              }}>
                <button style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}>
                  <Eye size={16} color="#64748b" />
                </button>
                <button style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}>
                  <Download size={16} color="#64748b" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Bottom Action Bar */}
      <div style={{
        background: 'white',
        padding: '16px 20px',
        borderTop: '1px solid rgba(226,232,240,0.5)',
        display: 'flex',
        gap: '12px'
      }}>
        <button style={{
          flex: 1,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '16px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <Download size={18} />
          Download All
        </button>
        <button style={{
          background: 'white',
          color: '#f59e0b',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '16px 20px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Filter size={18} />
        </button>
      </div>
    </div>
  )
}

export default DocumentScreen