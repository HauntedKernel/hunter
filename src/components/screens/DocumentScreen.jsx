import { useState } from 'react'
import { FileText, Download, Search, Filter, ArrowLeft, Eye, Calendar, Building, AlertCircle, Share2 } from 'lucide-react'

const DocumentScreen = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [viewingDocument, setViewingDocument] = useState(null)
  
  const documentCategories = [
    { id: 'all', name: 'All', count: 15 },
    { id: 'disclosures', name: 'Disclosures', count: 5 },
    { id: 'reports', name: 'Reports', count: 4 },
    { id: 'legal', name: 'Legal', count: 4 },
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
    },
    {
      id: 7,
      title: 'Lead-Based Paint Disclosure',
      type: 'Disclosure',
      date: '2024-01-09',
      size: '0.8 MB',
      category: 'disclosures',
      status: 'completed',
      preview: 'Federal EPA required disclosure for properties built before 1978...'
    },
    {
      id: 8,
      title: 'Termite Inspection Report',
      type: 'Report',
      date: '2024-01-08',
      size: '1.2 MB',
      category: 'reports',
      status: 'completed',
      preview: 'Wood destroying organism inspection report with treatment recommendations...'
    },
    {
      id: 9,
      title: 'Survey Report',
      type: 'Report',
      date: '2024-01-07',
      size: '3.8 MB',
      category: 'reports',
      status: 'completed',
      preview: 'Property boundary survey showing lot lines, easements, and encroachments...'
    },
    {
      id: 10,
      title: 'Purchase Agreement',
      type: 'Legal',
      date: '2024-01-06',
      size: '1.1 MB',
      category: 'legal',
      status: 'pending',
      preview: 'Residential purchase and sale agreement with all terms and conditions...'
    },
    {
      id: 11,
      title: 'Deed of Trust',
      type: 'Legal',
      date: '2024-01-05',
      size: '0.9 MB',
      category: 'legal',
      status: 'completed',
      preview: 'Security instrument that creates a lien on the property as security for loan...'
    },
    {
      id: 12,
      title: 'Natural Hazard Disclosure',
      type: 'Disclosure',
      date: '2024-01-04',
      size: '2.1 MB',
      category: 'disclosures',
      status: 'completed',
      preview: 'Disclosure of property location in flood, fire, earthquake, or other hazard zones...'
    },
    {
      id: 13,
      title: 'Roof Certification',
      type: 'Report',
      date: '2024-01-03',
      size: '1.6 MB',
      category: 'reports',
      status: 'completed',
      preview: 'Professional roof inspection with remaining life estimate and repair recommendations...'
    },
    {
      id: 14,
      title: 'Loan Estimate',
      type: 'Financial',
      date: '2024-01-02',
      size: '0.6 MB',
      category: 'financial',
      status: 'completed',
      preview: 'Standardized form showing loan terms, projected payments, and closing costs...'
    },
    {
      id: 15,
      title: 'Smoke & Carbon Monoxide Disclosure',
      type: 'Disclosure',
      date: '2024-01-01',
      size: '0.4 MB',
      category: 'disclosures',
      status: 'completed',
      preview: 'Disclosure of smoke detectors and carbon monoxide device compliance...'
    }
  ]
  
  const filteredDocuments = selectedCategory === 'all' 
    ? mockDocuments 
    : mockDocuments.filter(doc => doc.category === selectedCategory)

  const handleView = (doc) => {
    setViewingDocument(doc)
  }

  const handleDownload = (doc) => {
    // Simulate download
    const link = document.createElement('a')
    link.href = '#'
    link.download = doc.title.replace(/\s+/g, '_') + '.pdf'
    link.click()
    
    // Show feedback
    alert(`Downloading: ${doc.title}\n\nFile: ${doc.title.replace(/\s+/g, '_')}.pdf\nSize: ${doc.size}`)
  }

  const handleShare = (doc) => {
    // Mock share functionality with more detail
    const shareMessage = `Sharing: ${doc.title}\n\nShare options:\n• Email to client\n• Copy link\n• Send via SMS\n• Add to client portal\n\nDocument details:\n- Type: ${doc.type}\n- Size: ${doc.size}\n- Date: ${new Date(doc.date).toLocaleDateString()}`
    alert(shareMessage)
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #fafafa 0%, #f1f5f9 100%)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
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
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => onNavigate('home')}
        >
          <ArrowLeft size={20} />
        </div>
        
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b',
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)'
        }}>
          Documents
        </div>
        
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <button style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(248,250,252,0.8)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <Search size={18} />
          </button>
          <button style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(248,250,252,0.8)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}>
            <Filter size={18} />
          </button>
        </div>
      </div>
      
      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '16px 20px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' }
      }}>
        {documentCategories.map(category => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: selectedCategory === category.id 
                ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                : 'rgba(248,250,252,0.8)',
              color: selectedCategory === category.id ? 'white' : '#64748b',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {category.name}
            <span style={{
              fontSize: '12px',
              opacity: 0.8
            }}>
              {category.count}
            </span>
          </button>
        ))}
      </div>
      
      {/* Documents List */}
      <div style={{
        flex: 1,
        padding: '0 20px 20px',
        overflowY: 'auto'
      }}>
        {filteredDocuments.map(doc => (
          <div
            key={doc.id}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
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
                borderRadius: '12px',
                background: doc.status === 'completed' 
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileText size={24} color="white" />
              </div>
              
              {/* Document Info */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    {doc.title}
                  </h3>
                  <div style={{
                    display: 'flex',
                    gap: '8px'
                  }}>
                    <button 
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                      onClick={() => handleView(doc)}
                      title="View Document"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                      onClick={() => handleDownload(doc)}
                      title="Download Document"
                    >
                      <Download size={18} />
                    </button>
                    <button 
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                      onClick={() => handleShare(doc)}
                      title="Share Document"
                    >
                      <Share2 size={18} />
                    </button>
                  </div>
                </div>
                
                {/* Meta Info */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginBottom: '8px',
                  fontSize: '13px',
                  color: '#64748b'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building size={14} />
                    {doc.type}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} />
                    {new Date(doc.date).toLocaleDateString()}
                  </span>
                  <span>{doc.size}</span>
                </div>
                
                {/* Preview */}
                <p style={{
                  fontSize: '14px',
                  color: '#475569',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  {doc.preview}
                </p>
                
                {/* Status Badge */}
                {doc.status === 'pending' && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px',
                    padding: '4px 12px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#d97706'
                  }}>
                    <AlertCircle size={14} />
                    Pending Review
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Document Viewer Modal */}
      {viewingDocument && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        onClick={() => setViewingDocument(null)}
        >
          <div style={{
            background: 'white',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>
                {viewingDocument.title}
              </h2>
              <button
                onClick={() => setViewingDocument(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            {/* Modal Content */}
            <div style={{
              padding: '20px',
              overflow: 'auto',
              flex: 1
            }}>
              {/* Document Meta */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  fontSize: '14px'
                }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Type:</span>
                    <span style={{ color: '#1e293b', fontWeight: '600', marginLeft: '8px' }}>
                      {viewingDocument.type}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Size:</span>
                    <span style={{ color: '#1e293b', fontWeight: '600', marginLeft: '8px' }}>
                      {viewingDocument.size}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Date:</span>
                    <span style={{ color: '#1e293b', fontWeight: '600', marginLeft: '8px' }}>
                      {new Date(viewingDocument.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Status:</span>
                    <span style={{
                      color: viewingDocument.status === 'completed' ? '#10b981' : '#f59e0b',
                      fontWeight: '600',
                      marginLeft: '8px'
                    }}>
                      {viewingDocument.status === 'completed' ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Document Preview */}
              <div style={{
                background: '#fafafa',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '24px',
                minHeight: '300px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1e293b',
                  marginBottom: '16px'
                }}>
                  Document Preview
                </h3>
                <p style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#475569'
                }}>
                  {viewingDocument.preview}
                </p>
                
                <div style={{
                  marginTop: '24px',
                  padding: '16px',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    textAlign: 'center'
                  }}>
                    [Full document content would be displayed here]
                  </p>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => handleDownload(viewingDocument)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  background: 'white',
                  color: '#1e293b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Download size={16} />
                Download
              </button>
              <button
                onClick={() => handleShare(viewingDocument)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentScreen