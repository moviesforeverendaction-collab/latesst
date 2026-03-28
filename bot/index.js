/**
 * StreamyFlix Bot — Fixed Production Build
 * Fixes: CORS config, admin auth on API, proper range-request streaming,
 *        webhook URL setter, missing /api/stats, graceful shutdown
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const TelegramBot = require("node-telegram-bot-api");
const https = require("https");
const http = require("http");

// ─── Config ──────────────────────────────────────────────────────────────────
const {
  BOT_TOKEN,
  CHANNEL_ID,
  ADMIN_USER_IDS = "",
  MONGO_URI,
  MONGO_DB = "streamyflix",
  MONGO_COLLECTION = "files",
  PORT = 3001,
  WEBSITE_URL = "",
  WEBHOOK_URL = "",
  ADMIN_API_KEY = "",        // NEW: secret key for protecting admin API routes
  FORCE_SUB_LINK = "",
} = process.env;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is required");
if (!MONGO_URI) throw new Error("MONGO_URI is required");

const ADMINS = ADMIN_USER_IDS.split(",").map(Number).filter(Boolean);

// ─── MongoDB ─────────────────────────────────────────────────────────────────
let db, filesCol;
const mongoClient = new MongoClient(MONGO_URI);

async function connectDB() {
  await mongoClient.connect();
  db = mongoClient.db(MONGO_DB);
  filesCol = db.collection(MONGO_COLLECTION);
  await filesCol.createIndex({ file_unique_id: 1 }, { unique: true });
  await filesCol.createIndex({ tmdb_id: 1 });
  await filesCol.createIndex({ media_type: 1 });
  await filesCol.createIndex({ file_name: "text", title: "text" });
  console.log(`✅ MongoDB connected: ${MONGO_DB}.${MONGO_COLLECTION}`);
}

// ─── Telegram Bot ─────────────────────────────────────────────────────────────
const isWebhook = !!WEBHOOK_URL;
const bot = new TelegramBot(BOT_TOKEN, { polling: !isWebhook });

function isAdmin(userId) {
  return ADMINS.includes(userId);
}

// ─── File Extraction Helper ───────────────────────────────────────────────────
function extractFileInfo(msg) {
  let fileObj = null, fileType = "unknown";
  if (msg.document)  { fileObj = msg.document;  fileType = "document"; }
  else if (msg.video)     { fileObj = msg.video;     fileType = "video"; }
  else if (msg.audio)     { fileObj = msg.audio;     fileType = "audio"; }
  else if (msg.animation) { fileObj = msg.animation; fileType = "animation"; }
  if (!fileObj) return null;

  const fileName = fileObj.file_name || msg.caption || "Untitled";

  let quality = "Unknown";
  if (/2160p|4k|uhd/i.test(fileName))  quality = "4K UHD";
  else if (/1080p/i.test(fileName))    quality = "1080p HD";
  else if (/720p/i.test(fileName))     quality = "720p HD";
  else if (/480p/i.test(fileName))     quality = "480p SD";
  else if (/360p/i.test(fileName))     quality = "360p";

  let language = "Unknown";
  const langMap = {
    english: "English", hindi: "Hindi", tamil: "Tamil", telugu: "Telugu",
    malayalam: "Malayalam", kannada: "Kannada", spanish: "Spanish",
    french: "French", korean: "Korean", japanese: "Japanese",
    dual: "Dual Audio", multi: "Multi Audio",
  };
  for (const [key, val] of Object.entries(langMap)) {
    if (new RegExp(key, "i").test(fileName)) { language = val; break; }
  }

  let season = null, episode = null;
  const seMatch = fileName.match(/S(\d{1,3})E(\d{1,4})/i);
  if (seMatch) { season = parseInt(seMatch[1]); episode = parseInt(seMatch[2]); }
  else {
    const sMatch = fileName.match(/Season\s*(\d{1,3})/i);
    if (sMatch) season = parseInt(sMatch[1]);
  }

  let media_type = (season !== null || /series|S\d{1,3}/i.test(fileName)) ? "tv" : "movie";

  let title = fileName
    .replace(/\.(mkv|mp4|avi|mov|webm|flv|wmv|ts|m4v)$/i, "")
    .replace(/[\[\(].*?[\]\)]/g, "")
    .replace(/\d{3,4}p.*$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    file_id: fileObj.file_id,
    file_unique_id: fileObj.file_unique_id,
    file_name: fileName,
    file_size: fileObj.file_size || 0,
    mime_type: fileObj.mime_type || "application/octet-stream",
    duration: fileObj.duration || null,
    message_id: msg.message_id,
    channel_id: String(msg.chat.id),
    tmdb_id: null,
    media_type,
    title,
    quality,
    language,
    season,
    episode,
    file_type: fileType,
    indexed_at: new Date().toISOString(),
    download_count: 0,
    thumb: fileObj.thumb?.file_id || fileObj.thumbnail?.file_id || null,
  };
}

async function indexFile(fileInfo) {
  try {
    const result = await filesCol.updateOne(
      { file_unique_id: fileInfo.file_unique_id },
      { $set: fileInfo },
      { upsert: true }
    );
    return { ok: true, upserted: !!result.upsertedId };
  } catch (e) {
    console.error("Index error:", e.message);
    return { ok: false, error: e.message };
  }
}

// ─── Bot: /start ──────────────────────────────────────────────────────────────
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const param = (match[1] || "").trim();

  if (param.startsWith("dl_")) {
    const parts = param.replace("dl_", "").split("_");

    if (CHANNEL_ID) {
      try {
        const member = await bot.getChatMember(CHANNEL_ID, userId);
        if (!["member", "administrator", "creator"].includes(member.status)) {
          const channelLink = FORCE_SUB_LINK || `https://t.me/${CHANNEL_ID.replace("-100", "")}`;
          return bot.sendMessage(chatId,
            `⚠️ <b>Please join our channel first!</b>\n\nYou must be a member of our channel to download files.\n\n👉 <a href="${channelLink}">Join Channel</a>\n\nThen try again: /start ${param}`,
            { parse_mode: "HTML", disable_web_page_preview: true }
          );
        }
      } catch (e) {
        console.log("Force-sub check failed:", e.message);
      }
    }

    let query = {};
    if (parts[0] === "movie" || parts[0] === "tv") {
      const tmdbId = parseInt(parts[1]);
      if (!isNaN(tmdbId)) {
        query = { tmdb_id: tmdbId, media_type: parts[0] };
        if (parts.length > 2) {
          const extra = parts.slice(2);
          const sIdx = extra.findIndex(p => p.startsWith("s") && !isNaN(parseInt(p.slice(1))));
          if (sIdx !== -1) {
            query.season = parseInt(extra[sIdx].slice(1));
            const eIdx = extra.findIndex(p => p.startsWith("e") && !isNaN(parseInt(p.slice(1))));
            if (eIdx !== -1) query.episode = parseInt(extra[eIdx].slice(1));
          }
        }
      }
    }

    const files = await filesCol.find(query).sort({ quality: -1 }).limit(10).toArray();

    if (files.length === 0) {
      return bot.sendMessage(chatId,
        `❌ <b>File not found</b>\n\nThe requested content isn't available yet.\n\n🔍 Try searching on our website.`,
        { parse_mode: "HTML" }
      );
    }

    for (const file of files) {
      try {
        const caption =
          `🎬 <b>${file.title || file.file_name}</b>\n` +
          `📀 Quality: ${file.quality}\n` +
          `🌐 Language: ${file.language}\n` +
          `📦 Size: ${file.file_size ? (file.file_size / 1024 / 1024 / 1024).toFixed(2) + " GB" : "Unknown"}\n` +
          (file.season ? `📺 Season ${file.season}${file.episode ? ` Episode ${file.episode}` : ""}` : "");

        if (file.mime_type?.startsWith("video/")) {
          await bot.sendVideo(chatId, file.file_id, { caption, parse_mode: "HTML", supports_streaming: true });
        } else {
          await bot.sendDocument(chatId, file.file_id, { caption, parse_mode: "HTML" });
        }
        await filesCol.updateOne({ file_unique_id: file.file_unique_id }, { $inc: { download_count: 1 } });
      } catch (e) {
        console.error("Send file error:", e.message);
        await bot.sendMessage(chatId, `❌ Error sending file: ${e.message}`);
      }
    }
    return;
  }

  const botInfo = await bot.getMe();
  const welcomeText =
    `🎬 <b>Welcome to ${botInfo.first_name}!</b>\n\n` +
    `I can help you download movies, series, and anime directly to your Telegram.\n\n` +
    `<b>How to use:</b>\n` +
    `• Visit our website and click Download on any movie\n` +
    `• I'll send you the file directly here\n\n` +
    (isAdmin(userId)
      ? `⚡ <b>Admin commands:</b>\n/stats — Statistics\n/index — Index channel\n/search — Search files\n\n`
      : "") +
    (WEBSITE_URL ? `🌐 <a href="${WEBSITE_URL}">Visit Website</a>` : "");

  bot.sendMessage(chatId, welcomeText, {
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
async function handleFile(msg) {
  const fileInfo = extractFileInfo(msg);
  if (!fileInfo) return;
  const result = await indexFile(fileInfo);
  if (msg.chat.type === "private") {
    if (result.ok) {
      bot.sendMessage(msg.chat.id,
        `✅ <b>File Indexed!</b>\n\n📄 <b>${fileInfo.file_name}</b>\n📀 ${fileInfo.quality} • ${fileInfo.language}\n📦 ${fileInfo.file_size ? (fileInfo.file_size/1073741824).toFixed(2)+" GB" : "Unknown"}\n🏷️ ${fileInfo.media_type}${fileInfo.season ? ` • S${fileInfo.season}${fileInfo.episode?`E${fileInfo.episode}`:""}` : ""}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📝 Edit Title", callback_data: `edit_title_${fileInfo.file_unique_id}` }],
              [{ text: "🔗 Link to TMDB", callback_data: `link_tmdb_${fileInfo.file_unique_id}` }],
            ],
          },
        }
      );
    } else {
      bot.sendMessage(msg.chat.id, `❌ Index failed: ${result.error}`);
    }
  }
}

bot.on("document", handleFile);
bot.on("video", handleFile);
bot.on("audio", handleFile);

bot.on("channel_post", async (msg) => {
  if (CHANNEL_ID && String(msg.chat.id) === String(CHANNEL_ID)) {
    await handleFile(msg);
  }
});

bot.on("message", async (msg) => {
  if (msg.chat.type !== "private") return;
  if (!isAdmin(msg.from.id)) return;

  if (msg.forward_from_chat && msg.forward_from_chat.type === "channel") {
    const fromChannel = msg.forward_from_chat;
    if (msg.document || msg.video || msg.audio) await handleFile(msg);
    bot.sendMessage(msg.chat.id,
      `📢 <b>Channel Detected!</b>\n\nForwarded from: <b>${fromChannel.title}</b>\nID: <code>${fromChannel.id}</code>\n\nIndex ALL files from this channel?`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Yes, Index All", callback_data: `index_channel_${fromChannel.id}` },
            { text: "❌ No", callback_data: "dismiss" },
          ]],
        },
      }
    );
  }
});

// ─── Bot: Callbacks ───────────────────────────────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  if (data === "dismiss") {
    await bot.answerCallbackQuery(query.id, { text: "Dismissed" });
    return bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
  }

  if (data.startsWith("index_channel_")) {
    if (!isAdmin(userId)) return bot.answerCallbackQuery(query.id, { text: "❌ Admin only", show_alert: true });
    const channelId = data.replace("index_channel_", "");
    await bot.answerCallbackQuery(query.id, { text: "🔄 Starting..." });
    await bot.editMessageText(`⏳ <b>Indexing</b> <code>${channelId}</code>…\n\nThis may take a while.`,
      { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" }
    );

    let indexed = 0, skipped = 0, errors = 0, maxId = 0;
    try {
      const testMsg = await bot.sendMessage(channelId, "🔄 Indexing…");
      maxId = testMsg.message_id;
      await bot.deleteMessage(channelId, testMsg.message_id);
    } catch (e) {
      return bot.editMessageText(
        `❌ Cannot access channel <code>${channelId}</code>\n\nMake sure bot is admin with Post permission.\n\n${e.message}`,
        { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" }
      );
    }

    const startFrom = Math.max(1, maxId - 500);
    for (let msgId = maxId; msgId >= startFrom; msgId--) {
      try {
        const forwarded = await bot.forwardMessage(chatId, channelId, msgId);
        if (forwarded.document || forwarded.video || forwarded.audio) {
          const fi = extractFileInfo(forwarded);
          if (fi) {
            fi.channel_id = channelId;
            fi.message_id = msgId;
            const r = await indexFile(fi);
            if (r.ok) indexed++; else errors++;
          }
        } else skipped++;
        await bot.deleteMessage(chatId, forwarded.message_id).catch(() => {});
        if (msgId % 20 === 0) {
          await new Promise(r => setTimeout(r, 1000));
          await bot.editMessageText(
            `⏳ <b>Indexing…</b>\n\n📊 ${maxId - msgId}/${maxId - startFrom} scanned\n✅ ${indexed} indexed • ⏭️ ${skipped} skipped • ❌ ${errors} errors`,
            { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" }
          ).catch(() => {});
        }
      } catch { skipped++; }
    }

    return bot.editMessageText(
      `✅ <b>Done!</b>\n\n✅ Indexed: <b>${indexed}</b>\n⏭️ Skipped: ${skipped}\n❌ Errors: ${errors}`,
      { chat_id: chatId, message_id: query.message.message_id, parse_mode: "HTML" }
    );
  }

  if (data.startsWith("link_tmdb_")) {
    const fileUniqueId = data.replace("link_tmdb_", "");
    await bot.answerCallbackQuery(query.id, { text: "Send TMDB ID" });
    await bot.sendMessage(chatId, `🔗 <b>Link to TMDB</b>\n\nSend: <code>tmdb MOVIE 550</code> or <code>tmdb TV 1399</code>`, { parse_mode: "HTML" });
    if (!global._pendingLinks) global._pendingLinks = {};
    global._pendingLinks[userId] = fileUniqueId;
    return;
  }

  if (data.startsWith("edit_title_")) {
    const fileUniqueId = data.replace("edit_title_", "");
    await bot.answerCallbackQuery(query.id, { text: "Send new title" });
    await bot.sendMessage(chatId, `📝 <b>Edit Title</b>\n\nSend: <code>title Your New Title Here</code>`, { parse_mode: "HTML" });
    if (!global._pendingTitles) global._pendingTitles = {};
    global._pendingTitles[userId] = fileUniqueId;
    return;
  }

  await bot.answerCallbackQuery(query.id);
});

// ─── Bot: Text commands ───────────────────────────────────────────────────────
bot.on("message", async (msg) => {
  if (msg.chat.type !== "private" || !msg.text) return;
  const text = msg.text.trim();
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (text.toLowerCase().startsWith("tmdb ") && global._pendingLinks?.[userId]) {
    const parts = text.split(/\s+/);
    const mediaType = parts[1]?.toLowerCase();
    const tmdbId = parseInt(parts[2]);
    if (!mediaType || !tmdbId) return bot.sendMessage(chatId, "❌ Format: <code>tmdb MOVIE 550</code>", { parse_mode: "HTML" });
    const fileUniqueId = global._pendingLinks[userId];
    delete global._pendingLinks[userId];
    const result = await filesCol.updateOne(
      { file_unique_id: fileUniqueId },
      { $set: { tmdb_id: tmdbId, media_type: mediaType === "tv" ? "tv" : "movie" } }
    );
    bot.sendMessage(chatId, result.modifiedCount ? `✅ Linked to TMDB <b>${tmdbId}</b> (${mediaType})` : `❌ File not found`, { parse_mode: "HTML" });
    return;
  }

  if (text.toLowerCase().startsWith("title ") && global._pendingTitles?.[userId]) {
    const newTitle = text.replace(/^title\s+/i, "").trim();
    const fileUniqueId = global._pendingTitles[userId];
    delete global._pendingTitles[userId];
    const result = await filesCol.updateOne({ file_unique_id: fileUniqueId }, { $set: { title: newTitle } });
    bot.sendMessage(chatId, result.modifiedCount ? `✅ Title updated: <b>${newTitle}</b>` : `❌ File not found`, { parse_mode: "HTML" });
    return;
  }

  if (text === "/stats" && isAdmin(userId)) {
    const total = await filesCol.countDocuments();
    const movies = await filesCol.countDocuments({ media_type: "movie" });
    const tv = await filesCol.countDocuments({ media_type: "tv" });
    const linked = await filesCol.countDocuments({ tmdb_id: { $ne: null } });
    const dlAgg = await filesCol.aggregate([{ $group: { _id: null, total: { $sum: "$download_count" } } }]).toArray();
    bot.sendMessage(chatId,
      `📊 <b>Stats</b>\n\n📁 Total: <b>${total}</b>\n🎬 Movies: ${movies}\n📺 TV: ${tv}\n🔗 TMDB Linked: ${linked}\n📥 Downloads: ${dlAgg[0]?.total || 0}`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (text.startsWith("/search ")) {
    const q = text.replace("/search ", "").trim();
    if (!q) return bot.sendMessage(chatId, "Usage: /search <movie name>");
    const results = await filesCol.find({ $text: { $search: q } }, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" } }).limit(10).toArray();
    if (!results.length) return bot.sendMessage(chatId, `🔍 No results for "${q}"`);
    let out = `🔍 <b>Results for "${q}"</b>\n\n`;
    for (const f of results) {
      const gb = f.file_size ? (f.file_size/1073741824).toFixed(2)+" GB" : "?";
      out += `📄 <b>${f.title || f.file_name}</b>\n   ${f.quality} • ${f.language} • ${gb}\n\n`;
    }
    bot.sendMessage(chatId, out, { parse_mode: "HTML" });
    return;
  }

  if (text === "/index" && isAdmin(userId)) {
    if (!CHANNEL_ID) return bot.sendMessage(chatId, "❌ CHANNEL_ID not configured.");
    bot.sendMessage(chatId,
      `📢 <b>Re-index Channel</b>\n\nChannel: <code>${CHANNEL_ID}</code>\n\nScan last 500 messages?`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[
          { text: "✅ Start", callback_data: `index_channel_${CHANNEL_ID}` },
          { text: "❌ Cancel", callback_data: "dismiss" },
        ]]},
      }
    );
    return;
  }
});

// ─── Express API ──────────────────────────────────────────────────────────────
const app = express();

// FIXED: Dynamic CORS — allow configured website or any origin in dev
const allowedOrigins = WEBSITE_URL
  ? [WEBSITE_URL, "http://localhost:5173", "http://localhost:4173"]
  : true; // dev: allow all

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-admin-key"],
}));
app.use(express.json({ limit: "1mb" }));

// FIXED: Admin API key middleware for mutating endpoints
function requireAdminKey(req, res, next) {
  if (!ADMIN_API_KEY) return next(); // No key set — open (dev mode)
  const key = req.headers["x-admin-key"] || req.query.admin_key;
  if (key !== ADMIN_API_KEY) {
    return res.status(401).json({ ok: false, error: "Unauthorized: invalid admin key" });
  }
  next();
}

// Health check (public)
app.get("/health", async (req, res) => {
  let dbStatus = "disconnected";
  try { await db.command({ ping: 1 }); dbStatus = "connected"; } catch { dbStatus = "error"; }
  let botOk = false;
  try { await bot.getMe(); botOk = true; } catch {}
  res.json({
    status: "ok",
    db: dbStatus,
    bot: botOk,
    timestamp: new Date().toISOString(),
    files: await filesCol.countDocuments().catch(() => 0),
  });
});

// Stats (public)
app.get("/api/stats", async (req, res) => {
  try {
    const total = await filesCol.countDocuments();
    const movies = await filesCol.countDocuments({ media_type: "movie" });
    const tv = await filesCol.countDocuments({ media_type: "tv" });
    const linked = await filesCol.countDocuments({ tmdb_id: { $ne: null } });
    const dlAgg = await filesCol.aggregate([{ $group: { _id: null, total: { $sum: "$download_count" } } }]).toArray();
    res.json({ ok: true, total, movies, tv, linked, downloads: dlAgg[0]?.total || 0 });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// List files (public)
app.get("/api/files", async (req, res) => {
  try {
    const query = {};
    if (req.query.type) query.media_type = req.query.type;
    if (req.query.tmdb_id) query.tmdb_id = parseInt(req.query.tmdb_id);
    if (req.query.quality) query.quality = req.query.quality;
    const files = await filesCol.find(query)
      .sort({ indexed_at: -1 })
      .limit(parseInt(req.query.limit) || 200)
      .toArray();
    res.json({ ok: true, files, count: files.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Search (public)
app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json({ ok: true, files: [] });
    const files = await filesCol.find(
      { $text: { $search: q } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } }).limit(50).toArray();
    res.json({ ok: true, files, count: files.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// FIXED: Link file to TMDB — protected with admin key
app.post("/api/link", requireAdminKey, async (req, res) => {
  try {
    const { file_unique_id, tmdb_id, media_type, title } = req.body;
    if (!file_unique_id || !tmdb_id)
      return res.status(400).json({ ok: false, error: "file_unique_id and tmdb_id required" });
    const result = await filesCol.updateOne(
      { file_unique_id },
      { $set: { tmdb_id: parseInt(tmdb_id), media_type: media_type || "movie", ...(title ? { title } : {}) } }
    );
    res.json({ ok: true, modified: result.modifiedCount });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Get file by ID (public)
app.get("/api/file/:id", async (req, res) => {
  try {
    let file;
    try { file = await filesCol.findOne({ _id: new ObjectId(req.params.id) }); } catch {}
    if (!file) file = await filesCol.findOne({ file_unique_id: req.params.id });
    if (!file) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, file });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// FIXED: Delete — protected
app.delete("/api/file/:id", requireAdminKey, async (req, res) => {
  try {
    let result;
    try { result = await filesCol.deleteOne({ _id: new ObjectId(req.params.id) }); }
    catch { result = await filesCol.deleteOne({ file_unique_id: req.params.id }); }
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// FIXED: Stream proxy with proper Range request support
app.get("/stream", async (req, res) => {
  try {
    const { file_id } = req.query;
    if (!file_id) return res.status(400).json({ error: "file_id required" });

    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id }),
    });
    const fileData = await fileRes.json();

    if (!fileData.ok) {
      return res.status(413).json({
        error: "File too large for Bot API (>20MB). Deploy a GramJS/Telethon MTProto server for large file streaming.",
        description: fileData.description,
      });
    }

    const filePath = fileData.result.file_path;
    const fileSize = fileData.result.file_size || 0;
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    const range = req.headers.range;
    const protocol = downloadUrl.startsWith("https") ? https : http;

    if (range && fileSize) {
      // FIXED: Handle Range requests for video seeking
      const [startStr, endStr] = range.replace("bytes=", "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=3600",
      });

      const proxyReq = protocol.get(downloadUrl, { headers: { Range: range } }, (proxyRes) => {
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (e) => { if (!res.headersSent) res.status(500).json({ error: e.message }); });
    } else {
      // Full file response
      protocol.get(downloadUrl, (proxyRes) => {
        res.set({
          "Content-Type": proxyRes.headers["content-type"] || "application/octet-stream",
          "Content-Length": proxyRes.headers["content-length"],
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        });
        proxyRes.pipe(res);
      }).on("error", (e) => { res.status(500).json({ error: e.message }); });
    }
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// Webhook endpoint
app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  const botInfo = await bot.getMe();
  console.log(`🤖 Bot: @${botInfo.username} (${botInfo.id})`);

  // Set webhook if configured
  if (isWebhook && WEBHOOK_URL) {
    try {
      const hookUrl = `${WEBHOOK_URL}/webhook`;
      await bot.setWebHook(hookUrl);
      console.log(`📡 Webhook set: ${hookUrl}`);
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
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down gracefully...");
    server.close();
    await mongoClient.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
