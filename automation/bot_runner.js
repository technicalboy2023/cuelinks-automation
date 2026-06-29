/**
 * 🚀 Bot Runner — Standalone entry point for the Telegram Bot
 *
 * Run: node automation/bot_runner.js
 *
 * Deploy on:
 *   - Render free web service (recommended)
 *   - Railway.app
 *   - Any VPS with Node.js
 *
 * For GitHub Actions cron-only mode, run main.js instead.
 */

const CuelinksAPI = require('./cuelinks');
const LinkKit = require('./linkkit');
const CuelinksBot = require('./bot');
const UserSubmittedSource = require('./sources/user-submitted');
const config = require('./config');

async function main() {
  console.log('═'.repeat(50));
  console.log('🤖 Starting Cuelinks Affiliate Bot');
  console.log(`📢 Channel: ${config.telegram.channelId}`);
  console.log(`🌐 Website: GitHub Pages`);
  console.log('═'.repeat(50));

  // Initialize API clients
  const api = new CuelinksAPI();
  const linkkit = new LinkKit([], { logger: console });

  // Fetch campaigns once and seed LinkKit
  try {
    const campaigns = await api.getCampaigns();
    if (campaigns.length) {
      linkkit.setCampaigns(campaigns);
      console.log(`✅ Loaded ${campaigns.length} campaigns into LinkKit`);
    }
  } catch (err) {
    console.error(`⚠️ Could not load campaigns at startup: ${err.message}`);
    console.error('   Bot will still start, will retry campaigns during /convert calls');
  }

  // Initialize UserSubmittedSource for /deal command
  const submittedSource = new UserSubmittedSource({ logger: console });
  submittedSource.setLinkKit([], linkkit);

  // Start bot
  const bot = new CuelinksBot({
    api,
    linkkit,
    submittedSource,
    telegram: {
      botToken: config.telegram.botToken,
      channelId: config.telegram.channelId,
    },
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n⏹️ Received ${signal}, stopping bot...`);
    bot.stop();
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start();
}

main().catch(err => {
  console.error('💥 Fatal bot error:', err);
  process.exit(1);
});
