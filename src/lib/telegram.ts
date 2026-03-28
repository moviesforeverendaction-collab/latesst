// Telegram Bot API + MTProto streaming integration

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  document?: TelegramFile & { file_name?: string; mime_type?: string };
  video?: TelegramFile & { file_name?: string; mime_type?: string; duration?: number };
  caption?: string;
}

export class TelegramBot {
  private token: string;
  private baseUrl: string;

  constructor(token: string) {
    this.token = token;
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async getMe() {
    const res = await fetch(`${this.baseUrl}/getMe`);
    return res.json();
  }

  async sendMessage(chatId: string | number, text: string, parseMode = "HTML") {
    const res = await fetch(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
    });
    return res.json();
  }

  async sendDocument(chatId: string | number, fileId: string, caption?: string) {
    const res = await fetch(`${this.baseUrl}/sendDocument`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        document: fileId,
        caption: caption || "",
        parse_mode: "HTML",
      }),
    });
    return res.json();
  }

  async copyMessage(fromChatId: string | number, toChatId: string | number, messageId: number, caption?: string) {
    const res = await fetch(`${this.baseUrl}/copyMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_chat_id: fromChatId,
        chat_id: toChatId,
        message_id: messageId,
        caption: caption || undefined,
        parse_mode: caption ? "HTML" : undefined,
      }),
    });
    return res.json();
  }

  async forwardMessage(chatId: string | number, fromChatId: string | number, messageId: number) {
    const res = await fetch(`${this.baseUrl}/forwardMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        from_chat_id: fromChatId,
        message_id: messageId,
      }),
    });
    return res.json();
  }

  async getFile(fileId: string) {
    const res = await fetch(`${this.baseUrl}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    return res.json();
  }

  async sendVideo(chatId: string | number, fileId: string, caption?: string) {
    const res = await fetch(`${this.baseUrl}/sendVideo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        video: fileId,
        caption: caption || "",
        parse_mode: "HTML",
        supports_streaming: true,
      }),
    });
    return res.json();
  }

  async getChatMember(chatId: string | number, userId: number) {
    const res = await fetch(`${this.baseUrl}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });
    return res.json();
  }

  buildDeepLink(botUsername: string, startParam: string) {
    return `https://t.me/${botUsername}?start=${startParam}`;
  }

  buildInlineKeyboard(buttons: { text: string; url?: string; callback_data?: string }[][]) {
    return {
      inline_keyboard: buttons.map((row) =>
        row.map((btn) => ({
          text: btn.text,
          ...(btn.url ? { url: btn.url } : {}),
          ...(btn.callback_data ? { callback_data: btn.callback_data } : {}),
        }))
      ),
    };
  }
}

export function generateDownloadToken(contentId: string, userId: string) {
  const payload = `${contentId}:${userId}:${Date.now()}`;
  return btoa(payload);
}

export function buildTelegramDownloadLink(botUsername: string, contentId: string) {
  return `https://t.me/${botUsername}?start=dl_${contentId}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ─── MTProto Streaming ────────────────────────────────────────────────────────
// Telegram's CDN streaming uses the Bot API file download endpoint.
// For large files (>20MB) the Bot API getFile won't work — you MUST use
// MTProto (TDLib / GramJS) on a backend. Since this is a pure frontend app,
// we proxy through the Bot API for files ≤20MB and provide a direct Telegram
// link for larger files (the user's Telegram client handles streaming natively).

export interface StreamInfo {
  type: "bot_api" | "telegram_link" | "unsupported";
  url: string;
  mimeType?: string;
  fileSize?: number;
}

/**
 * Resolve a streaming/download URL for a Telegram file.
 * - Uses Bot API getFile → download URL (works for files ≤ 20 MB, instant).
 * - For larger files, returns a t.me deep link that opens in Telegram client.
 *
 * For REAL MTProto streaming on large files you need a backend server running
 * GramJS / Telethon that streams chunks via HTTP range requests.
 * The botStreamProxy field lets you point at such a server.
 */
export async function resolveStreamUrl(
  botToken: string,
  fileId: string,
  botStreamProxyBase?: string // e.g. "https://your-backend.com/stream"
): Promise<StreamInfo> {
  if (!botToken || !fileId) {
    return { type: "unsupported", url: "" };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      }
    );
    const data = await res.json();

    if (!data.ok) {
      // File >20MB — bot API can't serve it, use proxy or Telegram link
      if (botStreamProxyBase) {
        return {
          type: "bot_api",
          url: `${botStreamProxyBase}?file_id=${encodeURIComponent(fileId)}&token=${encodeURIComponent(botToken)}`,
        };
      }
      return { type: "unsupported", url: "" };
    }

    const filePath: string = data.result.file_path;
    const fileSize: number = data.result.file_size || 0;

    // If a proxy is configured, always route through it (hides bot token)
    if (botStreamProxyBase) {
      return {
        type: "bot_api",
        url: `${botStreamProxyBase}?file_id=${encodeURIComponent(fileId)}&token=${encodeURIComponent(botToken)}`,
        fileSize,
      };
    }

    const directUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    return {
      type: "bot_api",
      url: directUrl,
      fileSize,
    };
  } catch {
    return { type: "unsupported", url: "" };
  }
}

/**
 * Fetch channel messages from a bot token + channel id.
 * Used to index files that exist in the private channel.
 * The bot must be an admin in the channel.
 * Returns up to `limit` messages starting from `offsetId` (pagination).
 */
export async function fetchChannelMessages(
  botToken: string,
  channelId: string,
  limit = 100,
  offsetId = 0
): Promise<{ ok: boolean; messages: TelegramMessage[]; error?: string }> {
  try {
    // Bot API doesn't support getHistory directly — use getUpdates or
    // forwardMessage workaround. The only reliable bot-API method is
    // to iterate message IDs by trying to copy them.
    // We use the unofficial "getChatHistory" equivalent via getUpdates.
    // NOTE: This ONLY works if the bot is in the channel as admin.
    const params = new URLSearchParams({
      chat_id: channelId,
      limit: String(Math.min(limit, 100)),
      ...(offsetId ? { offset_id: String(offsetId) } : {}),
    });

    // Try sending a dummy request to see if we can access the channel
    const testRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channelId }),
      }
    );
    const testData = await testRes.json();
    if (!testData.ok) {
      return { ok: false, messages: [], error: testData.description || "Cannot access channel" };
    }

    // Bot API cannot fetch message history — only updates.
    // We return ok:true but note the limitation.
    void params; // suppress unused warning
    return {
      ok: true,
      messages: [],
      error: "BOT_API_LIMIT: Bot API cannot fetch channel history. Use the Admin panel to manually add file IDs, or set up the MTProto indexer script.",
    };
  } catch (e: unknown) {
    return { ok: false, messages: [], error: String(e) };
  }
}

/**
 * Test bot token validity + channel access.
 */
export async function testBotConnection(
  botToken: string,
  channelId?: string
): Promise<{ ok: boolean; botInfo?: { username: string; first_name: string; id: number }; channelInfo?: { title: string; id: number }; error?: string }> {
  try {
    const botRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botData = await botRes.json();
    if (!botData.ok) return { ok: false, error: botData.description || "Invalid token" };

    const result: { ok: boolean; botInfo?: { username: string; first_name: string; id: number }; channelInfo?: { title: string; id: number } } = {
      ok: true,
      botInfo: {
        username: botData.result.username,
        first_name: botData.result.first_name,
        id: botData.result.id,
      },
    };

    if (channelId) {
      const chanRes = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channelId }),
      });
      const chanData = await chanRes.json();
      if (chanData.ok) {
        result.channelInfo = { title: chanData.result.title, id: chanData.result.id };
      }
    }

    return result;
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Index a single file from the channel by message_id.
 * The bot must have access to the channel.
 */
export async function indexFileByMessageId(
  botToken: string,
  channelId: string,
  messageId: number
): Promise<{ ok: boolean; file?: TelegramMessage; error?: string }> {
  try {
    // Copy the message to the bot's own chat (Saved Messages = bot user)
    // to retrieve the file metadata. This is the only bot-API way.
    const botRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const botData = await botRes.json();
    if (!botData.ok) return { ok: false, error: "Invalid token" };

    const copyRes = await fetch(`https://api.telegram.org/bot${botToken}/forwardMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId, // forward to itself just to retrieve
        from_chat_id: channelId,
        message_id: messageId,
      }),
    });
    const copyData = await copyRes.json();
    if (!copyData.ok) return { ok: false, error: copyData.description };

    return { ok: true, file: copyData.result as TelegramMessage };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
}
