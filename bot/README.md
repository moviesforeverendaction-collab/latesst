# StreamyFlix Bot

Production-ready Telegram bot for StreamyFlix.

## What it does

- **Auto-indexes** every file posted to your private channel
- **Handles downloads** — when user clicks Download on website, bot sends file to DM
- **Prompts admin** when a file is sent to bot DM: offer to index all channel files
- **HTTP API** for the website to query indexed files
- **Streaming proxy** — pipes Bot API file downloads with range-request support
- **MongoDB** — persists all file metadata

## Setup

### 1. Install dependencies
```bash
cd bot
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run locally (polling mode)
```bash
npm start
```

### 4. Deploy to Railway

1. Push this `bot/` folder to a GitHub repo
2. Create a new project on [railway.app](https://railway.app)
3. Connect your repo
4. Add environment variables from `.env.example`
5. Set `WEBHOOK_URL` to your Railway public URL (e.g. `https://streamyflix-bot.up.railway.app`)
6. Railway auto-detects `package.json` and runs `npm start`

### 5. Deploy to Render

1. Create a new Web Service on [render.com](https://render.com)
2. Connect repo → set Root Directory to `bot`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add environment variables

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + DB status |
| GET | `/api/files` | List all indexed files |
| GET | `/api/files?type=movie` | Filter by type (movie/tv/unknown) |
| GET | `/api/files?tmdb_id=550` | Get files for a TMDB entry |
| GET | `/api/search?q=avengers` | Full-text search |
| GET | `/stream?file_id=AQAD...` | Stream/proxy a file |
| POST | `/api/link` | Link file to TMDB entry |
| POST | `/webhook` | Telegram webhook receiver |

## Bot Commands

| Command | Who | Description |
|---------|-----|-------------|
| `/start` | Everyone | Welcome message |
| `/start dl_movie_123` | Everyone | Download a specific file |
| `/index` | Admin only | Index all channel files |
| `/index 500` | Admin only | Index from message ID 500 |
| `/stats` | Admin only | Show database statistics |

## File Indexing Flow

```
Admin sends file to channel
         ↓
Bot receives channel_post update
         ↓
extractFileFromMessage() → parse filename
         ↓
indexFile() → upsert to MongoDB
         ↓
File available via /api/files
```

## Download Flow

```
User clicks Download on website
         ↓
Opens t.me/YourBot?start=dl_movie_550
         ↓
Bot handles /start dl_movie_550
         ↓
Query MongoDB: { tmdb_id: 550, media_type: "movie" }
         ↓
sendVideo() or sendDocument() to user DM
```

## MongoDB Document Schema

```json
{
  "_id": "ObjectId",
  "file_id": "BQACAgI...",
  "file_unique_id": "AgAD...",
  "file_name": "Avengers.Endgame.2019.1080p.mkv",
  "file_size": 5368709120,
  "mime_type": "video/x-matroska",
  "message_id": 42,
  "channel_id": "-1001234567890",
  "tmdb_id": 299534,
  "media_type": "movie",
  "title": "Avengers Endgame",
  "quality": "1080p",
  "language": "English",
  "season": null,
  "episode": null,
  "duration": 10860,
  "thumb": "AQAD...",
  "indexed_at": "2024-01-01T00:00:00.000Z",
  "download_count": 0
}
```
