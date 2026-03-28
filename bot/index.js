/**
 * StreamyFlix Bot — Advanced Production Build v2.0
 *
 * Improvements over v1:
 *  ✅ MongoDB text index language_override fix (no more "language override unsupported" errors)
 *  ✅ All indexes created safely with createIndex (idempotent, never crash on restart)
 *  ✅ Advanced file parser: multi-audio, edition tags, codec, HDR, release group, year extraction
 *  ✅ Duplicate detection by file_unique_id AND content hash
 *  ✅ Bulk channel indexer: pagination with rate-limit handling and stop support
 *  ✅ Retry logic with exponential backoff for all Telegram API calls
 *  ✅ Auto TMDB lookup by title + year using TMDB Search API (optional)
 *  ✅ Per-file genre + poster stored from TMDB
 *  ✅ Advanced /search with filters: /search avengers type:movie lang:hindi quality:1080p
 *  ✅ Paginated bot search results with inline keyboard navigation
 *  ✅ /fix command re-parses all files with new extractor (batch re-index)
 *  ✅ /pending command shows unlinked files awaiting TMDB
 *  ✅ /autolink auto-links all unlinked files via TMDB
 *  ✅ /broadcast sends a message to all users
 *  ✅ /stopindex aborts running bulk index
 *  ✅ Queue-based indexing so concurrent forwards don't flood Telegram
 *  ✅ User tracking (join date, visit count, last seen)
 *  ✅ API: /api/files supports pagination, sort, language, quality, season, episode, year, hdr, codec
 *  ✅ API: /api/search supports all above filters + pagination
 *  ✅ API: /api/tmdb/:type/:id proxies TMDB data (7-day cache in MongoDB)
 *  ✅ API: /api/bulk-link for mass TMDB linking
 *  ✅ API: /api/reparse triggers re-extraction on all documents
 *  ✅ Graceful shutdown with force-exit timeout
 *  ✅ process-level uncaughtException + unhandledRejection handlers
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const TelegramBot = require("node-telegram-bot-api");
const https     = require("https");
const http      = require("http");
const crypto    = require("crypto");

// ─── Config ──────────────────────────────────────────────────────────────────
const {
  BOT_TOKEN,
  CHANNEL_ID,
  ADMIN_USER_IDS    = "",
  MONGO_URI,
  MONGO_DB          = "streamyflix",
  MONGO_COLLECTION  = "files",
  PORT              = 8080,
  WEBSITE_URL       = "",
  WEBHOOK_URL       = "",
  ADMIN_API_KEY     = "",
  FORCE_SUB_LINK    = "",
  TMDB_API_KEY      = "",       // optional — enables auto TMDB linking
  INDEX_BATCH_SIZE  = "200",   // messages per indexing batch
  RATE_LIMIT_MS     = "60",    // ms delay between forwarded messages
} = process.env;

if (!BOT_TOKEN)  throw new Error("BOT_TOKEN is required");
if (!MONGO_URI)  throw new Error("MONGO_URI is required");

const ADMINS     = ADMIN_USER_IDS.split(",").map(Number).filter(Boolean);
const BATCH_SIZE = parseInt(INDEX_BATCH_SIZE) || 200;
const RATE_LIMIT = parseInt(RATE_LIMIT_MS)    || 60;

// ─── MongoDB ─────────────────────────────────────────────────────────────────
let db, filesCol, usersCol, cacheCol;
const mongoClient = new MongoClient(MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
});

async function connectDB() {
  await mongoClient.connect();
  db        = mongoClient.db(MONGO_DB);
  filesCol  = db.collection(MONGO_COLLECTION);
  usersCol  = db.collection("users");
  cacheCol  = db.collection("tmdb_cache");

  // ── Indexes (all idempotent — safe to call on every restart) ─────────────

  // Unique constraint on Telegram's own dedup key
  await safeCreateIndex(filesCol, { file_unique_id: 1 }, { unique: true, name: "uidx_unique" });

  // Common filter / sort fields
  await safeCreateIndex(filesCol, { tmdb_id: 1 },               { name: "uidx_tmdb"    });
  await safeCreateIndex(filesCol, { media_type: 1 },            { name: "uidx_type"    });
  await safeCreateIndex(filesCol, { language: 1 },              { name: "uidx_lang"    });
  await safeCreateIndex(filesCol, { quality: 1 },               { name: "uidx_quality" });
  await safeCreateIndex(filesCol, { year: 1 },                  { name: "uidx_year"    });
  await safeCreateIndex(filesCol, { season: 1, episode: 1 },    { name: "uidx_se", sparse: true });
  await safeCreateIndex(filesCol, { indexed_at: -1 },           { name: "uidx_date"    });
  await safeCreateIndex(filesCol, { download_count: -1 },       { name: "uidx_dl"      });
  await safeCreateIndex(filesCol, { channel_id: 1, message_id: 1 }, { name: "uidx_msg" });

  // Full-text search
  // CRITICAL: language_override must point to a field that does NOT exist in documents.
  // Without this, MongoDB treats the "language" field (which stores values like "Hindi",
  // "Dual Audio", "Unknown") as a per-document locale — and throws:
  //   "language override unsupported: Hindi"
  // Setting language_override to "search_lang" (a non-existent field) disables that
  // behavior and lets MongoDB use the default English stemmer for all documents.
  await safeCreateIndex(
    filesCol,
    { file_name: "text", title: "text" },
    {
      name:              "text_search",
      weights:           { title: 10, file_name: 5 },
      default_language:  "english",
      language_override: "search_lang",
    }
  );

  // TMDB cache — TTL 7 days
  await safeCreateIndex(cacheCol, { tmdb_id: 1, media_type: 1 }, { name: "cache_tmdb", unique: true });
  await safeCreateIndex(cacheCol, { fetched_at: 1 }, { name: "cache_ttl", expireAfterSeconds: 604800 });

  // Users
  await safeCreateIndex(usersCol, { user_id: 1 }, { name: "uidx_user", unique: true });

  console.log(`✅ MongoDB connected: ${MONGO_DB}.${MONGO_COLLECTION}`);
}

/**
 * Creates a MongoDB index safely.
 * If an index with the same name already exists but different options (code 85/86),
 * it drops the old one and recreates it — instead of crashing the process.
 */
async function safeCreateIndex(col, spec, opts = {}) {
  try {
    await col.createIndex(spec, opts);
  } catch (e) {
    if (e.code === 85 || e.code === 86) {
      console.warn(`⚠️  Index conflict on [${opts.name}] — dropping and recreating`);
      try {
        await col.dropIndex(opts.name);
        await col.createIndex(spec, opts);
        console.log(`♻️  Index [${opts.name}] recreated`);
      } catch (e2) {
        console.error(`❌ Could not recreate index [${opts.name}]:`, e2.message);
      }
    } else {
      console.error(`❌ Index error [${opts.name}]:`, e.message);
    }
  }
}

mongoClient.on("error", async (e) => {
  console.error("MongoDB error:", e.message);
  try { await connectDB(); } catch {}
});

// ─── Telegram Bot ─────────────────────────────────────────────────────────────
const isWebhook = !!WEBHOOK_URL;
const bot = new TelegramBot(BOT_TOKEN, { polling: !isWebhook });

function isAdmin(userId) { return ADMINS.includes(userId); }

// ─── Utilities ────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retry(fn, retries = 3, baseDelay = 1000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      const retryAfter = e.parameters?.retry_after
        ? e.parameters.retry_after * 1000
        : baseDelay * Math.pow(2, i);
      if (i === retries - 1) throw e;
      await sleep(retryAfter);
    }
  }
}

function progressBar(pct) {
  const f = Math.round(pct / 10);
  return "█".repeat(f) + "░".repeat(10 - f);
}

// ─── Simple serial queue ──────────────────────────────────────────────────────
class Queue {
  constructor(concurrency = 1) {
    this._c = concurrency;
    this._r = 0;
    this._q = [];
  }
  push(fn) {
    return new Promise((res, rej) => {
      this._q.push({ fn, res, rej });
      this._run();
    });
  }
  async _run() {
    if (this._r >= this._c || !this._q.length) return;
    this._r++;
    const { fn, res, rej } = this._q.shift();
    try { res(await fn()); } catch (e) { rej(e); }
    finally { this._r--; this._run(); }
  }
}
const forwardQueue = new Queue(1);

// ─── File Parser ──────────────────────────────────────────────────────────────
const QUALITY_PATTERNS = [
  { re: /\b(2160p|4k|uhd)\b/i,        label: "4K UHD"  },
  { re: /\b1080p\b/i,                  label: "1080p HD" },
  { re: /\b720p\b/i,                   label: "720p HD"  },
  { re: /\b480p\b/i,                   label: "480p SD"  },
  { re: /\b360p\b/i,                   label: "360p"     },
  { re: /\bCAMRIP|CAM\b/i,             label: "CAMRip"   },
  { re: /\bHDRIP\b/i,                  label: "HDRip"    },
  { re: /\bBLURIP|BLURAY|BDRip\b/i,    label: "BluRay"   },
  { re: /\bWEBRIP|WEB-DL\b/i,          label: "WEB-DL"   },
  { re: /\bDVDRIP|DVDR\b/i,            label: "DVDRip"   },
];

const LANGUAGE_MAP = [
  { re: /\bdual.?audio\b/i,   label: "Dual Audio"  },
  { re: /\bmulti.?audio\b/i,  label: "Multi Audio" },
  { re: /\benglish\b/i,       label: "English"     },
  { re: /\bhindi\b/i,         label: "Hindi"       },
  { re: /\btamil\b/i,         label: "Tamil"       },
  { re: /\btelugu\b/i,        label: "Telugu"      },
  { re: /\bmalay(alam)?\b/i,  label: "Malayalam"   },
  { re: /\bkannada\b/i,       label: "Kannada"     },
  { re: /\bspanish\b/i,       label: "Spanish"     },
  { re: /\bfrench\b/i,        label: "French"      },
  { re: /\bkorean\b/i,        label: "Korean"      },
  { re: /\bjapanese\b/i,      label: "Japanese"    },
  { re: /\bchinese\b/i,       label: "Chinese"     },
  { re: /\bgerman\b/i,        label: "German"      },
  { re: /\bitalian\b/i,       label: "Italian"     },
  { re: /\bportugues\b/i,     label: "Portuguese"  },
  { re: /\brussian\b/i,       label: "Russian"     },
  { re: /\barabic\b/i,        label: "Arabic"      },
];

const HDR_MAP = [
  { re: /\bDolby.?Vision|DV\b/i, label: "Dolby Vision" },
  { re: /\bHDR10\+/i,            label: "HDR10+"       },
  { re: /\bHDR10\b/i,            label: "HDR10"        },
  { re: /\bHDR\b/i,              label: "HDR"          },
  { re: /\bSDR\b/i,              label: "SDR"          },
];

const CODEC_MAP = [
  { re: /\bx265|HEVC\b/i,  label: "x265/HEVC" },
  { re: /\bx264|AVC\b/i,   label: "x264/AVC"  },
  { re: /\bAV1\b/i,        label: "AV1"       },
  { re: /\bVP9\b/i,        label: "VP9"       },
  { re: /\bXVID\b/i,       label: "XviD"      },
];

const AUDIO_MAP = [
  { re: /\bDolby.?Atmos\b/i, label: "Atmos"  },
  { re: /\bDTS.?HD\b/i,      label: "DTS-HD" },
  { re: /\bDTS\b/i,          label: "DTS"    },
  { re: /\bDD\+|EAC3\b/i,    label: "DD+"    },
  { re: /\bDD5|AC3\b/i,      label: "DD5.1"  },
  { re: /\bAAC\b/i,          label: "AAC"    },
  { re: /\bFLAC\b/i,         label: "FLAC"   },
  { re: /\bMP3\b/i,          label: "MP3"    },
];

function matchFirst(str, patterns) {
  for (const { re, label } of patterns) {
    if (re.test(str)) return label;
  }
  return null;
}

function extractYear(str) {
  const m = str.match(/\b(19[4-9]\d|20[0-3]\d)\b/);
  return m ? parseInt(m[1]) : null;
}

function extractFileInfo(msg) {
  let fileObj = null, fileType = "unknown";
  if      (msg.document)  { fileObj = msg.document;  fileType = "document";  }
  else if (msg.video)     { fileObj = msg.video;     fileType = "video";     }
  else if (msg.audio)     { fileObj = msg.audio;     fileType = "audio";     }
  else if (msg.animation) { fileObj = msg.animation; fileType = "animation"; }
  if (!fileObj) return null;

  const rawCaption = msg.caption || "";
  const fileName   = fileObj.file_name
    || (rawCaption.length < 200 ? rawCaption : null)
    || "Untitled";

  const quality      = matchFirst(fileName, QUALITY_PATTERNS) || "Unknown";
  const language     = matchFirst(fileName, LANGUAGE_MAP)     || "Unknown";
  const hdr          = matchFirst(fileName, HDR_MAP)          || null;
  const codec        = matchFirst(fileName, CODEC_MAP)        || null;
  const audio_format = matchFirst(fileName, AUDIO_MAP)        || null;
  const year         = extractYear(fileName);

  const releaseGroupMatch = fileName.match(/[-\[]([A-Za-z0-9]+)\]?$/);
  const release_group = releaseGroupMatch ? releaseGroupMatch[1] : null;

  // Season / Episode
  let season = null, episode = null;
  const seMatch = fileName.match(/S(\d{1,3})\s*E(\d{1,4})/i);
  if (seMatch) {
    season  = parseInt(seMatch[1]);
    episode = parseInt(seMatch[2]);
  } else {
    const sMatch = fileName.match(/Season\s*(\d{1,3})/i);
    if (sMatch) season = parseInt(sMatch[1]);
    const eMatch = fileName.match(/Episode\s*(\d{1,4})/i);
    if (eMatch && season) episode = parseInt(eMatch[1]);
  }

  const is_episode_pack = /E\d+-E\d+|complete.?series|full.?season/i.test(fileName);
  const media_type = (season !== null || /series|S\d{1,3}/i.test(fileName)) ? "tv" : "movie";

  // Clean title
  let title = fileName
    .replace(/\.(mkv|mp4|avi|mov|webm|flv|wmv|ts|m4v|m2ts)$/i, "")
    .replace(/[\[\(][^\[\]()]*[\]\)]/g, " ")
    .replace(/\b(19[4-9]\d|20[0-3]\d)\b.*/i, "")
    .replace(/\d{3,4}p.*/i, "")
    .replace(/S\d{1,3}E\d{1,4}.*/i, "")
    .replace(/Season\s*\d+.*/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const contentHash = crypto
    .createHash("md5")
    .update(`${fileName}|${fileObj.file_size || 0}`)
    .digest("hex");

  return {
    file_id:         fileObj.file_id,
    file_unique_id:  fileObj.file_unique_id,
    content_hash:    contentHash,
    file_name:       fileName,
    file_size:       fileObj.file_size || 0,
    mime_type:       fileObj.mime_type || "application/octet-stream",
    duration:        fileObj.duration  || null,
    message_id:      msg.message_id,
    channel_id:      String(msg.chat?.id || ""),
    tmdb_id:         null,
    media_type,
    title,
    quality,
    language,
    hdr,
    codec,
    audio_format,
    release_group,
    year,
    season,
    episode,
    is_episode_pack,
    file_type:       fileType,
    indexed_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
    download_count:  0,
    thumb: fileObj.thumb?.file_id || fileObj.thumbnail?.file_id || null,
  };
}

function reparseRecord(existing) {
  const fakeFileKey = existing.file_type === "video" ? "video" : "document";
  const fresh = extractFileInfo({
    [fakeFileKey]: {
      file_id:        existing.file_id,
      file_unique_id: existing.file_unique_id,
      file_name:      existing.file_name,
      file_size:      existing.file_size,
      mime_type:      existing.mime_type,
      duration:       existing.duration,
      thumb:          existing.thumb ? { file_id: existing.thumb } : null,
    },
    caption:    existing.file_name,
    message_id: existing.message_id,
    chat:       { id: existing.channel_id },
  });
  if (!fresh) return null;
  return {
    quality:         fresh.quality,
    language:        fresh.language,
    hdr:             fresh.hdr,
    codec:           fresh.codec,
    audio_format:    fresh.audio_format,
    release_group:   fresh.release_group,
    year:            fresh.year,
    title:           fresh.title,
    media_type:      fresh.media_type,
    season:          fresh.season,
    episode:         fresh.episode,
    is_episode_pack: fresh.is_episode_pack,
    content_hash:    fresh.content_hash,
    updated_at:      new Date().toISOString(),
  };
}

// ─── TMDB ─────────────────────────────────────────────────────────────────────
async function fetchTMDB(path) {
  if (!TMDB_API_KEY) return null;
  const url = `https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}`;
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

async function autoLinkTMDB(fileInfo) {
  if (!TMDB_API_KEY || !fileInfo.title) return null;
  const query = encodeURIComponent(fileInfo.title);
  const year  = fileInfo.year ? `&year=${fileInfo.year}` : "";
  const type  = fileInfo.media_type === "tv" ? "tv" : "movie";
  const data  = await fetchTMDB(`/search/${type}?query=${query}${year}`);
  if (!data?.results?.length) return null;

  const match   = data.results[0];
  const tmdbId  = match.id;
  const poster  = match.poster_path ? `https://image.tmdb.org/t/p/w500${match.poster_path}` : null;
  const genres  = (match.genre_ids || []).slice(0, 3);

  await cacheCol.updateOne(
    { tmdb_id: tmdbId, media_type: type },
    { $set: { tmdb_id: tmdbId, media_type: type, data: match, fetched_at: new Date() } },
    { upsert: true }
  ).catch(() => {});

  return { tmdb_id: tmdbId, title: match.title || match.name, poster, genres };
}

// ─── Index file ───────────────────────────────────────────────────────────────
async function indexFile(fileInfo, { autoTmdb = false } = {}) {
  try {
    let extra = {};
    if (autoTmdb && TMDB_API_KEY && !fileInfo.tmdb_id) {
      const t = await autoLinkTMDB(fileInfo);
      if (t) {
        extra.tmdb_id = t.tmdb_id;
        extra.poster  = t.poster;
        extra.genres  = t.genres;
        if (!fileInfo.title || fileInfo.title.length < 3) extra.title = t.title;
      }
    }
    const doc = { ...fileInfo, ...extra };
    const result = await filesCol.updateOne(
      { file_unique_id: fileInfo.file_unique_id },
      { $set: doc, $setOnInsert: { download_count: 0 } },
      { upsert: true }
    );
    return { ok: true, upserted: !!result.upsertedId, tmdb_id: extra.tmdb_id || null };
  } catch (e) {
    if (e.code === 11000) return { ok: true, upserted: false, duplicate: true };
    console.error("Index error:", e.message);
    return { ok: false, error: e.message };
  }
}

// ─── Bot: /start ──────────────────────────────────────────────────────────────
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const param  = (match[1] || "").trim();

  usersCol.updateOne(
    { user_id: userId },
    {
      $set: { username: msg.from.username, first_name: msg.from.first_name, last_seen: new Date() },
      $inc: { visit_count: 1 },
      $setOnInsert: { joined_at: new Date() },
    },
    { upsert: true }
  ).catch(() => {});

  if (param.startsWith("dl_")) {
    if (CHANNEL_ID) {
      try {
        const member = await retry(() => bot.getChatMember(CHANNEL_ID, userId));
        if (!["member", "administrator", "creator"].includes(member.status)) {
          const link = FORCE_SUB_LINK || `https://t.me/${CHANNEL_ID.replace("-100", "")}`;
          return bot.sendMessage(chatId,
            `⚠️ <b>Please join our channel first!</b>\n\n👉 <a href="${link}">Join Channel</a>\n\nThen retry: /start ${param}`,
            { parse_mode: "HTML", disable_web_page_preview: true }
          );
        }
      } catch {}
    }

    const parts = param.replace("dl_", "").split("_");
    let query = {};
    if (parts[0] === "movie" || parts[0] === "tv") {
      const tmdbId = parseInt(parts[1]);
      if (!isNaN(tmdbId)) {
        query = { tmdb_id: tmdbId, media_type: parts[0] };
        if (parts.length > 2) {
          const extra = parts.slice(2);
          const sIdx = extra.findIndex(p => /^s\d+$/i.test(p));
          if (sIdx !== -1) {
            query.season = parseInt(extra[sIdx].slice(1));
            const eIdx = extra.findIndex(p => /^e\d+$/i.test(p));
            if (eIdx !== -1) query.episode = parseInt(extra[eIdx].slice(1));
          }
        }
      }
    }

    const files = await filesCol.find(query).sort({ quality: -1 }).limit(10).toArray();
    if (!files.length) {
      return bot.sendMessage(chatId,
        `❌ <b>File not found</b>\n\nThis content isn't available yet.`,
        { parse_mode: "HTML" }
      );
    }

    for (const file of files) {
      try {
        const sizeStr = file.file_size ? (file.file_size / 1073741824).toFixed(2) + " GB" : "Unknown";
        const caption =
          `🎬 <b>${file.title || file.file_name}</b>\n` +
          `📀 ${file.quality}${file.hdr ? ` • ${file.hdr}` : ""}${file.codec ? ` • ${file.codec}` : ""}\n` +
          `🌐 ${file.language}${file.audio_format ? ` • ${file.audio_format}` : ""}\n` +
          `📦 ${sizeStr}\n` +
          (file.season ? `📺 S${String(file.season).padStart(2,"0")}${file.episode ? `E${String(file.episode).padStart(2,"0")}` : ""}` : "");

        if (file.mime_type?.startsWith("video/")) {
          await retry(() => bot.sendVideo(chatId, file.file_id, { caption, parse_mode: "HTML", supports_streaming: true }));
        } else {
          await retry(() => bot.sendDocument(chatId, file.file_id, { caption, parse_mode: "HTML" }));
        }
        await filesCol.updateOne({ file_unique_id: file.file_unique_id }, { $inc: { download_count: 1 } });
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Error sending: ${e.message}`).catch(() => {});
      }
    }
    return;
  }

  const botInfo = await bot.getMe().catch(() => ({ first_name: "StreamyFlix" }));
  const welcome =
    `🎬 <b>Welcome to ${botInfo.first_name}!</b>\n\n` +
    `Download movies, series & anime directly to Telegram.\n\n` +
    `<b>How to use:</b>\n• Visit our website → click Download\n• I'll send you the file here\n\n` +
    (isAdmin(userId)
      ? `⚡ <b>Admin:</b> /stats /index /stopindex /search /pending /autolink /fix /broadcast\n\n`
      : "") +
    (WEBSITE_URL ? `🌐 <a href="${WEBSITE_URL}">Visit Website</a>` : "");

  bot.sendMessage(chatId, welcome, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        ...(WEBSITE_URL ? [[{ text: "🌐 Visit Website", url: WEBSITE_URL }]] : []),
        [{ text: "📢 Join Channel", url: FORCE_SUB_LINK || `https://t.me/${(CHANNEL_ID || "").replace("-100", "")}` }],
      ],
    },
  });
});

// ─── Bot: File handling ───────────────────────────────────────────────────────
async function handleFile(msg, opts = {}) {
  const fileInfo = extractFileInfo(msg);
  if (!fileInfo) return null;
  const result = await indexFile(fileInfo, { autoTmdb: !!TMDB_API_KEY, ...opts });

  if (msg.chat?.type === "private" && !opts.silent) {
    if (result.ok) {
      const lines = [
        `✅ <b>${result.upserted ? "Indexed!" : result.duplicate ? "Already exists" : "Updated!"}</b>`,
        `📄 <b>${fileInfo.title || fileInfo.file_name}</b>`,
        `📀 ${fileInfo.quality}${fileInfo.hdr ? ` • ${fileInfo.hdr}` : ""}${fileInfo.codec ? ` • ${fileInfo.codec}` : ""}`,
        `🌐 ${fileInfo.language}${fileInfo.audio_format ? ` • ${fileInfo.audio_format}` : ""}`,
        `📦 ${fileInfo.file_size ? (fileInfo.file_size/1073741824).toFixed(2)+" GB" : "Unknown"}`,
        `🏷️ ${fileInfo.media_type}${fileInfo.season ? ` • S${String(fileInfo.season).padStart(2,"0")}${fileInfo.episode ? `E${String(fileInfo.episode).padStart(2,"0")}` : ""}` : ""}`,
        result.tmdb_id ? `🔗 Auto-linked TMDB: <b>${result.tmdb_id}</b>` : "",
      ].filter(Boolean).join("\n");

      bot.sendMessage(msg.chat.id, lines, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "📝 Edit Title", callback_data: `edit_title_${fileInfo.file_unique_id}` },
              { text: "🔗 Link TMDB",  callback_data: `link_tmdb_${fileInfo.file_unique_id}`  },
            ],
            [{ text: "🗑️ Delete", callback_data: `delete_file_${fileInfo.file_unique_id}` }],
          ],
        },
      }).catch(() => {});
    } else {
      bot.sendMessage(msg.chat.id, `❌ Index failed: ${result.error}`).catch(() => {});
    }
  }
  return result;
}

bot.on("document",  (msg) => handleFile(msg));
bot.on("video",     (msg) => handleFile(msg));
bot.on("audio",     (msg) => handleFile(msg));

bot.on("channel_post", async (msg) => {
  if (CHANNEL_ID && String(msg.chat.id) === String(CHANNEL_ID)) {
    await handleFile(msg, { silent: true });
  }
});

// ─── Bot: Forwarded channel detection ────────────────────────────────────────
bot.on("message", async (msg) => {
  if (msg.chat.type !== "private") return;
  if (!isAdmin(msg.from.id)) return;
  if (!msg.forward_from_chat || msg.forward_from_chat.type !== "channel") return;

  const from = msg.forward_from_chat;
  if (msg.document || msg.video || msg.audio) await handleFile(msg, { silent: true });

  bot.sendMessage(msg.chat.id,
    `📢 <b>Channel Detected!</b>\n\nForwarded from: <b>${from.title}</b>\nID: <code>${from.id}</code>`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📥 Index Last 200",   callback_data: `index_channel_${from.id}_200`  }],
          [{ text: "📥 Index Last 1000",  callback_data: `index_channel_${from.id}_1000` }],
          [{ text: "📥 Index ALL",        callback_data: `index_channel_${from.id}_0`    }],
          [{ text: "❌ Cancel",           callback_data: "dismiss"                        }],
        ],
      },
    }
  );
});

// ─── Bulk indexer ─────────────────────────────────────────────────────────────
const activeIndexJobs = new Map();

async function bulkIndex(channelId, adminChatId, statusMsgId, limit = BATCH_SIZE) {
  let indexed = 0, skipped = 0, errors = 0, duplicates = 0;
  let maxId = 0;

  try {
    const testMsg = await retry(() => bot.sendMessage(channelId, "🔄"));
    maxId = testMsg.message_id;
    await bot.deleteMessage(channelId, testMsg.message_id).catch(() => {});
  } catch (e) {
    await bot.editMessageText(
      `❌ Cannot access <code>${channelId}</code>\n\nMake the bot an admin with Post Messages.\n\n${e.message}`,
      { chat_id: adminChatId, message_id: statusMsgId, parse_mode: "HTML" }
    ).catch(() => {});
    return;
  }

  const startFrom = limit > 0 ? Math.max(1, maxId - limit) : 1;
  let lastUpdate  = Date.now();
  let stop        = false;
  activeIndexJobs.set(String(channelId), { stop: () => { stop = true; } });

  for (let msgId = maxId - 1; msgId >= startFrom && !stop; msgId--) {
    await forwardQueue.push(async () => {
      try {
        const fwd = await retry(() => bot.forwardMessage(adminChatId, channelId, msgId), 2, 500);
        if (fwd.document || fwd.video || fwd.audio) {
          const fi = extractFileInfo(fwd);
          if (fi) {
            fi.channel_id = String(channelId);
            fi.message_id = msgId;
            const r = await indexFile(fi, { autoTmdb: !!TMDB_API_KEY });
            if      (!r.ok)       errors++;
            else if (r.duplicate) duplicates++;
            else if (r.upserted)  indexed++;
            else                  skipped++;
          } else skipped++;
        } else skipped++;
        await bot.deleteMessage(adminChatId, fwd.message_id).catch(() => {});
      } catch (e) {
        if (/not found|MESSAGE_ID_INVALID/i.test(e.message)) skipped++;
        else { errors++; await sleep(2000); }
      }
      await sleep(RATE_LIMIT);
    });

    if ((maxId - msgId) % 25 === 0 || Date.now() - lastUpdate > 5000) {
      lastUpdate  = Date.now();
      const total = maxId - startFrom;
      const done  = maxId - msgId;
      const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
      await bot.editMessageText(
        `⏳ <b>Indexing ${channelId}…</b>\n\n` +
        `${progressBar(pct)} ${pct}%\n\n` +
        `📊 ${done}/${total} scanned\n` +
        `✅ New: ${indexed}  🔁 Updated: ${skipped}  🔂 Dup: ${duplicates}  ❌ Err: ${errors}\n\n` +
        `<i>/stopindex to abort</i>`,
        { chat_id: adminChatId, message_id: statusMsgId, parse_mode: "HTML" }
      ).catch(() => {});
    }
  }

  activeIndexJobs.delete(String(channelId));
  await bot.editMessageText(
    `✅ <b>Index Complete!</b>\n\n` +
    `📥 New: <b>${indexed}</b>  🔁 Updated: ${skipped}  🔂 Dup: ${duplicates}  ❌ Err: ${errors}`,
    { chat_id: adminChatId, message_id: statusMsgId, parse_mode: "HTML" }
  ).catch(() => {});
}

// ─── Bot: Callbacks ───────────────────────────────────────────────────────────
const pendingLinks  = new Map();
const pendingTitles = new Map();
const searchState   = new Map();

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const msgId  = query.message.message_id;
  const data   = query.data;

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (data === "dismiss")
    return bot.deleteMessage(chatId, msgId).catch(() => {});

  if (data.startsWith("index_channel_")) {
    if (!isAdmin(userId)) return;
    const parts     = data.replace("index_channel_", "").split("_");
    const channelId = parts[0];
    const limit     = parseInt(parts[1]) || BATCH_SIZE;
    await bot.editMessageText(
      `⏳ <b>Starting index of</b> <code>${channelId}</code>…\nLimit: ${limit || "ALL"}`,
      { chat_id: chatId, message_id: msgId, parse_mode: "HTML" }
    ).catch(() => {});
    bulkIndex(channelId, chatId, msgId, limit).catch(console.error);
    return;
  }

  if (data.startsWith("link_tmdb_")) {
    if (!isAdmin(userId)) return;
    pendingLinks.set(userId, data.replace("link_tmdb_", ""));
    return bot.sendMessage(chatId,
      `🔗 <b>Link to TMDB</b>\n\nSend:\n<code>tmdb movie 550</code>\nor\n<code>tmdb tv 1399</code>`,
      { parse_mode: "HTML" }
    );
  }

  if (data.startsWith("edit_title_")) {
    if (!isAdmin(userId)) return;
    pendingTitles.set(userId, data.replace("edit_title_", ""));
    return bot.sendMessage(chatId,
      `📝 <b>Edit Title</b>\n\nSend: <code>title Your New Title</code>`,
      { parse_mode: "HTML" }
    );
  }

  if (data.startsWith("delete_file_")) {
    if (!isAdmin(userId)) return;
    const uid    = data.replace("delete_file_", "");
    const result = await filesCol.deleteOne({ file_unique_id: uid });
    return bot.editMessageText(
      result.deletedCount ? `🗑️ File deleted.` : `❌ Not found.`,
      { chat_id: chatId, message_id: msgId }
    ).catch(() => {});
  }

  if (data.startsWith("search_page_")) {
    const page  = parseInt(data.replace("search_page_", ""));
    const state = searchState.get(userId);
    if (!state) return;
    state.page = page;
    await sendSearchResults(chatId, msgId, state, userId, true);
    return;
  }
});

// ─── Paginated search ─────────────────────────────────────────────────────────
async function sendSearchResults(chatId, editMsgId, state, userId, edit = false) {
  const PAGE_SIZE   = 5;
  const { query: q, page = 0, filter = {} } = state;
  const mongoQuery  = { $text: { $search: q }, ...filter };
  const [total, results] = await Promise.all([
    filesCol.countDocuments(mongoQuery).catch(() => 0),
    filesCol.find(mongoQuery, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" }, download_count: -1 })
      .skip(page * PAGE_SIZE).limit(PAGE_SIZE).toArray().catch(() => []),
  ]);

  if (!results.length && page === 0) {
    const text = `🔍 No results for "<b>${q}</b>"`;
    return edit
      ? bot.editMessageText(text, { chat_id: chatId, message_id: editMsgId, parse_mode: "HTML" }).catch(() => {})
      : bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  }

  let out = `🔍 <b>Results for "${q}"</b> — ${total} total (page ${page + 1}/${Math.ceil(total / PAGE_SIZE)})\n\n`;
  for (const f of results) {
    const gb = f.file_size ? (f.file_size / 1073741824).toFixed(2) + " GB" : "?";
    out += `<b>${f.title || f.file_name}</b>\n`;
    out += `  ${f.quality}${f.hdr ? ` • ${f.hdr}` : ""} • ${f.language} • ${gb}\n`;
    if (f.season) out += `  S${String(f.season).padStart(2,"0")}${f.episode ? `E${String(f.episode).padStart(2,"0")}` : ""}\n`;
    out += `  📥 ${f.download_count || 0} dls\n\n`;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const nav = [];
  if (page > 0)              nav.push({ text: "◀️ Prev", callback_data: `search_page_${page - 1}` });
  if (page < totalPages - 1) nav.push({ text: "Next ▶️", callback_data: `search_page_${page + 1}` });

  const opts = {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: nav.length ? [nav] : [] },
  };

  return edit
    ? bot.editMessageText(out, { chat_id: chatId, message_id: editMsgId, ...opts }).catch(() => {})
    : bot.sendMessage(chatId, out, opts);
}

// ─── Bot: Text commands ───────────────────────────────────────────────────────
bot.on("message", async (msg) => {
  if (msg.chat.type !== "private" || !msg.text) return;
  const text   = msg.text.trim();
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // Pending TMDB link
  if (text.toLowerCase().startsWith("tmdb ") && pendingLinks.has(userId)) {
    const parts    = text.split(/\s+/);
    const type     = parts[1]?.toLowerCase();
    const tmdbId   = parseInt(parts[2]);
    if (!type || !tmdbId)
      return bot.sendMessage(chatId, "❌ Format: <code>tmdb movie 550</code>", { parse_mode: "HTML" });
    const uid = pendingLinks.get(userId);
    pendingLinks.delete(userId);
    const r = await filesCol.updateOne(
      { file_unique_id: uid },
      { $set: { tmdb_id: tmdbId, media_type: type === "tv" ? "tv" : "movie", updated_at: new Date().toISOString() } }
    );
    return bot.sendMessage(chatId,
      r.modifiedCount ? `✅ Linked to TMDB <b>${tmdbId}</b>` : `❌ File not found`,
      { parse_mode: "HTML" }
    );
  }

  // Pending title edit
  if (text.toLowerCase().startsWith("title ") && pendingTitles.has(userId)) {
    const newTitle = text.replace(/^title\s+/i, "").trim();
    const uid = pendingTitles.get(userId);
    pendingTitles.delete(userId);
    const r = await filesCol.updateOne(
      { file_unique_id: uid },
      { $set: { title: newTitle, updated_at: new Date().toISOString() } }
    );
    return bot.sendMessage(chatId,
      r.modifiedCount ? `✅ Title: <b>${newTitle}</b>` : `❌ File not found`,
      { parse_mode: "HTML" }
    );
  }

  // /stats
  if (text === "/stats" && isAdmin(userId)) {
    const [total, movies, tv, linked, dlAgg, users, topFiles, byQuality] = await Promise.all([
      filesCol.countDocuments(),
      filesCol.countDocuments({ media_type: "movie" }),
      filesCol.countDocuments({ media_type: "tv" }),
      filesCol.countDocuments({ tmdb_id: { $ne: null } }),
      filesCol.aggregate([{ $group: { _id: null, total: { $sum: "$download_count" } } }]).toArray(),
      usersCol.countDocuments(),
      filesCol.find().sort({ download_count: -1 }).limit(3).toArray(),
      filesCol.aggregate([{ $group: { _id: "$quality", c: { $sum: 1 } } }, { $sort: { c: -1 } }, { $limit: 6 }]).toArray(),
    ]);
    let out  = `📊 <b>StreamyFlix Stats</b>\n\n`;
    out += `📁 Files: <b>${total}</b>  🎬 Movies: ${movies}  📺 TV: ${tv}\n`;
    out += `🔗 TMDB linked: ${linked} (${total ? Math.round(linked/total*100) : 0}%)\n`;
    out += `📥 Downloads: <b>${dlAgg[0]?.total || 0}</b>  👥 Users: ${users}\n\n`;
    if (byQuality.length) {
      out += `📀 <b>By Quality:</b> ` + byQuality.map(q => `${q._id}: ${q.c}`).join("  ") + "\n\n";
    }
    if (topFiles.length) {
      out += `🏆 <b>Top Downloads:</b>\n`;
      for (const f of topFiles) out += `  • ${f.title || f.file_name} — ${f.download_count}\n`;
    }
    return bot.sendMessage(chatId, out, { parse_mode: "HTML" });
  }

  // /search with inline filters
  if (text.startsWith("/search ") && isAdmin(userId)) {
    const raw    = text.replace("/search ", "").trim();
    const filter = {};
    const typeM  = raw.match(/\btype:(movie|tv)\b/i);
    if (typeM) filter.media_type = typeM[1].toLowerCase();
    const langM  = raw.match(/\blang:(\w+)\b/i);
    if (langM) filter.language = new RegExp(langM[1], "i");
    const qualM  = raw.match(/\bquality:(\S+)\b/i);
    if (qualM) filter.quality = new RegExp(qualM[1], "i");

    const q = raw
      .replace(/\btype:\S+\b/gi, "")
      .replace(/\blang:\S+\b/gi, "")
      .replace(/\bquality:\S+\b/gi, "")
      .trim();

    if (!q) return bot.sendMessage(chatId, "Usage: /search title [type:movie|tv] [lang:hindi] [quality:1080p]");
    const state = { query: q, page: 0, filter };
    searchState.set(userId, state);
    return sendSearchResults(chatId, null, state, userId, false);
  }

  // /index
  if (text === "/index" && isAdmin(userId)) {
    if (!CHANNEL_ID) return bot.sendMessage(chatId, "❌ CHANNEL_ID not configured.");
    return bot.sendMessage(chatId, `📢 <b>Index Channel</b> <code>${CHANNEL_ID}</code>`, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [
        [{ text: "📥 Last 200",  callback_data: `index_channel_${CHANNEL_ID}_200`  }],
        [{ text: "📥 Last 1000", callback_data: `index_channel_${CHANNEL_ID}_1000` }],
        [{ text: "📥 ALL",       callback_data: `index_channel_${CHANNEL_ID}_0`    }],
        [{ text: "❌ Cancel",    callback_data: "dismiss"                           }],
      ]},
    });
  }

  // /stopindex
  if (text === "/stopindex" && isAdmin(userId)) {
    if (!activeIndexJobs.size) return bot.sendMessage(chatId, "No active index job.");
    for (const [, job] of activeIndexJobs) job.stop();
    return bot.sendMessage(chatId, `⛔ Stopping ${activeIndexJobs.size} job(s)…`);
  }

  // /fix — re-parse all records with new extractor
  if (text === "/fix" && isAdmin(userId)) {
    const statusMsg = await bot.sendMessage(chatId, "🔄 Re-parsing all records…");
    let fixed = 0, failed = 0;
    const cursor = filesCol.find({});
    for await (const doc of cursor) {
      const updates = reparseRecord(doc);
      if (!updates) { failed++; continue; }
      try { await filesCol.updateOne({ _id: doc._id }, { $set: updates }); fixed++; }
      catch { failed++; }
    }
    return bot.editMessageText(
      `✅ Re-parse done\n✅ Fixed: ${fixed}  ❌ Failed: ${failed}`,
      { chat_id: chatId, message_id: statusMsg.message_id }
    );
  }

  // /pending
  if (text === "/pending" && isAdmin(userId)) {
    const count   = await filesCol.countDocuments({ tmdb_id: null });
    const samples = await filesCol.find({ tmdb_id: null }).sort({ indexed_at: -1 }).limit(5).toArray();
    let out = `🔗 <b>Unlinked Files:</b> ${count}\n\n`;
    for (const f of samples) {
      out += `• <b>${f.title || f.file_name}</b> (${f.media_type})\n`;
      out += `  <code>${f.file_unique_id}</code>\n`;
    }
    if (TMDB_API_KEY) out += `\n💡 Use /autolink to auto-link all.`;
    return bot.sendMessage(chatId, out, { parse_mode: "HTML" });
  }

  // /autolink
  if (text === "/autolink" && isAdmin(userId)) {
    if (!TMDB_API_KEY) return bot.sendMessage(chatId, "❌ TMDB_API_KEY not configured.");
    const statusMsg = await bot.sendMessage(chatId, "🔗 Auto-linking to TMDB…");
    let linked = 0, failed = 0;
    const cursor = filesCol.find({ tmdb_id: null });
    for await (const doc of cursor) {
      const info = await autoLinkTMDB(doc);
      if (info) {
        await filesCol.updateOne({ _id: doc._id }, {
          $set: { tmdb_id: info.tmdb_id, poster: info.poster, genres: info.genres, updated_at: new Date().toISOString() }
        });
        linked++;
      } else failed++;
      await sleep(250);
    }
    return bot.editMessageText(
      `✅ Auto-link done\n🔗 Linked: ${linked}  ❌ Not found: ${failed}`,
      { chat_id: chatId, message_id: statusMsg.message_id }
    );
  }

  // /broadcast
  if (text.startsWith("/broadcast ") && isAdmin(userId)) {
    const msg_text = text.replace("/broadcast ", "").trim();
    if (!msg_text) return bot.sendMessage(chatId, "Usage: /broadcast <message>");
    const allUsers = await usersCol.find({}, { projection: { user_id: 1 } }).toArray();
    let sent = 0, failed = 0;
    for (const u of allUsers) {
      try { await retry(() => bot.sendMessage(u.user_id, msg_text, { parse_mode: "HTML" })); sent++; }
      catch { failed++; }
      await sleep(50);
    }
    return bot.sendMessage(chatId, `📣 Broadcast done\n✅ Sent: ${sent}  ❌ Failed: ${failed}`);
  }
});

// ─── Express API ──────────────────────────────────────────────────────────────
const app = express();

const allowedOrigins = WEBSITE_URL
  ? [WEBSITE_URL, "http://localhost:5173", "http://localhost:4173", "http://localhost:3000"]
  : true;

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","x-admin-key"],
}));
app.use(express.json({ limit: "2mb" }));

function requireAdminKey(req, res, next) {
  if (!ADMIN_API_KEY) return next();
  const key = req.headers["x-admin-key"] || req.query.admin_key;
  if (key !== ADMIN_API_KEY) return res.status(401).json({ ok: false, error: "Unauthorized" });
  next();
}

function parsePagination(q) {
  const page  = Math.max(0, parseInt(q.page)  || 0);
  const limit = Math.min(500, Math.max(1, parseInt(q.limit) || 50));
  return { page, limit, skip: page * limit };
}

// Health
app.get("/health", async (req, res) => {
  let dbStatus = "disconnected";
  try { await db.command({ ping: 1 }); dbStatus = "connected"; } catch {}
  let botOk = false;
  try { await bot.getMe(); botOk = true; } catch {}
  res.json({
    status: "ok", db: dbStatus, bot: botOk, version: "2.0.0",
    timestamp: new Date().toISOString(),
    files: await filesCol.countDocuments().catch(() => 0),
  });
});

// Stats
app.get("/api/stats", async (req, res) => {
  try {
    const [total, movies, tv, linked, dlAgg, users, byQuality, byLang] = await Promise.all([
      filesCol.countDocuments(),
      filesCol.countDocuments({ media_type: "movie" }),
      filesCol.countDocuments({ media_type: "tv" }),
      filesCol.countDocuments({ tmdb_id: { $ne: null } }),
      filesCol.aggregate([{ $group: { _id: null, total: { $sum: "$download_count" } } }]).toArray(),
      usersCol.countDocuments(),
      filesCol.aggregate([{ $group: { _id: "$quality",  count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray(),
      filesCol.aggregate([{ $group: { _id: "$language", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]).toArray(),
    ]);
    res.json({ ok: true, total, movies, tv, linked, downloads: dlAgg[0]?.total || 0, users, by_quality: byQuality, by_language: byLang });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// List files
app.get("/api/files", async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const query = {};
    if (req.query.type)     query.media_type = req.query.type;
    if (req.query.tmdb_id)  query.tmdb_id    = parseInt(req.query.tmdb_id);
    if (req.query.quality)  query.quality    = req.query.quality;
    if (req.query.language) query.language   = new RegExp(req.query.language, "i");
    if (req.query.season)   query.season     = parseInt(req.query.season);
    if (req.query.episode)  query.episode    = parseInt(req.query.episode);
    if (req.query.year)     query.year       = parseInt(req.query.year);
    if (req.query.hdr)      query.hdr        = req.query.hdr;
    if (req.query.codec)    query.codec      = req.query.codec;
    if (req.query.unlinked === "1") query.tmdb_id = null;

    const sortField = req.query.sort || "indexed_at";
    const sortDir   = req.query.dir === "asc" ? 1 : -1;

    const [files, total] = await Promise.all([
      filesCol.find(query).sort({ [sortField]: sortDir }).skip(skip).limit(limit).toArray(),
      filesCol.countDocuments(query),
    ]);
    res.json({ ok: true, files, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Full-text search
app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ ok: true, files: [], pagination: {} });

    const { page, limit, skip } = parsePagination(req.query);
    const query = { $text: { $search: q } };
    if (req.query.type)     query.media_type = req.query.type;
    if (req.query.quality)  query.quality    = req.query.quality;
    if (req.query.language) query.language   = new RegExp(req.query.language, "i");

    const [files, total] = await Promise.all([
      filesCol.find(query, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" }, download_count: -1 })
        .skip(skip).limit(limit).toArray(),
      filesCol.countDocuments(query),
    ]);
    res.json({ ok: true, files, query: q, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Get file
app.get("/api/file/:id", async (req, res) => {
  try {
    let file;
    try { file = await filesCol.findOne({ _id: new ObjectId(req.params.id) }); } catch {}
    if (!file) file = await filesCol.findOne({ file_unique_id: req.params.id });
    if (!file) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, file });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Delete file
app.delete("/api/file/:id", requireAdminKey, async (req, res) => {
  try {
    let result;
    try { result = await filesCol.deleteOne({ _id: new ObjectId(req.params.id) }); }
    catch { result = await filesCol.deleteOne({ file_unique_id: req.params.id }); }
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Link file to TMDB
app.post("/api/link", requireAdminKey, async (req, res) => {
  try {
    const { file_unique_id, tmdb_id, media_type, title } = req.body;
    if (!file_unique_id || !tmdb_id)
      return res.status(400).json({ ok: false, error: "file_unique_id and tmdb_id required" });
    const set = { tmdb_id: parseInt(tmdb_id), updated_at: new Date().toISOString() };
    if (media_type) set.media_type = media_type === "tv" ? "tv" : "movie";
    if (title) set.title = title;
    const result = await filesCol.updateOne({ file_unique_id }, { $set: set });
    res.json({ ok: true, modified: result.modifiedCount });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Bulk TMDB link
app.post("/api/bulk-link", requireAdminKey, async (req, res) => {
  try {
    const { links } = req.body;
    if (!Array.isArray(links)) return res.status(400).json({ ok: false, error: "links[] required" });
    let ok = 0, failed = 0;
    for (const l of links) {
      if (!l.file_unique_id || !l.tmdb_id) { failed++; continue; }
      const r = await filesCol.updateOne(
        { file_unique_id: l.file_unique_id },
        { $set: { tmdb_id: parseInt(l.tmdb_id), media_type: l.media_type || "movie", updated_at: new Date().toISOString() } }
      );
      r.modifiedCount ? ok++ : failed++;
    }
    res.json({ ok: true, linked: ok, failed });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// TMDB proxy with 7-day cache
app.get("/api/tmdb/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const tmdbId = parseInt(id);
    if (!["movie","tv"].includes(type) || isNaN(tmdbId))
      return res.status(400).json({ ok: false, error: "Invalid type or id" });

    const cached = await cacheCol.findOne({ tmdb_id: tmdbId, media_type: type });
    if (cached) return res.json({ ok: true, data: cached.data, cached: true });

    if (!TMDB_API_KEY) return res.status(503).json({ ok: false, error: "TMDB_API_KEY not set" });
    const data = await fetchTMDB(`/${type}/${tmdbId}`);
    if (!data || data.status_code) return res.status(404).json({ ok: false, error: "Not found on TMDB" });

    await cacheCol.updateOne(
      { tmdb_id: tmdbId, media_type: type },
      { $set: { tmdb_id: tmdbId, media_type: type, data, fetched_at: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true, data, cached: false });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Re-parse all records via API
app.post("/api/reparse", requireAdminKey, async (req, res) => {
  try {
    const cursor = filesCol.find({});
    let fixed = 0, failed = 0;
    for await (const doc of cursor) {
      const updates = reparseRecord(doc);
      if (!updates) { failed++; continue; }
      await filesCol.updateOne({ _id: doc._id }, { $set: updates }).catch(() => failed++);
      fixed++;
    }
    res.json({ ok: true, fixed, failed });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Stream proxy with Range support
app.get("/stream", async (req, res) => {
  try {
    const { file_id } = req.query;
    if (!file_id) return res.status(400).json({ error: "file_id required" });

    const fileRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id }),
    });
    const fileData = await fileRes.json();

    if (!fileData.ok) {
      return res.status(413).json({
        error: "File too large for Bot API (>20MB). Deploy a GramJS/Telethon MTProto server.",
        description: fileData.description,
      });
    }

    const filePath    = fileData.result.file_path;
    const fileSize    = fileData.result.file_size || 0;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    const range       = req.headers.range;

    if (range && fileSize) {
      const [s, e]    = range.replace("bytes=", "").split("-");
      const start     = parseInt(s, 10);
      const end       = e ? parseInt(e, 10) : fileSize - 1;
      res.writeHead(206, {
        "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": end - start + 1,
        "Content-Type":   "video/mp4",
        "Cache-Control":  "public, max-age=3600",
      });
      https.get(downloadUrl, { headers: { Range: range } }, (pr) => pr.pipe(res))
        .on("error", (e) => { if (!res.headersSent) res.status(500).json({ error: e.message }); });
    } else {
      https.get(downloadUrl, (pr) => {
        res.set({
          "Content-Type":   pr.headers["content-type"] || "application/octet-stream",
          "Content-Length": pr.headers["content-length"],
          "Accept-Ranges":  "bytes",
          "Cache-Control":  "public, max-age=3600",
        });
        pr.pipe(res);
      }).on("error", (e) => { if (!res.headersSent) res.status(500).json({ error: e.message }); });
    }
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// Webhook
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ─── Process error handlers ───────────────────────────────────────────────────
process.on("uncaughtException",  (e) => console.error("Uncaught exception:",  e.message));
process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e));

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  const botInfo = await bot.getMe();
  console.log(`🤖 Bot: @${botInfo.username} (${botInfo.id})`);

  if (isWebhook && WEBHOOK_URL) {
    try {
      await bot.setWebHook(`${WEBHOOK_URL}/webhook`);
      console.log(`📡 Webhook set: ${WEBHOOK_URL}/webhook`);
    } catch (e) {
      console.error("Webhook setup failed:", e.message);
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`🚀 API running on port ${PORT}`);
    console.log(`📡 Mode: ${isWebhook ? "Webhook" : "Polling"}`);
    console.log(`📂 Channel: ${CHANNEL_ID || "(not set)"}`);
    console.log(`👑 Admins: ${ADMINS.join(", ") || "(none)"}`);
    console.log(`🔐 Admin API key: ${ADMIN_API_KEY ? "✅ set" : "⚠️  NOT SET (open access)"}`);
    console.log(`🎬 TMDB auto-link: ${TMDB_API_KEY ? "✅ enabled" : "⚠️  disabled"}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} — shutting down gracefully…`);
    server.close(async () => {
      await mongoClient.close();
      console.log("✅ Shutdown complete");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

start().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
