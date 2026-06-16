import React, { useState } from 'react';

// Add CSS keyframes for spinner animation
const spinnerStyles = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinnerStyles;
  document.head.appendChild(style);
}

const PropertyIntelligenceScreen = () => {
  const [activeTab, setActiveTab] = useState('search');
  const [searchAddress, setSearchAddress] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [delinquentProperties, setDelinquentProperties] = useState([]);

  const analyzeProperty = async () => {
    if (!searchAddress.trim()) return;

    setIsLoading(true);
    try {
      // Check if this is an area search (Highland Park, University Park, Dallas, etc.)
      const searchLower = searchAddress.toLowerCase();
      const isAreaSearch = !searchLower.match(/^\d+/) && // Doesn't start with a number
                          (searchLower.includes('highland park') || 
                           searchLower.includes('university park') || 
                           searchLower.includes('dallas') ||
                           searchLower === 'highland park' ||
                           searchLower === 'university park');

      if (isAreaSearch) {
        // Area-wide search for all delinquent properties
        await searchAreaDelinquencies(searchAddress);
        setAnalysisResult(null); // Clear individual property analysis
      } else {
        // Individual property analysis
        const response = await fetch('/api/property/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: searchAddress
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Analysis failed');
        }

        setAnalysisResult(data.data);
        
        // Add to recent analyses
        const newAnalysis = {
          address: searchAddress,
          score: data.data.motivation.totalScore,
          isMotivated: data.data.motivation.isMotivatedSeller,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString()
        };
        setRecentAnalyses(prev => [newAnalysis, ...prev.slice(0, 9)]);
        
        // Also search for nearby tax delinquent properties
        await searchNearbyDelinquencies(searchAddress);
      }
      
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const searchAreaDelinquencies = async (areaName) => {
    try {
      const areaLower = areaName.toLowerCase();
      let searchAddresses = [];
      let areaDisplayName = '';

      if (areaLower.includes('highland park')) {
        areaDisplayName = 'Highland Park';
        // Comprehensive Highland Park area search
        searchAddresses = [
          '4300 BEVERLY DR', '4400 BEVERLY DR', '4500 BEVERLY DR', '4600 BEVERLY DR',
          '3800 MOCKINGBIRD LN', '3900 MOCKINGBIRD LN', '4000 MOCKINGBIRD LN', '4100 MOCKINGBIRD LN',
          '4100 ARMSTRONG AVE', '4200 ARMSTRONG AVE', '4300 ARMSTRONG AVE', '4400 ARMSTRONG AVE',
          '3500 ABBOTT AVE', '3600 ABBOTT AVE', '3700 ABBOTT AVE', '3800 ABBOTT AVE',
          '4000 PRINCETON AVE', '4100 PRINCETON AVE', '4200 PRINCETON AVE', '4300 PRINCETON AVE',
          '3400 TURTLE CREEK BLVD', '3500 TURTLE CREEK BLVD', '3600 TURTLE CREEK BLVD',
          '4000 DREXEL DR', '4100 DREXEL DR', '4200 DREXEL DR', '4300 DREXEL DR',
          '3900 POTOMAC AVE', '4000 POTOMAC AVE', '4100 POTOMAC AVE', '4200 POTOMAC AVE'
        ];
      } else if (areaLower.includes('university park')) {
        areaDisplayName = 'University Park';
        // University Park area search
        searchAddresses = [
          '6800 HILLCREST AVE', '6900 HILLCREST AVE', '7000 HILLCREST AVE', '7100 HILLCREST AVE',
          '3400 UNIVERSITY BLVD', '3500 UNIVERSITY BLVD', '3600 UNIVERSITY BLVD', '3700 UNIVERSITY BLVD',
          '6700 PRESTON RD', '6800 PRESTON RD', '6900 PRESTON RD', '7000 PRESTON RD',
          '3300 DANIELS AVE', '3400 DANIELS AVE', '3500 DANIELS AVE', '3600 DANIELS AVE',
          '3400 STANFORD AVE', '3500 STANFORD AVE', '3600 STANFORD AVE', '3700 STANFORD AVE'
        ];
      } else if (areaLower.includes('dallas')) {
        areaDisplayName = 'Dallas';
        // Dallas area search
        searchAddresses = [
          '5500 PRESTON RD', '5600 PRESTON RD', '5700 PRESTON RD', '5800 PRESTON RD',
          '2100 ROSS AVE', '2200 ROSS AVE', '2300 ROSS AVE', '2400 ROSS AVE',
          '4800 CENTRAL EXPY', '4900 CENTRAL EXPY', '5000 CENTRAL EXPY', '5100 CENTRAL EXPY',
          '3400 OAK LAWN AVE', '3500 OAK LAWN AVE', '3600 OAK LAWN AVE', '3700 OAK LAWN AVE',
          '2800 MCKINNEY AVE', '2900 MCKINNEY AVE', '3000 MCKINNEY AVE', '3100 MCKINNEY AVE',
          '4200 LEMMON AVE', '4300 LEMMON AVE', '4400 LEMMON AVE', '4500 LEMMON AVE'
        ];
      }

      if (searchAddresses.length > 0) {
        console.log(`🔍 Searching entire ${areaDisplayName} area for tax delinquencies (${searchAddresses.length} properties)...`);
        
        // Use batch analysis to get real Dallas County tax data for entire area
        const response = await fetch('/api/property/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            addresses: searchAddresses,
            options: {
              concurrency: 5,
              prioritizeHighValue: true,
              includeAllProperties: true // Include all properties, not just motivated sellers
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            // Filter for properties with real tax delinquencies (not simulated)
            const realDelinquents = data.data.allResults.filter(result => 
              result.taxDelinquency?.isDelinquent === true && 
              result.taxDelinquency?.amountOwed > 0 &&
              result.taxDelinquency?.lookupMethod !== 'highland_park_simulation' && // Exclude simulated data
              result.property?.address // Must have valid address
            );

            console.log(`✅ Found ${realDelinquents.length} tax delinquent properties in ${areaDisplayName} area`);
            setDelinquentProperties(realDelinquents);
            
            if (realDelinquents.length === 0) {
              alert(`${areaDisplayName} area search completed. No properties found with confirmed tax delinquencies. This uses real Dallas County tax data - properties may be current on taxes.`);
            } else {
              alert(`Found ${realDelinquents.length} tax delinquent properties in ${areaDisplayName} area!`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Area delinquency search failed:', error);
      alert(`Area search failed: ${error.message}`);
    }
  };

  const searchNearbyDelinquencies = async (searchedAddress) => {
    try {
      // Extract area information from searched address for nearby search
      const addressLower = searchedAddress.toLowerCase();
      let nearbyAddresses = [];
      
      if (addressLower.includes('highland park') || addressLower.includes('beverly')) {
        // Highland Park area addresses
        nearbyAddresses = [
          '4300 BEVERLY DR',
          '4400 BEVERLY DR', 
          '4500 BEVERLY DR',
          '3800 MOCKINGBIRD LN',
          '3900 MOCKINGBIRD LN',
          '4000 MOCKINGBIRD LN',
          '4100 ARMSTRONG AVE',
          '4200 ARMSTRONG AVE'
        ];
      } else if (addressLower.includes('university park') || addressLower.includes('hillcrest')) {
        // University Park area addresses
        nearbyAddresses = [
          '6800 HILLCREST AVE',
          '6900 HILLCREST AVE',
          '7000 HILLCREST AVE',
          '3400 UNIVERSITY BLVD',
          '3500 UNIVERSITY BLVD',
          '3600 UNIVERSITY BLVD'
        ];
      } else if (addressLower.includes('dallas') || addressLower.includes('preston') || addressLower.includes('ross')) {
        // Dallas area addresses
        nearbyAddresses = [
          '5500 PRESTON RD',
          '5600 PRESTON RD',
          '5700 PRESTON RD',
          '2100 ROSS AVE',
          '2200 ROSS AVE',
          '2300 ROSS AVE',
          '4800 CENTRAL EXPY',
          '4900 CENTRAL EXPY'
        ];
      }

      if (nearbyAddresses.length > 0) {
        console.log(`🔍 Searching nearby area for tax delinquencies...`);
        
        // Use batch analysis to get real Dallas County tax data for nearby area
        const response = await fetch('/api/property/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            addresses: nearbyAddresses,
            options: {
              concurrency: 3,
              prioritizeHighValue: true
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            // Filter for properties with real tax delinquencies (not simulated)
            const realDelinquents = data.data.allResults.filter(result => 
              result.taxDelinquency?.isDelinquent === true && 
              result.taxDelinquency?.amountOwed > 0 &&
              result.taxDelinquency?.lookupMethod !== 'highland_park_simulation' // Exclude simulated data
            );

            console.log(`✅ Found ${realDelinquents.length} tax delinquent properties in nearby area`);
            setDelinquentProperties(realDelinquents);
          }
        }
      }
    } catch (error) {
      console.error('Nearby delinquency search failed:', error);
      // Don't show alert for this - it's supplementary information
    }
  };


  const simulatePropertyAnalysis = async (address) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate realistic analysis based on address
    const addressLower = address.toLowerCase();
    let mockData;
    
    if (addressLower.includes('highland park')) {
      mockData = {
        property: {
          address,
          currentValue: 2500000,
          yearBuilt: 1955,
          squareFeet: 5200,
          propertyType: 'Single Family Residential'
        },
        ownership: {
          ownerType: 'trust',
          ownerName: 'JOHNSON FAMILY TRUST',
          ownershipDuration: 19,
          decisionComplexity: 'medium'
        },
        motivation: {
          totalScore: 65,
          isMotivatedSeller: true,
          motivationLevel: 'medium',
          confidence: 92,
          factors: [
            { type: 'taxDelinquency', points: 30, description: 'Tax delinquent: $45,000 (1.8% of value)' },
            { type: 'longTermOwnership', points: 25, description: '19 years ownership (longTerm)' },
            { type: 'ageDeterioration', points: 5, description: 'Property very old: 69 years (likely needs major updates)' },
            { type: 'maintenanceNeglect', points: 5, description: 'Trust ownership (possible neglect)' }
          ]
        },
        geographic: {
          neighborhood: 'Highland Park',
          accessibilityScore: 90,
          growthPotential: 85,
          investmentGrade: 'A+',
          marketVelocity: 'medium'
        },
        financial: {
          currentValue: 2500000,
          taxAmount: 52000,
          delinquentAmount: 45000,
          taxBurdenRatio: 0.021
        }
      };
    } else if (addressLower.includes('university park')) {
      mockData = {
        property: {
          address,
          currentValue: 1650000,
          yearBuilt: 1948,
          squareFeet: 4200,
          propertyType: 'Single Family Residential'
        },
        ownership: {
          ownerType: 'estate',
          ownerName: 'WILSON ESTATE',
          ownershipDuration: 23,
          decisionComplexity: 'high'
        },
        motivation: {
          totalScore: 78,
          isMotivatedSeller: true,
          motivationLevel: 'high',
          confidence: 88,
          factors: [
            { type: 'estate', points: 35, description: 'Estate ownership (probate urgency)' },
            { type: 'longTermOwnership', points: 30, description: '23 years ownership (generational)' },
            { type: 'taxDelinquency', points: 8, description: 'Minor tax delinquency: $8,500' },
            { type: 'ageDeterioration', points: 5, description: 'Property very old: 76 years' }
        ]
        },
        geographic: {
          neighborhood: 'University Park',
          accessibilityScore: 88,
          growthPotential: 82,
          investmentGrade: 'A',
          marketVelocity: 'medium'
        },
        financial: {
          currentValue: 1650000,
          taxAmount: 35000,
          delinquentAmount: 8500,
          taxBurdenRatio: 0.021
        }
      };
    } else {
      // Default Dallas property
      mockData = {
        property: {
          address,
          currentValue: 450000,
          yearBuilt: 1985,
          squareFeet: 2400,
          propertyType: 'Single Family Residential'
        },
        ownership: {
          ownerType: 'individual',
          ownerName: 'DAVIS, MICHAEL',
          ownershipDuration: 5,
          decisionComplexity: 'low'
        },
        motivation: {
          totalScore: 25,
          isMotivatedSeller: false,
          motivationLevel: 'low',
          confidence: 75,
          factors: [
            { type: 'recentOwnership', points: 0, description: 'Recent ownership (5 years)' },
            { type: 'noDelinquency', points: 0, description: 'No tax delinquency' },
            { type: 'modernProperty', points: 0, description: 'Property age acceptable' }
          ]
        },
        geographic: {
          neighborhood: 'Dallas General',
          accessibilityScore: 65,
          growthPotential: 58,
          investmentGrade: 'B',
          marketVelocity: 'medium'
        },
        financial: {
          currentValue: 450000,
          taxAmount: 9500,
          delinquentAmount: 0,
          taxBurdenRatio: 0.021
        }
      };
    }
    
    return mockData;
  };

  const getScoreColor = (score) => {
    if (score >= 70) return '#10B981'; // Green
    if (score >= 45) return '#F59E0B'; // Orange
    if (score >= 25) return '#6B7280'; // Gray
    return '#EF4444'; // Red
  };

  const getRecommendation = (score) => {
    if (score >= 70) return { text: 'HIGH PRIORITY - Contact immediately', icon: '🚀', color: '#10B981' };
    if (score >= 45) return { text: 'MEDIUM PRIORITY - Include in outreach', icon: '📈', color: '#F59E0B' };
    if (score >= 25) return { text: 'LOW PRIORITY - Monitor for changes', icon: '📋', color: '#6B7280' };
    return { text: 'WATCH LIST - Not currently motivated', icon: '⏳', color: '#6B7280' };
  };

  const tabs = [
    { id: 'search', label: 'Property Search' },
    { id: 'analysis', label: 'Analysis Results' },
    { id: 'batch', label: 'Batch Analysis' }
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🏠 Property Intelligence</h1>
        <p style={styles.subtitle}>Dallas CAD Integration - Motivated Seller Analysis</p>
      </div>

      {/* Tab Navigation - 2x2 Grid */}
      <div style={styles.tabGrid}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.activeTab : {})
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.content}>

        {activeTab === 'search' && (
          <div style={styles.searchTab}>
            <div style={styles.searchSection}>
              <h3 style={styles.sectionTitle}>Property Address Search</h3>
              <div style={styles.searchContainer}>
                <input
                  type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  placeholder="Enter address or area (e.g., Highland Park, University Park, or 4300 Beverly Dr)"
                  style={styles.searchInput}
                  onKeyPress={(e) => e.key === 'Enter' && analyzeProperty()}
                />
                <button 
                  onClick={analyzeProperty}
                  disabled={isLoading || !searchAddress.trim()}
                  style={{
                    ...styles.searchButton,
                    opacity: (isLoading || !searchAddress.trim()) ? 0.6 : 1
                  }}
                >
                  {isLoading ? 'Analyzing...' : 'Analyze Property'}
                </button>
              </div>
              
              {/* Quick Examples */}
              <div style={styles.exampleSection}>
                <h4 style={styles.exampleTitle}>Try these examples:</h4>
                <div style={styles.exampleGrid}>
                  {[
                    '4300 Beverly Dr, Highland Park, TX 75205',
                    '6800 Hillcrest Ave, University Park, TX 75225',
                    '5500 Preston Rd, Dallas, TX 75230',
                    '2100 Ross Ave, Dallas, TX 75201'
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setSearchAddress(example)}
                      style={styles.exampleButton}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Analyses */}
            {recentAnalyses.length > 0 && (
              <div style={styles.recentSection}>
                <h3 style={styles.sectionTitle}>Recent Analyses</h3>
                <div style={styles.recentList}>
                  {recentAnalyses.map((analysis, index) => (
                    <div key={index} style={styles.recentItem}>
                      <div style={styles.recentAddress}>{analysis.address}</div>
                      <div style={styles.recentDetails}>
                        <span style={{ 
                          ...styles.recentScore, 
                          color: getScoreColor(analysis.score) 
                        }}>
                          {analysis.score}/100
                        </span>
                        <span style={styles.recentStatus}>
                          {analysis.isMotivated ? '✅ Motivated' : '❌ Not Motivated'}
                        </span>
                        <span style={styles.recentDate}>
                          {analysis.date} {analysis.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tax Delinquent Properties in Area */}
            {delinquentProperties.length > 0 && (
              <div style={styles.delinquentSection}>
                <h3 style={styles.sectionTitle}>⚠️ Tax Delinquent Properties in Area</h3>
                <p style={styles.delinquentSubtitle}>
                  Found {delinquentProperties.length} properties with confirmed tax delinquencies in the searched area
                </p>
                <div style={styles.delinquentGrid}>
                  {delinquentProperties.map((property, index) => (
                    <div key={index} style={styles.delinquentCard}>
                      <div style={styles.delinquentHeader}>
                        <h4 style={styles.delinquentAddress}>{property.property.address}</h4>
                        <div style={styles.delinquentBadge}>
                          <span style={styles.delinquencyIcon}>⚠️</span>
                          <span style={styles.delinquencyText}>DELINQUENT</span>
                        </div>
                      </div>
                      
                      <div style={styles.delinquentDetails}>
                        <div style={styles.detailRow}>
                          <strong>Amount Owed:</strong>
                          <span style={styles.amountOwed}>
                            ${property.taxDelinquency.amountOwed?.toLocaleString()}
                          </span>
                        </div>
                        <div style={styles.detailRow}>
                          <strong>Years Delinquent:</strong>
                          <span style={styles.yearsDelinquent}>
                            {property.taxDelinquency.yearsDelinquent} years
                          </span>
                        </div>
                        <div style={styles.detailRow}>
                          <strong>Foreclosure Risk:</strong>
                          <span style={{
                            color: property.taxDelinquency.foreclosureRisk === 'HIGH' ? '#DC2626' : 
                                   property.taxDelinquency.foreclosureRisk === 'MEDIUM' ? '#F59E0B' : '#10B981',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            fontSize: '12px'
                          }}>
                            {property.taxDelinquency.foreclosureRisk}
                          </span>
                        </div>
                        <div style={styles.detailRow}>
                          <strong>Owner:</strong>
                          <span>{property.ownership.ownerName || 'Unknown'}</span>
                        </div>
                      </div>
                      
                      <div style={styles.delinquentActions}>
                        <button style={styles.contactButton}>
                          📞 Priority Contact
                        </button>
                        <button 
                          style={styles.analyzeButton}
                          onClick={() => {
                            setSearchAddress(property.property.address);
                            setActiveTab('analysis');
                          }}
                        >
                          📊 Analyze
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && (
          <div style={styles.analysisTab}>
            {isLoading ? (
              <div style={styles.loadingContainer}>
                <div style={styles.loadingSpinner} />
                <h3 style={styles.loadingText}>Analyzing Property...</h3>
                <p style={styles.loadingSubtext}>Extracting data from Dallas CAD records</p>
              </div>
            ) : analysisResult ? (
              <div style={styles.analysisResults}>
                {/* Property Header */}
                <div style={styles.propertyHeader}>
                  <div style={styles.propertyAddress}>
                    <h2>{analysisResult.property.address}</h2>
                    <p style={styles.propertyDetails}>
                      {analysisResult.property.propertyType} • Built {analysisResult.property.yearBuilt} • 
                      {analysisResult.property.squareFeet?.toLocaleString()} sq ft
                    </p>
                  </div>
                  <div style={styles.propertyValue}>
                    <div style={styles.valueAmount}>
                      ${(analysisResult.property.currentValue || analysisResult.taxation?.totalValue || analysisResult.financial?.currentValue || 0).toLocaleString()}
                    </div>
                    <div style={styles.valueLabel}>Current Value</div>
                  </div>
                </div>

                {/* Motivation Score Card */}
                <div style={{
                  ...styles.scoreCard,
                  borderColor: getScoreColor(analysisResult.motivation.totalScore)
                }}>
                  <div style={styles.scoreHeader}>
                    <div style={{
                      ...styles.scoreCircle,
                      backgroundColor: getScoreColor(analysisResult.motivation.totalScore)
                    }}>
                      <span style={styles.scoreNumber}>{analysisResult.motivation.totalScore}</span>
                      <span style={styles.scoreMax}>/100</span>
                    </div>
                    <div style={styles.scoreInfo}>
                      <h3 style={styles.scoreTitle}>
                        {analysisResult.motivation.isMotivatedSeller ? '✅ MOTIVATED SELLER' : '❌ NOT MOTIVATED'}
                      </h3>
                      <p style={styles.scoreSubtitle}>
                        {analysisResult.motivation.motivationLevel.toUpperCase()} • 
                        {analysisResult.motivation.confidence}% Confidence
                      </p>
                    </div>
                  </div>
                  
                  <div style={styles.recommendation}>
                    <span style={styles.recIcon}>
                      {getRecommendation(analysisResult.motivation.totalScore).icon}
                    </span>
                    <span style={styles.recText}>
                      {getRecommendation(analysisResult.motivation.totalScore).text}
                    </span>
                  </div>
                </div>

                {/* Analysis Details - 2x2 Grid */}
                <div style={styles.detailsGrid}>
                  {/* Motivation Factors */}
                  <div style={styles.detailCard}>
                    <h4 style={styles.detailTitle}>🎯 Key Motivation Factors</h4>
                    <div style={styles.factorList}>
                      {analysisResult.motivation.factors
                        .filter(f => f.points > 0)
                        .sort((a, b) => b.points - a.points)
                        .map((factor, index) => (
                          <div key={index} style={styles.factorItem}>
                            <span style={styles.factorPoints}>+{factor.points}</span>
                            <span style={styles.factorDesc}>{factor.description}</span>
                          </div>
                        ))}
                      {analysisResult.motivation.factors.filter(f => f.points > 0).length === 0 && (
                        <p style={styles.noFactors}>No significant motivation factors detected</p>
                      )}
                    </div>
                  </div>

                  {/* Ownership Analysis */}
                  <div style={styles.detailCard}>
                    <h4 style={styles.detailTitle}>👤 Ownership Analysis</h4>
                    <div style={styles.ownershipDetails}>
                      <div style={styles.ownershipItem}>
                        <strong>Owner:</strong> {analysisResult.ownership.ownerName || analysisResult.ownership?.ownerName || 'Unknown Owner'}
                      </div>
                      <div style={styles.ownershipItem}>
                        <strong>Type:</strong> {analysisResult.ownership.ownerType}
                      </div>
                      <div style={styles.ownershipItem}>
                        <strong>Duration:</strong> {analysisResult.ownership.ownershipDuration} years
                      </div>
                      <div style={styles.ownershipItem}>
                        <strong>Complexity:</strong> {analysisResult.ownership.decisionComplexity}
                      </div>
                    </div>
                  </div>

                  {/* Geographic Context */}
                  <div style={styles.detailCard}>
                    <h4 style={styles.detailTitle}>📍 Geographic Context</h4>
                    <div style={styles.geographicDetails}>
                      <div style={styles.geoItem}>
                        <strong>Neighborhood:</strong> {analysisResult.geographic.neighborhood}
                      </div>
                      <div style={styles.geoItem}>
                        <strong>Investment Grade:</strong> {analysisResult.geographic.investmentGrade}
                      </div>
                      <div style={styles.geoItem}>
                        <strong>Accessibility:</strong> {analysisResult.geographic.accessibilityScore}/100
                      </div>
                      <div style={styles.geoItem}>
                        <strong>Growth Potential:</strong> {analysisResult.geographic.growthPotential}/100
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div style={styles.detailCard}>
                    <h4 style={styles.detailTitle}>💰 Financial Summary</h4>
                    <div style={styles.financialDetails}>
                      <div style={styles.financialItem}>
                        <strong>Current Value:</strong> ${analysisResult.financial.currentValue?.toLocaleString()}
                      </div>
                      <div style={styles.financialItem}>
                        <strong>Annual Taxes:</strong> ${analysisResult.financial.taxAmount?.toLocaleString()}
                      </div>
                      {analysisResult.financial.delinquentAmount > 0 && (
                        <div style={{...styles.financialItem, color: '#EF4444'}}>
                          <strong>Tax Delinquent:</strong> ${analysisResult.financial.delinquentAmount?.toLocaleString()}
                        </div>
                      )}
                      <div style={styles.financialItem}>
                        <strong>Tax Rate:</strong> {(analysisResult.financial.taxBurdenRatio * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.noAnalysis}>
                <h3>No Analysis Available</h3>
                <p>Search for a property in the Search tab to see analysis results here.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'batch' && (
          <div style={styles.batchTab}>
            <h3 style={styles.sectionTitle}>Batch Analysis</h3>
            <p style={styles.comingSoon}>🚧 Coming Soon - Analyze multiple properties simultaneously</p>
          </div>
        )}

        {activeTab === 'reports' && (
          <div style={styles.reportsTab}>
            <h3 style={styles.sectionTitle}>Analysis Reports</h3>
            <p style={styles.comingSoon}>📊 Coming Soon - Generate comprehensive property reports</p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: '20px',
    overflow: 'auto'
  },
  header: {
    marginBottom: '30px',
    textAlign: 'center'
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: 0
  },
  subtitle: {
    fontSize: '16px',
    color: '#6b7280',
    margin: '5px 0 0 0'
  },
  tabGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '12px',
    marginBottom: '30px',
    maxWidth: '600px',
    margin: '0 auto 30px auto'
  },
  tab: {
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    textAlign: 'center'
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
    color: '#ffffff'
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    minHeight: '600px'
  },
  searchTab: {
    padding: '30px'
  },
  searchSection: {
    marginBottom: '40px'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '20px'
  },
  searchContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  searchInput: {
    flex: 1,
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  },
  searchButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    whiteSpace: 'nowrap'
  },
  exampleSection: {
    marginTop: '30px'
  },
  exampleTitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '12px'
  },
  exampleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '8px'
  },
  exampleButton: {
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease'
  },
  recentSection: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '30px'
  },
  recentList: {
    space: '8px'
  },
  recentItem: {
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '8px'
  },
  recentAddress: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: '4px'
  },
  recentDetails: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#6b7280'
  },
  recentScore: {
    fontWeight: '600'
  },
  recentStatus: {},
  recentDate: {},
  analysisTab: {
    padding: '30px'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    marginBottom: '20px',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 8px 0'
  },
  loadingSubtext: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0
  },
  analysisResults: {
    space: '24px'
  },
  propertyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    marginBottom: '24px'
  },
  propertyAddress: {
    flex: 1
  },
  propertyDetails: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '4px 0 0 0'
  },
  propertyValue: {
    textAlign: 'right'
  },
  valueAmount: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#1f2937'
  },
  valueLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px'
  },
  scoreCard: {
    padding: '24px',
    borderRadius: '12px',
    border: '3px solid',
    backgroundColor: '#ffffff',
    marginBottom: '24px'
  },
  scoreHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '16px'
  },
  scoreCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff'
  },
  scoreNumber: {
    fontSize: '24px',
    fontWeight: 'bold',
    lineHeight: '1'
  },
  scoreMax: {
    fontSize: '12px',
    opacity: 0.8
  },
  scoreInfo: {
    flex: 1
  },
  scoreTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 4px 0'
  },
  scoreSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0
  },
  recommendation: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500'
  },
  recIcon: {
    fontSize: '16px'
  },
  recText: {
    color: '#374151'
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr 1fr',
    gap: '20px'
  },
  detailCard: {
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  detailTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px'
  },
  factorList: {
    space: '8px'
  },
  factorItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '8px'
  },
  factorPoints: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#10b981',
    backgroundColor: '#d1fae5',
    padding: '2px 6px',
    borderRadius: '4px',
    minWidth: '35px',
    textAlign: 'center'
  },
  factorDesc: {
    fontSize: '14px',
    color: '#374151',
    flex: 1
  },
  noFactors: {
    fontSize: '14px',
    color: '#6b7280',
    fontStyle: 'italic',
    margin: 0
  },
  ownershipDetails: {
    space: '8px'
  },
  ownershipItem: {
    fontSize: '14px',
    color: '#374151',
    marginBottom: '8px',
    lineHeight: '1.4'
  },
  geographicDetails: {
    space: '8px'
  },
  geoItem: {
    fontSize: '14px',
    color: '#374151',
    marginBottom: '8px',
    lineHeight: '1.4'
  },
  financialDetails: {
    space: '8px'
  },
  financialItem: {
    fontSize: '14px',
    color: '#374151',
    marginBottom: '8px',
    lineHeight: '1.4'
  },
  noAnalysis: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    textAlign: 'center'
  },
  batchTab: {
    padding: '30px',
    textAlign: 'center'
  },
  reportsTab: {
    padding: '30px',
    textAlign: 'center'
  },
  comingSoon: {
    fontSize: '16px',
    color: '#6b7280',
    marginTop: '20px'
  },
  highlandParkTab: {
    padding: '30px'
  },
  highlandParkHeader: {
    marginBottom: '30px',
    textAlign: 'center'
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px'
  },
  propertyCard: {
    backgroundColor: '#ffffff',
    border: '2px solid #fee2e2',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  propertyAddressCard: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0,
    flex: 1
  },
  delinquencyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600'
  },
  delinquencyIcon: {
    fontSize: '14px'
  },
  delinquencyText: {
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  cardContent: {
    marginBottom: '20px'
  },
  delinquencyDetails: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    border: '1px solid #fecaca'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '14px'
  },
  amountOwed: {
    fontWeight: '700',
    color: '#dc2626',
    fontSize: '16px'
  },
  yearsDelinquent: {
    fontWeight: '600',
    color: '#dc2626'
  },
  urgencyScore: {
    fontWeight: '700'
  },
  foreclosureRisk: {
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: '12px'
  },
  motivationSection: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  motivationScore: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  scoreLabel: {
    fontSize: '14px',
    fontWeight: '500'
  },
  scoreValue: {
    fontSize: '16px',
    fontWeight: '700'
  },
  ownerInfo: {
    fontSize: '14px',
    marginBottom: '8px',
    color: '#374151'
  },
  neighborhood: {
    fontSize: '14px',
    color: '#374151'
  },
  cardActions: {
    display: 'flex',
    gap: '12px'
  },
  contactButton: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },
  analyzeButton: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  delinquentSection: {
    borderTop: '1px solid #e5e7eb',
    paddingTop: '30px',
    marginTop: '30px'
  },
  delinquentSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '20px',
    textAlign: 'center'
  },
  delinquentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px'
  },
  delinquentCard: {
    backgroundColor: '#ffffff',
    border: '2px solid #fee2e2',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  },
  delinquentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  delinquentAddress: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0,
    flex: 1
  },
  delinquentBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600'
  },
  delinquentDetails: {
    marginBottom: '16px',
    padding: '16px',
    backgroundColor: '#fef2f2',
    borderRadius: '8px',
    border: '1px solid #fecaca'
  },
  delinquentActions: {
    display: 'flex',
    gap: '12px'
  }
};

export default PropertyIntelligenceScreen;