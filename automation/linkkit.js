/**
 * 🔗 Cuelinks LinkKit — Universal URL-to-Affiliate Converter
 *
 * Converts ANY product URL (Amazon, Flipkart, Shopsy, Myntra, etc.) into a
 * Cuelinks affiliate tracking link using one of two strategies:
 *
 *   1. PRIMARY  — Build URL from campaign template:
 *      `https://linksredirect.com/?pub_id=<cid>&url=<encoded_product_url>`
 *      Works for all Cuelinks-registered merchants.
 *
 *   2. FALLBACK — Try Cuelinks Link Kit API endpoints.
 *      (These currently return 404 for arbitrary URLs.)
 *
 * Supports:
 *   - Domain-based merchant detection (30+ Indian merchants)
 *   - Stripping of existing affiliate tags (tag=, affid=, utm_*, etc.)
 *   - Short URL resolution (fkrt.site, amzn.to, etc.) for accurate routing
 *   - Telegram post formatting with merchant emoji
 */

const axios = require('axios');
const { identifyMerchant, stripAffiliateTags, isShortener } = require('./merchant_map');

class LinkKit {
  /**
   * @param {Array} campaigns - Array of Cuelinks campaign objects
   * @param {Object} config - Optional logger / config
   */
  constructor(campaigns = [], config = {}) {
    this.campaigns = campaigns;
    this.logger = config.logger || console;
    // Cache: domain → campaign lookup
    this._domainCache = this._buildDomainCache(campaigns);
  }

  /** Build O(1) lookup cache: domain → campaign */
  _buildDomainCache(campaigns) {
    const cache = {};
    for (const c of campaigns) {
      const dom = (c.domain || '').replace(/^www\./, '').toLowerCase();
      if (dom) cache[dom] = c;
      const url = (c.url || '').toLowerCase();
      try {
        if (url) {
          const h = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
          if (h && !cache[h]) cache[h] = c;
        }
      } catch {
        // ignore malformed URLs
      }
    }
    return cache;
  }

  /**
   * Update the campaign list (call after fetching /campaigns).
   */
  setCampaigns(campaigns) {
    this.campaigns = campaigns;
    this._domainCache = this._buildDomainCache(campaigns);
  }

  /**
   * Resolve a shortened URL to its final destination via HEAD request.
   * Returns the final URL or the original if resolution fails.
   */
  async resolveShortUrl(url) {
    if (!isShortener(url)) return url;
    try {
      const resp = await axios.head(url, {
        maxRedirects: 5,
        timeout: 8000,
        validateStatus: () => true,
      });
      const finalUrl = resp.request?.res?.responseUrl || url;
      this.logger.log?.(`🔗 Resolved ${url} → ${finalUrl.substring(0, 60)}...`);
      return finalUrl;
    } catch (err) {
      this.logger.log?.(`⚠️ Short URL resolve failed: ${url} — ${err.message}`);
      return url;
    }
  }

  /**
   * Find the best matching campaign for a URL.
   * Matches by:
   *   1. Exact domain match from cache (fastest)
   *   2. Partial domain match (e.g. shop.flipkart.com → flipkart.com)
   *   3. Merchant map fallback (known merchants)
   * Returns the campaign or null.
   */
  findCampaign(url) {
    if (!url) return null;
    let hostname = '';
    try {
      hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
    // 1. Exact cache hit
    if (this._domainCache[hostname]) return this._domainCache[hostname];
    // 2. Partial match
    for (const [dom, campaign] of Object.entries(this._domainCache)) {
      if (hostname.endsWith(dom) || dom.endsWith(hostname)) return campaign;
    }
    // 3. Fallback: search all campaigns for any containing hostname substring
    const lowerHost = hostname.toLowerCase();
    for (const c of this.campaigns) {
      const cdom = (c.domain || '').toLowerCase();
      const curl = (c.url || '').toLowerCase();
      const cname = (c.name || '').toLowerCase();
      if (cdom && lowerHost.includes(cdom)) return c;
      if (curl && lowerHost.includes(curl.replace(/^https?:\/\/(www\.)?/, ''))) return c;
      if (cname && lowerHost.includes(cname.split(' ')[0])) return c;
    }
    return null;
  }

  /**
   * Build a Cuelinks affiliate URL from a campaign template + destination URL.
   * Strategy 1 (preferred): use campaign's affiliate_url template directly.
   */
  _buildFromTemplate(campaign, targetUrl) {
    const encoded = encodeURIComponent(targetUrl);
    // The campaign.affiliate_url already contains the redirect template
    // e.g. "https://linksredirect.com/?pub_id=242184"
    // We need to append or replace the `url=` parameter
    let template = campaign.affiliate_url || campaign.affiliate_link || '';
    if (!template) return null;

    // If template already has url=, replace it
    if (template.includes('url=')) {
      return template.replace(/url=[^&]*/, `url=${encoded}`);
    }
    // Otherwise append
    const sep = template.includes('?') ? '&' : '?';
    return `${template}${sep}url=${encoded}`;
  }

  /**
   * Strategy 2: try POST /api/v2/links with various payload formats.
   * Best-effort fallback. Currently returns 404 for most inputs.
   */
  async _tryLinkKitApi(targetUrl) {
    const apiKey = process.env.CUELINKS_API_KEY;
    if (!apiKey) return null;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const base = 'https://www.cuelinks.com/api/v2';
    // Try a few payload shapes (most likely to work)
    const payloads = [
      { url: targetUrl },
      { url: targetUrl, source: 'api' },
      { url: targetUrl, source: 'linkkit' },
      { destination: targetUrl },
    ];
    for (const body of payloads) {
      try {
        const r = await axios.post(`${base}/links`, body, { headers, timeout: 8000 });
        const link = r?.data?.link || r?.data?.affiliate_url || r?.data?.url;
        if (link && typeof link === 'string') {
          this.logger.log?.(`✅ LinkKit API success!`);
          return link;
        }
      } catch (err) {
        // swallow — try next payload
      }
    }
    return null;
  }

  /**
   * ⭐ Public API — convert ANY product URL into a Cuelinks affiliate link.
   *
   * @param {string} inputUrl - The product URL (any merchant)
   * @param {Object} options - { skipResolveShort, skipStrip }
   * @returns {Promise<{ success, affiliateUrl, originalUrl, merchant, campaign, source, error }>}
   */
  async convert(inputUrl, options = {}) {
    const result = {
      success: false,
      affiliateUrl: null,
      originalUrl: inputUrl,
      merchant: null,
      campaign: null,
      source: null,
      error: null,
    };
    if (!inputUrl || typeof inputUrl !== 'string') {
      result.error = 'Invalid URL';
      return result;
    }

    try {
      // Step 1: Resolve short URLs (fkrt.site, amzn.to)
      let url = inputUrl;
      if (!options.skipResolveShort && isShortener(url)) {
        url = await this.resolveShortUrl(url);
      }

      // Step 2: Strip existing affiliate tags for clean tracking
      if (!options.skipStrip) {
        url = stripAffiliateTags(url);
      }

      // Step 3: Identify merchant + find campaign
      const merchant = identifyMerchant(url);
      const campaign = this.findCampaign(url);
      result.merchant = merchant;
      result.campaign = campaign;
      result.originalUrl = url;

      // Step 4: Build affiliate URL
      let affiliateUrl = null;

      // Strategy 1: Campaign template (preferred)
      if (campaign) {
        affiliateUrl = this._buildFromTemplate(campaign, url);
        if (affiliateUrl) result.source = 'campaign_template';
      }

      // Strategy 2: LinkKit API fallback
      if (!affiliateUrl) {
        const apiLink = await this._tryLinkKitApi(url);
        if (apiLink) {
          affiliateUrl = apiLink;
          result.source = 'cuelinks_api';
        }
      }

      if (affiliateUrl) {
        result.success = true;
        result.affiliateUrl = affiliateUrl;
        return result;
      }

      result.error = 'Could not match merchant to any registered Cuelinks campaign';
      return result;
    } catch (err) {
      result.error = err.message;
      return result;
    }
  }

  /**
   * Bulk convert multiple URLs in parallel.
   * @param {string[]} urls
   * @returns {Promise<Array>} array of convert() results
   */
  async convertBulk(urls) {
    return Promise.all(urls.map(u => this.convert(u)));
  }
}

module.exports = LinkKit;
