/**
 * Scrape Dallas County Clerk foreclosure (Notice of Substitute Trustee Sale)
 * postings into a CSV for ingest_legal_events.js — the real, free, public
 * pre-foreclosure feed (STRATEGY.md §3, roadmap #2 — the strongest signal).
 *
 * WHY OCR: the county posts notices ONLY as scanned-image PDFs (JBIG2), grouped
 * by city/month at dallascounty.org. There is no list/CSV and no clean text
 * layer, so we rasterize each page (pdftoppm) and OCR it (tesseract), then parse.
 *
 * WHAT WE EXTRACT: notices identify the property inconsistently — some print a
 * clean "Property Address: <street>, <city>, TX <zip>" line (matchable to the
 * tax roll by street+ZIP), others give only a Lot/Block legal description (not
 * matchable). We anchor on the explicit address line and attach a best-effort
 * grantor (owner) name + sale date. Coverage is therefore PARTIAL by design —
 * we emit only records we can actually match, and never invent data.
 *
 * DEPENDENCIES (install on the host): poppler-utils (pdftoppm/pdfinfo),
 * tesseract-ocr. No npm deps — Node builtins only.
 *
 * Usage:
 *   node scrape_foreclosures.js <Month> [cityFilter] [--max-files N] [--dpi N]
 * Examples:
 *   node scrape_foreclosures.js May                 # every city in May
 *   node scrape_foreclosures.js May Dallas          # only files named Dallas_*
 *   node scrape_foreclosures.js May "" --max-files 5
 * Output: ./foreclosures_<month>.csv  (then: node ingest_legal_events.js that.csv)
 */
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const INDEX_URL = 'https://www.dallascounty.org/government/county-clerk/recording/foreclosures.php';
const HOST = 'https://www.dallascounty.org';

const args = process.argv.slice(2);
const month = args[0];
const cityFilter = (args[1] && !args[1].startsWith('--')) ? args[1] : '';
const maxFiles = args.includes('--max-files') ? parseInt(args[args.indexOf('--max-files') + 1], 10) : Infinity;
const dpi = args.includes('--dpi') ? parseInt(args[args.indexOf('--dpi') + 1], 10) : 300;
if (!month) { console.error('Usage: node scrape_foreclosures.js <Month> [cityFilter] [--max-files N] [--dpi N]'); process.exit(1); }

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} for ${url}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('timeout', function () { this.destroy(new Error('timeout')); }).on('error', reject);
  });
}

// Download with retries — the county host occasionally drops the connection.
async function getRetry(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await get(url); }
    catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
  throw lastErr;
}

// Strip OCR/legal noise words that leak onto the front of a grantor capture
// ("with", "surviving spouse", "and", etc.) and trailing punctuation.
function cleanOwner(name) {
  let s = (name || '').replace(/\s+/g, ' ').trim();
  const lead = /^(with|surviving|spouse|and|the|of|by|to|as|an?|deceased|husband|wife|mr|mrs|ms)\b[ .,]*/i;
  while (lead.test(s)) s = s.replace(lead, '').trim();
  return s.replace(/[ ,.]+$/, '').trim();
}

// CSV field escaping for ingest_legal_events.js
const esc = (v) => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Pull every record from a notice bundle's OCR text. Anchor on an explicit
// property address; grab a nearby grantor + sale date best-effort.
function extractRecords(text, sourceFile) {
  const out = [];
  // Normalize OCR whitespace/newlines into a flat-ish stream but keep markers.
  const flat = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ');

  // "Property Address: 914 STILLMEADOW ROAD, DALLAS, TX 75232"
  // also "commonly known as 914 STILLMEADOW ..."
  const addrRe = /(?:Property Address|commonly known as|Address of Property|Property to be sold)\s*[:\-]?\s*([0-9][0-9A-Za-z .#\/-]{3,60}?,\s*[A-Za-z .]{3,30},\s*TX[ ,]*\d{5})/gi;
  let m;
  while ((m = addrRe.exec(flat)) !== null) {
    const fullAddr = m[1].replace(/\s+/g, ' ').trim();
    // The ingester tokenizes address by longest word, so a full address would
    // tokenize on the CITY ("DALLAS") and miss the tax roll (which stores the
    // street only). Emit "<street line> <zip>" so the token is a real street word.
    const street = fullAddr.split(',')[0].trim();
    const zip = (fullAddr.match(/\b(\d{5})\b/) || [])[1] || '';
    const address = zip ? `${street} ${zip}` : street;
    // Look in a window around the address for a grantor name and a sale date.
    const windowText = flat.slice(Math.max(0, m.index - 1500), m.index + 1500);

    // Grantor: "<Name> and <Name>, ... grantor(s)" or "executed by <Name>"
    let owner = '';
    const g1 = /([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}(?:\s+and\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})?)\s*,?\s*(?:husband and wife,?\s*|an?\s+\w+\s+\w+,?\s*)?grantor/i.exec(windowText);
    const g2 = /executed by\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}(?:\s+and\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})?)/i.exec(windowText);
    if (g1) owner = g1[1]; else if (g2) owner = g2[1];
    owner = cleanOwner(owner);

    // Sale date: "Date of Sale: 06/03/2025" / "will be sold ... on 06/03/2025"
    let saleDate = '';
    const d1 = /(?:Date of Sale|Sale Date|will be sold)[^0-9]{0,40}(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(windowText);
    if (d1) saleDate = d1[1];

    out.push({ address, owner_name: owner, sale_date: saleDate, source: `dallascounty.org/${sourceFile}` });
  }
  return out;
}

(async () => {
  console.log(`Fetching index for month=${month}${cityFilter ? `, city~${cityFilter}` : ''} (dpi=${dpi})…`);
  const indexHtml = (await get(INDEX_URL)).toString('utf8');
  const links = [...indexHtml.matchAll(/href="([^"]*foreclosure[^"]*\.pdf)"/gi)]
    .map(x => x[1])
    .filter(href => new RegExp(`/foreclosure/${month}/`, 'i').test(href))
    .filter(href => !cityFilter || new RegExp(cityFilter, 'i').test(href.split('/').pop()))
    .filter((v, i, a) => a.indexOf(v) === i);

  console.log(`Found ${links.length} notice PDF(s) for ${month}${cityFilter ? ` matching "${cityFilter}"` : ''}.`);
  const targets = links.slice(0, maxFiles);
  if (targets.length < links.length) console.log(`(processing first ${targets.length} due to --max-files)`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-'));
  let totalPages = 0, written = 0;
  const seen = new Set();
  // Write the CSV incrementally (header now, rows per file) so a long OCR run is
  // resilient and partial results can be ingested at any time.
  const outPath = path.join(process.cwd(), `foreclosures_${month}.csv`);
  fs.writeFileSync(outPath, 'event_type,account_id,address,owner_name,filed_date,sale_date,source\n');

  for (let i = 0; i < targets.length; i++) {
    const href = targets[i];
    const fileName = href.split('/').pop();
    const url = HOST + href.split('/').map(encodeURIComponent).join('/');
    const pdfPath = path.join(tmp, `f${i}.pdf`);
    try {
      fs.writeFileSync(pdfPath, await getRetry(url));
      const pages = parseInt((execSync(`pdfinfo "${pdfPath}" 2>/dev/null | awk '/^Pages:/{print $2}'`).toString().trim()) || '0', 10);
      totalPages += pages;
      // Rasterize all pages, OCR each, concatenate.
      execSync(`pdftoppm -png -r ${dpi} "${pdfPath}" "${path.join(tmp, 'pg')}" >/dev/null 2>&1`);
      let text = '';
      for (const png of fs.readdirSync(tmp).filter(f => f.startsWith('pg') && f.endsWith('.png')).sort()) {
        text += execSync(`tesseract "${path.join(tmp, png)}" stdout 2>/dev/null`).toString() + '\n';
        fs.unlinkSync(path.join(tmp, png));
      }
      const recs = extractRecords(text, fileName);
      let added = 0;
      for (const r of recs) {
        const k = r.address.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (seen.has(k)) continue;
        seen.add(k);
        fs.appendFileSync(outPath, ['preforeclosure', '', r.address, r.owner_name, '', r.sale_date, r.source].map(esc).join(',') + '\n');
        added++; written++;
      }
      console.log(`  [${i + 1}/${targets.length}] ${fileName}: ${pages}p → ${recs.length} found, ${added} new (total ${written})`);
      fs.unlinkSync(pdfPath);
    } catch (e) {
      console.log(`  [${i + 1}/${targets.length}] ${fileName}: FAILED (${e.message.split('\n')[0]})`);
    }
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  console.log(`\nOCR'd ${totalPages} pages across ${targets.length} file(s).`);
  console.log(`Wrote ${written} unique addressed records to ${outPath}`);
  console.log(`Next: node ingest_legal_events.js ${outPath}`);
})().catch(e => { console.error('SCRAPE FAILED:', e); process.exit(1); });
