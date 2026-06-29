# 🛍️ Cuelinks Affiliate Automation v2

Fully-automated Cuelinks affiliate marketing system that:
- Fetches deals from Cuelinks /offers API
- Converts **any** product URL (Amazon, Flipkart, Shopsy, etc.) to Cuelinks affiliate links
- Auto-posts top deals to a Telegram channel every 6 hours
- Accepts URL submissions via Telegram bot (`/deal <url>`)
- Auto-monitors your channel for posted URLs and replies with affiliate versions
- Publishes a beautiful deals website via GitHub Pages
- **Zero monthly cost** (GitHub Actions free tier + Pexels free tier)

---

## 🏗️ Architecture

```
┌─────────────────────── INPUTS ────────────────────────┐
│                                                        │
│  ⏰ GitHub Actions cron        ─ apply offers /search │
│  🤖 Telegram Bot /deal /convert                       │
│  👀 Channel Monitor (auto-detect URLs in posts)        │
│  🌐 Web Form (docs/index.html)                        │
│           │                                           │
│           ▼                                           │
│  ┌────────────────────────┐                           │
│  │ Multi-Source Pipeline  │   CuelinksOffersSource    │
│  │   + Deduplication      │   UserSubmittedSource     │
│  │   + Category Filter    │   (more sources future)  │
│  └────────────────────────┘                           │
│           │                                           │
│           ▼                                           │
│  ┌────────────────────────┐                           │
│  │ LinkKit Converter      │   Domain → Campaign      │
│  │  (URL → Affiliate)     │   linksredirect.com/      │
│  └────────────────────────┘   ?pub_id=X&url=Y         │
│           │                                           │
│           ▼                                           │
│  ┌────────────────────────┐                           │
│  │ Telegram Poster        │   Image + Caption         │
│  │  + Auto-tracking       │   saved posted_deals.json │
│  └────────────────────────┘                           │
│           │                                           │
│           ▼                                           │
│  📢 Telegram Channel + 🌐 GitHub Pages                │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 📂 File Structure

```
automation/
├── main.js              # Cron orchestrator (GitHub Actions entry)
├── cuelinks.js          # Cuelinks REST API client
├── linkkit.js           # Universal URL → affiliate converter
├── merchant_map.js      # 30+ Indian merchant detection
├── bot.js               # Telegram bot commands
├── bot_runner.js        # Standalone bot entry point
├── monitor.js           # Channel URL auto-monitor
├── monitor_runner.js    # Standalone monitor entry point
├── telegram.js          # Telegram post formatter
├── images.js            # Optional Pexels image fetcher
├── config.js            # All settings
├── docs/
│   ├── index.html       # Beautiful deals website
│   └── deals.json       # Auto-updated by main.js
├── sources/
│   ├── base.js          # Source abstract class
│   ├── cuelinks-offers.js  # Cuelinks /offers source
│   ├── user-submitted.js   # User URL submissions source
│   └── index.js         # Multi-source orchestrator
├── data/
│   └── submitted_urls.json   # Created automatically (bot submissions)
├── posted_deals.json    # Auto: tracking file (created at runtime)
├── deals.json           # Auto: website data
├── run_log.json         # Auto: run logs
└── .env.example         # Environment template
.github/workflows/
└── automation.yml       # GitHub Actions schedule (every 6h)
```

---

## 🚀 Setup

### Prerequisites
1. Cuelinks account with API key (Dashboard → Resources → API Key)
2. Telegram Bot via @BotFather (already created for this project)
3. Telegram channel where bot is admin
4. GitHub repository (already set up)

### GitHub Secrets (Settings → Secrets and variables → Actions)
| Secret | Value |
|---|---|
| `CUELINKS_API_KEY` | Your Cuelinks API key |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHANNEL` | `@your_channel_username` |
| `GH_PAT` | GitHub Personal Access Token (for committing + Pages deploy) |
| `PEXELS_API_KEY` | (Optional) Pexels API for enhanced images |
| `BOT_ENABLED` | `true` if deploying bot on Render (otherwise omit) |
| `MONITOR_ENABLED` | `true` if deploying monitor on Render (otherwise omit) |

---

## ⏰ Cron Mode (Default — runs in GitHub Actions)

Every 6 hours, the workflow automatically:
1. Fetches Cuelinks campaigns (100 merchants)
2. Fetches up to 300 deals from /offers API
3. Reads pending bot submissions (if any)
4. Dedupes across all sources
5. Picks top N best deals
6. Posts to Telegram channel
7. Updates website data
8. Commits to repo + deploys to GitHub Pages

**Local run:**
```bash
cd automation
node main.js         # Live posting
node main.js --dry-run  # Fetch + process without posting
```

---

## 🤖 Bot Mode (Optional — deploy on Render free tier)

Bot handles ALL these commands in private chat with your bot:

| Command | Example | Description |
|---|---|---|
| `/deal <url>` | `/deal https://amazon.in/dp/X` | Convert URL + queue for posting |
| `/deal <url> \| <title>` | `/deal https://... \| Headphones` | Submit with custom title |
| `/convert <url>` | `/convert https://flipkart.com/p/123` | Just get affiliate link |
| `/search <keyword>` | `/search headphones` | Search Cuelinks offers |
| `/top` | `/top` | Show highest-payout offers |
| `/stats` | `/stats` | Today's posting stats + run history |
| `/help` | `/help` | Command list |

**Deploy on Render (free):**
1. Go to [render.com](https://render.com) → Sign up
2. New → Web Service → Connect GitHub repo
3. **Settings:**
   - Build command: `cd automation && npm install`
   - Start command: `cd automation && node bot_runner.js`
   - Instance type: Free
4. Add env vars in Render dashboard:
   - `CUELINKS_API_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHANNEL`
   - `BOT_ENABLED=true`
5. Deploy → Bot starts listening 24/7

---

## 👀 Channel Monitor (Optional — deploy on Render)

When ANY message contains a URL in your channel, bot auto-replies with:
- Original URL preserved as attribution
- Affiliate link added as a reply message
- (mode='reply' default; modes 'silent' and 'edit' available)

**Deploy on Render:**
- Build command: `cd automation && npm install`
- Start command: `cd automation && node monitor_runner.js`
- Env vars: Same as bot + `MONITOR_ENABLED=true`

---

## 🌐 GitHub Pages Website

Auto-deployed every cron run:
- Source: [`automation/docs/index.html`](./automation/docs/index.html)
- Updates: `deals.json` regenerated with latest 50 deals
- Beautiful responsive UI with category filters
- Live at: `https://<username>.github.io/<repo>/`

---

## 🔄 End-to-End Manual Test

```bash
# Test LinkKit conversion
node -e "
const LinkKit = require('./automation/linkkit');
const lk = new LinkKit([], { logger: console });
lk.convert('https://www.amazon.in/dp/B09QL2WWC4').then(r => {
  console.log(JSON.stringify(r, null, 2));
});
"

# Test full pipeline (dry-run)
node automation/main.js --dry-run
```

---

## 📊 Daily Manual Effort

After full deployment:
- Telegram glance (30 sec) — see what got posted
- Optional: `/stats` on bot (5 sec)

**Total: 0-1 minute/day = 0.5% of full automation cycle** 🚀

---

## 🐛 Troubleshooting

### Bot not responding to commands
- Confirm `BOT_ENABLED=true` in Render env
- Check Render logs for poll errors
- Test `/getMe` API directly with your bot token

### Monitor not auto-converting
- Confirm `MONITOR_ENABLED=true`
- Confirm bot is ADMIN in the channel (with "Post messages" permission)
- Check that the channel username matches `TELEGRAM_MONITOR_CHANNEL`

### Cron run fails on GitHub Actions
- Verify secrets are correctly set (Settings → Secrets)
- Check `GH_PAT` has `repo` + `workflow` scopes (for Pages deploy)
- Look at the run log in Actions tab

### Affiliate links not tracking conversions
- Confirm campaign has matching retailer (search URL via /campaigns)
- Verify the affiliate URL contains your `pub_id` (look at `posted_deals.json`)

---

## 📈 Roadmap (Future Enhancements)

- 🌐 **Discord webhook** posting (mirror Telegram to Discord)
- 🐦 **Twitter / X auto-post** via API
- 📊 **Analytics dashboard** (clicks, conversions, payouts)
- 🤖 **AI caption generation** (GPT for varied post styles)
- 🔔 **Coupon expiry alerts** (Telegram notification)
- 📥 **RSS feed scraper source** (additional deals)

---

## ⚖️ Compliance Notes

This system respects:
- Cuelinks disclosure requirements (affiliate links disclosed)
- Telegram Bot Platform Terms (no spam, content moderation)
- Network merchant agreements (proper attribution)

---

## 📜 License

Free to use, modify, redistribute. No warranty.
