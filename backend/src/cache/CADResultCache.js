/**
 * CADResultCache - Persistent (SQLite) cache for Dallas CAD enrichment results.
 *
 * CAD detail pages (beds/baths/sqft/year built/owner/value) change rarely, and
 * each lookup costs a rate-limited scrape of dallascad.org. Caching the final
 * normalized enrichment result keyed by address makes repeat selections — even
 * across server restarts and sessions — instant.
 *
 * Stores one row per normalized address. A TTL (default 30 days) keeps results
 * reasonably fresh while still serving most repeat lookups from cache.
 */

const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const Logger = require('../utils/Logger');

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

class CADResultCache {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.dbPath = path.join(this.dataDir, 'cad_cache.db');
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    this.db = null;
    this.logger = new Logger('CADResultCache', { logLevel: options.logLevel || 'info', enableConsole: true });
  }

  async init() {
    if (this.db) return;
    await fs.mkdir(this.dataDir, { recursive: true });
    this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS cad_cache (
        address_key TEXT PRIMARY KEY,
        data        TEXT NOT NULL,
        fetched_at  INTEGER NOT NULL
      )
    `);
    this.logger.info('CAD result cache ready', { dbPath: this.dbPath, ttlDays: this.ttlMs / 86400000 });
  }

  /**
   * Normalize an address into a stable cache key: uppercase, collapse
   * whitespace, drop everything after the first comma (city/state/zip tails)
   * and trailing punctuation.
   */
  static normalizeKey(address) {
    return String(address || '')
      .toUpperCase()
      .split(',')[0]
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Return cached enrichment data for an address, or null if absent/expired.
   */
  async get(address) {
    if (!this.db) await this.init();
    const key = CADResultCache.normalizeKey(address);
    if (!key) return null;

    const row = await this.db.get('SELECT data, fetched_at FROM cad_cache WHERE address_key = ?', [key]);
    if (!row) return null;

    if (Date.now() - row.fetched_at > this.ttlMs) {
      // Expired — drop it so it gets refreshed on next fetch.
      await this.db.run('DELETE FROM cad_cache WHERE address_key = ?', [key]);
      return null;
    }

    try {
      return JSON.parse(row.data);
    } catch {
      return null;
    }
  }

  /**
   * Store enrichment data for an address (upsert).
   */
  async set(address, data) {
    if (!this.db) await this.init();
    const key = CADResultCache.normalizeKey(address);
    if (!key) return;

    await this.db.run(
      `INSERT INTO cad_cache (address_key, data, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(address_key) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
      [key, JSON.stringify(data), Date.now()]
    );
  }

  async stats() {
    if (!this.db) await this.init();
    const row = await this.db.get('SELECT COUNT(*) AS total FROM cad_cache');
    return { total: row?.total || 0, dbPath: this.dbPath };
  }
}

module.exports = CADResultCache;
