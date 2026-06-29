/**
 * Indian E-commerce Merchant Map
 * Maps URL domains to recognized merchants with metadata.
 * Used by LinkKit to identify affiliate link opportunities.
 */

const MERCHANT_MAP = {
  // 🛒 Major Marketplaces
  'amazon.in':       { name: 'Amazon India',       category: 'electronics', emoji: '🛒', priority: 1 },
  'amazon.com':      { name: 'Amazon',            category: 'electronics', emoji: '🛒', priority: 1 },
  'amzn.to':         { name: 'Amazon (Short)',    category: 'electronics', emoji: '🛒', priority: 1 },
  'flipkart.com':    { name: 'Flipkart',          category: 'electronics', emoji: '🛒', priority: 1 },
  'fkrt.site':       { name: 'Flipkart (Short)',  category: 'electronics', emoji: '🛒', priority: 1 },
  'shopsy.in':       { name: 'Shopsy',            category: 'general',     emoji: '🛍️', priority: 2 },

  // 👗 Fashion
  'myntra.com':      { name: 'Myntra',            category: 'fashion',     emoji: '👗', priority: 2 },
  'ajio.com':        { name: 'AJIO',              category: 'fashion',     emoji: '👕', priority: 2 },
  'nykaa.com':       { name: 'Nykaa',             category: 'beauty',      emoji: '💄', priority: 2 },
  'nykaafashion.com':{ name: 'Nykaa Fashion',     category: 'fashion',     emoji: '👗', priority: 2 },
  'tatacliq.com':    { name: 'Tata CLiQ',         category: 'fashion',     emoji: '🛍️', priority: 2 },
  'snapdeal.com':    { name: 'Snapdeal',          category: 'general',     emoji: '🛒', priority: 3 },

  // 📱 Electronics / Gadgets
  'croma.com':       { name: 'Croma',             category: 'electronics', emoji: '📱', priority: 2 },
  'reliancedigital.in': { name: 'Reliance Digital',category: 'electronics', emoji: '📱', priority: 2 },
  'boat-lifestyle.com':{ name: 'boAt',             category: 'electronics', emoji: '🎧', priority: 3 },
  'oneplus.in':      { name: 'OnePlus',           category: 'electronics', emoji: '📱', priority: 3 },
  'mi.com':          { name: 'Xiaomi',            category: 'electronics', emoji: '📱', priority: 3 },

  // 💄 Beauty & Wellness
  'purplle.com':     { name: 'Purplle',           category: 'beauty',      emoji: '💄', priority: 3 },
  'mamaearth.in':    { name: 'Mamaearth',         category: 'beauty',      emoji: '🌿', priority: 3 },

  // 🍔 Food & Delivery
  'swiggy.com':      { name: 'Swiggy',            category: 'food',        emoji: '🍔', priority: 2 },
  'zomato.com':      { name: 'Zomato',            category: 'food',        emoji: '🍕', priority: 2 },

  // ✈️ Travel
  'makemytrip.com':  { name: 'MakeMyTrip',        category: 'travel',      emoji: '✈️', priority: 2 },
  'goibibo.com':     { name: 'Goibibo',           category: 'travel',      emoji: '🏨', priority: 3 },
  'cleartrip.com':   { name: 'Cleartrip',         category: 'travel',      emoji: '✈️', priority: 3 },
  'yatra.com':       { name: 'Yatra',             category: 'travel',      emoji: '✈️', priority: 3 },
  'booking.com':     { name: 'Booking.com',       category: 'travel',      emoji: '🏨', priority: 3 },
  'agoda.com':       { name: 'Agoda',             category: 'travel',      emoji: '🏨', priority: 3 },

  // 🎟️ Entertainment
  'bookmyshow.com':  { name: 'BookMyShow',        category: 'entertainment', emoji: '🎬', priority: 3 },

  // 🛒 Grocery
  'jiomart.com':     { name: 'JioMart',           category: 'grocery',     emoji: '🛒', priority: 2 },
  'bigbasket.com':   { name: 'BigBasket',         category: 'grocery',     emoji: '🛒', priority: 2 },
  'grofers.com':     { name: 'Grofers',           category: 'grocery',     emoji: '🛒', priority: 3 },

  // 💼 Other Popular
  'meesho.com':      { name: 'Meesho',            category: 'fashion',     emoji: '🛍️', priority: 2 },
  'limeroad.com':    { name: 'Limeroad',          category: 'fashion',     emoji: '👕', priority: 3 },
  'lifestylestores.com': { name: 'Lifestyle Stores', category: 'fashion', emoji: '👗', priority: 3 },
  'pepperfry.com':   { name: 'Pepperfry',         category: 'general',     emoji: '🛋️', priority: 3 },
  'urbanic.com':     { name: 'Urbanic',           category: 'fashion',     emoji: '👗', priority: 3 },
  'thesouledstore.com': { name: 'The Souled Store', category: 'fashion',     emoji: '👕', priority: 3 },
};

/**
 * Identify merchant from URL.
 * Returns { name, category, emoji, priority } or null.
 */
function identifyMerchant(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    // Direct match first
    if (MERCHANT_MAP[hostname]) {
      return { ...MERCHANT_MAP[hostname], domain: hostname };
    }
    // Partial match (e.g. "shop.flipkart.com")
    for (const [domain, info] of Object.entries(MERCHANT_MAP)) {
      if (hostname.includes(domain) || hostname.endsWith('.' + domain)) {
        return { ...info, domain: hostname };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Strip known affiliate/tracking parameters from a URL before re-conversion.
 * Matched by exact parameter KEY (not regex against URL string).
 * Examples stripped: ?tag=techspy09-21, ?affid=xyz, ?ref=asdf, ?utm_source=tg
 */
const TRACKING_PARAM_KEYS = new Set([
  // General affiliate refs
  'tag', 'affid', 'affiliate', 'affiliate_id', 'ref', 'ref_id',
  'ref_source', 'tracking_id', 'click_id',
  // UTM tracking
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  // Amazon-specific
  'linkCode', 'ascsubtag', 'psc', 'smid',
  // Flipkart-specific
  'affExtParam1', 'affExtParam2',
]);

function stripAffiliateTags(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    let removed = 0;
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM_KEYS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
        removed++;
      }
    }
    return removed ? u.toString() : url;
  } catch {
    return url;
  }
}

/**
 * Check if a URL is a known shortener that we should resolve.
 */
function isShortener(url) {
  if (!url) return false;
  const shorteners = ['fkrt.site', 'amzn.to', 'bit.ly', 'tinyurl.com', 'goo.gl', 't.me'];
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return shorteners.some(s => hostname.includes(s));
  } catch {
    return false;
  }
}

module.exports = {
  MERCHANT_MAP,
  identifyMerchant,
  stripAffiliateTags,
  isShortener,
};
