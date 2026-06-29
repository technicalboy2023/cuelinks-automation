/**
 * Telegram Bot Poster
 * Handles all Telegram operations - posting, formatting, scheduling.
 */
const axios = require('axios');
const config = require('./config');

class TelegramPoster {
  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${config.telegram.botToken}`;
    this.channelId = config.telegram.channelId;
  }

  /**
   * Send a text message to the channel.
   */
  async sendMessage(text, options = {}) {
    try {
      const { data } = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: this.channelId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        ...options,
      }, { timeout: 15000 });

      if (data.ok) {
        console.log(`✅ Message sent (ID: ${data.result.message_id})`);
        return data.result;
      } else {
        console.error('❌ Telegram sendMessage failed:', data.description);
        return null;
      }
    } catch (err) {
      console.error('❌ Telegram API error:', err.message);
      return null;
    }
  }

  /**
   * Send a photo with caption to the channel.
   */
  async sendPhoto(photoUrl, caption, options = {}) {
    try {
      const { data } = await axios.post(`${this.baseUrl}/sendPhoto`, {
        chat_id: this.channelId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML',
        ...options,
      }, { timeout: 15000 });

      if (data.ok) {
        console.log(`✅ Photo sent (ID: ${data.result.message_id})`);
        return data.result;
      } else {
        // Fallback to text-only if photo fails
        console.error('❌ Photo send failed:', data.description);
        return await this.sendMessage(caption, options);
      }
    } catch (err) {
      console.error('❌ Photo API error:', err.message);
      return await this.sendMessage(caption, options);
    }
  }

  /**
   * Format a deal into an attractive Telegram post caption.
   */
  formatDealCaption(deal) {
    const emoji = this.getCategoryEmoji(deal.category);
    const payoutBadge = this.formatPayout(deal.payout, deal.payoutType);

    return [
      `${emoji} <b>${this.escapeHtml(deal.title)}</b>`,
      '',
      `🏪 <b>Store:</b> ${this.escapeHtml(deal.campaignName)}`,
      `💰 <b>Commission:</b> ${payoutBadge}`,
      '',
      `🔥 <a href="${deal.affiliateLink}">🛍️ Shop Now & Save!</a>`,
      '',
      `📌 <i>Grab this deal before it ends!</i>`,
      '',
      `#${deal.category} #${this.escapeHashtag(deal.campaignName)} #Deals #Shopping #SaveMoney #OnlineShopping`,
    ].join('\n');
  }

  /**
   * Format a text-only post (no image) - richer formatting.
   */
  formatTextOnlyDeal(deal) {
    const emoji = this.getCategoryEmoji(deal.category);
    const payoutBadge = this.formatPayout(deal.payout, deal.payoutType);

    return [
      `${emoji} ${emoji} <b>HOT DEAL ALERT!</b> ${emoji} ${emoji}`,
      '',
      `🛍️ <b>${this.escapeHtml(deal.title)}</b>`,
      '',
      `━━━━━━━━━━━━━━━`,
      '',
      `🏪 <b>Store:</b> ${this.escapeHtml(deal.campaignName)}`,
      `🌐 <b>Site:</b> <code>${this.escapeHtml(deal.domain)}</code>`,
      `💰 <b>Earn:</b> <b>${payoutBadge}</b> commission`,
      '',
      `━━━━━━━━━━━━━━━`,
      '',
      `🔥 <a href="${deal.affiliateLink}">👉 CLICK HERE TO SHOP 👈</a>`,
      '',
      `━━━━━━━━━━━━━━━`,
      '',
      `💡 <i>Tip: Share this deal with friends & earn!</i>`,
      `📢 Join: ${config.telegram.channelLink}`,
      '',
      `#${this.escapeHashtag(deal.category)} #${this.escapeHashtag(deal.campaignName)} #Deals #ShoppingDeals #SaveBig #OnlineShopping #Offers #Cuelinks`,
    ].join('\n');
  }

  /**
   * Post a deal to Telegram (with or without image).
   */
  async postDeal(deal, imageUrl = null) {
    if (imageUrl) {
      const caption = this.formatDealCaption(deal);
      return await this.sendPhoto(imageUrl, caption);
    } else {
      const text = this.formatTextOnlyDeal(deal);
      return await this.sendMessage(text);
    }
  }

  /**
   * Get emoji for category.
   */
  getCategoryEmoji(category) {
    const map = {
      fashion: '👗',
      electronics: '📱',
      travel: '✈️',
      food: '🍕',
      grocery: '🛒',
      beauty: '💄',
    };
    return map[category] || '🛍️';
  }

  /**
   * Format payout nicely.
   */
  formatPayout(payout, type) {
    if (!payout) return 'Varies';
    if (type?.includes('%')) return `${payout}%`;
    if (type?.includes('Fixed')) return `₹${payout}`;
    return `${payout}`;
  }

  /**
   * Escape HTML special chars for Telegram.
   */
  escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Convert campaign name to hashtag-safe format.
   */
  escapeHashtag(text) {
    if (!text) return '';
    // Remove non-alphanumeric chars, spaces, special chars for clean hashtags
    return text.replace(/[^a-zA-Z0-9]/g, '');
  }
}

module.exports = TelegramPoster;
