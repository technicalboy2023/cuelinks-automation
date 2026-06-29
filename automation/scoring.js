/**
 * 📊 Deal Quality Scorer
 *
 * Ranks Cuelinks offers so we post the BEST 5 deals (not just highest payout).
 * Quality is measured by:
 *   - Payout (more = more commission for you)
 *   - Has coupon (users love coupons)
 *   - Has image (visual posts get 3x engagement)
 *   - Description quality
 *   - Popular merchant (Amazon, Flipkart, Myntra... more trust)
 *   - Freshness (recent offer = relevant)
 *   - Category diversity (don't show 5 from same category)
 */

const POPULAR_MERCHANTS = [
  'amazon', 'flipkart', 'myntra', 'ajio', 'tatacliq', 'snapdeal',
  'meesho', 'bigbasket', 'jiomart', 'shopsy', 'nykaa', 'lifestylestores',
  'pepperfry', 'swiggy', 'zomato', 'makemytrip', 'goibibo', 'bookmyshow',
  'croma', 'reliancedigital',
];

// Time-sensitive keywords (flash sale / limited time)
const URGENT_KEYWORDS = [
  'today only', 'flash sale', 'limited time', 'ending soon', 'last day',
  'today', 'flash', 'hurry', 'few hours', 'clearance', 'flash-sale',
];

/**
 * Compute a numeric quality score for a single deal.
 * Higher = better. Always >= 0.
 */
function scoreDeal(deal) {
  if (!deal) return 0;
  let score = 0;

  // 1. Payout (numeric value, e.g. "8" for 8%)
  const payout = parseFloat(deal.payout) || 0;
  score += payout;

  // 2. Has coupon code (huge user-appeal)
  if (deal.couponCode) score += 5;

  // 3. Has image (visual content wins)
  if (deal.imageUrl || deal.offerImage) score += 3;

  // 4. Description quality (longer = more informative)
  const desc = (deal.description || '').trim();
  if (desc.length > 100) score += 3;
  else if (desc.length > 50) score += 1.5;

  // 5. Popular merchant bonus
  const campName = (deal.campaignName || '').toLowerCase();
  if (POPULAR_MERCHANTS.some(m => campName.includes(m))) score += 4;

  // 6. Time-sensitive (flash sale etc.)
  const titleDesc = ((deal.title || '') + ' ' + desc).toLowerCase();
  if (URGENT_KEYWORDS.some(kw => titleDesc.includes(kw))) score += 2;

  // 7. Freshness: prefer recent offers
  const startDate = deal.metadata?.startDate || deal.startDate;
  if (startDate) {
    const days = (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 0 && days <= 7) score += 3;        // last week
    else if (days > 7 && days <= 30) score += 1;   // last month
    // older deals get no freshness bonus
  }

  // 8. Title quality (not too short, not too long)
  const title = (deal.title || '').trim();
  if (title.length >= 20 && title.length <= 100) score += 1;

  return Math.round(score * 10) / 10;  // 1 decimal
}

/**
 * Pick the top N deals with category diversity.
 * Ensures no single category dominates the picks.
 *
 * Strategy:
 *   1. Score all deals
 *   2. Sort by score DESC, then by startDate DESC (newer first), then user-submitted first
 *   3. Walk through sorted list, taking deals up to maxPerCategory per category
 *   4. If we can't fill N (e.g. too many from same category), relax limit
 *      progressively (+1 each pass) before falling back to unlimited
 *   5. Logs a warning if backfill is needed
 */
function pickTopN(deals, n = 5, options = {}) {
  // Edge case: invalid n
  if (!n || n <= 0 || !Array.isArray(deals) || !deals.length) return [];
  // Sanitize maxPerCategory: must be >= 1, else default to 2
  let maxPerCategory = options.maxPerCategory ?? 2;
  if (typeof maxPerCategory !== 'number' || !isFinite(maxPerCategory) || maxPerCategory < 1) {
    console.warn(`⚠️  pickTopN: invalid maxPerCategory=${options.maxPerCategory}, defaulting to 2`);
    maxPerCategory = 2;
  }

  // Score + sort with explicit tie-breakers
  const scored = deals.map(d => {
    const startDate = d.metadata?.startDate || d.startDate;
    return {
      ...d,
      _score: scoreDeal(d),
      _date: startDate ? new Date(startDate).getTime() : 0,
      _isUser: (d.source === 'user-submitted') ? 1 : 0,
    };
  });
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;             // primary: score
    if (b._isUser !== a._isUser) return b._isUser - a._isUser;         // tie 1: user-submitted first
    if (b._date !== a._date) return b._date - a._date;                 // tie 2: newer offer first
    return 0;                                                           // stable
  });

  // Progressive backfill: try maxPerCategory, then +1, +2, ... then unlimited
  let picked = [];
  const tryPick = (limit) => {
    const result = [];
    const cat = {};
    for (const d of scored) {
      if (result.length >= n) break;
      const c = d.category || 'general';
      if ((cat[c] || 0) >= limit) continue;
      result.push(d);
      cat[c] = (cat[c] || 0) + 1;
    }
    return result;
  };

  // Start strict, relax if needed
  for (let limit = maxPerCategory; limit <= n; limit++) {
    picked = tryPick(limit);
    if (picked.length >= n) break;
  }
  // Final fallback: any 5 best-scoring
  if (picked.length < n) {
    picked = tryPick(Infinity);
    if (picked.length < n) {
      // Last resort: pad with original remaining
      const haveIds = new Set(picked.map(d => d.sourceId || d.affiliateLink));
      for (const d of scored) {
        if (picked.length >= n) break;
        const id = d.sourceId || d.affiliateLink;
        if (!haveIds.has(id)) picked.push(d);
      }
      console.warn(`⚠️  pickTopN: only ${picked.length}/${n} deals available (pool=${deals.length})`);
    } else {
      console.warn(`⚠️  pickTopN: backfill ignored category limit (only ${picked.length} unique categories)`);
    }
  }

  return picked;
}

/**
 * Explain why a deal was scored high/low (for debugging).
 */
function explainScore(deal) {
  const reasons = [];
  const payout = parseFloat(deal.payout) || 0;
  if (payout) reasons.push(`+${payout} payout`);
  if (deal.couponCode) reasons.push('+5 coupon');
  if (deal.imageUrl || deal.offerImage) reasons.push('+3 image');
  const desc = (deal.description || '').trim();
  if (desc.length > 100) reasons.push('+3 long desc');
  else if (desc.length > 50) reasons.push('+1.5 medium desc');
  const campName = (deal.campaignName || '').toLowerCase();
  if (POPULAR_MERCHANTS.some(m => campName.includes(m))) reasons.push('+4 popular merchant');
  const titleDesc = ((deal.title || '') + ' ' + desc).toLowerCase();
  if (URGENT_KEYWORDS.some(kw => titleDesc.includes(kw))) reasons.push('+2 urgent/flash');
  return reasons;
}

module.exports = {
  scoreDeal,
  pickTopN,
  explainScore,
  POPULAR_MERCHANTS,
  URGENT_KEYWORDS,
};
