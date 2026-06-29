/**
 * Image Fetcher - Pexels API (Free Tier)
 * Fetches high-quality images for product deals.
 */
const axios = require('axios');
const config = require('./config');

class ImageFetcher {
  constructor() {
    this.client = axios.create({
      baseURL: config.pexels.baseUrl,
      headers: {
        'Authorization': config.pexels.apiKey,
      },
      timeout: 15000,
    });
  }

  /**
   * Search for images matching a query.
   * Free tier: 200 req/hour, 20K req/month.
   */
  async searchImages(query, count = 3) {
    if (!config.pexels.apiKey) {
      console.log('⚠️ No Pexels API key - using placeholder image style');
      return this.getPlaceholderImages(count);
    }

    try {
      const { data } = await this.client.get('/search', {
        params: { query, per_page: count, size: 'medium', orientation: 'landscape' },
      });
      return data.photos?.map(p => ({
        url: p.src?.large || p.src?.medium,
        photographer: p.photographer,
        alt: p.alt || query,
        width: p.width,
        height: p.height,
      })) || [];
    } catch (err) {
      console.error('❌ Image search failed:', err.message);
      return [];
    }
  }

  /**
   * Get a relevant image for a deal.
   */
  async getDealImage(deal) {
    const queries = [
      `${deal.campaignName} deal offer`,
      `${deal.category} shopping sale`,
      `${deal.domain} products`,
      'online shopping deals',
    ];

    for (const q of queries) {
      const images = await this.searchImages(q, 1);
      if (images.length > 0) return images[0];
    }
    return null;
  }

  /**
   * Fallback: generate rich text-only post when no images available.
   */
  getPlaceholderImages(count) {
    // No Pexels key - we'll use text-based posts with emoji/formatting
    return [];
  }
}

module.exports = ImageFetcher;
