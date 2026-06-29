/**
 * 🚀 Cuelinks Affiliate Automation - Main Orchestrator
 *
 * Flow:
 * 1. Fetch campaigns & offers from Cuelinks API
 * 2. Process offers into deals with affiliate links
 * 3. Fetch relevant images via Pexels
 * 4. Format rich posts & send to Telegram channel
 * 5. Track posted deals to avoid duplicates
 * 6. Save JSON for website integration
 *
 * Run: node main.js
 * Schedule: GitHub Actions cron
 */

const fs = require('fs');
const path = require('path');
const CuelinksAPI = require('./cuelinks');
const TelegramPoster = require('./telegram');
const ImageFetcher = require('./images');
const config = require('./config');

class AutomationEngine {
  constructor() {
    this.cuelinks = new CuelinksAPI();
    this.telegram = new TelegramPoster();
    this.images = new ImageFetcher();
    this.trackingPath = path.join(__dirname, config.trackingFile);
    this.postedDeals = this.loadPostedDeals();
  }

  /**
   * Load previously posted deal IDs to avoid duplicates.
   */
  loadPostedDeals() {
    try {
      if (fs.existsSync(this.trackingPath)) {
        const data = JSON.parse(fs.readFileSync(this.trackingPath, 'utf8'));
        return new Set(data.postedIds || []);
      }
    } catch (err) {
      console.error('⚠️ Failed to load tracking file:', err.message);
    }
    return new Set();
  }

  /**
   * Save posted deal IDs.
   */
  savePostedDeals() {
    try {
      const data = {
        lastRun: new Date().toISOString(),
        postedIds: [...this.postedDeals],
        totalPosted: this.postedDeals.size,
      };
      fs.writeFileSync(this.trackingPath, JSON.stringify(data, null, 2));
      console.log(`💾 Tracking: ${this.postedDeals.size} total deals posted`);
    } catch (err) {
      console.error('❌ Failed to save tracking:', err.message);
    }
  }

  /**
   * Save deals to JSON file for website + docs/ for GitHub Pages.
   */
  saveWebsiteData(deals) {
    try {
      const websitePath = path.join(__dirname, config.websiteOutputFile);
      const docsPath = path.join(__dirname, 'docs', config.websiteOutputFile);
      const docsDir = path.dirname(docsPath);

      // Keep last 50 deals for performance
      const topDeals = deals.slice(0, 50);
      const data = {
        updated: new Date().toISOString(),
        channel: config.telegram.channelLink,
        totalDeals: deals.length,
        deals: topDeals,
      };

      // Save to automation/ for the website
      fs.writeFileSync(websitePath, JSON.stringify(data, null, 2));

      // Copy to docs/ for GitHub Pages (create dir if needed)
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
        console.log(`📁 Created docs/ directory for GitHub Pages`);
      }
      fs.writeFileSync(docsPath, JSON.stringify(data, null, 2));

      console.log(`🌐 Website data saved: ${topDeals.length} deals`);
    } catch (err) {
      console.error('❌ Failed to save website data:', err.message);
    }
  }

  /**
   * Check if a deal has already been posted.
   */
  isDuplicate(deal) {
    return this.postedDeals.has(deal.id);
  }

  /**
   * Mark a deal as posted.
   */
  markPosted(deal) {
    this.postedDeals.add(deal.id);
  }

  /**
   * MAIN EXECUTION FLOW
   */
  async run() {
    const startTime = Date.now();
    console.log('═'.repeat(60));
    console.log('🤖 CUELINKS AFFILIATE AUTOMATION');
    console.log(`⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    console.log('═'.repeat(60));
    console.log('');

    // Step 1: Fetch campaigns & offers from Cuelinks
    console.log('📡 [1/5] Fetching from Cuelinks API...');
    const [campaigns, offers] = await Promise.all([
      this.cuelinks.getCampaigns(),
      this.cuelinks.getOffers(),
    ]);

    if (!campaigns.length) {
      console.error('❌ No campaigns found — aborting');
      return;
    }

    // Step 2: Process offers into affiliate deals
    console.log(`\n🔗 [2/5] Processing ${offers.length} offers into deals...`);
    let deals = this.cuelinks.processOffers(offers, campaigns);

    // Filter duplicates
    const newDeals = deals.filter(d => !this.isDuplicate(d));
    console.log(`   ${newDeals.length} new deals (${deals.length - newDeals.length} duplicates skipped)`);

    if (!newDeals.length) {
      console.log('📭 No new deals to post. All caught up!');
      return;
    }

    // Step 3: Apply filters & limit
    let toPost = newDeals;

    // Filter by focus categories (if configured)
    if (config.automation.focusCategories.length > 0) {
      toPost = toPost.filter(d =>
        config.automation.focusCategories.includes(d.category)
      );
      console.log(`   ${toPost.length} deals after category filter: [${config.automation.focusCategories}]`);
    }

    // Filter by min payout (skip deals without payout data rather than dropping them)
    if (config.automation.minPayoutPercent > 0) {
      toPost = toPost.filter(d => {
        const payout = parseFloat(d.payout);
        if (isNaN(payout) || !payout) return true; // Keep deals without payout data
        return payout >= config.automation.minPayoutPercent;
      });
      console.log(`   ${toPost.length} deals after payout filter (>=${config.automation.minPayoutPercent}%)`);
    }

    // Limit posts per run
    toPost = toPost.slice(0, config.automation.maxPostsPerRun);
    console.log(`📊 [3/5] Posting ${toPost.length} deals this run...\n`);

    // Step 4: Post deals to Telegram
    console.log(`📢 [4/5] Posting to Telegram...\n`);
    let posted = 0;
    let failed = 0;

    for (let i = 0; i < toPost.length; i++) {
      const deal = toPost[i];
      console.log(`   📝 [${i + 1}/${toPost.length}] ${deal.title.substring(0, 60)}...`);

      try {
        // Try to get image
        let imageUrl = null;
        if (config.pexels.apiKey) {
          const image = await this.images.getDealImage(deal);
          if (image) {
            imageUrl = image.url;
            console.log(`   🖼️  Image: ${image.photographer || 'Pexels'}`);
          }
        }

        // Post to Telegram
        const result = await this.telegram.postDeal(deal, imageUrl);
        if (result) {
          this.markPosted(deal);
          posted++;
          console.log(`   ✅ Posted successfully!\n`);
        } else {
          failed++;
          console.log(`   ❌ Failed to post\n`);
        }

        // Delay between posts to avoid rate limits
        if (i < toPost.length - 1) {
          await this.sleep(config.automation.postDelay);
        }
      } catch (err) {
        failed++;
        console.error(`   ❌ Error posting: ${err.message}\n`);
      }
    }

    // Step 5: Save tracking & website data
    console.log('💾 [5/5] Saving data...');
    this.savePostedDeals();
    this.saveWebsiteData(deals);
    this.saveLog(deals, toPost, posted, failed, startTime);

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('');
    console.log('═'.repeat(60));
    console.log(`✅ DONE in ${duration}s — Posted: ${posted} | Failed: ${failed} | Skipped: ${newDeals.length - toPost.length}`);
    console.log(`📊 Total deals in tracking: ${this.postedDeals.size}`);
    console.log('═'.repeat(60));
  }

  /**
   * Save a run log for debugging.
   */
  saveLog(allDeals, posted, success, failed, startTime) {
    try {
      const logPath = path.join(__dirname, 'run_log.json');
      const log = {
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        totalDeals: allDeals.length,
        postedThisRun: posted.length,
        success,
        failed,
        deals: posted.map(d => ({
          id: d.id,
          title: d.title,
          campaign: d.campaignName,
          link: d.affiliateLink,
        })),
      };
      fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    } catch (err) {
      // Non-critical - don't fail the run
    }
  }

  /**
   * Delay helper.
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run
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
