/**
 * Cuelinks Affiliate Automation - Configuration
 * All API keys, tokens, and settings in one place.
 */

const config = {
  // Cuelinks API
  cuelinks: {
    apiKey: process.env.CUELINKS_API_KEY || 'CWovRV40KcoWhp2e72h0Hq3m8qHPNxoauYrlf3rOaKI',
    baseUrl: 'https://www.cuelinks.com/api/v2',
  },

  // Telegram Bot
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8142520623:AAHSa4rSsWs8z-n5tB9GJ622dgXJrV9Ai8s',
    channelId: process.env.TELEGRAM_CHANNEL || '@shoppingdealsofferscuelinks',
    channelLink: 'https://t.me/shoppingdealsofferscuelinks',
  },

  // Pexels API for images (free tier: 200 req/hour, 20K/month)
  pexels: {
    apiKey: process.env.PEXELS_API_KEY || '',
    baseUrl: 'https://api.pexels.com/v1',
  },

  // Automation settings
  automation: {
    // Max posts per run to avoid flooding
    maxPostsPerRun: 5,
    // Delay between posts (ms)
    postDelay: 3000,
    // Categories to focus on (empty = all)
    focusCategories: [],
    // Minimum payout percentage to include (0 = include all deals, even without payout data)
    minPayoutPercent: 0,
  },

  // Tracking file - stores posted deals to avoid duplicates
  trackingFile: 'posted_deals.json',

  // Output file for website
  websiteOutputFile: 'deals.json',
};

module.exports = config;
