/**
 * Source: User-submitted URLs
 *
 * Reads pending URL submissions from a JSON file that gets populated by:
 *   - Telegram bot /deal <url> command (bot.js)
 *   - Website URL submission form (docs/index.html → repository_dispatch)
 *   - Channel auto-monitor (monitor.js)
 *
 * Process:
 *   1. Read submissions from data/submitted_urls.json
 *   2. For each URL, run LinkKit conversion → tracking link
 *   3. Mark each as processed (move to processed list)
 *   4. Return as normalized Deal array
 */

const fs = require('fs');
const path = require('path');
const BaseSource = require('./base');
const LinkKit = require('../linkkit');

class UserSubmittedSource extends BaseSource {
  constructor(config = {}) {
    super(config);
    this.dataDir = config.dataDir || path.join(__dirname, '..', 'data');
    this.filePath = path.join(this.dataDir, 'submitted_urls.json');
    this.linkkit = config.linkkit || null;
    this.campaigns = config.campaigns || [];
    this.logger = config.logger || console;
  }

  name() { return 'user-submitted'; }

  setLinkKit(campaigns, linkkit) {
    this.campaigns = campaigns;
    if (linkkit) this.linkkit = linkkit;
    if (!this.linkkit && campaigns) {
      this.linkkit = new LinkKit(campaigns, { logger: this.logger });
    } else if (this.linkkit && campaigns) {
      this.linkkit.setCampaigns(campaigns);
    }
  }

  async fetch() {
    const submissions = this._readPending();
    if (!submissions.length) return [];
    this.logger.log?.(`📥 UserSubmittedSource: ${submissions.length} pending URLs`);
    const deals = [];
    const processedIds = [];
    for (const sub of submissions) {
      try {
        const url = sub.url;
        const result = this.linkkit
          ? await this.linkkit.convert(url)
          : { success: false, error: 'No LinkKit instance' };
        if (!result.success) {
          this.logger.log?.(`⚠️  Convert failed for ${url}: ${result.error}`);
          continue;
        }
        const merchant = result.merchant || {};
        deals.push({
          source: this.name(),
          sourceId: `user-${sub.id}`,
          title: sub.title?.trim() || `${merchant.name || 'Deal'} — ${sub.id}`,
          description: sub.description?.trim() || null,
          merchantUrl: result.originalUrl || url,
          affiliateLink: result.affiliateUrl,
          imageUrl: sub.imageUrl || null,
          couponCode: sub.couponCode || null,
          category: merchant.category || 'general',
          payout: null,
          payoutType: null,
          campaignName: merchant.name || 'User Submitted',
          metadata: {
            submittedBy: sub.submittedBy || 'unknown',
            submittedAt: sub.submittedAt,
            merchant: merchant.name || null,
            campaignId: result.campaign?.id || null,
          },
        });
        processedIds.push(sub.id);
      } catch (err) {
        this.logger.log?.(`❌ UserSubmittedSource error: ${err.message}`);
      }
    }
    // Mark processed
    if (processedIds.length) this._markProcessed(processedIds);
    this.logger.log?.(`✅ UserSubmittedSource: ${deals.length} deals converted`);
    return deals;
  }

  /**
   * Append a new submission to the pending list.
   * Called from bot.js / web form / monitor.js.
   */
  add(submission) {
    const data = this._loadAll();
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const entry = {
      id,
      url: submission.url,
      title: submission.title || null,
      description: submission.description || null,
      imageUrl: submission.imageUrl || null,
      couponCode: submission.couponCode || null,
      submittedBy: submission.submittedBy || 'unknown',
      submittedAt: new Date().toISOString(),
      processed: false,
    };
    data.pending.push(entry);
    this._saveAll(data);
    return entry;
  }

  /**
   * Read pending (unprocessed) submissions.
   */
  _readPending() {
    const data = this._loadAll();
    return (data.pending || []).filter(p => !p.processed);
  }

  /**
   * Mark ids as processed (move out of pending, into processed).
   */
  _markProcessed(ids) {
    const data = this._loadAll();
    const idSet = new Set(ids);
    const stillPending = [];
    const processed = data.processed || [];
    for (const p of (data.pending || [])) {
      if (idSet.has(p.id)) {
        processed.push({ ...p, processedAt: new Date().toISOString() });
      } else if (!p.processed) {
        stillPending.push(p);
      }
    }
    data.pending = stillPending;
    data.processed = processed.slice(-500); // keep last 500
    this._saveAll(data);
  }

  _loadAll() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        const init = { pending: [], processed: [] };
        fs.writeFileSync(this.filePath, JSON.stringify(init, null, 2));
        return init;
      }
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (err) {
      this.logger.log?.(`⚠️  Could not load submissions: ${err.message}`);
      return { pending: [], processed: [] };
    }
  }

  _saveAll(data) {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      this.logger.log?.(`❌ Could not save submissions: ${err.message}`);
    }
  }
}

module.exports = UserSubmittedSource;
