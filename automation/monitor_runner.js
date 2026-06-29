/**
 * 👀 Monitor Runner — Standalone entry point for Channel Auto-Monitor
 *
 * Run: node automation/monitor_runner.js
 *
 * Deploy alongside bot_runner.js on Render / Railway / VPS.
 *
 * Behavior: 
 *   - Watches TELEGRAM_MONITOR_CHANNEL for new messages
 *   - When a message contains a URL, replies with the affiliate version
 *   - Mode set in config.monitor.mode ('reply' | 'silent')
 */

const CuelinksAPI = require('./cuelinks');
const LinkKit = require('./linkkit');
const ChannelMonitor = require('./monitor');
const config = require('./config');

async function main() {
  if (!config.monitor.enabled) {
    console.error('❌ Monitor is DISABLED in config (config.monitor.enabled = false)');
    console.error('   Set MONITOR_ENABLED=true in env to enable');
    process.exit(1);
  }
  console.log('═'.repeat(50));
  console.log('👀 Starting Cuelinks Channel Monitor');
  console.log(`📢 Channel: ${config.telegram.monitorChannelId}`);
  console.log(`⚙️  Mode: ${config.monitor.mode}`);
  console.log('═'.repeat(50));

  const api = new CuelinksAPI();
  const linkkit = new LinkKit([], { logger: console });

  // Seed campaigns at startup
  try {
    const campaigns = await api.getCampaigns();
    if (campaigns.length) {
      linkkit.setCampaigns(campaigns);
      console.log(`✅ Loaded ${campaigns.length} campaigns into LinkKit`);
    }
  } catch (err) {
    console.error(`⚠️ Could not load campaigns: ${err.message}`);
  }

  const monitor = new ChannelMonitor({
    api,
    linkkit,
    telegram: {
      botToken: config.telegram.botToken,
      monitorChannelId: config.telegram.monitorChannelId,
      channelId: config.telegram.channelId,
    },
    mode: config.monitor.mode,
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n⏹️ Received ${signal}, stopping monitor...`);
    monitor.stop();
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await monitor.start();
}

main().catch(err => {
  console.error('💥 Fatal monitor error:', err);
  process.exit(1);
});
