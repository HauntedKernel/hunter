import { useState, useEffect } from 'react'
import { Home, TrendingUp, Calendar, DollarSign, Users, Download, Share, Filter, MapPin, Building, Mic, MicOff, Link, Copy, Check } from 'lucide-react'
import { shareSessionService, buildShareableReportData } from '../../services/ShareSessionService.js'
import { customerService } from '../../services/CustomerService.js'

const ResultsScreen = ({ onNavigate, mode = 'discovery' }) => {
  // Add pulse animation CSS
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])
  const [selectedType, setSelectedType] = useState('sale') // sale, rental
  const [cmaTab, setCmaTab] = useState('subject') // subject, comparables, motivation, negotiation
  const [issueInput, setIssueInput] = useState('')
  const [parsedIssues, setParsedIssues] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [recognition, setRecognition] = useState(null)
  
  // Subject property details
  const [subjectInput, setSubjectInput] = useState('')
  const [parsedSubjectDetails, setParsedSubjectDetails] = useState([
    { icon: '🎨', title: 'Interior Updates', desc: 'Wants new paint in 20x30 living room', type: 'planned' },
    { icon: '🔧', title: 'Kitchen Renovation', desc: 'Updated granite countertops and stainless appliances', type: 'completed' }
  ])

  // Share link functionality
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [shareResult, setShareResult] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(() => {
    // Get selected customer from localStorage, fallback to default
    return localStorage.getItem('selectedCustomer') || 'John & Jane Smith'
  })
  
  // Mock customer profiles for selection
  const customerProfiles = [
    'John & Jane Smith',
    'Michael & Sarah Johnson', 
    'David & Lisa Chen',
    'Robert & Maria Garcia',
    'James & Jennifer Wilson'
  ]

  const generateShareLink = async () => {
    setIsGeneratingLink(true)
    
    try {
      // Build report data based on current mode and selections
      const properties = mode === 'discovery' ? discoveryProperties.slice(0, 6) : discoveryProperties.slice(0, 3)
      const subjectProperty = {
        address: '456 Oak Avenue, Dallas, TX',
        beds: 4,
        baths: 3,
        sqft: 2380,
        price: mode === 'cma' ? 485000 : null
      }
      
      // Enhanced CMA data with comparables and intelligence
      const cmaComparables = [
        { address: '458 Oak Avenue', specs: '4 BR • 3 BA • 2,420 sq ft', condition: 'Excellent condition • New roof 2023', price: 515000, date: 'Sold 15 days ago', status: 'sold', sqft: 2420, beds: 4, baths: 3, pricePerSqFt: 213 },
        { address: '442 Elm Street', specs: '4 BR • 2.5 BA • 2,290 sq ft', condition: 'Good condition • Original roof (12 years)', price: 478000, date: 'Sold 28 days ago', status: 'sold', sqft: 2290, beds: 4, baths: 2.5, pricePerSqFt: 209 },
        { address: '523 Pine Road', specs: '3 BR • 3 BA • 2,340 sq ft', condition: 'Good condition • Recent updates', price: 465000, date: 'Sold 45 days ago', status: 'sold', sqft: 2340, beds: 3, baths: 3, pricePerSqFt: 199 },
        { address: '612 Maple Drive', specs: '4 BR • 3 BA • 2,450 sq ft', condition: 'Fair condition • Needs cosmetic work', price: 445000, date: 'Sold 38 days ago', status: 'sold', sqft: 2450, beds: 4, baths: 3, pricePerSqFt: 182 },
        { address: '789 Cedar Lane', specs: '4 BR • 2.5 BA • 2,380 sq ft', condition: 'Excellent condition • Move-in ready', price: 495000, date: 'Sold 22 days ago', status: 'sold', sqft: 2380, beds: 4, baths: 2.5, pricePerSqFt: 208 },
        { address: '334 Birch Street', specs: '3 BR • 3 BA • 2,180 sq ft', condition: 'Good condition • Minor repairs needed', price: 458000, date: 'Sold 33 days ago', status: 'sold', sqft: 2180, beds: 3, baths: 3, pricePerSqFt: 210 }
      ]

      const additionalData = {
        customerName: selectedCustomer,
        agentName: 'Sarah Johnson',
        agentCompany: 'Premier Realty',
        agentEmail: 'sarah@premierrealty.com',
        agentPhone: '(214) 555-0123',
        ...(mode === 'cma' && {
          comparables: cmaComparables,
          priceRecommendation: {
            low: 465000,
            recommended: 485000,
            high: 505000
          },
          marketStats: {
            avgDaysOnMarket: 18,
            saleToListRatio: 98.2,
            pricePerSqFt: 205
          },
          negotiationIntelligence: parsedIssues.length > 0 ? {
            issues: parsedIssues,
            totalOpportunity: parsedIssues.reduce((sum, issue) => sum + issue.cost, 0),
            neighborhoodStats: {
              avgDaysOnMarket: 18,
              medianPrice: 485000,
              priceGrowth: 3.2,
              marketPace: 'Fast'
            },
            sellerMotivation: {
              score: 88,
              factors: [
                { icon: '🏠', text: 'Already purchased replacement home' },
                { icon: '📅', text: 'Carrying two mortgages for 45 days' },
                { icon: '💰', text: 'Motivated to close quickly' },
                { icon: '🔧', text: 'Disclosed roof issues suggest transparency' }
              ]
            }
          } : {
            neighborhoodStats: {
              avgDaysOnMarker: 18,
              medianPrice: 485000,
              priceGrowth: 3.2,
              marketPace: 'Fast'
            },
            sellerMotivation: {
              score: 88,
              factors: [
                { icon: '🏠', text: 'Already purchased replacement home' },
                { icon: '📅', text: 'Carrying two mortgages for 45 days' },
                { icon: '💰', text: 'Motivated to close quickly' },
                { icon: '🔧', text: 'Disclosed roof issues suggest transparency' }
              ]
            }
          }
        }),
        ...(selectedType === 'rental' && {
          rentalEstimate: {
            monthly: 2800,
            annual: 33600
          },
          investmentMetrics: {
            capRate: 6.2,
            cashOnCash: 8.2,
            paybackPeriod: 12
          }
        })
      }

      const reportData = buildShareableReportData(
        selectedType === 'rental' ? 'rental' : mode,
        mode === 'cma' ? cmaComparables : properties,
        subjectProperty,
        additionalData
      )

      // Create share session
      const result = await shareSessionService.createShareSession(reportData, {
        expirationDays: 30,
        maxAccess: null // No access limit
      })

      if (result.success) {
        setShareResult(result)
        setShowShareModal(true)
      } else {
        alert('Failed to generate share link. Please try again.')
      }

    } catch (error) {
      console.error('Share link generation failed:', error)
      alert('Failed to generate share link. Please try again.')
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const copyShareLink = async () => {
    if (shareResult?.shareUrl) {
      try {
        await navigator.clipboard.writeText(shareResult.shareUrl)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy link:', error)
        // Fallback for browsers that don't support clipboard API
        const textArea = document.createElement('textarea')
        textArea.value = shareResult.shareUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      }
    }
  }

  const closeShareModal = () => {
    setShowShareModal(false)
    setShareResult(null)
    setLinkCopied(false)
  }

  const viewShareLink = () => {
    if (shareResult?.shareUrl) {
      window.open(shareResult.shareUrl, '_blank')
    }
  }

  // Save to customer profile functionality
  const saveToProfile = async () => {
    try {
      // Create or find customer
      const customerId = customerService.createCustomer({
        name: selectedCustomer,
        email: '', // Could be enhanced to collect email
        phone: ''  // Could be enhanced to collect phone
      })

      // Generate session title and get property count
      const propertyCount = mode === 'discovery' ? 6 : 3
      const sessionTitle = customerService.generateSessionTitle(mode, '456 Oak Avenue')

      // Generate share link first
      const shareLink = await generateShareLinkForSave()

      // Save session to customer profile
      const sessionData = {
        sessionType: mode,
        title: sessionTitle,
        shareUrl: shareLink,
        propertyCount: propertyCount
      }

      const savedSession = customerService.saveSession(customerId, sessionData)
      
      // Show success feedback
      alert(`${mode === 'discovery' ? 'Discovery Report' : 'CMA Analysis'} saved to ${selectedCustomer}'s profile!`)
      
      console.log('Session saved:', savedSession)
      
    } catch (error) {
      console.error('Failed to save session:', error)
      alert('Failed to save session. Please try again.')
    }
  }

  // Helper function to generate share link without showing modal
  const generateShareLinkForSave = async () => {
    try {
      // Build report data based on current mode and selections
      const properties = mode === 'discovery' ? discoveryProperties.slice(0, 6) : discoveryProperties.slice(0, 3)
      const subjectProperty = {
        address: '456 Oak Avenue, Dallas, TX',
        beds: 4,
        baths: 3,
        sqft: 2380,
        price: mode === 'cma' ? 485000 : null
      }
      
      const cmaComparables = [
        { address: '458 Oak Avenue', specs: '4 BR • 3 BA • 2,420 sq ft', condition: 'Excellent condition • New roof 2023', price: 515000, date: 'Sold 15 days ago', status: 'sold', sqft: 2420, beds: 4, baths: 3, pricePerSqFt: 213 },
        { address: '442 Elm Street', specs: '4 BR • 2.5 BA • 2,290 sq ft', condition: 'Good condition • Original roof (12 years)', price: 478000, date: 'Sold 28 days ago', status: 'sold', sqft: 2290, beds: 4, baths: 2.5, pricePerSqFt: 209 },
        { address: '523 Pine Road', specs: '3 BR • 3 BA • 2,340 sq ft', condition: 'Good condition • Recent updates', price: 465000, date: 'Sold 45 days ago', status: 'sold', sqft: 2340, beds: 3, baths: 3, pricePerSqFt: 199 }
      ]

      const additionalData = {
        customerName: selectedCustomer,
        agentName: 'Sarah Johnson',
        agentCompany: 'Premier Realty',
        agentEmail: 'sarah@premierrealty.com',
        agentPhone: '(214) 555-0123',
        ...(mode === 'cma' && {
          comparables: cmaComparables,
          priceRecommendation: {
            low: 465000,
            recommended: 485000,
            high: 505000
          },
          marketStats: {
            avgDaysOnMarket: 18,
            saleToListRatio: 98.2,
            pricePerSqFt: 205
          },
          negotiationIntelligence: parsedIssues.length > 0 ? {
            issues: parsedIssues,
            totalOpportunity: parsedIssues.reduce((sum, issue) => sum + issue.cost, 0)
          } : null
        })
      }

      const reportData = buildShareableReportData(subjectProperty, properties, mode, additionalData)
      const result = await shareSessionService.createShareSession(reportData)
      
      return result.success ? result.shareUrl : null
    } catch (error) {
      console.error('Failed to generate share link for save:', error)
      return null
    }
  }


  // Voice recording functionality
  const startRecording = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const newRecognition = new SpeechRecognition()
      
      newRecognition.continuous = true
      newRecognition.interimResults = true
      newRecognition.lang = 'en-US'
      
      newRecognition.onstart = () => {
        setIsRecording(true)
      }
      
      newRecognition.onresult = (event) => {
        let finalTranscript = ''
        let interimTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }
        
        if (finalTranscript) {
          const newText = issueInput + (issueInput ? ' ' : '') + finalTranscript
          setIssueInput(newText)
          handleIssueInputChange(newText)
        }
      }
      
      newRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)
      }
      
      newRecognition.onend = () => {
        setIsRecording(false)
      }
      
      newRecognition.start()
      setRecognition(newRecognition)
    } else {
      alert('Speech recognition not supported in this browser')
    }
  }

  const stopRecording = () => {
    if (recognition) {
      recognition.stop()
      setRecognition(null)
    }
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Mock data for different modes
  const discoveryProperties = [
    {
      id: 1,
      address: '456 Oak Avenue',
      city: 'Dallas, TX',
      price: 489900,
      beds: 4,
      baths: 3,
      sqft: 2380,
      yearBuilt: 2018,
      status: 'SOLD',
      daysOnMarket: 18,
      pricePerSqft: 206,
      match: 92,
      image: 'linear-gradient(45deg, #667eea, #764ba2)'
    },
    {
      id: 2,
      address: '789 Pine Street',
      city: 'Dallas, TX',
      price: 445000,
      beds: 3,
      baths: 2,
      sqft: 2100,
      yearBuilt: 2015,
      status: 'ACTIVE',
      daysOnMarket: 12,
      pricePerSqft: 212,
      match: 88,
      image: 'linear-gradient(45deg, #f093fb, #f5576c)'
    },
    {
      id: 3,
      address: '321 Maple Drive',
      city: 'Dallas, TX',
      price: 525000,
      beds: 4,
      baths: 4,
      sqft: 2650,
      yearBuilt: 2020,
      status: 'PENDING',
      daysOnMarket: 8,
      pricePerSqft: 198,
      match: 85,
      image: 'linear-gradient(45deg, #4facfe, #00f2fe)'
    }
  ]

  const cmaData = {
    propertiesAnalyzed: 24,
    averagePrice: 467633,
    averageSize: 2377,
    averagePricePerSqft: 205,
    marketTrend: '+4.8%',
    averageDaysOnMarket: 15,
    priceRange: { min: 395000, max: 595000 },
    recommendations: [
      'Price competitively - market is moving fast',
      'Highlight unique features in listing', 
      'Consider staging for maximum appeal',
      'Be prepared for multiple offers'
    ]
  }

  const rentalData = {
    averageRent: 2850,
    rentPerSqft: 1.35,
    vacancyRate: 4.2,
    averageLease: 12,
    yieldEstimate: 6.8,
    comparableRentals: [
      { address: '123 Oak St', rent: 2750, sqft: 2200 },
      { address: '456 Pine Ave', rent: 2950, sqft: 2400 },
      { address: '789 Elm Dr', rent: 2800, sqft: 2350 }
    ]
  }

  // Comprehensive negotiation database with realistic pricing
  const negotiationDatabase = {
    // OBJECTIVE ISSUES (Structural/Mechanical/Safety)
    roof: {
      patterns: [
        { regex: /roof\s*(leak|patch|repair\s*small|spot\s*repair)/i, scale: 'partial', baseCost: 1500, description: 'Roof patch/small repair' },
        { regex: /partial\s*roof|section\s*of\s*roof|half\s*roof/i, scale: 'partial', baseCost: 8500, description: 'Partial roof replacement' },
        { regex: /(new|replace|full)\s*roof|roof\s*(replacement|needs?\s*replacing)/i, scale: 'full', baseCost: 18500, description: 'Full roof replacement' },
        { regex: /roof/i, scale: 'full', baseCost: 18500, description: 'Roof replacement' } // default
      ],
      type: 'objective',
      category: 'Roof',
      sqftMultiplier: 7.75 // per sqft for full replacement
    },
    
    foundation: {
      patterns: [
        { regex: /minor\s*foundation|small\s*crack|foundation\s*crack/i, scale: 'minor', baseCost: 3500, description: 'Minor foundation repair' },
        { regex: /foundation\s*(issue|problem|repair)/i, scale: 'moderate', baseCost: 8500, description: 'Foundation repairs' },
        { regex: /major\s*foundation|foundation\s*replacement/i, scale: 'major', baseCost: 25000, description: 'Major foundation work' }
      ],
      type: 'objective',
      category: 'Foundation'
    },
    
    electrical: {
      patterns: [
        { regex: /outlet|switch|electrical\s*fixture/i, scale: 'minor', baseCost: 350, description: 'Electrical fixture repair' },
        { regex: /electrical\s*panel|breaker|200\s*amp/i, scale: 'moderate', baseCost: 4500, description: 'Electrical panel upgrade' },
        { regex: /rewire|whole\s*house\s*electrical/i, scale: 'major', baseCost: 12000, description: 'Full electrical rewiring' }
      ],
      type: 'objective',
      category: 'Electrical'
    },
    
    plumbing: {
      patterns: [
        { regex: /faucet|toilet|sink\s*repair/i, scale: 'minor', baseCost: 450, description: 'Plumbing fixture repair' },
        { regex: /water\s*heater/i, scale: 'moderate', baseCost: 2200, description: 'Water heater replacement' },
        { regex: /pipe|plumbing\s*repair/i, scale: 'moderate', baseCost: 3500, description: 'Plumbing repairs' },
        { regex: /repipe|whole\s*house\s*plumbing/i, scale: 'major', baseCost: 8500, description: 'Full house repiping' }
      ],
      type: 'objective',
      category: 'Plumbing'
    },
    
    hvac: {
      patterns: [
        { regex: /ac\s*repair|furnace\s*repair|hvac\s*service/i, scale: 'minor', baseCost: 650, description: 'HVAC service/repair' },
        { regex: /ac\s*unit|furnace|hvac\s*replacement/i, scale: 'full', baseCost: 7500, description: 'HVAC system replacement' },
        { regex: /hvac|heating|cooling|air\s*conditioning/i, scale: 'full', baseCost: 7500, description: 'HVAC replacement' }
      ],
      type: 'objective',
      category: 'HVAC'
    },
    
    windows: {
      patterns: [
        { regex: /(one|1|single)\s*window/i, scale: 'single', baseCost: 650, description: 'Single window replacement' },
        { regex: /(few|some|several)\s*windows?/i, scale: 'partial', baseCost: 2500, description: 'Several windows replacement' },
        { regex: /all\s*windows?|windows?\s*throughout/i, scale: 'full', baseCost: 8500, description: 'All windows replacement' },
        { regex: /windows?/i, scale: 'partial', baseCost: 2500, description: 'Window replacement' }
      ],
      type: 'objective',
      category: 'Windows'
    },
  }

  // Parse subject property details from natural language
  const parseSubjectDetails = (input) => {
    const text = input.toLowerCase()
    const details = []
    
    // Paint/Interior
    if (text.includes('paint') || text.includes('painting')) {
      const roomMatch = text.match(/(\d+x\d+|\d+\s*x\s*\d+)\s*(\w+\s*\w*\s*room|\w+)/i)
      const room = roomMatch ? roomMatch[0] : 'interior spaces'
      details.push({
        icon: '🎨',
        title: 'Interior Paint',
        desc: `Wants new paint in ${room}`,
        type: 'planned'
      })
    }
    
    // Kitchen updates
    if (text.includes('kitchen') || text.includes('countertop') || text.includes('appliance')) {
      details.push({
        icon: '🔧',
        title: 'Kitchen Updates',
        desc: 'Kitchen renovation with updated countertops and appliances',
        type: text.includes('want') || text.includes('need') ? 'planned' : 'completed'
      })
    }
    
    // Flooring
    if (text.includes('floor') || text.includes('carpet') || text.includes('hardwood') || text.includes('tile')) {
      details.push({
        icon: '🏠',
        title: 'Flooring',
        desc: `Flooring updates: ${text.match(/\b\w*floor\w*|\b\w*carpet\w*|\b\w*hardwood\w*|\b\w*tile\w*/gi)?.[0] || 'flooring improvements'}`,
        type: text.includes('want') || text.includes('need') ? 'planned' : 'completed'
      })
    }
    
    // Bathroom
    if (text.includes('bathroom') || text.includes('bath')) {
      details.push({
        icon: '🚿',
        title: 'Bathroom Updates',
        desc: 'Bathroom renovation or updates',
        type: text.includes('want') || text.includes('need') ? 'planned' : 'completed'
      })
    }
    
    // Windows/Doors
    if (text.includes('window') || text.includes('door')) {
      details.push({
        icon: '🪟',
        title: 'Windows & Doors',
        desc: 'Window or door improvements',
        type: text.includes('want') || text.includes('need') ? 'planned' : 'completed'
      })
    }
    
    return details
  }
  
  // Handle subject input changes
  const handleSubjectInputChange = (value) => {
    setSubjectInput(value)
    if (value.trim()) {
      const parsed = parseSubjectDetails(value)
      // Merge with existing details, avoiding duplicates
      const existing = parsedSubjectDetails.filter(detail => 
        !parsed.some(p => p.title === detail.title)
      )
      setParsedSubjectDetails([...existing, ...parsed])
    }
  }

  const parseIssues = (text) => {
    const found = []
    const lowerText = text.toLowerCase()
    
    // Parse subjective issues (desires, wants, preferences)
    const parseSubjectiveIssues = (text) => {
      const subjective = []
      
      // Paint/Interior desires
      if (text.includes('paint') || text.includes('painting')) {
        const roomMatch = text.match(/(\d+x\d+|\d+\s*x\s*\d+)\s*(\w+\s*\w*\s*room|\w+)/i)
        const room = roomMatch ? roomMatch[0] : 'interior spaces'
        const sqft = roomMatch ? parseInt(roomMatch[1].replace('x', '')) * parseInt(roomMatch[1].split('x')[1]) : 400
        subjective.push({
          type: 'subjective',
          category: 'Interior',
          issue: `Wants new paint in ${room}`,
          cost: Math.min(sqft * 3, 2500), // $3 per sqft, max $2500
          severity: 'cosmetic',
          description: `Owner desires fresh paint for ${room}`,
          negotiable: true
        })
      }
      
      // Kitchen desires
      if (text.includes('kitchen') && (text.includes('want') || text.includes('update') || text.includes('remodel'))) {
        subjective.push({
          type: 'subjective',
          category: 'Kitchen',
          issue: 'Wants kitchen updates',
          cost: 15000,
          severity: 'moderate',
          description: 'Owner desires kitchen improvements',
          negotiable: true
        })
      }
      
      // Flooring desires
      if ((text.includes('floor') || text.includes('carpet') || text.includes('hardwood')) && 
          (text.includes('want') || text.includes('replace') || text.includes('update'))) {
        subjective.push({
          type: 'subjective',
          category: 'Flooring',
          issue: 'Wants flooring updates',
          cost: 8000,
          severity: 'moderate',
          description: 'Owner desires new flooring',
          negotiable: true
        })
      }
      
      // Bathroom desires
      if (text.includes('bathroom') && (text.includes('want') || text.includes('update') || text.includes('remodel'))) {
        subjective.push({
          type: 'subjective',
          category: 'Bathroom',
          issue: 'Wants bathroom updates',
          cost: 12000,
          severity: 'moderate',
          description: 'Owner desires bathroom improvements',
          negotiable: true
        })
      }
      
      return subjective
    }
    
    // Add subjective issues
    found.push(...parseSubjectiveIssues(lowerText))
    
    // Check each category in the database for objective issues
    Object.entries(negotiationDatabase).forEach(([key, category]) => {
      // Check each pattern in the category
      for (const pattern of category.patterns) {
        if (pattern.regex.test(lowerText)) {
          // Calculate adjusted cost based on property specifics
          let adjustedCost = pattern.baseCost
          
          // Highland Park premium (10-15% depending on type)
          const locationMultiplier = category.type === 'objective' ? 1.1 : 1.15
          adjustedCost = Math.round(adjustedCost * locationMultiplier)
          
          // Add to found issues (avoid duplicates)
          if (!found.some(f => f.category === category.category)) {
            found.push({
              type: category.type,
              category: category.category,
              description: pattern.description,
              cost: adjustedCost,
              scale: pattern.scale,
              id: Math.random().toString(36).substr(2, 9)
            })
          }
          break // Use first matching pattern
        }
      }
    })
    
    return found
  }

  const handleIssueInputChange = (text) => {
    setIssueInput(text)
    if (text.trim()) {
      const parsed = parseIssues(text)
      setParsedIssues(parsed)
    } else {
      setParsedIssues([])
    }
  }

  const PropertyCard = ({ property }) => (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      overflow: 'hidden',
      marginBottom: '16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    }}>
      {/* Property Image */}
      <div style={{
        height: '140px',
        background: property.image,
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <div style={{
            background: property.status === 'SOLD' ? 'rgba(16,185,129,0.9)' : 
                       property.status === 'ACTIVE' ? 'rgba(59,130,246,0.9)' : 'rgba(245,158,11,0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: '700'
          }}>{property.status}</div>
          <div style={{
            background: 'rgba(59,130,246,0.9)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: '700'
          }}>{property.match}% match</div>
        </div>
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '900' }}>
            ${property.price.toLocaleString()}
          </div>
        </div>
      </div>
      
      {/* Property Info */}
      <div style={{ padding: '16px' }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '8px'
        }}>{property.address}</div>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          marginBottom: '12px'
        }}>{property.city}</div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <span>{property.beds} bed, {property.baths} bath</span>
          <span>{property.sqft.toLocaleString()} sq ft</span>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#64748b',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <span>{property.daysOnMarket} days</span>
          <span>${property.pricePerSqft}/sqft</span>
          <span>Built {property.yearBuilt}</span>
        </div>
      </div>
    </div>
  )

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
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('analysis')}
        >←</div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b'
        }}>
          {mode === 'discovery' ? 'Property Discovery' : 'CMA Results'}
        </div>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(248,250,252,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}>
          <Filter size={18} />
        </div>
      </div>


      {/* Content */}
      <div style={{
        flex: '1',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch'
      }}>
        {mode === 'discovery' ? (
          // DISCOVERY MODE
          <div style={{ padding: '20px' }}>
            {/* Summary Stats */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px'
              }}>Active Properties Found</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#3b82f6'
                  }}>{discoveryProperties.length}</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Properties</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#10b981'
                  }}>
                    {Math.round(discoveryProperties.reduce((acc, p) => acc + p.match, 0) / discoveryProperties.length)}%
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Avg Match</div>
                </div>
              </div>
            </div>

            {/* Property List */}
            {discoveryProperties.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
            
            {/* Action Buttons for Discovery */}
            <div style={{ marginTop: '32px', marginBottom: '40px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px'
              }}>
                <button onClick={saveToProfile} style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <Download size={16} />
                  Save
                </button>
                <button 
                  onClick={generateShareLink}
                  disabled={isGeneratingLink}
                  style={{
                    background: isGeneratingLink ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    padding: '12px 8px',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isGeneratingLink ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    opacity: isGeneratingLink ? 0.7 : 1
                  }}>
                  <Link size={16} />
                  {isGeneratingLink ? 'Creating...' : 'Link'}
                </button>
                <button style={{
                  background: 'white',
                  color: '#3b82f6',
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: '2px solid #3b82f6',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <Share size={16} />
                  Share
                </button>
              </div>
            </div>
          </div>
        ) : (
          // CMA MODE
          <div style={{ padding: '20px' }}>
            {/* CMA Type Toggle */}
            <div style={{
              display: 'flex',
              background: 'white',
              borderRadius: '12px',
              padding: '4px',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedType === 'sale' ? '#3b82f6' : 'transparent',
                  color: selectedType === 'sale' ? 'white' : '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedType('sale')}
              >
                Sales CMA
              </button>
              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedType === 'rental' ? '#3b82f6' : 'transparent',
                  color: selectedType === 'rental' ? 'white' : '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedType('rental')}
              >
                Rental CMA
              </button>
            </div>

            {selectedType === 'sale' ? (
              // SALES CMA
              <>
                {/* CMA Tab Navigation */}
                <div style={{
                  display: 'flex',
                  background: 'white',
                  borderRadius: '12px',
                  padding: '4px',
                  marginBottom: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  overflow: 'hidden'
                }}>
                  {[
                    { id: 'subject', label: 'Subject Property' },
                    { id: 'comparables', label: 'Comparables' },
                    { id: 'negotiation', label: 'Intelligence' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: 'none',
                        background: cmaTab === tab.id ? '#3b82f6' : 'transparent',
                        color: cmaTab === tab.id ? 'white' : '#64748b',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      onClick={() => setCmaTab(tab.id)}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {cmaTab === 'subject' && (
                  // SUBJECT PROPERTY TAB
                  <>
                    {/* Executive Summary */}
                    <div style={{
                      background: 'linear-gradient(135deg, #e0f2fe, #dbeafe)',
                      borderRadius: '20px',
                      padding: '24px',
                      marginBottom: '20px',
                      border: '1px solid #3b82f6'
                    }}>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '800',
                        color: '#1d4ed8',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        📊 Executive Summary
                      </h3>
                      <div style={{
                        textAlign: 'center',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: '900',
                          color: '#1d4ed8',
                          marginBottom: '4px'
                        }}>$465,000 - $495,000</div>
                        <div style={{
                          fontSize: '14px',
                          color: '#1e40af',
                          marginBottom: '8px'
                        }}>High confidence • 6 comparables analyzed</div>
                        <div style={{
                          background: '#fef3c7',
                          color: '#d97706',
                          padding: '8px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>⚠️</span>
                          <span>Roof condition requires attention</span>
                        </div>
                      </div>
                    </div>

                    {/* Property Details */}
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          background: 'linear-gradient(45deg, #667eea, #764ba2)',
                          borderRadius: '12px',
                          flexShrink: 0
                        }}></div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '700',
                            color: '#1e293b',
                            marginBottom: '4px'
                          }}>456 Oak Avenue, Dallas, TX</div>
                          <div style={{
                            fontSize: '14px',
                            color: '#64748b',
                            marginBottom: '8px'
                          }}>4 BR • 3 BA • 2,380 sq ft • Built 2018</div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '12px'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              background: '#f59e0b',
                              borderRadius: '4px'
                            }}></div>
                            <span style={{ color: '#d97706', fontWeight: '600' }}>Seller's disclosure analyzed</span>
                          </div>
                        </div>
                      </div>

                      {/* Subject Property Details & Improvements */}
                      <div style={{
                        background: '#f0fdf4',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        borderLeft: '4px solid #10b981'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '12px'
                        }}>🏠 Property Details & Improvements</h4>
                        
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {parsedSubjectDetails.map((item, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px'
                            }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '10px',
                                background: item.type === 'planned' ? '#fef3c7' : '#dcfce7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>{item.icon}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginBottom: '2px'
                                }}>
                                  <div style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#1e293b'
                                  }}>{item.title}</div>
                                  <div style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: item.type === 'planned' ? '#fbbf24' : '#10b981',
                                    color: 'white',
                                    fontWeight: '600'
                                  }}>{item.type === 'planned' ? 'PLANNED' : 'DONE'}</div>
                                </div>
                                <div style={{
                                  fontSize: '12px',
                                  color: '#64748b',
                                  lineHeight: '1.4'
                                }}>{item.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Disclosure Analysis */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '12px'
                        }}>🔍 Disclosure Analysis</h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {[
                            { icon: '⚠️', type: 'warning', title: 'Roof Condition Alert', desc: 'Seller disclosed roof leak repairs in 2023. Age: 6 years. Recommend inspection.' },
                            { icon: 'ℹ️', type: 'info', title: 'HVAC System', desc: 'New HVAC installed 2022. Good condition with warranty remaining.' },
                            { icon: '✓', type: 'good', title: 'Foundation', desc: 'No foundation issues disclosed. Recent engineering report clean.' }
                          ].map((item, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px'
                            }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '10px',
                                background: item.type === 'warning' ? '#fef3c7' :
                                           item.type === 'info' ? '#dbeafe' : '#dcfce7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                flexShrink: 0,
                                marginTop: '1px'
                              }}>{item.icon}</div>
                              <div>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#1e293b',
                                  marginBottom: '2px'
                                }}>{item.title}</div>
                                <div style={{
                                  fontSize: '12px',
                                  color: '#64748b',
                                  lineHeight: '1.4'
                                }}>{item.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Seller Motivation Analysis */}
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        Subject Property Seller Motivation
                      </h3>

                      {/* High Motivation Property */}
                      <div style={{
                        background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
                        borderRadius: '16px',
                        padding: '20px',
                        border: '2px solid #f59e0b'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          marginBottom: '12px'
                        }}>
                          <div style={{
                            fontSize: '32px',
                            fontWeight: '900',
                            color: '#dc2626'
                          }}>88%</div>
                          <div>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>456 Oak Avenue (Subject)</div>
                            <div style={{
                              fontSize: '12px',
                              color: '#78716c',
                              fontWeight: '600'
                            }}>HIGH MOTIVATION</div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {[
                            { icon: '🏠', text: 'Already purchased replacement home' },
                            { icon: '📅', text: 'Carrying two mortgages for 45 days' },
                            { icon: '💰', text: 'Motivated to close quickly' },
                            { icon: '🔧', text: 'Disclosed roof issues suggest transparency' }
                          ].map((indicator, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              color: '#78716c'
                            }}>
                              <span style={{ fontSize: '14px' }}>{indicator.icon}</span>
                              <span>{indicator.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {cmaTab === 'comparables' && (
                  // COMPARABLES TAB
                  <>
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        Selected Comparables
                        <span style={{
                          background: '#e0f2fe',
                          color: '#0284c7',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>6 properties</span>
                      </h3>

                      {[
                        { address: '458 Oak Avenue', specs: '4 BR • 3 BA • 2,420 sq ft', condition: 'Excellent condition • New roof 2023', price: '$515,000', date: 'Sold 15 days ago', dot: '#10b981' },
                        { address: '442 Elm Street', specs: '4 BR • 2.5 BA • 2,290 sq ft', condition: 'Good condition • Original roof (12 years)', price: '$478,000', date: 'Sold 28 days ago', dot: '#f59e0b' },
                        { address: '523 Pine Road', specs: '3 BR • 3 BA • 2,340 sq ft', condition: 'Good condition • Recent updates', price: '$465,000', date: 'Sold 45 days ago', dot: '#10b981' },
                        { address: '612 Maple Drive', specs: '4 BR • 3 BA • 2,450 sq ft', condition: 'Fair condition • Needs cosmetic work', price: '$445,000', date: 'Sold 38 days ago', dot: '#f59e0b' },
                        { address: '789 Cedar Lane', specs: '4 BR • 2.5 BA • 2,380 sq ft', condition: 'Excellent condition • Move-in ready', price: '$495,000', date: 'Sold 22 days ago', dot: '#10b981' },
                        { address: '334 Birch Street', specs: '3 BR • 3 BA • 2,180 sq ft', condition: 'Good condition • Minor repairs needed', price: '$458,000', date: 'Sold 33 days ago', dot: '#10b981' }
                      ].map((comp, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '16px 0',
                          borderBottom: index < 5 ? '1px solid #e5e7eb' : 'none'
                        }}>
                          <div style={{
                            width: '60px',
                            height: '60px',
                            background: `linear-gradient(45deg, ${comp.dot}, ${comp.dot}90)`,
                            borderRadius: '8px',
                            flexShrink: 0
                          }}></div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>{comp.address}</div>
                            <div style={{
                              fontSize: '12px',
                              color: '#64748b',
                              marginBottom: '4px'
                            }}>{comp.specs}</div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '11px'
                            }}>
                              <div style={{
                                width: '6px',
                                height: '6px',
                                background: comp.dot,
                                borderRadius: '3px'
                              }}></div>
                              <span style={{ color: '#64748b' }}>{comp.condition}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b',
                              marginBottom: '2px'
                            }}>{comp.price}</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>{comp.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {cmaTab === 'negotiation' && (
                  // NEGOTIATION INTELLIGENCE TAB
                  <>
                    <div style={{
                      background: 'white',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '20px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#1e293b',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        Negotiation Intelligence
                      </h3>

                      {/* Neighborhood Intelligence */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '12px'
                        }}>Highland Park Neighborhood Intelligence</h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '12px'
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#16a34a'
                            }}>18 days</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>Avg Days on Market</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#3b82f6'
                            }}>$485K</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>Median Price ($450-520K)</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#f59e0b'
                            }}>3.2%</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>YoY Price Growth</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: '20px',
                              fontWeight: '900',
                              color: '#dc2626'
                            }}>Fast</div>
                            <div style={{
                              fontSize: '11px',
                              color: '#64748b'
                            }}>Market Pace</div>
                          </div>
                        </div>
                      </div>

                      {/* Issues Parser */}
                      <div style={{
                        background: 'rgba(139,92,246,0.05)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '20px',
                        border: '1px solid rgba(139,92,246,0.2)'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: '#1e293b',
                          marginBottom: '12px'
                        }}>
                          Issues
                        </h4>
                        
                        <div style={{
                          background: '#ffffff',
                          border: '2px dashed #d1d5db',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '12px',
                          position: 'relative'
                        }}>
                          <textarea
                            placeholder="Describe property issues and defects (e.g., 'needs new roof', 'foundation concerns', 'HVAC problems', 'electrical issues')..."
                            value={issueInput}
                            onChange={(e) => handleIssueInputChange(e.target.value)}
                            style={{
                              width: '100%',
                              minHeight: '60px',
                              border: 'none',
                              outline: 'none',
                              fontSize: '13px',
                              color: '#374151',
                              backgroundColor: 'transparent',
                              resize: 'vertical',
                              paddingRight: '40px'
                            }}
                          />
                          <button
                            onClick={toggleRecording}
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              background: isRecording ? '#ef4444' : '#6b7280',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                              animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                            }}
                            title={isRecording ? 'Stop recording' : 'Start voice input'}
                          >
                            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                          </button>
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: parsedIssues.length > 0 ? '16px' : '0'
                        }}>
                          {[
                            'needs new roof',
                            'foundation issues', 
                            'HVAC problems',
                            'electrical issues',
                            'plumbing leaks',
                            'window replacement needed'
                          ].map((phrase, index) => (
                            <button
                              key={index}
                              onClick={() => handleIssueInputChange(issueInput + (issueInput ? ', ' : '') + phrase)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                background: '#f9fafb',
                                fontSize: '11px',
                                color: '#4b5563',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >{phrase}</button>
                          ))}
                        </div>

                        {/* Live Parsed Results */}
                        {parsedIssues.length > 0 && (
                          <div style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid #e5e7eb'
                          }}>
                            <div style={{
                              fontWeight: '600',
                              color: '#1e293b',
                              marginBottom: '12px',
                              fontSize: '14px'
                            }}>Parsed Issues:</div>
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {parsedIssues.map((issue) => (
                                <div key={issue.id} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  background: '#f8fafc',
                                  borderRadius: '6px',
                                  borderLeft: `4px solid ${issue.type === 'objective' ? '#dc2626' : '#8b5cf6'}`
                                }}>
                                  <div>
                                    <div style={{
                                      fontSize: '13px',
                                      fontWeight: '600',
                                      color: '#1e293b'
                                    }}>{issue.category}</div>
                                    <div style={{
                                      fontSize: '11px',
                                      color: '#64748b'
                                    }}>{issue.description}</div>
                                    <div style={{
                                      fontSize: '10px',
                                      color: issue.type === 'objective' ? '#dc2626' : '#8b5cf6',
                                      fontWeight: '600',
                                      textTransform: 'uppercase'
                                    }}>{issue.type}</div>
                                  </div>
                                  <div style={{
                                    fontSize: '14px',
                                    fontWeight: '700',
                                    color: issue.type === 'objective' ? '#dc2626' : '#8b5cf6'
                                  }}>-${issue.cost.toLocaleString()}</div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Total */}
                            <div style={{
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid #e5e7eb',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#1e293b'
                              }}>Total Estimated Impact:</div>
                              <div style={{
                                fontSize: '16px',
                                fontWeight: '900',
                                color: '#dc2626'
                              }}>-${parsedIssues.reduce((total, issue) => total + issue.cost, 0).toLocaleString()}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Total Opportunity */}
                      <div style={{
                        textAlign: 'center',
                        padding: '20px',
                        background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1))',
                        borderRadius: '12px',
                        marginBottom: '20px'
                      }}>
                        <div style={{
                          fontSize: '28px',
                          fontWeight: '900',
                          color: '#dc2626',
                          marginBottom: '4px'
                        }}>${(parsedIssues.reduce((sum, issue) => sum + issue.cost, 0)).toLocaleString()}</div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#374151',
                          marginBottom: '6px'
                        }}>Total Negotiation Opportunity</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>
                          Objective Issues: ${parsedIssues.filter(i => i.type === 'objective').reduce((sum, issue) => sum + issue.cost, 0).toLocaleString()} • 
                          Subjective Issues: ${parsedIssues.filter(i => i.type === 'subjective').reduce((sum, issue) => sum + issue.cost, 0).toLocaleString()}
                        </div>
                      </div>

                      {/* Objective Issues */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                        borderLeft: '4px solid #dc2626'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                          paddingBottom: '8px',
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#1e293b'
                            }}>Property Issues</span>
                          </div>
                          <span style={{
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#dc2626'
                          }}>${parsedIssues.filter(i => i.type === 'objective').reduce((sum, issue) => sum + issue.cost, 0).toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'grid', gap: '12px' }}>
                          {parsedIssues.filter(i => i.type === 'objective').map((issue, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              background: '#ffffff',
                              borderRadius: '8px',
                              borderLeft: `4px solid ${issue.impact === 'high' ? '#dc2626' : issue.impact === 'medium' ? '#f59e0b' : '#6b7280'}`
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#1e293b',
                                  marginBottom: '2px'
                                }}>{issue.description}</div>
                                <div style={{
                                  fontSize: '11px',
                                  color: '#64748b',
                                  lineHeight: '1.3'
                                }}>{issue.category} - {issue.scale}</div>
                              </div>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '700',
                                color: '#dc2626',
                                flexShrink: 0
                              }}>-${issue.cost.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Subjective Issues */}
                      {parsedIssues.filter(i => i.type === 'subjective').length > 0 && (
                        <div style={{
                          background: '#fef7ff',
                          borderRadius: '12px',
                          padding: '16px',
                          marginBottom: '16px',
                          borderLeft: '4px solid #8b5cf6'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: '1px solid #e2e8f0'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              <span style={{
                                fontSize: '16px',
                                fontWeight: '700',
                                color: '#1e293b'
                              }}>Seller Desires & Preferences</span>
                            </div>
                            <span style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              color: '#8b5cf6'
                            }}>-${parsedIssues.filter(i => i.type === 'subjective').reduce((sum, issue) => sum + issue.cost, 0).toLocaleString()}</span>
                          </div>
                          
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {parsedIssues.filter(issue => issue.type === 'subjective').map((issue, index) => (
                              <div key={index} style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '8px 0'
                              }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#1e293b',
                                    marginBottom: '2px'
                                  }}>{issue.issue}</div>
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#64748b',
                                    lineHeight: '1.3'
                                  }}>{issue.description} - {issue.negotiable ? 'Negotiable' : 'Non-negotiable'}</div>
                                </div>
                                <div style={{
                                  fontSize: '14px',
                                  fontWeight: '700',
                                  color: '#8b5cf6',
                                  flexShrink: 0
                                }}>-${issue.cost.toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Strategy Recommendations */}
                      <div style={{
                        background: 'rgba(59,130,246,0.05)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid rgba(59,130,246,0.2)'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: '#1e293b'
                          }}>Recommended Strategy</span>
                        </div>

                        <div style={{ display: 'grid', gap: '8px' }}>
                          {[
                            { tag: 'Opening', text: 'Lead with roof concerns ($12K) + electrical ($4.5K) = $16.5K reduction', color: '#dc2626' },
                            { tag: 'Fallback', text: 'Accept $10K seller concession + roof inspection contingency', color: '#f59e0b' },
                            { tag: 'Final', text: 'Minimum: $8K adjustment for roof safety concerns only', color: '#16a34a' }
                          ].map((strategy, index) => (
                            <div key={index} style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              padding: '12px',
                              background: '#ffffff',
                              borderRadius: '8px',
                              border: `1px solid ${strategy.color}20`
                            }}>
                              <div style={{
                                background: strategy.color,
                                color: 'white',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '700',
                                flexShrink: 0
                              }}>{strategy.tag}</div>
                              <div style={{
                                fontSize: '12px',
                                color: '#374151',
                                lineHeight: '1.4'
                              }}>{strategy.text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              // RENTAL CMA
              <>
                {/* Rental Summary */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
                  borderRadius: '20px',
                  padding: '24px',
                  marginBottom: '20px',
                  border: '1px solid #10b981'
                }}>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    color: '#047857',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Building size={24} />
                    Rental Analysis
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>${rentalData.averageRent.toLocaleString()}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Average Rent</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>${rentalData.rentPerSqft}</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Rent per sqft</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>{rentalData.vacancyRate}%</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Vacancy Rate</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#047857'
                      }}>{rentalData.yieldEstimate}%</div>
                      <div style={{
                        fontSize: '12px',
                        color: '#065f46'
                      }}>Est. Yield</div>
                    </div>
                  </div>
                </div>

                {/* Comparable Rentals */}
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1e293b',
                    marginBottom: '16px'
                  }}>Comparable Rentals</h3>
                  {rentalData.comparableRentals.map((rental, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: index < rentalData.comparableRentals.length - 1 ? '1px solid #e5e7eb' : 'none'
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1e293b'
                        }}>{rental.address}</div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>{rental.sqft.toLocaleString()} sq ft</div>
                      </div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#10b981'
                      }}>${rental.rent.toLocaleString()}/mo</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div style={{ marginTop: '32px', marginBottom: '40px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                <button onClick={saveToProfile} style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: 'white',
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <Download size={16} />
                  Save
                </button>
                <button 
                  onClick={generateShareLink}
                  disabled={isGeneratingLink}
                  style={{
                    background: isGeneratingLink ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    padding: '12px 8px',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isGeneratingLink ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    opacity: isGeneratingLink ? 0.7 : 1
                  }}>
                  <Link size={16} />
                  {isGeneratingLink ? 'Creating...' : 'Link'}
                </button>
                <button style={{
                  background: 'white',
                  color: '#3b82f6',
                  padding: '12px 8px',
                  borderRadius: '12px',
                  border: '2px solid #3b82f6',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <Share size={16} />
                  Share
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && shareResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '90%',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            position: 'relative'
          }}>
            {/* Close button */}
            <button 
              onClick={closeShareModal}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#64748b',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >×</button>
            
            {/* Modal content */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '24px',
                marginBottom: '8px'
              }}>🔗</div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '8px'
              }}>
                Share Link Created!
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                marginBottom: '16px'
              }}>
                Share this link with your client to view the {mode === 'discovery' ? 'property discovery' : selectedType === 'rental' ? 'rental analysis' : 'CMA report'}
              </p>
              
              {/* Customer Selection */}
              <div style={{
                marginBottom: '20px',
                textAlign: 'left'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '6px'
                }}>Customer Profile:</label>
                <select 
                  value={selectedCustomer}
                  onChange={(e) => {
                    setSelectedCustomer(e.target.value)
                    localStorage.setItem('selectedCustomer', e.target.value)
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '14px',
                    color: '#374151',
                    background: 'white'
                  }}
                >
                  {customerProfiles.map(customer => (
                    <option key={customer} value={customer}>{customer}</option>
                  ))}
                </select>
              </div>
              
              {/* Share URL */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <input 
                  type="text" 
                  value={shareResult.shareUrl}
                  readOnly
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    fontSize: '12px',
                    color: '#374151',
                    outline: 'none'
                  }}
                />
                <button 
                  onClick={copyShareLink}
                  style={{
                    background: linkCopied ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background 0.3s ease'
                  }}
                >
                  {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              
              {/* Share info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>30 days</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Expires in</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>Unlimited</div>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b'
                  }}>Access</div>
                </div>
              </div>
              
              {/* Action buttons */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                justifyContent: 'center'
              }}>
                <button 
                  onClick={viewShareLink}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>👁️</span>
                  View
                </button>
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `FlashStack ${mode === 'discovery' ? 'Property Discovery' : selectedType === 'rental' ? 'Rental Analysis' : 'CMA Report'}`,
                        text: `Check out this ${mode === 'discovery' ? 'property discovery' : selectedType === 'rental' ? 'rental analysis' : 'CMA report'} for ${selectedCustomer}`,
                        url: shareResult.shareUrl
                      })
                    } else {
                      copyShareLink()
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Share size={14} />
                  Share
                </button>
                <button 
                  onClick={closeShareModal}
                  style={{
                    background: 'white',
                    color: '#64748b',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    padding: '12px 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResultsScreen