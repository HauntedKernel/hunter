/**
 * SkipTraceService — turns leads into *contactable* leads (STRATEGY.md §5/§7).
 *
 * Two responsibilities:
 *   1. Skip-trace: name + mailing address -> phone/email. No public source;
 *      requires a paid vendor. Contacts are sourced from the `contacts` table
 *      (loaded via ingest_contacts.js) and/or a live provider behind env keys.
 *   2. DNC compliance: a phone is NOT callable until scrubbed against the Do Not
 *      Call registry. FAIL-CLOSED — unknown/unscrubbed = not callable. Calling a
 *      DNC number carries per-call statutory penalties (TCPA), so the product
 *      must enforce this, not the user.
 *
 * Env config (all optional; absent => that capability reports "not configured"):
 *   SKIPTRACE_API_URL, SKIPTRACE_API_KEY   live skip-trace provider
 *   DNC_API_URL, DNC_API_KEY               live DNC-scrub provider
 */
class SkipTraceService {
  constructor(db) {
    this.db = db;
  }

  providerStatus() {
    return {
      skiptrace: !!(process.env.SKIPTRACE_API_URL && process.env.SKIPTRACE_API_KEY),
      dnc: !!(process.env.DNC_API_URL && process.env.DNC_API_KEY)
    };
  }

  /** A phone is callable only when DNC-scrubbed AND confirmed not-on-DNC. */
  static isCallable(phone) {
    return phone.dnc === 'clear';
  }

  /**
   * Fetch stored contacts for the given account ids, with the DNC gate applied.
   * Returns { [accountId]: { phones:[{number,type,dnc,callable}], emails:[] } }.
   */
  async getContacts(accountIds = []) {
    const ids = accountIds.filter(Boolean);
    if (!ids.length) return {};
    const placeholders = ids.map(() => '?').join(',');
    const rows = await this.db.all(
      `SELECT account_id, phones, emails, source, dnc_checked_at FROM contacts WHERE account_id IN (${placeholders})`,
      ids
    );
    const out = {};
    for (const r of rows) {
      let phones = [];
      let emails = [];
      try { phones = JSON.parse(r.phones || '[]'); } catch { /* ignore */ }
      try { emails = JSON.parse(r.emails || '[]'); } catch { /* ignore */ }
      out[r.account_id] = {
        phones: phones.map(p => ({ ...p, callable: SkipTraceService.isCallable(p) })),
        emails,
        source: r.source,
        dncCheckedAt: r.dnc_checked_at
      };
    }
    return out;
  }

  /**
   * DNC-scrub a list of phone objects (mutates dnc field). Requires a configured
   * DNC provider; without one this is a no-op and phones STAY 'unknown' (i.e.
   * not callable) — never optimistically marked clear.
   *
   * @returns {boolean} whether scrubbing actually ran
   */
  async scrubDNC(phones) {
    if (!this.providerStatus().dnc) return false; // fail-closed: leave as 'unknown'
    // Live DNC provider integration goes here, e.g.:
    //   const res = await axios.post(process.env.DNC_API_URL, { phones: phones.map(p=>p.number) },
    //     { headers: { Authorization: `Bearer ${process.env.DNC_API_KEY}` } });
    //   res.data.results.forEach(r => { const p = phones.find(x=>x.number===r.number);
    //     if (p) p.dnc = r.onDnc ? 'do_not_call' : 'clear'; });
    // Not wired to a specific vendor yet.
    throw new Error('DNC provider configured but adapter not implemented for this vendor');
  }

  /**
   * Live skip-trace for a single lead via the configured provider. Without a
   * provider, returns { status: 'no_provider' } — we never invent contact data.
   */
  async liveTrace(/* lead */) {
    if (!this.providerStatus().skiptrace) return { status: 'no_provider', phones: [], emails: [] };
    // Live skip-trace provider integration goes here (vendor-specific request).
    throw new Error('Skip-trace provider configured but adapter not implemented for this vendor');
  }
}

module.exports = SkipTraceService;
