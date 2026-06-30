/*
 * Shared SITUS-key normalization for matching address-only feeds (311, foreclosure
 * notices) to a parcel via the situs crosswalk (situs_xref, built by
 * build_situs_xref.py). The key is `house|zip5|street-core`.
 *
 * MUST stay in lockstep with build_situs_xref.py's situs_key()/street_core() — the
 * crosswalk is built in python, looked up here in JS. Parity-tested on real samples.
 *
 * situsKeyFromAddress() handles both formats we see:
 *   - 311:        "9030 MARKVILLE DR, DALLAS, TX, 75243"  (comma-delimited, has city)
 *   - foreclosure:"1136 Fair Oaks Drive 75060"            (OCR'd, no commas/city,
 *                  sometimes a repeated house number and/or no ZIP)
 * It requires a leading house number AND a Dallas-area ZIP (7xxxx) — without a ZIP the
 * crosswalk can't disambiguate, so it returns null and the caller falls back.
 */
const DIR = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW', 'NORTH', 'SOUTH', 'EAST', 'WEST']);
const SUF = new Set(['ST', 'STREET', 'AVE', 'AV', 'AVENUE', 'DR', 'DRIVE', 'LN', 'LANE', 'RD', 'ROAD',
  'BLVD', 'BL', 'CT', 'COURT', 'PL', 'PLACE', 'WAY', 'CIR', 'CIRCLE', 'TER', 'TERR', 'TERRACE',
  'TRL', 'TRAIL', 'PKWY', 'PARKWAY', 'CV', 'COVE', 'PT', 'POINT', 'HWY', 'HIGHWAY', 'LOOP',
  'PASS', 'PATH', 'RUN', 'ROW', 'XING', 'CROSSING', 'SQ', 'PLZ', 'PLAZA', 'EXPY', 'EXPWY', 'FWY']);

function streetCore(name) {
  let toks = String(name || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (toks.length && DIR.has(toks[0])) toks = toks.slice(1);
  if (toks.length && SUF.has(toks[toks.length - 1])) toks = toks.slice(0, -1);
  return toks.join(' ');
}

function situsKeyFromAddress(addr) {
  const s = String(addr || '').trim();
  const hm = s.match(/^0*(\d+)\b/);                 // leading house number
  if (!hm) return null;
  const house = hm[1];
  const zm = s.match(/\b(7[5-9]\d{3})\b/);          // Dallas-area ZIP (distinguishes a real
  if (!zm) return null;                              // ZIP from an OCR-repeated house number)
  const zip = zm[1];
  let seg = (s.split(',')[0] || '');                // street name is before the first comma (city/state follow)
  seg = seg.replace(/^0*\d+\s*/, '');               // drop the leading house number
  seg = seg.replace(new RegExp('\\b' + zip + '\\b', 'g'), ' ')   // drop the ZIP if it's in the segment
           .replace(new RegExp('\\b' + house + '\\b', 'g'), ' ');// drop any repeated house-number token (OCR)
  const core = streetCore(seg);
  return core ? `${house}|${zip}|${core}` : null;
}

module.exports = { streetCore, situsKeyFromAddress };
