/**
 * TaxRollProcessor - Downloads and processes Dallas County Tax Roll data
 * 
 * Downloads the weekly tax roll file, unzips it, parses the ASCII data,
 * and creates a searchable database of tax delinquent properties.
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const yauzl = require('yauzl-promise'); // For unzipping
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const Logger = require('../utils/Logger');

class TaxRollProcessor {
  constructor() {
    this.logger = new Logger('TaxRollProcessor', {
      logLevel: 'info',
      enableConsole: true
    });
    
    this.taxRollURL = 'https://www.dallascounty.org/Assets/uploads/docs/tax/trw/trwfile.701243.zip';
    this.dataDir = path.join(__dirname, '../data');
    this.dbPath = path.join(this.dataDir, 'tax_roll.db');
    this.zipPath = path.join(this.dataDir, 'tax_roll.zip');
    
    this.db = null;
    
    this.logger.info('TaxRollProcessor initialized', {
      taxRollURL: this.taxRollURL,
      dataDir: this.dataDir,
      dbPath: this.dbPath
    });
  }

  /**
   * Initialize the database and create tables
   */
  async initializeDatabase() {
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });
      
      // Create tax roll table with all Dallas County fields
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS tax_roll (
          account_id TEXT PRIMARY KEY,
          property_id TEXT,
          tax_year INTEGER,
          jurisdiction TEXT,
          owner_name TEXT,
          owner_address TEXT,
          property_address TEXT,
          city TEXT,
          state TEXT,
          zip_code TEXT,
          parcel_number INTEGER,
          roll_code TEXT,
          category_code TEXT,
          tax_amount REAL,
          delinquent_amount REAL,
          total_amount_due REAL,
          total_amount_due_30 REAL,
          total_amount_due_60 REAL,
          total_amount_due_90 REAL,
          court_cost REAL,
          abstract_fee REAL,
          total_value REAL,
          delinquent_years INTEGER,
          is_delinquent BOOLEAN,
          payment_status TEXT,
          date_paid TEXT,
          due_date TEXT,
          exemptions TEXT,
          homestead_exemption BOOLEAN,
          over65_exemption BOOLEAN,
          veteran_exemption BOOLEAN,
          disabled_exemption BOOLEAN,
          ag_exemption BOOLEAN,
          payment_agreement BOOLEAN,
          deferred BOOLEAN,
          suit_pending BOOLEAN,
          bankruptcy_filed BOOLEAN,
          attorney_date_set BOOLEAN,
          cause_number TEXT,
          bankruptcy_number TEXT,
          omit_flag TEXT,
          bill_supp_flag TEXT,
          split_payment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create indexes for fast searching
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_city ON tax_roll(city);
        CREATE INDEX IF NOT EXISTS idx_delinquent ON tax_roll(is_delinquent);
        CREATE INDEX IF NOT EXISTS idx_property_address ON tax_roll(property_address);
        CREATE INDEX IF NOT EXISTS idx_delinquent_amount ON tax_roll(delinquent_amount);
      `);

      // Legal events (pre-foreclosure / lis pendens) — populated by
      // ingest_legal_events.js. Created here so discovery's LEFT JOIN always
      // resolves even before any feed is loaded.
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS legal_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id TEXT,
          event_type TEXT,
          address TEXT,
          owner_name TEXT,
          filed_date TEXT,
          sale_date TEXT,
          source TEXT,
          match_method TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_legal_events_account ON legal_events(account_id);
      `);

      // Skip-trace contact info (phone/email) — populated by ingest_contacts.js
      // or a live provider. Phones carry a per-number DNC status; not callable
      // until scrubbed (see SkipTraceService).
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
          account_id TEXT PRIMARY KEY,
          owner_name TEXT,
          phones TEXT,
          emails TEXT,
          source TEXT,
          dnc_checked_at TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Voter-file demographics (owner age, empty-nester) — populated by
      // ingest_voters.js. Empty until a voter file is loaded.
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS voter_demographics (
          account_id TEXT PRIMARY KEY,
          owner_age INTEGER,
          household_size INTEGER,
          youngest_age INTEGER,
          oldest_age INTEGER,
          empty_nester INTEGER DEFAULT 0,
          source TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      this.logger.info('Database initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize database', { error: error.message });
      throw error;
    }
  }

  /**
   * Download the latest tax roll file
   */
  async downloadTaxRoll() {
    try {
      this.logger.info('Downloading Dallas County Tax Roll...', { url: this.taxRollURL });
      
      const response = await axios.get(this.taxRollURL, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 60000 // 1 minute timeout
      });
      
      await fs.writeFile(this.zipPath, response.data);
      
      const fileSizeMB = Math.round(response.data.length / 1024 / 1024);
      this.logger.info('Tax roll downloaded successfully', { 
        size: `${fileSizeMB}MB`,
        path: this.zipPath 
      });
      
      return this.zipPath;
      
    } catch (error) {
      this.logger.error('Failed to download tax roll', { error: error.message });
      throw error;
    }
  }

  /**
   * Unzip the tax roll file
   */
  async unzipTaxRoll() {
    try {
      this.logger.info('Unzipping tax roll file...', { zipPath: this.zipPath });
      
      const zip = await yauzl.open(this.zipPath);
      const extractedFiles = [];
      
      // Process entries sequentially instead of for-await
      const entries = [];
      for await (const entry of zip) {
        entries.push(entry);
      }
      
      // Process each entry
      for (const entry of entries) {
        if (entry.filename.endsWith('/')) {
          // Skip directories
          continue;
        }
        
        const extractPath = path.join(this.dataDir, path.basename(entry.filename)); // Flatten directory structure
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(extractPath), { recursive: true });
        
        const readStream = await entry.openReadStream();
        const writeStream = require('fs').createWriteStream(extractPath);
        
        await new Promise((resolve, reject) => {
          readStream.pipe(writeStream);
          writeStream.on('close', resolve);
          writeStream.on('error', reject);
          readStream.on('error', reject);
        });
        
        extractedFiles.push(extractPath);
        this.logger.debug('Extracted file', { filename: entry.filename, size: entry.uncompressedSize });
      }
      
      // Close zip after processing all entries
      await zip.close();
      
      this.logger.info('Tax roll unzipped successfully', { 
        filesExtracted: extractedFiles.length,
        files: extractedFiles.map(f => path.basename(f))
      });
      
      return extractedFiles;
      
    } catch (error) {
      this.logger.error('Failed to unzip tax roll', { error: error.message });
      throw error;
    }
  }

  /**
   * Parse the ASCII tax roll data file
   */
  async parseTaxRollData(filePath) {
    try {
      this.logger.info('Parsing tax roll data...', { filePath });
      
      const data = await fs.readFile(filePath, 'ascii');
      const lines = data.split('\n');
      
      this.logger.info(`Processing ${lines.length} records from tax roll`);
      
      let processedCount = 0;
      let delinquentCount = 0;
      
      // Clear existing data (optional - could be done only on full refresh)
      await this.db.exec('DELETE FROM tax_roll');
      
      // Begin transaction for better performance
      await this.db.exec('BEGIN TRANSACTION');
      
      try {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const record = this.parseDataLine(line);
          if (record) {
            await this.insertTaxRecord(record);
            processedCount++;
            
            if (record.is_delinquent) {
              delinquentCount++;
            }
            
            // Log progress every 10,000 records
            if (processedCount % 10000 === 0) {
              this.logger.debug(`Processed ${processedCount} records...`);
            }
          }
        }
        
        // Commit transaction
        await this.db.exec('COMMIT');
        
        this.logger.info('Tax roll data parsed successfully', {
          totalProcessed: processedCount,
          delinquentProperties: delinquentCount,
          delinquentRate: `${((delinquentCount / processedCount) * 100).toFixed(2)}%`
        });
        
      } catch (error) {
        // Rollback transaction on error
        await this.db.exec('ROLLBACK');
        throw error;
      }
      
    } catch (error) {
      this.logger.error('Failed to parse tax roll data', { error: error.message });
      throw error;
    }
  }

  /**
   * Parse a single data line from the tax roll file
   * Based on Dallas County Tax Roll file layout specification
   */
  parseDataLine(line) {
    try {
      // Tax roll is fixed-width ASCII format - minimum 534 characters based on layout
      if (line.length < 534) return null; // Skip short lines
      
      // Parse using actual Dallas County Tax Roll field positions
      const record = {
        // Field 1: ACCOUNT (1-34)
        account_id: line.substring(0, 34).trim(),
        
        // Field 2: YEAR (35-38)
        tax_year: parseInt(line.substring(34, 38)) || new Date().getFullYear(),
        
        // Field 3: JURISDICTION (39-42)
        jurisdiction: line.substring(38, 42).trim(),
        
        // Field 4: TAX-UNIT-ACCT (43-76) - Appraisal District No.
        property_id: line.substring(42, 76).trim(),
        
        // Field 5: LEVY (77-87) - Shows levy on account (assumed decimal)
        tax_amount: this.parseDecimalAmount(line.substring(76, 87)),
        
        // Field 6: HOMESTEAD (88)
        homestead_exemption: line.substring(87, 88).trim() === 'Y',
        
        // Field 7: OVER65 (89)
        over65_exemption: line.substring(88, 89).trim() === 'Y',
        
        // Field 8: VETERAN (90)
        veteran_exemption: line.substring(89, 90).trim() === 'Y',
        
        // Field 9: DISABLED (91)
        disabled_exemption: line.substring(90, 91).trim() === 'Y',
        
        // Field 10: AG (92)
        ag_exemption: line.substring(91, 92).trim() === 'Y',
        
        // Field 11: DATE-PAID (93-100) - YYYYMMDD
        date_paid: line.substring(92, 100).trim(),
        
        // Field 12: DUE-DATE (101-108) - YYYYMMDD
        due_date: line.substring(100, 108).trim(),
        
        // Field 13: OMIT-FLAG (109-110)
        omit_flag: line.substring(108, 110).trim(),
        
        // Field 14: LEVY-BALANCE (111-121) - Remaining levy due (assumed decimal)
        delinquent_amount: this.parseDecimalAmount(line.substring(110, 121)),
        
        // Field 15: SUIT (122) - Suit pending indicator
        suit_pending: ['A', 'J', 'L'].includes(line.substring(121, 122).trim()),
        
        // Field 16: CAUSENO (123-162) - Cause number of suit
        cause_number: line.substring(122, 162).trim(),
        
        // Field 17: BANKCODE (163) - Bankruptcy indicator
        bankruptcy_filed: ['A', 'J', 'L', 'N', 'B'].includes(line.substring(162, 163).trim()),
        
        // Field 18: BANKRUPTNO (164-203) - Bankruptcy number
        bankruptcy_number: line.substring(163, 203).trim(),
        
        // Field 19: ATTORNEY (204) - 33.07 date set
        attorney_date_set: line.substring(203, 204).trim() === 'Y',
        
        // Field 20: COURT-COST (205-211)
        court_cost: this.parseAmount(line.substring(204, 211)),
        
        // Field 21: ABSTRACT-FEE (212-218)
        abstract_fee: this.parseAmount(line.substring(211, 218)),
        
        // Field 22: DEFERRAL (219) - Deferral Flag
        deferred: line.substring(218, 219).trim() === 'D',
        
        // Field 23: BILLSUPP (220) - Bill supp flag
        bill_supp_flag: line.substring(219, 220).trim(),
        
        // Field 24: SPLIT-PMTFLAG (221) - Split Payment Option
        split_payment: line.substring(220, 221).trim(),
        
        // Field 25: CATEGORY-CODE (222-225)
        category_code: line.substring(221, 225).trim(),
        
        // Field 26: OWNER (226-265) - Owner address line 1
        owner_name: line.substring(225, 265).trim(),
        
        // Field 27: ADDRESS2 (266-305) - Owner address line 2
        owner_address_2: line.substring(265, 305).trim(),
        
        // Field 28: ADDRESS3 (306-345) - Owner address line 3
        owner_address_3: line.substring(305, 345).trim(),
        
        // Field 29: ADDRESS4 (346-385) - Owner address line 4
        owner_address_4: line.substring(345, 385).trim(),
        
        // Field 30: CITY (386-425) - Address City
        city: line.substring(385, 425).trim(),
        
        // Field 31: STATE (426-427) - Address State
        state: line.substring(425, 427).trim(),
        
        // Field 32: ZIP (428-439) - Address Zipcode
        zip_code: line.substring(427, 439).trim(),
        
        // Field 33: ROLL-CODE (440) - Property Roll Code
        roll_code: line.substring(439, 440).trim(),
        
        // Field 34: PARCEL NO. (441-448) - Parcel No.
        parcel_number: parseInt(line.substring(440, 448)) || null,
        
        // Field 35: PARCEL NAME (449-488) - Parcel Name
        property_address: line.substring(448, 488).trim(),
        
        // Field 36: PAYMENT AGREEMENT (489) - Payment Agreement Flag
        payment_agreement: line.substring(488, 489).trim() === 'Y',
        
        // Field 37: TOT_AMT_DUE (490-500) - Total Amt Due as of EOM (assumed decimal)
        total_amount_due: this.parseDecimalAmount(line.substring(489, 500)),
        
        // Field 38: TOT_AMT_DUE-30 (501-511) - Total Amt Due + 30 days
        total_amount_due_30: this.parseDecimalAmount(line.substring(500, 511)),
        
        // Field 39: TOT_AMT_DUE-60 (512-522) - Total Amt Due + 60 days
        total_amount_due_60: this.parseDecimalAmount(line.substring(511, 522)),
        
        // Field 40: TOT_AMT_DUE-90 (523-533) - Total Amt Due + 90 days
        total_amount_due_90: this.parseDecimalAmount(line.substring(522, 533))
      };
      
      // Build complete owner address
      const ownerAddressParts = [
        record.owner_address_2,
        record.owner_address_3, 
        record.owner_address_4
      ].filter(part => part && part.trim());
      
      record.owner_address = ownerAddressParts.join(', ');
      
      // Calculate exemptions summary
      const exemptions = [];
      if (record.homestead_exemption) exemptions.push('Homestead');
      if (record.over65_exemption) exemptions.push('Over 65');
      if (record.veteran_exemption) exemptions.push('Veteran');
      if (record.disabled_exemption) exemptions.push('Disabled');
      if (record.ag_exemption) exemptions.push('Agricultural');
      record.exemptions = exemptions.join(', ');
      
      // Determine delinquency status
      record.is_delinquent = record.delinquent_amount > 0 && !record.date_paid;
      
      // Calculate years delinquent based on due date
      if (record.is_delinquent && record.due_date && record.due_date.length === 8) {
        const dueYear = parseInt(record.due_date.substring(0, 4));
        const currentYear = new Date().getFullYear();
        record.delinquent_years = Math.max(1, currentYear - dueYear);
      } else {
        record.delinquent_years = record.is_delinquent ? this.estimateDelinquentYears(record.delinquent_amount) : 0;
      }
      
      // Set payment status based on various flags
      if (record.date_paid) {
        record.payment_status = 'PAID';
      } else if (record.payment_agreement) {
        record.payment_status = 'PAYMENT_AGREEMENT';
      } else if (record.deferred) {
        record.payment_status = 'DEFERRED';
      } else if (record.suit_pending) {
        record.payment_status = 'SUIT_PENDING';
      } else if (record.bankruptcy_filed) {
        record.payment_status = 'BANKRUPTCY';
      } else if (record.is_delinquent) {
        record.payment_status = 'DELINQUENT';
      } else {
        record.payment_status = 'CURRENT';
      }
      
      // Use total value estimate or tax amount for property value
      record.total_value = record.tax_amount > 0 ? Math.round(record.tax_amount * 40) : 0; // Rough estimate: tax is ~2.5% of value
      
      return record;
      
    } catch (error) {
      this.logger.warn('Failed to parse data line', { 
        line: line.substring(0, 50) + '...', 
        lineLength: line.length,
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Parse amount from string
   */
  parseAmount(amountStr) {
    if (!amountStr) return 0;
    const cleaned = amountStr.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Parse decimal amount from string (assumed decimal format)
   * For fields marked as "assumed decimal" in the layout
   */
  parseDecimalAmount(amountStr) {
    if (!amountStr) return 0;
    const cleaned = amountStr.replace(/[^\d]/g, ''); // Remove all non-digits
    if (!cleaned) return 0;
    
    // Convert to decimal by dividing by 100 (last 2 digits are cents)
    const amount = parseInt(cleaned) || 0;
    return amount / 100;
  }

  /**
   * Estimate years delinquent based on amount
   */
  estimateDelinquentYears(amount) {
    if (amount < 3000) return 1;
    if (amount < 8000) return 2;
    if (amount < 15000) return 3;
    return 4;
  }

  /**
   * Insert tax record into database
   */
  async insertTaxRecord(record) {
    const sql = `
      INSERT OR REPLACE INTO tax_roll (
        account_id, property_id, tax_year, jurisdiction, owner_name, owner_address,
        property_address, city, state, zip_code, parcel_number, roll_code, category_code,
        tax_amount, delinquent_amount, total_amount_due, total_amount_due_30,
        total_amount_due_60, total_amount_due_90, court_cost, abstract_fee,
        total_value, delinquent_years, is_delinquent, payment_status,
        date_paid, due_date, exemptions,
        homestead_exemption, over65_exemption, veteran_exemption, disabled_exemption, ag_exemption,
        payment_agreement, deferred, suit_pending, bankruptcy_filed, attorney_date_set,
        cause_number, bankruptcy_number, omit_flag, bill_supp_flag, split_payment,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.db.run(sql, [
      record.account_id, record.property_id, record.tax_year, record.jurisdiction,
      record.owner_name, record.owner_address, record.property_address, record.city,
      record.state, record.zip_code, record.parcel_number, record.roll_code, record.category_code,
      record.tax_amount, record.delinquent_amount, record.total_amount_due, record.total_amount_due_30,
      record.total_amount_due_60, record.total_amount_due_90, record.court_cost, record.abstract_fee,
      record.total_value, record.delinquent_years, record.is_delinquent, record.payment_status,
      record.date_paid, record.due_date, record.exemptions,
      record.homestead_exemption, record.over65_exemption, record.veteran_exemption, 
      record.disabled_exemption, record.ag_exemption, record.payment_agreement, record.deferred,
      record.suit_pending, record.bankruptcy_filed, record.attorney_date_set,
      record.cause_number, record.bankruptcy_number, record.omit_flag, 
      record.bill_supp_flag, record.split_payment
    ]);
  }

  /**
   * Search for delinquent properties in a specific area
   */
  async searchDelinquentProperties(area, options = {}) {
    try {
      const limit = options.limit || 100;
      const minAmount = options.minAmount || 0;

      // Build a flexible area filter. The tax roll files many well-known
      // neighborhoods (Highland Park, University Park, etc.) under city = DALLAS
      // and stores ZIPs as 9-digit ZIP+4 (e.g. "752050000"), so a plain
      // `city LIKE` match misses them. buildAreaFilter() resolves the input to
      // ZIP-prefix matches when possible and falls back to a city match.
      const areaFilter = this.buildAreaFilter(area);

      const sql = `
        SELECT * FROM tax_roll
        WHERE is_delinquent = 1
          AND ${areaFilter.clause}
          AND delinquent_amount >= ?
          AND suit_pending = 0
          AND bankruptcy_filed = 0
          AND payment_status NOT IN ('SUIT_PENDING', 'BANKRUPTCY')
        ORDER BY delinquent_amount DESC, delinquent_years DESC
        LIMIT ?
      `;

      const params = [...areaFilter.params, minAmount, limit];
      const results = await this.db.all(sql, params);

      this.logger.info(`Found ${results.length} delinquent properties in "${area}" (${areaFilter.label})`);

      return results.map(this.formatPropertyResult);

    } catch (error) {
      this.logger.error('Failed to search delinquent properties', { error: error.message });
      throw error;
    }
  }

  /**
   * Resolve a free-text area into a SQL WHERE fragment + params.
   *
   * Supports three input shapes:
   *   1. A known Dallas-county neighborhood name -> matches its ZIP prefixes
   *      (these are filed under city = DALLAS, so a city match would fail).
   *   2. A bare 5-digit ZIP code -> matches the 9-digit ZIP+4 by prefix.
   *   3. Anything else -> case-insensitive city-name match.
   *
   * @param {string} area
   * @returns {{clause: string, params: any[], label: string}}
   */
  buildAreaFilter(area) {
    const raw = String(area || '').trim();
    const key = raw.toLowerCase();

    // Neighborhoods that the tax roll files under city = DALLAS. Mapped to the
    // ZIP prefixes that cover them so searches actually return results.
    const NEIGHBORHOOD_ZIPS = {
      'highland park': ['75205', '75219'],
      'university park': ['75205', '75225'],
      'preston hollow': ['75225', '75229', '75230'],
      'lakewood': ['75206', '75214'],
      'oak cliff': ['75208', '75211', '75224'],
      'bishop arts': ['75208'],
      'uptown': ['75201', '75204'],
      'deep ellum': ['75226'],
      'm streets': ['75206'],
      'kessler park': ['75208']
    };

    if (NEIGHBORHOOD_ZIPS[key]) {
      const zips = NEIGHBORHOOD_ZIPS[key];
      return {
        clause: '(' + zips.map(() => 'zip_code LIKE ?').join(' OR ') + ')',
        params: zips.map(z => `${z}%`),
        label: `neighborhood ZIPs ${zips.join('/')}`
      };
    }

    const zipMatch = raw.match(/\b(\d{5})\b/);
    if (zipMatch) {
      return {
        clause: 'zip_code LIKE ?',
        params: [`${zipMatch[1]}%`],
        label: `ZIP ${zipMatch[1]}`
      };
    }

    return {
      clause: 'UPPER(city) LIKE ?',
      params: [`%${raw.toUpperCase()}%`],
      label: `city LIKE ${raw}`
    };
  }

  /**
   * Build a SQL filter from selected property types, mapped to Texas SPTD
   * state category codes (the `category_code` column):
   *   A = single-family residential (incl. condo/townhome — SPTD doesn't code
   *       them separately), B = multifamily, C/D/1D = vacant and ag land,
   *   F1 = commercial, F2 = industrial.
   * Categories like L (business personal property), J (utilities), G (minerals),
   * M (mobile/tangible) are intentionally excluded — they aren't listable real
   * estate. Returns null when nothing is selected (no category filter applied).
   *
   * @param {Object} propertyTypes - { singleFamily, condo, ... : boolean }
   * @returns {{clause: string, params: string[]}|null}
   */
  buildPropertyTypeFilter(propertyTypes) {
    if (!propertyTypes || typeof propertyTypes !== 'object') return null;

    const CATEGORY_PREFIXES = {
      // Texas SPTD codes don't separate house/condo/townhome — all are category
      // A — so the UI offers one "Residential" toggle. The granular keys are kept
      // for backward compatibility (they all map to A).
      residential: ['A'],
      singleFamily: ['A'],
      condo: ['A'],
      townhome: ['A'],
      multiFamily: ['B'],
      commercial: ['F1'],
      industrial: ['F2'],
      rawLand: ['C', 'D', '1D']
    };

    const prefixes = new Set();
    for (const [type, enabled] of Object.entries(propertyTypes)) {
      if (enabled && CATEGORY_PREFIXES[type]) {
        CATEGORY_PREFIXES[type].forEach(p => prefixes.add(p));
      }
    }
    if (prefixes.size === 0) return null;

    const arr = [...prefixes];
    return {
      clause: '(' + arr.map(() => 'category_code LIKE ?').join(' OR ') + ')',
      params: arr.map(p => `${p}%`)
    };
  }

  /**
   * Broadened discovery: surface candidates matching ANY motivation signal in
   * an area — tax-delinquent OR over-65/disabled exemption OR absentee owner —
   * not just delinquents. Candidate pools can be thousands per ZIP, so we rank
   * with a SQL score proxy and return the strongest top-N. The in-process
   * MotivationScorer then computes the precise score. See STRATEGY.md §2.
   */
  async searchCandidatesByArea(area, options = {}) {
    try {
      const limit = options.limit || 100;
      const areaFilter = this.buildAreaFilter(area);
      const ptFilter = this.buildPropertyTypeFilter(options.propertyTypes);

      // Quality floor. The raw tax roll is full of rows that look like junk to a
      // realtor: trivial delinquencies (a few dollars owed) and government /
      // institutional owners (the city, county, school districts) who will never
      // sell. Drop both so results are actionable. The dollar floor only applies
      // to delinquent rows, so current-owner signals (elderly/absentee/empty-
      // nester) still surface regardless of any balance owed.
      const minAmount = options.minAmount != null ? Number(options.minAmount) : 1000;
      const GOV_OWNER_PATTERNS = [
        '%CITY OF%', '%COUNTY OF%', 'DALLAS COUNTY%', '%ISD%',
        '%STATE OF TEXAS%', '%UNITED STATES%', '%HOUSING AUTHORITY%',
        '%DEPARTMENT OF%', '%FEDERAL HOME LOAN%'
      ];
      const govClause = GOV_OWNER_PATTERNS.map(() => 'owner_name NOT LIKE ?').join('\n          AND ');

      const baseWhere = `${areaFilter.clause}
          AND suit_pending = 0
          AND bankruptcy_filed = 0
          AND payment_status NOT IN ('SUIT_PENDING', 'BANKRUPTCY')
          AND (is_delinquent = 0 OR delinquent_amount >= ?)
          AND owner_name IS NOT NULL
          AND ${govClause}
          ${ptFilter ? `AND ${ptFilter.clause}` : ''}`;
      // Params that prefix every query below, in clause order: area filter, the
      // delinquent-amount floor, the government-owner exclusions, then property-type.
      const baseParams = [
        ...areaFilter.params,
        minAmount,
        ...GOV_OWNER_PATTERNS,
        ...(ptFilter ? ptFilter.params : [])
      ];

      // Which motivation signals to hunt for (UI toggles). Default: all.
      // An all-off selection falls back to all-on so a search never returns empty.
      const ALL = { delinquent: true, elderly: true, absentee: true, preForeclosure: true, emptyNester: true, estate: true };
      let signals = options.signals || ALL;
      if (!Object.values(signals).some(Boolean)) signals = ALL;

      // Join legal events (pre-foreclosure / lis pendens) and voter demographics
      // (owner age / empty-nester). Both deduped to one row per account so joins
      // can't multiply results; both empty until their feeds are ingested.
      const FROM = `tax_roll t
          LEFT JOIN (
            SELECT account_id, event_type, sale_date FROM legal_events
            WHERE account_id IS NOT NULL GROUP BY account_id
          ) le ON le.account_id = t.account_id
          LEFT JOIN voter_demographics vd ON vd.account_id = t.account_id`;
      const SELECT = `t.*, le.event_type AS legal_event_type, le.sale_date AS legal_sale_date,
            (le.account_id IS NOT NULL) AS has_preforeclosure,
            vd.owner_age AS owner_age, vd.empty_nester AS empty_nester`;

      // elderly fires on the tax exemption OR a voter-file age >= 65.
      const ELDERLY = '(over65_exemption = 1 OR disabled_exemption = 1 OR vd.owner_age >= 65)';
      const ABSENTEE = '(is_absentee = 1)';
      const PREFORE = '(le.account_id IS NOT NULL)';
      const EMPTYNEST = '(vd.empty_nester = 1)';
      // Estate / inherited — the owner has died and the property is held by an
      // estate or heirs (a top-tier "death" seller signal, per STRATEGY.md).
      // Precise patterns so "REAL ESTATE LLC" business names don't match.
      const ESTATE = "(owner_name LIKE '%ESTATE OF%' OR owner_name LIKE '%LIFE ESTATE%' OR owner_name LIKE '%HEIRS%' OR owner_name LIKE '% ET AL%')";

      // Blend (reserve slots for current owners) only when delinquent is hunted
      // alongside a non-delinquent signal — otherwise one ranked query is enough.
      const blend = signals.delinquent && (signals.elderly || signals.absentee || signals.emptyNester || signals.estate);

      if (blend) {
        const delqTarget = Math.ceil(limit * 0.6);
        const delqSql = `
          SELECT ${SELECT} FROM ${FROM}
          WHERE ${baseWhere} AND is_delinquent = 1
          ORDER BY (${PREFORE} * 35) + MIN(COALESCE(delinquent_amount, 0) / 1000.0, 40)
            + (${ELDERLY} * 5) + (${ABSENTEE} * 5) + (${EMPTYNEST} * 5) + (${ESTATE} * 8) DESC,
            delinquent_amount DESC, account_id
          LIMIT ?`;
        const delq = await this.db.all(delqSql, [...baseParams, delqTarget]);

        // Non-delinquent owners matching the enabled non-delinquent signals
        // (elderly / absentee / pre-foreclosure / empty-nester).
        const nonDelqConds = [];
        if (signals.elderly) nonDelqConds.push(ELDERLY);
        if (signals.absentee) nonDelqConds.push(ABSENTEE);
        if (signals.preForeclosure) nonDelqConds.push(PREFORE);
        if (signals.emptyNester) nonDelqConds.push(EMPTYNEST);
        if (signals.estate) nonDelqConds.push(ESTATE);
        const nonDelqTarget = limit - delq.length;
        let nonDelq = [];
        if (nonDelqTarget > 0 && nonDelqConds.length) {
          const nonDelqSql = `
            SELECT ${SELECT} FROM ${FROM}
            WHERE ${baseWhere} AND is_delinquent = 0 AND (${nonDelqConds.join(' OR ')})
            ORDER BY (${PREFORE} * 35) + (${ELDERLY} * 10) + (${ABSENTEE} * 12) + (${EMPTYNEST} * 12) + (${ESTATE} * 14) DESC, total_value DESC, account_id
            LIMIT ?`;
          nonDelq = await this.db.all(nonDelqSql, [...baseParams, nonDelqTarget]);
        }
        let results = [...delq, ...nonDelq];

        // Estate / inherited is sparse and cross-cutting (an estate owner may or
        // may not be delinquent), so the 60/40 delinquent split can bury it. When
        // it's selected, guarantee representation with a reserved estate slice.
        if (signals.estate) {
          const have = new Set(results.map(r => r.account_id));
          const estateRows = await this.db.all(`
            SELECT ${SELECT} FROM ${FROM}
            WHERE ${baseWhere} AND ${ESTATE}
            ORDER BY is_delinquent DESC, delinquent_amount DESC, total_value DESC, account_id
            LIMIT ?`, [...baseParams, Math.ceil(limit * 0.3)]);
          for (const r of estateRows) {
            if (!have.has(r.account_id)) { results.push(r); have.add(r.account_id); }
          }
        }
        this.logger.info(`Found ${results.length} candidates in "${area}" (${areaFilter.label}): ${delq.length} delinquent + ${nonDelq.length} non-delinquent${signals.estate ? ' + estate slice' : ''}`);
        return results.map(this.formatPropertyResult);
      }

      // Single ranked query for any other signal combination. Only the SELECTED
      // signals influence ranking — so "elderly only" ranks by elderly + value
      // (surfacing current downsizers), not by a delinquency weight the user
      // didn't ask for.
      const conds = [];
      const orderTerms = [];
      if (signals.preForeclosure) {
        conds.push(PREFORE);
        orderTerms.push(`(${PREFORE} * 35)`);
      }
      if (signals.delinquent) {
        conds.push('is_delinquent = 1');
        orderTerms.push('(is_delinquent = 1) * 40');
        orderTerms.push('MIN(COALESCE(delinquent_amount, 0) / 1000.0, 20)');
      }
      if (signals.elderly) {
        conds.push(ELDERLY);
        orderTerms.push(`(${ELDERLY} * 10)`);
      }
      if (signals.absentee) {
        conds.push(ABSENTEE);
        orderTerms.push(`(${ABSENTEE} * 12)`);
      }
      if (signals.emptyNester) {
        conds.push(EMPTYNEST);
        orderTerms.push(`(${EMPTYNEST} * 12)`);
      }
      if (signals.estate) {
        conds.push(ESTATE);
        orderTerms.push(`(${ESTATE} * 14)`);
      }
      const orderExpr = orderTerms.length ? orderTerms.join(' + ') : 'total_value';

      const sql = `
        SELECT ${SELECT} FROM ${FROM}
        WHERE ${baseWhere} AND (${conds.join(' OR ')})
        ORDER BY ${orderExpr} DESC, total_value DESC, account_id
        LIMIT ?`;
      const results = await this.db.all(sql, [...baseParams, limit]);
      this.logger.info(`Found ${results.length} candidates in "${area}" (${areaFilter.label}); signals=[${Object.keys(signals).filter(k => signals[k]).join(',')}]`);
      return results.map(this.formatPropertyResult);

    } catch (error) {
      this.logger.error('Failed to search candidates', { error: error.message });
      throw error;
    }
  }

  /**
   * Format property result for API response
   */
  formatPropertyResult(record) {
    // Absentee-owner signal is precomputed into the DB (migrate_signal_columns.js)
    // so it can be filtered/ranked in SQL. Same street-token definition.
    const isAbsentee = !!record.is_absentee;
    const isDelinquent = !!record.is_delinquent;
    // Pre-foreclosure / lis-pendens — joined from legal_events (may be absent).
    const isPreForeclosure = !!record.has_preforeclosure;
    // Voter-file demographics — joined from voter_demographics (may be absent).
    const ownerAge = record.owner_age || null;
    const isEmptyNester = !!record.empty_nester;
    // Estate / inherited — owner deceased, property held by an estate or heirs.
    // Read straight from the owner-name patterns (same as the ESTATE SQL filter).
    const isEstate = /ESTATE OF|LIFE ESTATE|HEIRS|\bET AL\b/i.test(record.owner_name || '');

    // Calculate motivation score based on multiple factors
    let motivationScore = 0;
    if (record.delinquent_amount > 15000) motivationScore += 30;
    else if (record.delinquent_amount > 5000) motivationScore += 20;
    else if (record.delinquent_amount > 1000) motivationScore += 10;
    
    if (record.delinquent_years >= 3) motivationScore += 25;
    else if (record.delinquent_years >= 2) motivationScore += 15;
    else motivationScore += 5;
    
    if (!record.homestead_exemption) motivationScore += 15; // Likely investment property
    if (record.payment_agreement) motivationScore -= 10; // Already working on payment
    if (record.over65_exemption || record.disabled_exemption) motivationScore += 10; // May need cash
    
    motivationScore = Math.min(100, Math.max(0, motivationScore));
    
    return {
      address: record.property_address || 'Address Not Available',
      accountId: record.account_id,
      propertyId: record.property_id,
      ownerName: record.owner_name,
      ownerAddress: record.owner_address,
      isAbsentee: isAbsentee,
      isPreForeclosure: isPreForeclosure,
      legalEventType: record.legal_event_type || null,
      legalSaleDate: record.legal_sale_date || null,
      ownerAge: ownerAge,
      isEmptyNester: isEmptyNester,
      isEstate: isEstate,
      city: record.city,
      state: record.state,
      zipCode: record.zip_code,
      parcelNumber: record.parcel_number,
      amountOwed: record.delinquent_amount,
      taxAmount: record.tax_amount,
      totalAmountDue: record.total_amount_due,
      totalAmountDue30: record.total_amount_due_30,
      totalAmountDue60: record.total_amount_due_60,
      totalAmountDue90: record.total_amount_due_90,
      totalValue: record.total_value,
      yearsDelinquent: record.delinquent_years,
      isDelinquent: isDelinquent,
      status: isDelinquent ? 'DELINQUENT' : 'CURRENT',
      paymentStatus: record.payment_status || (isDelinquent ? 'DELINQUENT' : 'CURRENT'),
      datePaid: record.date_paid,
      dueDate: record.due_date,
      exemptions: record.exemptions,
      homesteadExemption: record.homestead_exemption,
      over65Exemption: record.over65_exemption,
      veteranExemption: record.veteran_exemption,
      disabledExemption: record.disabled_exemption,
      agExemption: record.ag_exemption,
      paymentAgreement: record.payment_agreement,
      deferred: record.deferred,
      foreclosureRisk: !isDelinquent ? 'NONE' :
                       record.delinquent_amount > 15000 ? 'HIGH' :
                       record.delinquent_amount > 5000 ? 'MEDIUM' : 'LOW',
      motivationScore: motivationScore,
      source: 'dallas_county_tax_roll',
      taxYear: record.tax_year,
      lastUpdated: record.updated_at
    };
  }

  /**
   * Process complete tax roll update
   */
  async processFullUpdate() {
    try {
      this.logger.info('Starting full tax roll update...');
      
      // Initialize database
      await this.initializeDatabase();
      
      // Download latest tax roll
      const zipPath = await this.downloadTaxRoll();
      
      // Unzip files
      const extractedFiles = await this.unzipTaxRoll();
      
      // Parse each data file
      for (const filePath of extractedFiles) {
        if (path.extname(filePath) === '.txt' || path.extname(filePath) === '.dat') {
          await this.parseTaxRollData(filePath);
        }
      }
      
      // Clean up files
      await this.cleanup();
      
      this.logger.info('Tax roll update completed successfully');
      
    } catch (error) {
      this.logger.error('Tax roll update failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      // Remove zip file
      await fs.unlink(this.zipPath).catch(() => {});
      
      // Remove extracted files (keep only database)
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (file !== 'tax_roll.db' && !file.endsWith('.log')) {
          await fs.unlink(path.join(this.dataDir, file)).catch(() => {});
        }
      }
      
      this.logger.info('Cleanup completed');
      
    } catch (error) {
      this.logger.warn('Cleanup failed', { error: error.message });
    }
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.db) {
      await this.initializeDatabase();
    }
    
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total_properties,
        COUNT(CASE WHEN is_delinquent = 1 THEN 1 END) as delinquent_properties,
        AVG(CASE WHEN is_delinquent = 1 THEN delinquent_amount END) as avg_delinquent_amount,
        MAX(updated_at) as last_updated
      FROM tax_roll
    `);
    
    return stats;
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

module.exports = TaxRollProcessor;