/**
 * Multi-Source Orchestrator
 * Combines outputs from multiple deal sources and deduplicates.
 */

const CuelinksOffersSource = require('./cuelinks-offers');
const UserSubmittedSource = require('./user-submitted');

/**
 * Build a list of source instances.
 * @param {Object} config
 * @returns {Array}
 */
function buildSources(config) {
  const sources = [];
  if (config.sources?.cuelinksOffers !== false) {
    sources.push(new CuelinksOffersSource({
      apiKey: config.cuelinks?.apiKey || process.env.CUELINKS_API_KEY,
      baseUrl: config.cuelinks?.baseUrl,
    }));
  }
  if (config.sources?.userSubmitted !== false) {
    sources.push(new UserSubmittedSource({
      logger: console,
    }));
  }
  return sources;
}

/**
 * Run all sources in parallel, return merged + deduped deals.
 */
async function fetchAll(sources) {
  const results = await Promise.allSettled(sources.map(s => s.fetch()));
  const allDeals = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      allDeals.push(...r.value);
    } else if (r.status === 'rejected') {
      console.error(`❌ Source failed: ${r.reason?.message || r.reason}`);
    }
  }
  return dedupe(allDeals);
}

/**
 * Deduplicate by (campaign name + destination URL hash).
 */
function dedupe(deals) {
  const seen = new Set();
  const out = [];
  for (const d of deals) {
    const key = `${(d.campaignName || '')}|${(d.merchantUrl || d.affiliateLink || '')}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

module.exports = {
  buildSources,
  fetchAll,
  dedupe,
  CuelinksOffersSource,
  UserSubmittedSource,
};
