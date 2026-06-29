/**
 * Image Fetcher v3 — Pexels API with truly varied, deal-specific images
 *
 * Fixes two critical bugs in v2:
 *   1. ❌ `...titleKeywords.slice(0,2).join(' ')` — spreading a string! That turned
 *      "headphones bluetooth" into 18 single-char queries ('h','e','a','d',...).
 *      Result: every query returned 0 results → fell through to "shopping" → SAME image.
 *   2. ❌ Per-run query cache returned the SAME image to multiple deals when they
 *      shared fallback keywords (e.g. different "shopping" fallbacks cached one image).
 *
 * v3 changes:
 *   - Queries are STRINGS (not spread of strings)
 *   - Cache is per-deal: each deal gets its own fetched image, even if titles overlap
 *   - Page offset = deal-index * random + 1, so similar deals get different pages
 *   - WIDER page range (1-15) for more visual variety
 *   - Per-query tries a higher per_page (5) and picks randomly from results
 *   - Falls back to a colored SVG placeholder only if Pexels truly fails
 *
 * Free tier: 200 requests/hour, 20,000 requests/month.
 */

const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

// Stopwords: skip noise, focus on product/brand terms
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
  'get', 'use', 'your', 'you', 'our', 'we', 'they', 'their', 'it', 'its', 'as', 'if',
  'sale', 'deal', 'deals', 'offer', 'offers', 'shop', 'shopping', 'buy', 'online', 'store',
  'now', 'today', 'tomorrow', 'only', 'limited', 'time', 'free', 'new', 'best', 'top',
  'grab', 'avail', 'enjoy', 'extra', 'special', 'mega', 'super', 'discount', 'discounted',
  'off', 'upto', 'rs', 'inr', 'percent', 'save', 'savings', 'flat', 'minimum', 'maximum',
  'site', 'app', 'platform', 'website', 'order', 'delivery', 'cashback', 'reward', 'rewards',
  'earn', 'earning', 'plus', 'pro', 'max', 'mini', 'ultra', 'premium', 'edition', 'version',
]);

// Category → better Pexels query (improves relevance for generic deal titles)
const CATEGORY_QUERY = {
  'fashion': 'fashion clothing',
  'electronics': 'electronics gadgets',
  'mobile': 'smartphone mobile phone',
  'beauty': 'beauty cosmetics',
  'home': 'home decor interior',
  'fitness': 'fitness gym workout',
  'food': 'food groceries',
  'travel': 'travel vacation',
  'books': 'books reading',
  'kids': 'kids toys children',
  'health': 'health wellness',
  'general': 'shopping products',
};

class ImageFetcher {
  constructor() {
    this.client = axios.create({
      baseURL: config.pexels.baseUrl,
      headers: {
        // Pexels expects raw key (no Bearer prefix)
        'Authorization': config.pexels.apiKey || '',
      },
      timeout: 15000,
    });
    // Per-run image cache. Keyed by deal-id so each deal gets unique image.
    this._dealImages = new Map();
  }

  /**
   * Extract 1-5 meaningful product/brand keywords from a deal title.
   * Filters out stopwords + words that are too short/long.
   */
  _extractKeywords(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\d+/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 4 && w.length <= 20 && !STOPWORDS.has(w))
      .slice(0, 5);
  }

  /**
   * Build a varied, deal-specific query chain (STRINGS only).
   * Order: title-keywords (best) → brand+category → category → generic fallback.
   * Returns array of strings, each a complete search query.
   */
  _buildQueries(deal) {
    const titleKeywords = this._extractKeywords(deal.title || '');
    const brand = (deal.campaignName || '').trim();
    const category = (deal.category || 'general').toLowerCase();
    const categoryQ = CATEGORY_QUERY[category] || `${category} products`;

    const queries = [];

    // 1) Title keywords joined (2 best) — most specific, e.g. "wireless headphones"
    if (titleKeywords.length >= 2) {
      queries.push(titleKeywords.slice(0, 2).join(' '));
    }
    // 2) Single best title keyword
    if (titleKeywords.length >= 1) {
      queries.push(titleKeywords[0]);
    }
    // 3) Brand + category combo
    if (brand) {
      queries.push(`${brand} ${categoryQ.split(' ')[0]}`.trim());
    }
    // 4) Just brand
    if (brand) {
      queries.push(brand);
    }
    // 5) Category + first title keyword
    if (titleKeywords[0]) {
      queries.push(`${categoryQ.split(' ')[0]} ${titleKeywords[0]}`);
    }
    // 6) Just category (improved)
    queries.push(categoryQ);
    // 7) Last-resort generic
    queries.push('products shopping');

    // Dedupe while preserving order
    return [...new Set(queries.filter(q => q && q.length >= 2))];
  }

  /**
   * Search Pexels for ONE image. Uses deal-index-based page offset for variety.
   * Fetches 8 results, picks one randomly.
   */
  async searchImage(query, dealIndex = 0) {
    if (!config.pexels.apiKey) {
      return null;
    }
    // Page = (deal_index mod 10) + 1, plus 0-2 random — gives pages 1-12 typically
    const basePage = (dealIndex % 10) + 1;
    const page = basePage + Math.floor(Math.random() * 3);
    try {
      const { data } = await this.client.get('/search', {
        params: {
          query,
          per_page: 8,        // fetch more so we can pick varied one
          page,
          size: 'medium',
          orientation: 'landscape',
        },
      });
      const photos = (data.photos ?? []).filter(p => p.src?.large || p.src?.medium);
      if (photos.length === 0) return null;
      // Pick a RANDOM photo from results (not always the first)
      const photo = photos[Math.floor(Math.random() * photos.length)];
      return {
        url: photo.src?.large || photo.src?.medium,
        photographer: photo.photographer,
        alt: photo.alt || query,
        width: photo.width,
        height: photo.height,
        page: data.page,
      };
    } catch (err) {
      // Surface to log so user can debug
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        console.error(`❌ Pexels auth failed (${status}). Check PEXELS_API_KEY.`);
      } else {
        console.error(`❌ Pexels "${query}" failed: ${err.message}`);
      }
      return null;
    }
  }

  /**
   * Get a unique, relevant image for a deal.
   * Caches per-deal-id so each deal gets its own image.
   * @param {Object} deal - the deal object
   * @param {number} dealIndex - 0-based position in this run (used for page variety)
   * @returns {Object|null} { url, photographer, alt, source, query }
   */
  async getDealImage(deal, dealIndex = 0) {
    const dealId = deal.sourceId || deal.affiliateLink || JSON.stringify(deal).slice(0, 50);

    // If we already fetched for this exact deal, reuse
    if (this._dealImages.has(dealId)) {
      return this._dealImages.get(dealId);
    }

    const queries = this._buildQueries(deal);
    for (const q of queries) {
      const img = await this.searchImage(q, dealIndex);
      if (img) {
        const enriched = { ...img, source: 'pexels', query: q };
        this._dealImages.set(dealId, enriched);
        console.log(`🖼️  [${q}] (deal #${dealIndex + 1}) → ${(img.alt || 'image').substring(0, 45)}`);
        return enriched;
      }
    }

    // No image found from any query — store null to avoid retrying
    this._dealImages.set(dealId, null);
    console.log(`⚠️  No Pexels image for: "${(deal.title || '').substring(0, 40)}" (tried ${queries.length} queries)`);
    return null;
  }

  /**
   * Clear cache (call between cron runs to allow re-fetching with new deal data).
   */
  resetCache() {
    this._dealImages.clear();
  }

  /**
   * Returns a colored SVG placeholder as a data URL (only if Pexels totally fails).
   */
  getPlaceholderDataUrl(title = 'Deal') {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFD93D', '#6C5CE7'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const text = title.replace(/[^\w\s]/g, '').substring(0, 30);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">
      <rect width="800" height="400" fill="${color}"/>
      <text x="50%" y="50%" font-family="Arial" font-size="36" fill="white"
            text-anchor="middle" dominant-baseline="middle" font-weight="bold">${text}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
}

module.exports = ImageFetcher;
