/**
 * 👀 Channel Auto-Monitor
 *
 * Long-polling watcher that detects URLs posted in your Telegram channel
 * and auto-converts them to affiliate links.
 *
 * Modes:
 *   - 'reply'    : Bot replies with affiliate link, original message stays
 *   - 'edit'     : Bot edits original message replacing URLs (not always allowed)
 *   - 'silent'   : Convert + log only, no Telegram action
 *
 * Usage (standalone):
 *   node monitor.js
 *
 * The original message POST is preserved as attribution.
 * ONLY converts URLs from registered merchants; ignores everything else.
 */

const axios = require('axios');
const LinkKit = require('./linkkit');
const config = require('./config');

class ChannelMonitor {
  constructor({ linkkit, api, telegram, mode = 'reply' }) {
    this.linkkit = linkkit || new LinkKit([], { logger: console });
    this.api = api;
    this.telegram = telegram;
    this.mode = mode;                    // 'reply' | 'edit' | 'silent'
    this.baseUrl = `https://api.telegram.org/bot${this.telegram.botToken}`;
    this.monitorChatId = this.telegram.monitorChannelId || this.telegram.channelId;
    this.running = false;
    this.offset = 0;
    this.conversions = 0;
  }

  async start() {
    this.running = true;
    console.log(`👀 Channel monitor started — watching ${this.monitorChatId} (mode: ${this.mode})`);
    while (this.running) {
      try {
        const updates = await this._poll();
        for (const u of updates) {
          this.offset = Math.max(this.offset, u.update_id + 1);
          if (u.message) await this._handleMessage(u.message);
        }
      } catch (err) {
        console.error(`❌ Monitor poll error: ${err.message}`);
        await this._sleep(3000);
      }
    }
  }

  stop() { this.running = false; }

  async _poll() {
    const r = await axios.get(`${this.baseUrl}/getUpdates`, {
      params: { offset: this.offset, timeout: 30, allowed_updates: ['channel_post', 'message'] },
      timeout: 35000,
    });
    return r.data?.result || [];
  }

  async _handleMessage(msg) {
    // Only monitor our configured channel.
    // Telegram sends channel messages with msg.chat.id (negative int) AND msg.chat.username (string).
    // We support BOTH forms here: numeric ID OR @username.
    if (!msg.chat) return;
    const chatId = String(msg.chat.id || '');
    const chatUsername = String(msg.chat.username || '');
    const monitorRaw = String(this.monitorChatId || '');
    const isUsernameConfig = monitorRaw.startsWith('@');
    const monitorUsername = isUsernameConfig ? monitorRaw.slice(1).toLowerCase() : monitorRaw.toLowerCase();
    const monitorId = isUsernameConfig ? '' : monitorRaw;
    const matches =
      (monitorId && chatId === monitorId) ||
      (monitorUsername && (chatUsername.toLowerCase() === monitorUsername));
    if (!matches) return;

    const text = msg.text || msg.caption || '';
    const urls = this._extractUrls(text);
    if (!urls.length) return;
    console.log(`👀 Found ${urls.length} URL(s) in channel message ${msg.message_id}`);

    // Refresh campaigns from Cuelinks (so we use latest)
    if (this.api && typeof this.api.getCampaigns === 'function') {
      try {
        const campaigns = await this.api.getCampaigns();
        if (campaigns.length) this.linkkit.setCampaigns(campaigns);
      } catch { /* ok */ }
    }

    for (const url of urls) {
      const result = await this.linkkit.convert(url);
      if (!result.success) continue;
      this.conversions++;
      const merchant = result.merchant?.name || 'Deal';
      const reply = [
        `🔗 <b>Affiliate link (${this._esc(merchant)}):</b>`,
        `<code>${result.affiliateUrl}</code>`,
        '',
        `<i>Original URL: ${url}</i>`,
      ].join('\n');
      if (this.mode === 'reply') {
        await this._reply(msg.chat.id, reply, { reply_to_message_id: msg.message_id });
      } else if (this.mode === 'silent') {
        console.log(`🔇 Silent convert ${url} → ${result.affiliateUrl.substring(0, 80)}...`);
      }
    }
  }

  _extractUrls(text) {
    if (!text) return [];
    const matches = text.match(/https?:\/\/\S+/g) || [];
    // Strip trailing punctuation
    return matches.map(u => u.replace(/[),.!?\]}>'"]+$/, ''));
  }

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

  _esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = ChannelMonitor;
