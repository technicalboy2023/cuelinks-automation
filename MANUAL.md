# 📖 Cuelinks Affiliate Automation — Complete Manual Setup Guide

> **One-time setup karo, phir bhool jao — system 100% auto chalta hai!**

---

## 🎯 Project Overview

This is a fully-automated Cuelinks affiliate marketing system that:

- ✅ Fetches 300+ deals from Cuelinks every 6 hours
- ✅ Picks TOP 5 quality-scored deals (smart scoring: payout + coupon + image + freshness)
- ✅ Auto-posts to your Telegram channel
- ✅ Auto-updates your website (GitHub Pages)
- ✅ Optional: Cuelinks Autopost (their official bot) for additional curated deals
- ✅ **₹0/month forever** (free tiers only)

**Daily manual effort: 0 minutes** ☕

---

## 🔑 Quick Reference: All API Keys & Tokens

| # | Key/Token Name | Where to Get | Where to Fill | Required? | Free? |
|---|----------------|--------------|---------------|-----------|------|
| 1 | `CUELINKS_API_KEY` | Cuelinks dashboard → API Key | GitHub Secret + Render env + config.js | ✅ YES | ✅ |
| 2 | `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram | GitHub Secret + Render env + config.js | ✅ YES | ✅ |
| 3 | `TELEGRAM_CHANNEL` | @channelusername (your channel) | GitHub Secret + Render env + config.js | ✅ YES | ✅ |
| 4 | `GH_PAT` | github.com/settings/tokens | GitHub Secret (for Pages deploy) | ✅ YES | ✅ |
| 5 | `PEXELS_API_KEY` | pexels.com/api | GitHub Secret + Render env | 🟡 Optional | ✅ |
| 6 | `BOT_ENABLED` | — | Render env only | 🟡 Optional | — |
| 7 | `MONITOR_ENABLED` | — | Render env only | 🟡 Optional | — |
| 8 | Bitly Token | bitly.com/settings/api | Future | ⚪ Skip | Free tier limited |

---

## 📝 Step 1: GitHub Setup (10 min)

### 1.1 Create GitHub Account (if not already)
- Go to [github.com](https://github.com) → Sign up
- Verify email

### 1.2 Fork/Clone the Repository
- Repository: `technicalboy2023/cuelinks-automation`
- Either fork it (your own copy) or use directly

### 1.3 Add GitHub Secrets

Go to: **Repo → Settings → Secrets and variables → Actions → New repository secret**

#### Secret 1: `CUELINKS_API_KEY`
```
Name:  CUELINKS_API_KEY
Value: [your Cuelinks API key - see Step 2]
```

#### Secret 2: `TELEGRAM_BOT_TOKEN`
```
Name:  TELEGRAM_BOT_TOKEN
Value: [your bot token - see Step 3]
```

#### Secret 3: `TELEGRAM_CHANNEL`
```
Name:  TELEGRAM_CHANNEL
Value: @shoppingdealsofferscuelinks  (your @channel_username)
```

#### Secret 4: `GH_PAT` (Personal Access Token)
```
Name:  GH_PAT
Value: [your PAT - see 1.4 below]
```

#### Secret 5: `PEXELS_API_KEY` (Optional)
```
Name:  PEXELS_API_KEY
Value: [your Pexels API key - see Step 4]
```

### 1.4 Generate GH Personal Access Token

1. Go to: [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Fill in:
   - **Note:** `Cuelinks Automation`
   - **Expiration:** `No expiration` (or 90 days)
4. Select Scopes:
   - ✅ `repo` (all checkboxes)
   - ✅ `workflow`
5. Click **"Generate token"**
6. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)
7. Save it as `GH_PAT` in GitHub Secrets (above)

---

## 🎯 Step 2: Cuelinks Setup (10 min)

### 2.1 Create Cuelinks Account
- Go to: [cuelinks.com](https://www.cuelinks.com)
- Click **"Sign Up"** → **"Publisher"** (you earn commission)
- Complete registration with email + website
- ⚠️ **Note:** Cuelinks may ask for a website URL — use your GitHub Pages URL: `https://technicalboy2023.github.io/cuelinks-automation/`

### 2.2 Get Your Cuelinks API Key

1. Login to Cuelinks dashboard
2. Go to: **Resources → API Key**
3. Click **"Generate API Key"** (if not already)
4. **Copy the API key** (looks like: `CWovRV40KcoWhp2e72h0Hq3m8qHPNxoauYrlf3rOaKI`)
5. Save it as `CUELINKS_API_KEY` in GitHub Secrets (Step 1.3)

### 2.3 Explore Cuelinks Tools (all FREE)

| Tool | Where to Find | What It Does |
|------|---------------|--------------|
| **Dashboard** | Main page | Earnings, clicks, conversions |
| **Campaigns** | Left menu | 100+ merchant programs |
| **Reports** | Left menu | Analytics |
| **Offers** | Left menu | Current deals (300+ available) |
| **Link Kit** | Resources → Link Kit | Manual URL→Affiliate converter |
| **Global Postback** | Resources → Global Postback | Webhook for sale notifications |
| **Telegram Autoposting** | Resources → Telegram Autoposting | 🤖 Native bot for auto-posting |
| **API Key** | Resources → API Key | Your API key |
| **Bitly Token** | Installation → Bitly Token | URL shortener (optional) |

### 2.4 Setup Telegram Autoposting (Highly Recommended)

This adds 10-15 Cuelinks curated deals per day to your channel (separate from your cron):

#### Step A: Add Bot to Your Channel
1. Open Telegram
2. Go to your channel: `@shoppingdealsofferscuelinks`
3. Channel Info → **Administrators**
4. **Add Administrator**
5. Search: `@cuelinks_bot`
6. Permissions:
   - ✅ **Post Messages** (REQUIRED)
   - ✅ **Edit Messages** (optional but useful)
7. Save

#### Step B: Authenticate with Cuelinks
1. Open Telegram
2. Search: `@cuelinks_bot`
3. Click **Start**
4. Type: `/login`
5. Bot asks for **email** → send your Cuelinks email
6. Bot asks for **password** → send your Cuelinks password
7. Bot confirms: ✅ "Login successful!"

#### Step C: Enable Auto-Posting
1. Still in @cuelinks_bot chat
2. Type: `/enable_autoposting`
3. Bot confirms: ✅ "Auto-posting enabled for @yourchannel"
4. Verify: `/autoposting_status`

#### Step D: Optional Custom Content
1. Go to Cuelinks dashboard → Resources → Telegram Autoposting
2. Find your channel row
3. Click **"Add Content"** or **"Configure"**
4. Paste your custom content (with merchant URLs)
5. Set schedule (every 12h recommended)
6. Save

**Example Custom Content:**
```
🎉 Flash Deal Alert!
boAt Rockerz Headphones @₹1,199
Buy now: https://www.amazon.in/boAt-Rockerz-425/dp/B09QL2WWC4

Limited time only! #Deal #Headphones
```

Cuelinks will auto-convert URLs to your affiliate links before posting!

---

## 🤖 Step 3: Telegram Setup (10 min)

### 3.1 Create Telegram Bot (if not already)

1. Open Telegram
2. Search: `@BotFather`
3. Type: `/newbot`
4. BotFather asks for **name** → e.g. `My Deals Bot`
5. BotFather asks for **username** → must end in `bot` → e.g. `myd_eals_bot`
6. BotFather gives you a **token** like: `8142520623:AAHSa4rSsWs8z-n5tB9GJ622dgXJrV9Ai8s`
7. **SAVE THIS TOKEN!** (needed for GitHub Secret)

### 3.2 Create Telegram Channel (if not already)

1. Open Telegram
2. Click **"New Channel"**
3. Name: e.g. `Shopping Deals & Offers`
4. Username: e.g. `shoppingdealsofferscuelinks` (must be unique, no `@`)
5. Make it **Public** (so users can find it)
6. Skip adding members for now

### 3.3 Add Your Bot as Channel Admin

1. Open your channel
2. Channel Info → **Administrators** → **Add Administrator**
3. Search your bot's username (e.g. `@myd_eals_bot`)
4. Permissions:
   - ✅ **Post Messages** (REQUIRED)
   - ✅ **Edit Messages** (optional)
   - ✅ **Delete Messages** (optional)
5. Save

### 3.4 Add @cuelinks_bot as Admin (for Autopost)
Same as above but search `@cuelinks_bot`

### 3.5 Get Channel ID (Optional — for advanced setups)

If you need numeric channel ID:
1. Forward any message from your channel to @JsonDumpBot
2. Bot shows `chat.id` like `-1001234567890`
3. Use this as `TELEGRAM_CHANNEL` if needed (not required if @username works)

### 3.6 Save Token in GitHub Secrets
- Use the bot token from Step 3.1
- Save as `TELEGRAM_BOT_TOKEN` in GitHub Secrets (Step 1.3)

---

## 🖼️ Step 4: Pexels API Setup (Optional, 5 min)

*Skip this if you don't want real product images — emoji icons will be used instead.*

### 4.1 Create Pexels Account
- Go to: [pexels.com/api](https://www.pexels.com/api/)
- Click **"Get Started"** → Sign up with email
- Verify email

### 4.2 Get API Key
1. Login to Pexels
2. Go to your **Account → API**
3. Copy your **API Key**
4. Free tier: 200 requests/hour, 20,000/month

### 4.3 Save as GitHub Secret
- Save as `PEXELS_API_KEY` in GitHub Secrets (Step 1.3)

### 4.4 Test
Run your GitHub Actions workflow. Posts should now show real product images.

---

## 🖥️ Step 5: Render Deployment (Optional, 12 min)

*Skip this if you don't need `/deal` or `/convert` Telegram bot commands. Cron + Cuelinks autopost already give you 30+ posts/day.*

### 5.1 Create Render Account
- Go to: [render.com](https://render.com)
- Sign up with **GitHub** (use your GitHub account)

### 5.2 Deploy Bot Service
1. Click **"New +"** → **"Web Service"**
2. Connect repo: `technicalboy2023/cuelinks-automation`
3. Fill in:
   ```
   Name:           cuelinks-bot
   Region:         Singapore
   Branch:         main
   Build Command:  cd automation && npm install
   Start Command:  cd automation && node bot_runner.js
   Instance Type:  Free
   ```
4. Click **"Advanced"** → Add Environment Variables:

| Name | Value |
|------|-------|
| `CUELINKS_API_KEY` | (your Cuelinks API key) |
| `TELEGRAM_BOT_TOKEN` | (your bot token) |
| `TELEGRAM_CHANNEL` | `@shoppingdealsofferscuelinks` |
| `BOT_ENABLED` | `true` |

5. Click **"Create Web Service"**
6. Wait 3-5 minutes for build
7. Test: Send `/start` to your bot on Telegram

### 5.3 Deploy Monitor Service (Optional)
Repeat Step 5.2 but:
```
Name:           cuelinks-monitor
Start Command:  cd automation && node monitor_runner.js
Add env:        MONITOR_ENABLED=true
```

---

## ✅ Verification Checklist

After setup, verify each:

| Check | How to Verify | Expected Result |
|-------|---------------|-----------------|
| Cuelinks API works | Run `node automation/main.js --dry-run` | 300 deals fetched |
| GitHub Actions works | Repo → Actions tab | Workflow runs every 6h |
| Telegram posts work | After cron run | 5 deals in channel |
| Website updates | After cron run | `https://yourname.github.io/repo/` |
| Cuelinks Autopost | Wait 24h | 10-15 posts from Cuelinks |
| Pexels images | Wait for next cron | Real product images |
| Bot commands | Telegram `/start` | Bot replies with help |
| Monitor | Post URL in channel | Bot auto-replies |

---

## 🔄 Day-to-Day Operations (Zero Manual)

```
⏰ 06:00 AM  My cron:    5 quality-scored deals → Channel
⏰ 12:00 PM  My cron:    5 quality-scored deals → Channel
⏰ 06:00 PM  My cron:    5 quality-scored deals → Channel
⏰ 12:00 AM  My cron:    5 quality-scored deals → Channel

+ Cuelinks Autopost:  10-15 deals/day (real-time)

📊 TOTAL: 30-35 deals/day on your channel
💰 COST: ₹0 forever
✋ DAILY MANUAL EFFORT: 0 minutes
```

**You literally do nothing after setup. Sit back and watch!** ☕

---

## 💰 Total Cost Breakdown

| Service | Tier | Cost | Usage |
|---------|------|------|-------|
| GitHub | Free | ₹0 | Code + Actions + Pages |
| Telegram | Free | ₹0 | Bot API + Channel |
| Cuelinks | Free | ₹0 | Commission-based (you earn) |
| Cuelinks Autopost | Free | ₹0 | Native bot |
| Pexels | Free | ₹0 | 20K images/month |
| Render (Optional) | Free | ₹0 | 750 hrs/month |
| Bitly | Free | ₹0 | 10 links/month |
| **TOTAL** | | **₹0** | **Forever** |

---

## 📂 File Reference

```
/home/coder/project/
├── MANUAL.md                          ← THIS FILE
├── README.md                          ← Project overview
├── .github/workflows/automation.yml   ← GitHub Actions cron
├── .gitignore                         ← Excludes dev files
└── automation/
    ├── main.js                        ← Cron orchestrator
    ├── bot.js                         ← Telegram bot commands
    ├── bot_runner.js                  ← Standalone bot entry
    ├── monitor.js                     ← Channel URL detector
    ├── monitor_runner.js              ← Standalone monitor entry
    ├── cuelinks.js                    ← Cuelinks API client
    ├── linkkit.js                     ← URL → Affiliate converter
    ├── merchant_map.js                ← 30+ Indian merchants
    ├── scoring.js                     ← Quality scoring (NEW!)
    ├── sources/                       ← Pluggable deal sources
    │   ├── base.js
    │   ├── cuelinks-offers.js
    │   ├── user-submitted.js
    │   └── index.js
    ├── data/
    │   └── submitted_urls.json        ← Auto: bot submissions
    ├── docs/
    │   ├── index.html                 ← Beautiful website
    │   └── deals.json                 ← Auto: latest deals
    ├── deals.json                     ← Auto: website data
    ├── posted_deals.json              ← Auto: dedup tracking
    ├── run_log.json                   ← Auto: run logs
    ├── config.js                      ← All settings
    └── package.json                   ← Dependencies
```

---

## 🔧 Common Issues & Fixes

### Issue 1: Bot token invalid
- **Fix:** Re-generate via @BotFather → /token
- Update GitHub Secret `TELEGRAM_BOT_TOKEN`

### Issue 2: Channel posts not appearing
- **Check:** Bot is admin with "Post Messages" permission
- **Check:** Channel username is correct (with @)

### Issue 3: GitHub Actions failing
- **Check:** All secrets are set correctly
- **Check:** `GH_PAT` has `repo` + `workflow` scopes
- **Check:** Workflow logs in Actions tab

### Issue 4: Cuelinks API 401 Unauthorized
- **Fix:** Verify API key is correct in Cuelinks dashboard
- **Fix:** Re-generate API key if expired

### Issue 5: Website not updating
- **Check:** GitHub Pages is enabled (Settings → Pages → gh-pages branch)
- **Check:** Workflow has `pages: write` permission
- **Check:** Wait 1-2 minutes after workflow runs

### Issue 6: Render bot not responding
- **Check:** BOT_ENABLED=true in Render env
- **Check:** Bot token is correct
- **Check:** Render logs for errors

### Issue 7: Pexels images not loading
- **Check:** API key is set in GitHub Secret
- **Check:** Pexels free tier not exceeded
- **Fallback:** Posts will use emoji icons

### Issue 8: Cuelinks Autopost not working
- **Check:** @cuelinks_bot is channel admin
- **Check:** Login done via /login
- **Check:** /autoposting_status shows "ON"

---

## 📊 Quality Scoring System

Your system picks TOP 5 deals based on this scoring (1-25 scale):

| Factor | Weight | Why |
|--------|--------|-----|
| **Payout %** | +1 per % | Direct commission |
| **Has coupon** | +5 | Users love coupons |
| **Has image** | +3 | Visual posts get 3x engagement |
| **Description > 100 chars** | +3 | More informative |
| **Description > 50 chars** | +1.5 | Moderately informative |
| **Popular merchant** | +4 | Amazon/Flipkart = more trust |
| **Time-sensitive (flash sale)** | +2 | Urgency drives clicks |
| **Fresh (0-7 days)** | +3 | Recent = relevant |
| **Fresh (7-30 days)** | +1 | Still recent |
| **Title 20-100 chars** | +1 | Good readable length |

**Plus: Category diversity** (max 2 deals per category per run)

---

## 🔄 Workflow Architecture

```
┌────────────────────────────────────────────────────┐
│  GITHUB ACTIONS CRON (every 6h)                     │
│  ─────────────────────────────                      │
│  1. Fetch campaigns from Cuelinks                   │
│  2. Fetch 300 offers from Cuelinks                  │
│  3. Smart score each deal (scoring.js)              │
│  4. Pick TOP 5 with category diversity              │
│  5. Post 5 to Telegram channel                      │
│  6. Update website data                             │
│  7. Commit to repo + Deploy to Pages                │
└────────────────────────────────────────────────────┘
                    + 
┌────────────────────────────────────────────────────┐
│  CUELINKS AUTOPOST (real-time)                      │
│  ─────────────────────────                          │
│  @cuelinks_bot → /enable_autoposting                │
│  → 10-15 curated deals/day to channel               │
└────────────────────────────────────────────────────┘
                    + 
┌────────────────────────────────────────────────────┐
│  RENDER BOT (Optional, 24/7)                        │
│  ─────────────────────────                          │
│  User types: /deal <url>                            │
│  → Bot converts + queues for posting                │
│  User types: /convert <url>                         │
│  → Bot returns affiliate link                       │
│  User types: /stats                                 │
│  → Bot returns posting stats                        │
└────────────────────────────────────────────────────┘
                    + 
┌────────────────────────────────────────────────────┐
│  RENDER MONITOR (Optional, 24/7)                    │
│  ─────────────────────────                          │
│  Channel post contains URL                         │
│  → Bot auto-replies with affiliate version          │
└────────────────────────────────────────────────────┘
```

---

## 📞 Support & Resources

- **Cuelinks Support:** support@cuelinks.com
- **GitHub Issues:** github.com/technicalboy2023/cuelinks-automation/issues
- **Telegram Bot API:** core.telegram.org/bots/api
- **GitHub Actions Docs:** docs.github.com/en/actions
- **Render Docs:** render.com/docs

---

## 🎉 Setup Complete Checklist

- [ ] GitHub account + repo + secrets set
- [ ] Cuelinks account + API key obtained
- [ ] Cuelinks Autopost enabled via @cuelinks_bot
- [ ] Telegram bot created via @BotFather
- [ ] Telegram channel created + bot added as admin
- [ ] Pexels API key (optional) added
- [ ] Render Bot deployed (optional)
- [ ] Render Monitor deployed (optional)
- [ ] First cron run successful (check Actions tab)
- [ ] First Telegram post visible in channel
- [ ] Website live at GitHub Pages URL
- [ ] Autopost verified after 24h

**All done? Enjoy your fully automated affiliate channel! 🚀**

---

**Last Updated:** Auto-updated with each commit
**License:** Free to use, modify, redistribute
**Support:** github.com/technicalboy2023/cuelinks-automation/issues
