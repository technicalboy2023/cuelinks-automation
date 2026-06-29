/**
 * 🤖 Cuelinks Telegram Bot
 *
 * Long-polling bot that handles user commands:
 *   /deal <url>      — Submit URL, convert to affiliate, post to channel
 *   /convert <url>   — Convert URL to affiliate (no posting)
 *   /stats           — Show channel stats (posts today, top merchants)
 *   /search <query>  — Search Cuelinks /offers by keyword
 *   /top             — Show best (highest payout) recent offers
 *   /help            — Command list
 *
 * Runs as a long-lived process (deploy on Render/Railway free tier).
 */

const axios = require('axios');
const LinkKit = require('./linkkit');
const UserSubmittedSource = require('./sources/user-submitted');
const config = require('./config');

class CuelinksBot {
  constructor({ api, linkkit, submittedSource, telegram }) {
    this.api = api;                                  // CuelinksAPI instance (or null)
    this.linkkit = linkkit || new LinkKit([], { logger: console });
    this.submitted = submittedSource || new UserSubmittedSource({ logger: console });
    this.telegram = telegram;                        // { botToken, channelId }
    this.baseUrl = `https://api.telegram.org/bot${this.telegram.botToken}`;
    this.running = false;
    this.offset = 0;
    this.stats = { commandsRun: 0, lastCommandAt: null };
  }

  /**
   * Start the long-polling loop. Returns when stop() is called.
   */
  async start() {
    this.running = true;
    console.log('🤖 Bot started — listening for commands...');
    while (this.running) {
      try {
        const updates = await this._getUpdates();
        for (const update of updates) {
          this.offset = Math.max(this.offset, update.update_id + 1);
          await this._handleUpdate(update);
        }
      } catch (err) {
        console.error(`❌ Bot poll error: ${err.message}`);
        await this._sleep(3000);
      }
    }
    console.log('🤖 Bot stopped.');
  }

  stop() {
    this.running = false;
  }

  /**
   * Telegram long poll.
   */
  async _getUpdates() {
    const resp = await axios.get(`${this.baseUrl}/getUpdates`, {
      params: { offset: this.offset, timeout: 30, allowed_updates: ['message'] },
      timeout: 35000,
    });
    return resp.data?.result || [];
  }

  async _handleUpdate(update) {
    const msg = update.message;
    if (!msg || !msg.text) return;
    // Allow commands from ANY chat, but skip channel posts (monitor handles those)
    if (msg.chat?.type === 'channel') return;

    const text = msg.text.trim();
    const chatId = msg.chat.id;
    const username = msg.from?.username || msg.from?.first_name || 'user';

    // Parse command (with optional @botname suffix)
    const match = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)$/s);
    if (!match) {
      // Not a command — offer to convert any URL found in chat
      const url = this._extractFirstUrl(text);
      if (url) {
        await this._reply(chatId,
          `👋 I see a URL in your message. Use /convert ${url} to get the affiliate link, or /deal ${url} to submit it as a post.\n\nType /help for all commands.`);
      }
      return;
    }
    const [, cmd, args] = match;
    this.stats.commandsRun++;
    this.stats.lastCommandAt = new Date().toISOString();
    console.log(`🤖 ${username} → /${cmd} ${args?.substring(0, 80)}`);

    try {
      switch (cmd.toLowerCase()) {
        case 'start':
        case 'help':       await this._cmdHelp(chatId); break;
        case 'deal':       await this._cmdDeal(chatId, args.trim(), username); break;
        case 'convert':    await this._cmdConvert(chatId, args.trim()); break;
        case 'stats':      await this._cmdStats(chatId); break;
        case 'search':     await this._cmdSearch(chatId, args.trim()); break;
        case 'top':        await this._cmdTop(chatId); break;
        default:
          await this._reply(chatId, `❌ Unknown command: /${cmd}\nType /help for command list.`);
      }
    } catch (err) {
      console.error(`❌ Bot handler error: ${err.message}`);
      await this._reply(chatId, `⚠️ Error: ${err.message}`);
    }
  }

  // ─── Commands ───────────────────────────────────────────────────

  async _cmdHelp(chatId) {
    const text = [
      '🤖 <b>Cuelinks Affiliate Bot</b>',
      '',
      '<b>Available commands:</b>',
      '  /deal &lt;url&gt;     — Convert + post as channel message',
      '  /convert &lt;url&gt;  — Convert URL → affiliate link (no post)',
      '  /search &lt;query&gt; — Search Cuelinks offers by keyword',
      '  /top               — Best (highest payout) recent offers',
      '  /stats             — Today\'s posting stats',
      '  /help              — Show this message',
      '',
      '💡 <b>Tip:</b> Just paste any Amazon/Flipkart URL in chat — I\'ll auto-suggest commands!',
      '',
      `📢 Channel: ${config.telegram.channelLink}`,
    ].join('\n');
    await this._reply(chatId, text);
  }

  async _cmdConvert(chatId, url) {
    if (!url) {
      return this._reply(chatId, '❌ Usage: /convert <product-url>');
    }
    // Update campaigns if we have the API
    if (this.api && typeof this.api.getCampaigns === 'function') {
      try {
        const campaigns = await this.api.getCampaigns();
        if (campaigns.length) this.linkkit.setCampaigns(campaigns);
      } catch (e) { /* proceed with cached campaigns */ }
    }
    const result = await this.linkkit.convert(url);
    if (!result.success) {
      return this._reply(chatId, `⚠️ Could not convert.\n\n<b>Reason:</b> ${result.error}\n\nMake sure the URL is from a Cuelinks-registered retailer (Amazon, Flipkart, Myntra, etc).`);
    }
    const m = result.merchant || {};
    const lines = [
      '✅ <b>Converted!</b>',
      '',
      `🏪 <b>Merchant:</b> ${this._esc(m.name || 'Unknown')}`,
      `🌐 <b>Domain:</b> <code>${this._esc(m.domain || '')}</code>`,
      `📦 <b>Category:</b> ${m.category || 'general'}`,
      '',
      `🔗 <b>Affiliate link:</b>\n<code>${result.affiliateUrl}</code>`,
      '',
      result.campaign
        ? `📊 <b>Campaign:</b> ${this._esc(result.campaign.name)} (payout: ${result.campaign.payout || 'varies'})`
        : `⚠️ No matching campaign data — link still works.`,
      '',
      `💡 Use /deal ${url} to also post this to the channel.`,
    ];
    await this._reply(chatId, lines.join('\n'));
  }

  async _cmdDeal(chatId, url, submitter) {
    if (!url) {
      return this._reply(chatId, '❌ Usage: /deal <product-url>\n\nOptional: /deal <url> | <title>');
    }
    // Allow "url | title" format
    const [u, ...titleParts] = url.split('|').map(s => s.trim());
    const customTitle = titleParts.join(' | ').trim();

    if (this.api && typeof this.api.getCampaigns === 'function') {
      try {
        const campaigns = await this.api.getCampaigns();
        if (campaigns.length) this.linkkit.setCampaigns(campaigns);
      } catch (e) { /* cached is fine */ }
    }
    const result = await this.linkkit.convert(u);
    if (!result.success) {
      return this._reply(chatId, `⚠️ Could not convert: ${result.error}`);
    }
    const submission = this.submitted.add({
      url: u,
      title: customTitle || null,
      submittedBy: submitter,
      source: 'bot',
    });
    await this._reply(chatId, [
      '✅ <b>Submitted!</b>',
      '',
      `🏪 ${this._esc(result.merchant?.name || 'Deal')}`,
      `🔗 <code>${result.affiliateUrl}</code>`,
      '',
      `📅 Will be posted at the next automation cycle (within ~6h, or use /postnow to request immediate post).`,
      `🆔 Submission ID: <code>${submission.id}</code>`,
    ].join('\n'));
  }

  async _cmdStats(chatId) {
    const postedFile = require('path').join(__dirname, 'posted_deals.json');
    let totalPosted = 0;
    let lastRun = '-';
    try {
      const data = JSON.parse(require('fs').readFileSync(postedFile, 'utf8'));
      totalPosted = data.totalPosted || 0;
      lastRun = data.lastRun || '-';
    } catch {}
    const lines = [
      '📊 <b>Cuelinks Automation Stats</b>',
      '',
      `📝 Total deals posted: <b>${totalPosted}</b>`,
      `⏰ Last run: <i>${lastRun}</i>`,
      `🤖 Bot commands run: <b>${this.stats.commandsRun}</b>`,
      '',
      `📢 Channel: ${config.telegram.channelLink}`,
      `🌐 Website: https://technicalboy2023.github.io/cuelinks-automation/`,
    ];
    await this._reply(chatId, lines.join('\n'));
  }

  async _cmdSearch(chatId, query) {
    if (!this.api || typeof this.api.getOffers !== 'function') {
      return this._reply(chatId, '⚠️ Search is unavailable (no API access).');
    }
    if (!query?.trim()) {
      return this._reply(chatId, '❌ Usage: /search <keyword>\n\nExample: /search headphones');
    }
    const offers = await this.api.getOffers();
    const q = query.toLowerCase();
    const matches = offers.filter(o => {
      const t = `${o.title || ''} ${o.campaign || ''} ${(o.categories || []).join(' ')}`.toLowerCase();
      return t.includes(q);
    }).slice(0, 5);
    if (!matches.length) {
      return this._reply(chatId, `🔍 No offers found for "${query}".`);
    }
    const lines = [`🔍 <b>Top ${matches.length} results for "${this._esc(query)}"</b>`, ''];
    matches.forEach((o, i) => {
      const payout = (o.payout || '').toString().replace(/[^0-9.]/g, '');
      const payoutBadge = payout ? `💰 ${payout}%` : '';
      lines.push(`<b>${i + 1}. ${this._esc(o.title)}</b>`);
      lines.push(`🏪 ${this._esc(o.campaign || '')} ${payoutBadge}`);
      lines.push(`🔗 <a href="${o.affiliate_url}">View Deal</a>`);
      lines.push('');
    });
    await this._reply(chatId, lines.join('\n'));
  }

  async _cmdTop(chatId) {
    if (!this.api || typeof this.api.getOffers !== 'function') {
      return this._reply(chatId, '⚠️ /top unavailable (no API access).');
    }
    const offers = await this.api.getOffers();
    const top = [...offers]
      .map(o => ({ ...o, _payout: parseFloat((o.payout || '').toString().replace(/[^0-9.]/g, '')) || 0 }))
      .sort((a, b) => b._payout - a._payout)
      .slice(0, 5);
    const lines = ['🏆 <b>Top 5 highest-payout offers</b>', ''];
    top.forEach((o, i) => {
      lines.push(`<b>${i + 1}. ${this._esc(o.title)}</b>`);
      lines.push(`🏪 ${this._esc(o.campaign)} | 💰 ${o._payout}%`);
      lines.push(`🔗 <a href="${o.affiliate_url}">View Deal</a>`);
      lines.push('');
    });
    await this._reply(chatId, lines.join('\n'));
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  async _reply(chatId, text, options = {}) {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options,
      }, { timeout: 15000 });
    } catch (err) {
      console.error(`❌ Reply failed: ${err.message}`);
    }
  }

  _extractFirstUrl(text) {
    if (!text) return null;
    const m = text.match(/https?:\/\/\S+/i);
    return m ? m[0].replace(/[)\]]+$/, '') : null;
  }

  _esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = CuelinksBot;
