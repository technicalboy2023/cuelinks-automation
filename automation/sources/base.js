/**
 * Base Source — abstract interface for deal sources
 *
 * All sources must implement:
 *   - async fetch() : returns Deal[] (normalized deals)
 *   - name()        : source identifier
 *
 * Normalized Deal shape:
 *   {
 *     source: 'cuelinks-offers' | 'user-submitted' | ...,
 *     sourceId: string,
 *     title: string,
 *     description?: string,
 *     merchantUrl: string,
 *     affiliateLink: string,         // REQUIRED — the tracking URL
 *     imageUrl?: string,
 *     category?: string,
 *     payout?: string,
 *     payoutType?: string,
 *     couponCode?: string,
 *     campaignName?: string,
 *     metadata: object,              // source-specific extra
 *   }
 */

class BaseSource {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Source identifier (e.g. 'cuelinks-offers').
   */
  name() {
    throw new Error('Source must implement name()');
  }

  /**
   * Fetch deals from this source.
   * @returns {Promise<Array>}
   */
  async fetch() {
    throw new Error('Source must implement fetch()');
  }

  /**
   * Validate a deal has all required fields.
   */
  validate(deal) {
    if (!deal || typeof deal !== 'object') return false;
    if (!deal.affiliateLink) return false;
    if (!deal.title) return false;
    return true;
  }

  /**
   * Filter + normalize fetched deals.
   */
  normalize(rawDeals) {
    return (rawDeals || [])
      .filter(d => this.validate(d))
      .map(d => ({
        source: this.name(),
        ...d,
        fetchedAt: new Date().toISOString(),
      }));
  }
}

module.exports = BaseSource;
