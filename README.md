# 🎬 StreamyFlix

A Netflix-style streaming website that serves content from Telegram. Built with React + Vite (frontend) and Node.js + Express (bot backend).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User visits StreamyFlix website (Netlify / Vercel)     │
│  React + Vite + Tailwind — fetches metadata from TMDB   │
└──────────────────────┬──────────────────────────────────┘
                       │ clicks Download
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Telegram Bot deep-link  t.me/YourBot?start=dl_movie_X  │
│  Bot sends the video file directly in Telegram chat     │
└──────────────────────┬──────────────────────────────────┘
                       │ admin indexes files
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Bot Backend API  (Railway / Render)                    │
│  Node.js + Express + MongoDB                            │
│  • Indexes files into MongoDB                           │
│  • REST API: /api/files, /api/search, /stream          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) → `/newbot`
2. Copy the **BOT_TOKEN**
3. Get your channel ID: forward a message from your channel to [@userinfobot](https://t.me/userinfobot)
4. Add your bot as an **admin** in the channel with "Post Messages" permission

### 2. MongoDB Atlas (free tier)

1. Sign up at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free cluster → **Connect** → **Drivers** → copy the URI
3. In **Network Access**, add `0.0.0.0/0` (allow all IPs — needed for Railway/Render)

---

## Deploy the Backend (Bot)

### Railway (recommended — free tier)

1. Fork this repo or upload the `bot/` folder
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select the repo, set **Root Directory** to `bot`
4. Add these **Environment Variables**:

| Variable | Value |
|---|---|
| `BOT_TOKEN` | Your Telegram bot token |
| `CHANNEL_ID` | Your channel ID e.g. `-1001234567890` |
| `ADMIN_USER_IDS` | Your Telegram user ID(s), comma-separated |
| `MONGO_URI` | MongoDB Atlas connection string |
| `ADMIN_API_KEY` | A long random secret string (you make this up) |
| `WEBSITE_URL` | Your frontend URL (fill in after deploying frontend) |
| `WEBHOOK_URL` | Your Railway service URL (auto-shown in Railway dashboard) |
| `FORCE_SUB_LINK` | `https://t.me/your_channel` |

5. Railway auto-deploys. Copy the service URL (e.g. `https://streamyflix-bot-production.up.railway.app`)

### Render (alternative)

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect repo, set **Root Directory** to `bot`
3. **Build Command**: `npm install`
4. **Start Command**: `node index.js`
5. Add same environment variables as above
6. Copy your Render URL

---

## Deploy the Frontend

### Netlify (recommended)

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Set **Base directory**: *(leave blank — root of repo)*
3. **Build command**: `npm run build`
4. **Publish directory**: `dist`
5. **Environment variables** (optional):
   - `VITE_TMDB_API_KEY` — get a free key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
6. Deploy. Copy your Netlify URL.

### Vercel (alternative)

```bash
npm i -g vercel
vercel --prod
```

---

## Configure the Website

After deploying both services:

1. Open your website → click the ⚙️ gear icon → **Config**
2. In **Bot API** tab, fill in:
   - **Bot Token** — your Telegram bot token
   - **Channel ID** — your Telegram channel ID
   - **Bot Username** — e.g. `StreamyFlixServerBot`
   - **Backend API URL** — your Railway/Render URL
   - **Admin API Key** — the same `ADMIN_API_KEY` you set on the backend
3. Click **Save All Settings**
4. Go to **Admin** page → **Indexed Files** tab → click **Refresh** to load files

---

## Using the Bot

### Index your files

**Option A** — Send files directly to the bot in DM → auto-indexed

**Option B** — Forward a message from your channel to the bot → prompts to index all

**Option C** — In bot DM, send `/index` → indexes the configured `CHANNEL_ID`

### Link files to TMDB

After indexing, go to Admin → Indexed Files → click **Link TMDB** next to any file → search for the movie/series → link it. Now the file will appear on detail pages.

### Download flow

When a user clicks Download on the website → opens `t.me/YourBot?start=dl_movie_550` → bot checks if user is subscribed → sends the file.

---

## API Reference

All endpoints are relative to your backend URL.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health check + stats |
| `GET` | `/api/files` | Public | List indexed files |
| `GET` | `/api/search?q=...` | Public | Text search |
| `GET` | `/api/file/:id` | Public | Get single file |
| `GET` | `/stream?file_id=...` | Public | Stream proxy (≤20MB) |
| `POST` | `/api/link` | 🔒 Admin key | Link file to TMDB |
| `DELETE` | `/api/file/:id` | 🔒 Admin key | Remove from index |
| `POST` | `/webhook` | Public | Telegram webhook |

Protected routes require header: `x-admin-key: YOUR_ADMIN_API_KEY`

---

## Local Development

```bash
# Frontend
npm install
npm run dev        # http://localhost:5173

# Bot backend
cd bot
npm install
cp .env.example .env   # fill in your values
npm run dev        # http://localhost:3001
```

For local bot dev, leave `WEBHOOK_URL` blank — uses polling automatically.

---

## Environment Variables Reference

### Bot (`bot/.env`)

| Variable | Required | Description |
|---|---|---|
| `BOT_TOKEN` | ✅ | Telegram bot token from @BotFather |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `CHANNEL_ID` | ✅ | Telegram channel ID (-100...) |
| `ADMIN_USER_IDS` | ✅ | Comma-separated Telegram user IDs |
| `ADMIN_API_KEY` | ⚠️ | Secret for protecting admin API routes |
| `WEBSITE_URL` | ⚠️ | Frontend URL (for CORS) |
| `WEBHOOK_URL` | ⚠️ | Backend public URL (enables webhook mode) |
| `FORCE_SUB_LINK` | ☑️ | Channel link shown to non-subscribers |
| `MONGO_DB` | ☑️ | Database name (default: `streamyflix`) |
| `MONGO_COLLECTION` | ☑️ | Collection name (default: `files`) |
| `PORT` | ☑️ | Server port (default: `3001`) |

### Frontend (`.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_TMDB_API_KEY` | ☑️ | TMDB API key (has public fallback) |

---

## Troubleshooting

**Bot not receiving messages**
- Make sure `WEBHOOK_URL` is set to your deployed backend URL
- Check Railway/Render logs for webhook registration confirmation

**"Unauthorized" on Admin actions**
- Make sure `ADMIN_API_KEY` in the website Config matches `ADMIN_API_KEY` in your backend env

**Stream returns 413 error**
- Files >20MB can't be served via Bot API. Use the Telegram deep-link download instead (bot sends the file directly).

**CORS errors in browser**
- Set `WEBSITE_URL` in your backend env to match your frontend URL exactly (no trailing slash)

**MongoDB connection fails**
- In Atlas → Network Access → add `0.0.0.0/0` to allow Railway/Render IPs
