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
    // Channel monitor watches THIS channel for URLs to auto-convert
    monitorChannelId: process.env.TELEGRAM_MONITOR_CHANNEL || '@shoppingdealsofferscuelinks',
    channelLink: 'https://t.me/shoppingdealsofferscuelinks',
  },

  // Pexels API for images (free tier: 200 req/hour, 20K/month)
  pexels: {
    apiKey: process.env.PEXELS_API_KEY || '',
    baseUrl: 'https://api.pexels.com/v1',
  },

  // Bitly token for branded short URLs (optional, free tier = 10/month)
  bitly: {
    apiKey: process.env.BITLY_API_KEY || '',
    enabled: false, // Set true once you have a Bitly Generic Access Token
  },

  // Source flags — toggle which sources contribute to the deal pipeline
  sources: {
    cuelinksOffers: true,    // /offers API (primary curated source)
    userSubmitted: true,     // URLs from /deal command, web form, monitor
    // future: rssFeed: false, scraperAdult: false, etc.
  },

  // LinkKit (URL → affiliate converter)
  linkkit: {
    enabled: true,
    stripExistingTags: true,
    resolveShortUrls: true,
  },

  // Bot (Telegram long-polling command handler)
  bot: {
    enabled: process.env.BOT_ENABLED !== 'false',
    pollTimeout: 30,
    commands: ['deal', 'convert', 'stats', 'search', 'top', 'help'],
  },

  // Channel Monitor (auto-convert URLs in channel posts)
  monitor: {
    enabled: process.env.MONITOR_ENABLED === 'true',
    mode: 'reply',  // 'reply' | 'silent' | 'edit'
    deleteOriginalAfterConvert: false,  // 'reply' mode doesn't need this
  },

  // Global Postback (commission notifications)
  postback: {
    enabled: false,                                  // Enable after Cuelinks setup
    targetUrl: process.env.POSTBACK_TARGET_URL || '', // e.g. https://api.github.com/repos/technicalboy2023/cuelinks-automation/dispatches
    githubToken: process.env.GH_PAT || '',           // Auth for repo_dispatch
    eventType: 'cuelinks-commission',
  },

  // Automation settings (cron job)
  automation: {
    maxPostsPerRun: 5,
    postDelay: 3000,
    focusCategories: [],
    minPayoutPercent: 0,
    // When set, posts user-submitted URLs FIRST before /offers picks
    prioritizeUserSubmissions: true,
  },

  // Tracking file - stores posted deal IDs/URLs to avoid duplicates
  trackingFile: 'posted_deals.json',

  // Output file for website
  websiteOutputFile: 'deals.json',
};

module.exports = config;
