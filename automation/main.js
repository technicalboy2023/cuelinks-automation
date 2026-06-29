/**
 * 🚀 Cuelinks Affiliate Automation - Main Orchestrator (v2)
 *
 * Pipeline (multi-source):
 *   1. Fetch from ALL enabled sources (Cuelinks /offers, user-submitted)
 *   2. Merge + dedupe (across sources)
 *   3. Filter (categories, min payout, posted before)
 *   4. Limit (max posts per run)
 *   5. Post to Telegram (best format per deal)
 *   6. Track posted IDs/URLs
 *   7. Update website data + GitHub Pages
 *
 * Run modes:
 *   - node main.js              → Standard cron run
 *   - node main.js --dry-run    → Fetch + process, no posting
 *   - node main.js --web-form   → Trigger from website form (already submitted)
 *
 * Schedule: GitHub Actions cron (every 6 hours)
 */

const fs = require('fs');
const path = require('path');
const CuelinksAPI = require('./cuelinks');
const LinkKit = require('./linkkit');
const TelegramPoster = require('./telegram');
const ImageFetcher = require('./images');
const { buildSources, fetchAll } = require('./sources');
const UserSubmittedSource = require('./sources/user-submitted');
const config = require('./config');

class AutomationEngine {
  constructor() {
    this.cuelinks = new CuelinksAPI();
    this.linkkit = new LinkKit([], { logger: console });
    this.telegram = new TelegramPoster();
    this.images = new ImageFetcher();
    this.trackingPath = path.join(__dirname, config.trackingFile);
    this.postedDeals = this.loadPostedDeals();
    this.submittedSource = new UserSubmittedSource({ logger: console });
    this.dryRun = process.argv.includes('--dry-run');
    this.logger = console;
  }

  loadPostedDeals() {
    try {
      if (fs.existsSync(this.trackingPath)) {
        const data = JSON.parse(fs.readFileSync(this.trackingPath, 'utf8'));
        // Support both old (postedIds array) and new (posted array with keys)
        const posted = data.postedIds || data.posted || [];
        return new Set(posted);
      }
    } catch (err) {
      this.logger.error('⚠️  Failed to load tracking file:', err.message);
    }
    return new Set();
  }

  savePostedDeals() {
    try {
      const data = {
        lastRun: new Date().toISOString(),
        postedIds: [...this.postedDeals].slice(-2000),  // keep last 2000
        totalPosted: this.postedDeals.size,
      };
      fs.writeFileSync(this.trackingPath, JSON.stringify(data, null, 2));
      this.logger.log(`💾 Tracking: ${this.postedDeals.size} total entries`);
    } catch (err) {
      this.logger.error('❌ Failed to save tracking:', err.message);
    }
  }

  isDuplicate(deal) {
    const keys = [
      deal.sourceId,
      deal.affiliateLink,
      `${deal.source}::${deal.merchantUrl}`,
    ].filter(Boolean);
    return keys.some(k => this.postedDeals.has(k));
  }

  markPosted(deal) {
    [deal.sourceId, deal.affiliateLink, `${deal.source}::${deal.merchantUrl}`]
      .filter(Boolean)
      .forEach(k => this.postedDeals.add(k));
  }

  saveWebsiteData(deals) {
    try {
      const websitePath = path.join(__dirname, config.websiteOutputFile);
      const docsPath = path.join(__dirname, 'docs', config.websiteOutputFile);
      const docsDir = path.dirname(docsPath);
      const topDeals = deals.slice(0, 50);
      const data = {
        updated: new Date().toISOString(),
        channel: config.telegram.channelLink,
        totalDeals: deals.length,
        deals: topDeals.map(d => ({
          id: d.sourceId,
          title: d.title,
          description: d.description || '',
          campaignName: d.campaignName || 'Deal',
          domain: this._extractDomain(d.merchantUrl || d.affiliateLink),
          affiliateLink: d.affiliateLink,
          offerImage: d.imageUrl,
          couponCode: d.couponCode,
          category: d.category || 'general',
          payout: d.payout || '',
          payoutType: d.payoutType || '',
          source: d.source,
        })),
      };
      fs.writeFileSync(websitePath, JSON.stringify(data, null, 2));
      if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(docsPath, JSON.stringify(data, null, 2));
      this.logger.log(`🌐 Website data saved: ${topDeals.length} deals`);
    } catch (err) {
      this.logger.error('❌ Failed to save website data:', err.message);
    }
  }

  _extractDomain(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  async run() {
    const startTime = Date.now();
    this.logger.log('═'.repeat(60));
    this.logger.log('🤖 CUELINKS AFFILIATE AUTOMATION v2 (multi-source)');
    this.logger.log(`⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    this.logger.log(`🔧 Mode: ${this.dryRun ? 'DRY-RUN (no posting)' : 'LIVE POSTING'}`);
    this.logger.log('═'.repeat(60));

    // ── Step 1: Fetch campaigns (always needed for LinkKit) ──
    this.logger.log('\n📡 [1/6] Fetching Cuelinks campaigns...');
    const campaigns = await this.cuelinks.getCampaigns();
    if (config.linkkit.enabled && campaigns.length) {
      this.linkkit.setCampaigns(campaigns);
      this.submittedSource.setLinkKit(campaigns, this.linkkit);
    }

    // ── Step 2: Build sources + fetch all in parallel ──
    this.logger.log('\n📥 [2/6] Building sources...');
    const sources = buildSources(config).map(s => {
      if (s.name === 'user-submitted') s.setLinkKit(campaigns, this.linkkit);
      return s;
    });
    this.logger.log(`   Sources: ${sources.map(s => s.name()).join(', ')}`);

    this.logger.log('\n📦 [3/6] Fetching deals from all sources...');
    const allDeals = await fetchAll(sources);
    this.logger.log(`   Total unique deals: ${allDeals.length}`);

    if (!allDeals.length) {
      this.logger.log('📭 No deals from any source. Done.');
      return;
    }

    // ── Step 3: Prioritize user-submitted (if enabled) ──
    let ordered = allDeals;
    if (config.automation.prioritizeUserSubmissions) {
      const user = allDeals.filter(d => d.source === 'user-submitted');
      const others = allDeals.filter(d => d.source !== 'user-submitted');
      ordered = [...user, ...others];
      this.logger.log(`   Prioritized: ${user.length} user-submitted first`);
    }

    // ── Step 4: Filter duplicates + apply config filters ──
    this.logger.log('\n🔍 [4/6] Filtering & scoring...');
    const fresh = ordered.filter(d => !this.isDuplicate(d));
    this.logger.log(`   ${fresh.length} new (${ordered.length - fresh.length} duplicates skipped)`);

    let toPost = fresh;
    if (config.automation.focusCategories.length > 0) {
      toPost = toPost.filter(d =>
        config.automation.focusCategories.includes(d.category || 'general')
      );
      this.logger.log(`   ${toPost.length} after category filter`);
    }
    if (config.automation.minPayoutPercent > 0) {
      toPost = toPost.filter(d => {
        const p = parseFloat(d.payout);
        return isNaN(p) || p === 0 || p >= config.automation.minPayoutPercent;
      });
      this.logger.log(`   ${toPost.length} after payout filter`);
    }
    // Sort by payout (desc) then by source priority (user-submitted first)
    toPost.sort((a, b) => {
      const ap = parseFloat(a.payout) || 0;
      const bp = parseFloat(b.payout) || 0;
      if (bp !== ap) return bp - ap;
      return (a.source === 'user-submitted' ? -1 : 1);
    });

    toPost = toPost.slice(0, config.automation.maxPostsPerRun);
    this.logger.log(`📊 [5/6] Posting ${toPost.length} deals this run (maxPostsPerRun=${config.automation.maxPostsPerRun})\n`);

    if (this.dryRun) {
      toPost.forEach((d, i) => this.logger.log(`   [${i + 1}] ${d.title.substring(0, 60)} — ${d.campaignName}`));
    } else {
      let posted = 0, failed = 0;
      for (let i = 0; i < toPost.length; i++) {
        const deal = toPost[i];
        this.logger.log(`   📝 [${i + 1}/${toPost.length}] ${deal.title.substring(0, 60)}...`);
        try {
          let imageUrl = null;
          if (config.pexels.apiKey) {
            const image = await this.images.getDealImage({ title: deal.title, category: deal.category });
            if (image) imageUrl = image.url;
          }
          const result = await this.telegram.postDeal(this._toTeleFormat(deal), imageUrl);
          if (result) {
            this.markPosted(deal);
            posted++;
            this.logger.log(`   ✅ Posted!\n`);
          } else {
            failed++;
            this.logger.log(`   ❌ Failed\n`);
          }
          if (i < toPost.length - 1) await this.sleep(config.automation.postDelay);
        } catch (err) {
          failed++;
          this.logger.error(`   ❌ Error: ${err.message}\n`);
        }
      }

      this.logger.log('💾 [6/6] Saving data...');
      this.savePostedDeals();
      this.saveWebsiteData(allDeals);
      this._saveRunLog(allDeals, toPost, posted, failed, startTime);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log('\n' + '═'.repeat(60));
      this.logger.log(`✅ DONE in ${duration}s — Posted: ${posted} | Failed: ${failed} | Source mix: ${this._sourceMix(allDeals)}`);
      this.logger.log(`📊 Total in tracking: ${this.postedDeals.size}`);
      this.logger.log('═'.repeat(60));
    }
  }

  _sourceMix(deals) {
    const c = {};
    deals.forEach(d => c[d.source] = (c[d.source] || 0) + 1);
    return Object.entries(c).map(([k, v]) => `${k}=${v}`).join(' ');
  }

  _toTeleFormat(deal) {
    return {
      id: deal.sourceId,
      title: deal.title,
      description: deal.description,
      campaignName: deal.campaignName,
      domain: this._extractDomain(deal.merchantUrl || deal.affiliateLink),
      affiliateLink: deal.affiliateLink,
      merchantUrl: deal.merchantUrl,
      offerImage: deal.imageUrl,
      couponCode: deal.couponCode,
      category: deal.category,
      payout: deal.payout,
      payoutType: deal.payoutType,
      source: deal.source,
    };
  }

  _saveRunLog(all, posted, ok, fail, startTime) {
    try {
      const logPath = path.join(__dirname, 'run_log.json');
      fs.writeFileSync(logPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        totalDeals: all.length,
        postedThisRun: posted.length,
        successful: ok,
        failed: fail,
        sourceMix: this._sourceMix(all),
        deals: posted.map(d => ({
          id: d.sourceId,
          title: d.title,
          source: d.source,
          link: d.affiliateLink,
        })),
      }, null, 2));
    } catch {}
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

(async () => {
  const engine = new AutomationEngine();
  try {
    await engine.run();
    process.exit(0);
  } catch (err) {
    console.error('💥 FATAL ERROR:', err);
    process.exit(1);
  }
})();
