/**
 * Cuelinks Affiliate API Client
 * Handles all Cuelinks API operations - campaigns, offers, link generation.
 */
const axios = require('axios');
const config = require('./config');

class CuelinksAPI {
  constructor() {
    this.client = axios.create({
      baseURL: config.cuelinks.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.cuelinks.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Fetch all active campaigns (paginated).
   */
  async getCampaigns() {
    try {
      // Fetch first page to get started
      const { data } = await this.client.get('/campaigns', {
        params: { per_page: 100 }
      });
      const campaigns = data.campaigns || [];
      console.log(`✅ Fetched ${campaigns.length} campaigns`);
      return campaigns;
    } catch (err) {
      console.error('❌ Failed to fetch campaigns:', err.message);
      return [];
    }
  }

  /**
   * Fetch current offers/deals (paginated - fetches up to 200).
   * These contain specific promotions with campaign details.
   */
  async getOffers() {
    try {
      const allOffers = [];
      let totalCount = 0;
      
      // Fetch up to 3 pages (200 offers max to avoid API overload)
      for (let page = 1; page <= 3; page++) {
        const { data } = await this.client.get('/offers', {
          params: { page, per_page: 100 }
        });
        
        const offers = data.offers || [];
        totalCount = data.total_count || totalCount;
        allOffers.push(...offers);
        
        if (offers.length < 100) break; // No more pages
      }
      
      console.log(`✅ Fetched ${allOffers.length} offers (total available: ${totalCount})`);
      return allOffers;
    } catch (err) {
      console.error('❌ Failed to fetch offers:', err.message);
      return [];
    }
  }

  /**
   * Get transactions/history for analytics.
   */
  async getTransactions() {
    try {
      const { data } = await this.client.get('/transactions');
      return data.transactions || [];
    } catch (err) {
      console.error('❌ Failed to fetch transactions:', err.message);
      return [];
    }
  }



  /**
   * Generate affiliate link for a product URL using campaign data.
   * Uses the pub_id format matching actual Cuelinks links.
   */
  generateAffiliateLink(productUrl, campaignId) {
    const encodedUrl = encodeURIComponent(productUrl);
    return `https://linksredirect.com/?pub_id=${campaignId}&url=${encodedUrl}`;
  }

  /**
   * Extract domain from a URL.
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '').toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Process offers into post-ready deals with affiliate links.
   * 
   * Strategy: Offers already contain affiliate_url, image_url, and all needed data.
   * Campaign matching is used only to enrich deals with additional metadata.
   * If no matching campaign is found, the deal is still created from offer data.
   */
  processOffers(offers, campaigns) {

    const deals = [];

    for (const offer of offers) {
      // Try to find matching campaign for enrichment
      const campaignId = offer.camapign_id || offer.campaign_id;
      const campaign = campaigns.find(c =>
        c.id === campaignId || c.name === offer.campaign
      );

      // Extract domain from offer URL or campaign data
      const offerDomain = this.extractDomain(offer.url || '');
      const campaignDomain = campaign?.domain || '';
      const domain = offerDomain || campaignDomain;

      const deal = {
        // Core deal data (always from offer)
        id: offer.id,
        title: offer.title || (campaign?.name || 'Shopping Deal'),
        description: this.stripHtml(offer.description || ''),
        campaignName: campaign?.name || offer.campaign || 'Shopping',
        campaignId: campaignId || campaign?.id || 0,
        // Affiliate link: use pre-built offer link
        affiliateLink: offer.affiliate_url || '',
        merchantUrl: offer.url || campaign?.url || '',
        domain: domain,
        
        // Campaign enrichment (when available)
        payout: campaign?.payout || '',
        payoutType: campaign?.payout_type || '',
        
        // Offer extras
        offerImage: offer.image_url || null,
        couponCode: offer.coupon_code || null,
        category: this.getCategory(domain),
        offerCategories: offer.categories || [],
        startDate: offer.start_date || '',
        endDate: offer.end_date || '',
        
        // Metadata
        timestamp: new Date().toISOString(),
      };

      deals.push(deal);
    }

    const enriched = deals.filter(d => d.payout).length;
    console.log(`🔗 Generated ${deals.length} deals (${enriched} enriched with campaign data)`);
    return deals;
  }

  /**
   * Strip HTML tags from description text.
   */
  stripHtml(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Categorize a merchant by domain.
   */
  getCategory(domain) {
    const categories = {
      fashion: ['myntra', 'ajio', 'nykaa', 'tatacliq', 'zara', 'hm', 'fabindia', 'snapdeal'],
      electronics: ['flipkart', 'amazon', 'samsung', 'apple', 'oneplus', 'realme', 'xiaomi', ' boat'],
      travel: ['makemytrip', 'goibibo', 'oyo', 'cleartrip', 'easemytrip', 'ixigo'],
      food: ['swiggy', 'zomato', 'dominos', 'faasos', 'licious'],
      general: [],
    };

    for (const [cat, domains] of Object.entries(categories)) {
      for (const d of domains) {
        if (domain && domain.includes(d)) return cat;
      }
    }
    return 'general';
  }
}

module.exports = CuelinksAPI;
