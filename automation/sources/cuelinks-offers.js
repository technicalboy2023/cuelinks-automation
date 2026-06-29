/**
 * Source: Cuelinks /offers API
 *
 * Primary source of curated deals. Fetches up to 3 pages of offers
 * (300 deals max per run) and normalizes into standard Deal shape.
 */

const axios = require('axios');
const BaseSource = require('./base');

class CuelinksOffersSource extends BaseSource {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.CUELINKS_API_KEY;
    this.baseUrl = config.baseUrl || 'https://www.cuelinks.com/api/v2';
    this.maxPages = config.maxPages || 3;
    this.perPage = config.perPage || 100;
  }

  name() { return 'cuelinks-offers'; }

  async fetch() {
    if (!this.apiKey) {
      console.warn('⚠️  CuelinksOffersSource: missing apiKey');
      return [];
    }
    const allOffers = [];
    try {
      for (let page = 1; page <= this.maxPages; page++) {
        const { data } = await axios.get(`${this.baseUrl}/offers`, {
          params: { page, per_page: this.perPage },
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
          },
          timeout: 20000,
        });
        const offers = data.offers || [];
        if (!offers.length) break;
        allOffers.push(...offers);
        if (offers.length < this.perPage) break;
      }
      console.log(`📡 CuelinksOffersSource: fetched ${allOffers.length} offers`);
    } catch (err) {
      console.error(`❌ CuelinksOffersSource fetch failed: ${err.message}`);
      return [];
    }
    return this._convertOffers(allOffers);
  }

  /**
   * Convert raw Cuelinks offer objects → normalized Deal shape.
   */
  _convertOffers(offers) {
    return offers.map(o => {
      const payoutValue = (o.payout || '').toString().replace(/[^0-9.]/g, '');
      return {
        source: this.name(),
        sourceId: `cuelinks-${o.id}`,
        title: o.title || 'Special Offer',
        description: this._stripHtml(o.description || ''),
        merchantUrl: o.url || '',
        affiliateLink: o.affiliate_url || '',
        imageUrl: o.image_url || null,
        couponCode: o.coupon_code || null,
        category: this._detectCategory(o),
        payout: payoutValue || null,
        payoutType: o.payout_type || '%',
        campaignName: o.campaign || 'Shopping',
        metadata: {
          offerId: o.id,
          campaignId: o.camapign_id || o.campaign_id || null,
          startDate: o.start_date || null,
          endDate: o.end_date || null,
          categories: o.categories || [],
        },
      };
    }).filter(d => d.affiliateLink);
  }

  _stripHtml(s) {
    return (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  _detectCategory(offer) {
    // Cuelinks API returns categories inconsistently: array, string, CSV, or null.
    // Normalize to a single space-separated string for matching.
    const cats = offer.categories;
    let catStr = '';
    if (Array.isArray(cats)) catStr = cats.join(' ');
    else if (typeof cats === 'string') catStr = cats;
    const text = `${offer.campaign || ''} ${offer.title || ''} ${catStr}`.toLowerCase();
    const map = {
      fashion: ['fashion', 'myntra', 'ajio', 'clothing', 'apparel'],
      electronics: ['electronic', 'mobile', 'phone', 'gadget', 'tech'],
      travel: ['travel', 'flight', 'hotel', 'trip'],
      food: ['food', 'restaurant', 'pizza'],
      beauty: ['beauty', 'cosmetic', 'makeup', 'skincare'],
      grocery: ['grocery', 'mart', 'food'],
    };
    for (const [cat, keys] of Object.entries(map)) {
      if (keys.some(k => text.includes(k))) return cat;
    }
    return 'general';
  }
}

module.exports = CuelinksOffersSource;
