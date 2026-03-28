import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiSave, FiCheckCircle, FiXCircle, FiLoader, FiEye, FiEyeOff,
  FiAlertTriangle, FiInfo, FiRefreshCw, FiDatabase, FiServer,
  FiZap, FiLink, FiShield
} from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { SiMongodb } from "react-icons/si";
import { useStore } from "../store/useStore";
import { testBotConnection } from "../lib/telegram";
import toast from "react-hot-toast";

type TestStatus = "idle" | "loading" | "success" | "error";

interface TestResult {
  status: TestStatus;
  message: string;
  details?: Record<string, string | number | boolean>;
}

const defaultResult = (): TestResult => ({ status: "idle", message: "" });

// ─── Input Field ─────────────────────────────────────────────────────────────
function ConfigInput({
  label, value, onChange, placeholder, type = "text", hint, required, monospace,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
  required?: boolean; monospace?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-red-400 text-xs">*</span>}
      </label>
      <div className="relative">
        <input
          type={isPassword && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm outline-none focus:border-blue-500/60 focus:bg-[#0d1117] transition-all ${monospace ? "font-mono text-xs" : ""} ${isPassword ? "pr-10" : ""}`}
          spellCheck={false}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            {show ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {hint && <p className="text-gray-600 text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ result }: { result: TestResult }) {
  if (result.status === "idle") return null;
  const map = {
    loading: { icon: <FiLoader className="w-4 h-4 animate-spin" />, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    success: { icon: <FiCheckCircle className="w-4 h-4" />, color: "text-green-400 bg-green-500/10 border-green-500/20" },
    error: { icon: <FiXCircle className="w-4 h-4" />, color: "text-red-400 bg-red-500/10 border-red-500/20" },
  } as const;
  const { icon, color } = map[result.status as keyof typeof map];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${color}`}
    >
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="space-y-1 min-w-0">
        <p className="font-medium leading-snug">{result.message}</p>
        {result.details && (
          <div className="space-y-0.5">
            {Object.entries(result.details).map(([k, v]) => (
              <p key={k} className="text-xs opacity-80 font-mono">
                {k}: <span className="font-semibold">{String(v)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, color }: {
  icon: React.ReactNode; title: string; subtitle: string; color: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border ${color} mb-6`}>
      <div className="text-xl">{icon}</div>
      <div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
        <p className="text-xs opacity-70 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Info Box ─────────────────────────────────────────────────────────────────
function InfoBox({ children, variant = "info" }: { children: React.ReactNode; variant?: "info" | "warn" | "tip" }) {
  const styles = {
    info: "bg-blue-500/5 border-blue-500/20 text-blue-300",
    warn: "bg-yellow-500/5 border-yellow-500/20 text-yellow-300",
    tip: "bg-purple-500/5 border-purple-500/20 text-purple-300",
  };
  const icons = { info: <FiInfo />, warn: <FiAlertTriangle />, tip: <FiZap /> };
  return (
    <div className={`flex gap-2.5 p-3.5 rounded-xl border text-xs leading-relaxed ${styles[variant]}`}>
      <span className="mt-0.5 flex-shrink-0">{icons[variant]}</span>
      <div>{children}</div>
    </div>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────
type TabId = "bot" | "mtproto" | "mongodb" | "webhook" | "howto";
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "bot", label: "Bot API", icon: <FaTelegramPlane /> },
  { id: "mtproto", label: "MTProto", icon: <FiServer /> },
  { id: "mongodb", label: "MongoDB", icon: <SiMongodb /> },
  { id: "webhook", label: "Backend", icon: <FiLink /> },
  { id: "howto", label: "Setup Guide", icon: <FiShield /> },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConfigPage() {
  const {
    telegramConfig, setTelegramConfig,
    mtprotoConfig, setMtprotoConfig,
    mongoConfig, setMongoConfig,
    isAdminMode,
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabId>("bot");

  // Bot form
  const [botForm, setBotForm] = useState({ ...telegramConfig });
  const [botTest, setBotTest] = useState<TestResult>(defaultResult());

  // MTProto form
  const [mtForm, setMtForm] = useState({ ...mtprotoConfig });
  const [mtTest, setMtTest] = useState<TestResult>(defaultResult());

  // MongoDB form
  const [mgForm, setMgForm] = useState({ ...mongoConfig });
  const [mgTest, setMgTest] = useState<TestResult>(defaultResult());

  // ── Bot API Test ────────────────────────────────────────────────────────────
  const handleTestBot = useCallback(async () => {
    if (!botForm.botToken.trim()) {
      setBotTest({ status: "error", message: "Bot token is required." });
      return;
    }
    setBotTest({ status: "loading", message: "Connecting to Telegram Bot API…" });
    try {
      const result = await testBotConnection(
        botForm.botToken.trim(),
        botForm.channelId.trim() || undefined
      );
      if (result.ok) {
        setBotTest({
          status: "success",
          message: "✅ Bot connected successfully!",
          details: {
            "Bot Username": `@${result.botInfo?.username}`,
            "Bot Name": result.botInfo?.first_name || "",
            "Bot ID": result.botInfo?.id || "",
            ...(result.channelInfo
              ? { "Channel": result.channelInfo.title, "Channel ID": result.channelInfo.id }
              : {}),
          },
        });
        // Auto-fill username
        if (result.botInfo?.username) {
          setBotForm((f) => ({ ...f, botUsername: result.botInfo!.username }));
        }
      } else {
        setBotTest({ status: "error", message: `❌ ${result.error || "Connection failed"}` });
      }
    } catch (e: unknown) {
      setBotTest({ status: "error", message: `❌ Network error: ${String(e)}` });
    }
  }, [botForm.botToken, botForm.channelId]);

  const handleSaveBot = () => {
    setTelegramConfig(botForm);
    toast.success("✅ Bot config saved!");
    setBotTest(defaultResult());
  };

  // ── MTProto Test ────────────────────────────────────────────────────────────
  const handleTestMtProto = useCallback(async () => {
    if (!mtForm.apiId.trim() || !mtForm.apiHash.trim()) {
      setMtTest({ status: "error", message: "API ID and API Hash are both required." });
      return;
    }
    if (isNaN(Number(mtForm.apiId)) || Number(mtForm.apiId) <= 0) {
      setMtTest({ status: "error", message: "API ID must be a positive integer." });
      return;
    }
    setMtTest({ status: "loading", message: "Validating API credentials format…" });

    // Real MTProto connections require a backend (GramJS/Telethon) — 
    // we can only validate the format here in the browser.
    await new Promise((r) => setTimeout(r, 800));

    const apiId = Number(mtForm.apiId);
    const hashOk = /^[a-f0-9]{32}$/i.test(mtForm.apiHash.trim());

    if (!hashOk) {
      setMtTest({
        status: "error",
        message: "❌ API Hash format invalid. It must be a 32-character hex string from my.telegram.org.",
      });
      return;
    }

    if (apiId < 1000) {
      setMtTest({ status: "error", message: "❌ API ID seems too small. Get the real one from my.telegram.org." });
      return;
    }

    setMtTest({
      status: "success",
      message: "✅ MTProto credentials format is valid!",
      details: {
        "API ID": apiId,
        "API Hash": `${mtForm.apiHash.slice(0, 8)}…${mtForm.apiHash.slice(-4)}`,
        "Note": "Full MTProto auth requires backend server",
      },
    });
  }, [mtForm.apiId, mtForm.apiHash]);

  const handleSaveMtProto = () => {
    setMtprotoConfig(mtForm);
    toast.success("✅ MTProto config saved!");
    setMtTest(defaultResult());
  };

  // ── Backend/Webhook Test ─────────────────────────────────────────────────────
  const [webhookTest, setWebhookTest] = useState<TestResult>(defaultResult());

  const handleTestBackend = useCallback(async () => {
    const backendUrl = botForm.backendUrl?.trim();
    if (!backendUrl) {
      setWebhookTest({ status: "error", message: "Backend URL is required." });
      return;
    }
    setWebhookTest({ status: "loading", message: "Connecting to backend server…" });
    try {
      const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(8000) });
      const data = await res.json();
      if (data.status === "ok") {
        setWebhookTest({
          status: "success",
          message: "✅ Backend server is reachable!",
          details: {
            "DB Status": data.db,
            "Bot Connected": data.bot ? "Yes" : "No",
            "Server Time": data.timestamp,
          },
        });
      } else {
        setWebhookTest({ status: "error", message: "❌ Server responded but status is not OK." });
      }
    } catch (e: unknown) {
      setWebhookTest({ status: "error", message: `❌ Cannot reach backend: ${String(e)}` });
    }
  }, [botForm.backendUrl]);

  const handleSetWebhook = useCallback(async () => {
    const backendUrl = botForm.backendUrl?.trim();
    if (!backendUrl || !botForm.botToken.trim()) {
      setWebhookTest({ status: "error", message: "Both Backend URL and Bot Token are required." });
      return;
    }
    setWebhookTest({ status: "loading", message: "Setting Telegram webhook…" });
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botForm.botToken.trim()}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: `${backendUrl}/webhook`,
            allowed_updates: ["message", "callback_query", "channel_post"],
            drop_pending_updates: false,
          }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        setWebhookTest({
          status: "success",
          message: "✅ Webhook set successfully!",
          details: { "Webhook URL": `${backendUrl}/webhook`, "Description": data.description },
        });
        toast.success("✅ Webhook configured!");
      } else {
        setWebhookTest({ status: "error", message: `❌ ${data.description || "Failed to set webhook"}` });
      }
    } catch (e: unknown) {
      setWebhookTest({ status: "error", message: `❌ ${String(e)}` });
    }
  }, [botForm.backendUrl, botForm.botToken]);

  const handleGetWebhookInfo = useCallback(async () => {
    if (!botForm.botToken.trim()) {
      setWebhookTest({ status: "error", message: "Bot token required." });
      return;
    }
    setWebhookTest({ status: "loading", message: "Fetching webhook info…" });
    try {
      const res = await fetch(`https://api.telegram.org/bot${botForm.botToken.trim()}/getWebhookInfo`);
      const data = await res.json();
      if (data.ok) {
        const wi = data.result;
        setWebhookTest({
          status: wi.url ? "success" : "error",
          message: wi.url ? "✅ Webhook is active" : "❌ No webhook set — bot using polling",
          details: {
            "Webhook URL": wi.url || "(none)",
            "Pending Updates": wi.pending_update_count,
            "Last Error": wi.last_error_message || "None",
          },
        });
      } else {
        setWebhookTest({ status: "error", message: `❌ ${data.description}` });
      }
    } catch (e: unknown) {
      setWebhookTest({ status: "error", message: `❌ ${String(e)}` });
    }
  }, [botForm.botToken]);

  // ── MongoDB Test ─────────────────────────────────────────────────────────────
  const handleTestMongo = useCallback(async () => {
    if (!mgForm.uri.trim()) {
      setMgTest({ status: "error", message: "MongoDB connection URI is required." });
      return;
    }
    setMgTest({ status: "loading", message: "Validating MongoDB URI format…" });
    await new Promise((r) => setTimeout(r, 600));

    const uri = mgForm.uri.trim();
    const isMongoSrv = uri.startsWith("mongodb+srv://");
    const isMongo = uri.startsWith("mongodb://");

    if (!isMongoSrv && !isMongo) {
      setMgTest({
        status: "error",
        message: "❌ Invalid URI. Must start with mongodb:// or mongodb+srv://",
      });
      return;
    }

    // Extract host for display
    let host = "";
    try {
      const withScheme = uri.replace("mongodb+srv://", "https://").replace("mongodb://", "https://");
      const parsed = new URL(withScheme);
      host = parsed.hostname;
    } catch { host = "unknown"; }

    setMgTest({
      status: "success",
      message: "✅ MongoDB URI format is valid!",
      details: {
        "Type": isMongoSrv ? "MongoDB Atlas (SRV)" : "Standard",
        "Host": host,
        "Database": mgForm.dbName || "(default)",
        "Collection": mgForm.collectionName || "files",
        "Note": "Direct browser→MongoDB not supported (use backend)",
      },
    });
  }, [mgForm.uri, mgForm.dbName, mgForm.collectionName]);

  const handleSaveMongo = () => {
    setMongoConfig(mgForm);
    toast.success("✅ MongoDB config saved!");
    setMgTest(defaultResult());
  };

  if (!isAdminMode) {
    return (
      <div className="min-h-screen bg-[#080c10] flex flex-col items-center justify-center pt-20 gap-4 text-center p-8">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-4xl">🔒</div>
        <h2 className="text-white text-2xl font-bold">Admin Access Required</h2>
        <p className="text-gray-400 max-w-sm">Enable Admin Mode in Settings (gear icon) to access the Config panel.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c10] pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
              <FiServer className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              System Configuration
            </h1>
          </div>
          <p className="text-gray-500 text-sm">
            Configure Telegram Bot API, MTProto streaming credentials, and MongoDB indexer. All credentials are stored locally in your browser.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-8 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-all relative ${
                activeTab === tab.id ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="configTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ─── BOT API TAB ─────────────────────────────────────────────────── */}
          {activeTab === "bot" && (
            <motion.div key="bot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              <SectionHeader
                icon={<FaTelegramPlane className="text-blue-400" />}
                title="Telegram Bot API"
                subtitle="Used for file delivery via /start deeplinks and bot DMs"
                color="bg-blue-500/5 border-blue-500/20 text-blue-300"
              />

              <InfoBox variant="info">
                <strong>How it works:</strong> When a user clicks Download, they are sent to your bot with a deep-link parameter
                (e.g. <code className="font-mono bg-white/10 px-1 rounded">?start=dl_movie_123</code>). Your bot reads this, finds
                the file in your private channel, and forwards it to the user.
                The bot must be an <strong>admin in your private channel</strong>.
              </InfoBox>

              <div className="space-y-4">
                <ConfigInput
                  label="Bot Token"
                  value={botForm.botToken}
                  onChange={(v) => setBotForm((f) => ({ ...f, botToken: v }))}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  type="password"
                  hint="Get from @BotFather → /newbot or /token. Keep this secret!"
                  required
                  monospace
                />
                <ConfigInput
                  label="Private Channel ID"
                  value={botForm.channelId}
                  onChange={(v) => setBotForm((f) => ({ ...f, channelId: v }))}
                  placeholder="-1001234567890"
                  hint="The numeric ID of your private Telegram channel where files are stored. Must start with -100 for supergroups/channels."
                  required
                  monospace
                />
                <ConfigInput
                  label="Bot Username"
                  value={botForm.botUsername}
                  onChange={(v) => setBotForm((f) => ({ ...f, botUsername: v }))}
                  placeholder="YourBotUsername (without @)"
                  hint="Auto-filled when you test the bot. Used to build download deep-links."
                />
                <ConfigInput
                  label="Backend API URL"
                  value={botForm.backendUrl || ""}
                  onChange={(v) => setBotForm((f) => ({ ...f, backendUrl: v }))}
                  placeholder="https://your-bot.railway.app"
                  hint="The public URL where your bot backend is deployed. Used by the website to fetch indexed files and for streaming. See the Backend tab for setup."
                  monospace
                />
                <ConfigInput
                  label="Admin API Key"
                  value={(botForm as typeof botForm & { adminApiKey?: string }).adminApiKey || ""}
                  onChange={(v) => setBotForm((f) => ({ ...f, adminApiKey: v } as typeof f))}
                  placeholder="your_secret_admin_key"
                  type="password"
                  hint="Must match the ADMIN_API_KEY set on your bot backend. Required to delete files or link TMDB IDs via the Admin panel."
                />
                <ConfigInput
                  label="Force Subscribe Channel Link"
                  value={botForm.forceSubChannelLink}
                  onChange={(v) => setBotForm((f) => ({ ...f, forceSubChannelLink: v }))}
                  placeholder="https://t.me/your_public_channel"
                  hint="Optional: Users must join this channel before downloading. Your bot checks membership."
                />
              </div>

              <StatusBadge result={botTest} />

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTestBot}
                  disabled={botTest.status === "loading"}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {botTest.status === "loading" ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
                  Test Connection
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveBot}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  <FiSave className="w-4 h-4" />
                  Save Bot Config
                </motion.button>
              </div>

              {/* Channel ID How-To */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">How to get your Channel ID</p>
                <ol className="text-gray-500 text-xs space-y-1.5 list-decimal list-inside">
                  <li>Forward any message from your private channel to <strong className="text-gray-400">@userinfobot</strong></li>
                  <li>It will reply with the channel ID (negative number like <code className="font-mono">-1001234567890</code>)</li>
                  <li>Alternatively, add <strong className="text-gray-400">@username_to_id_bot</strong> as admin and it will print the ID</li>
                  <li>Or use the Telegram Web interface: the channel URL contains the ID</li>
                </ol>
              </div>
            </motion.div>
          )}

          {/* ─── MTPROTO TAB ─────────────────────────────────────────────────── */}
          {activeTab === "mtproto" && (
            <motion.div key="mtproto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              <SectionHeader
                icon={<FiServer className="text-purple-400" />}
                title="MTProto API (Streaming)"
                subtitle="Enables direct video streaming via Telegram's MTProto protocol"
                color="bg-purple-500/5 border-purple-500/20 text-purple-300"
              />

              <InfoBox variant="warn">
                <strong>⚠️ Backend Required:</strong> MTProto cannot run in the browser (no raw TCP/WebSocket support).
                You need a backend server running <strong>GramJS</strong> (Node.js) or <strong>Telethon</strong> (Python)
                that exposes an HTTP streaming endpoint. These credentials authenticate that backend.
              </InfoBox>

              <InfoBox variant="tip">
                <strong>💡 How streaming works:</strong> Your backend server authenticates with Telegram MTProto using your
                API credentials. When a user plays a video, the player fetches
                <code className="font-mono bg-white/10 px-1 rounded mx-1">GET /stream?file_id=…</code>
                from your backend which downloads chunks from Telegram and pipes them as HTTP range responses (seekable video).
              </InfoBox>

              <div className="space-y-4">
                <ConfigInput
                  label="API ID"
                  value={mtForm.apiId}
                  onChange={(v) => setMtForm((f) => ({ ...f, apiId: v }))}
                  placeholder="12345678"
                  hint="From my.telegram.org → App configuration → App api_id"
                  required
                  monospace
                />
                <ConfigInput
                  label="API Hash"
                  value={mtForm.apiHash}
                  onChange={(v) => setMtForm((f) => ({ ...f, apiHash: v }))}
                  placeholder="0123456789abcdef0123456789abcdef"
                  type="password"
                  hint="From my.telegram.org → App configuration → App api_hash (32 hex chars)"
                  required
                  monospace
                />
                <ConfigInput
                  label="Session String (Optional)"
                  value={mtForm.sessionString}
                  onChange={(v) => setMtForm((f) => ({ ...f, sessionString: v }))}
                  placeholder="1BQANOTEuMT..."
                  type="password"
                  hint="Exported Telethon/GramJS session string. Allows your backend to start without re-authentication."
                  monospace
                />
              </div>

              <StatusBadge result={mtTest} />

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTestMtProto}
                  disabled={mtTest.status === "loading"}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {mtTest.status === "loading" ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
                  Validate Credentials
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveMtProto}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  <FiSave className="w-4 h-4" />
                  Save MTProto Config
                </motion.button>
              </div>

              {/* How to get API credentials */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Getting API ID & Hash</p>
                <ol className="text-gray-500 text-xs space-y-1.5 list-decimal list-inside">
                  <li>Go to <a href="https://my.telegram.org" target="_blank" rel="noopener" className="text-purple-400 hover:underline">my.telegram.org</a> and log in</li>
                  <li>Click <strong className="text-gray-400">API Development Tools</strong></li>
                  <li>Fill the form (App title, Short name) — any values work</li>
                  <li>Copy the <strong className="text-gray-400">App api_id</strong> (number) and <strong className="text-gray-400">App api_hash</strong> (hex string)</li>
                  <li>These are tied to your Telegram account — keep them secret!</li>
                </ol>
              </div>

              {/* Streaming Backend Info */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <FiLink className="w-3.5 h-3.5" />
                  Backend Streaming Server (Required)
                </p>
                <p className="text-gray-500 text-xs leading-relaxed">
                  Deploy a Node.js server with GramJS that handles HTTP range requests.
                  A minimal server looks like:
                </p>
                <pre className="text-[10px] font-mono text-green-400/80 bg-black/40 rounded-lg p-3 overflow-x-auto scrollbar-hide leading-relaxed">{`// server.js (Node.js + GramJS)
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const express = require("express");

const client = new TelegramClient(
  new StringSession(process.env.SESSION),
  parseInt(process.env.API_ID),
  process.env.API_HASH,
  { connectionRetries: 5 }
);

const app = express();
app.get("/stream", async (req, res) => {
  const { file_id } = req.query;
  // Use client.downloadFile() with range headers
  // and pipe to res with Content-Type + Accept-Ranges
});`}</pre>
              </div>
            </motion.div>
          )}

          {/* ─── MONGODB TAB ─────────────────────────────────────────────────── */}
          {activeTab === "mongodb" && (
            <motion.div key="mongodb" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              <SectionHeader
                icon={<SiMongodb className="text-green-400" />}
                title="MongoDB Indexer"
                subtitle="Stores file metadata indexed by your Telegram bot"
                color="bg-green-500/5 border-green-500/20 text-green-300"
              />

              <InfoBox variant="info">
                <strong>How indexing works:</strong> When a file is forwarded to your bot or posted in the private channel,
                the bot extracts <code className="font-mono bg-white/10 px-1 rounded">file_id</code>,
                <code className="font-mono bg-white/10 px-1 rounded mx-1">file_name</code>, size, MIME type and stores
                them in MongoDB. The website then queries this database to show available content.
              </InfoBox>

              <InfoBox variant="warn">
                <strong>⚠️ Browser limitation:</strong> Direct browser → MongoDB connections are blocked by CORS.
                Your bot backend (Python/Node.js) writes to MongoDB, and your backend API exposes
                a <code className="font-mono bg-white/10 px-1 rounded">GET /api/files</code> endpoint that the website calls.
                Store the URI here so your backend can use it.
              </InfoBox>

              <div className="space-y-4">
                <ConfigInput
                  label="MongoDB Connection URI"
                  value={mgForm.uri}
                  onChange={(v) => setMgForm((f) => ({ ...f, uri: v }))}
                  placeholder="mongodb+srv://user:pass@cluster.mongodb.net/"
                  type="password"
                  hint="Full MongoDB connection string. Get from MongoDB Atlas → Connect → Drivers."
                  required
                  monospace
                />
                <ConfigInput
                  label="Database Name"
                  value={mgForm.dbName}
                  onChange={(v) => setMgForm((f) => ({ ...f, dbName: v }))}
                  placeholder="streamyflix"
                  hint="The database where your bot stores file indexes."
                />
                <ConfigInput
                  label="Collection Name"
                  value={mgForm.collectionName}
                  onChange={(v) => setMgForm((f) => ({ ...f, collectionName: v }))}
                  placeholder="files"
                  hint="Collection name for indexed file documents."
                />
              </div>

              <StatusBadge result={mgTest} />

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTestMongo}
                  disabled={mgTest.status === "loading"}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {mgTest.status === "loading" ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
                  Validate URI
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveMongo}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold transition-all"
                >
                  <FiSave className="w-4 h-4" />
                  Save MongoDB Config
                </motion.button>
              </div>

              {/* MongoDB document schema */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <FiDatabase className="w-3.5 h-3.5" />
                  File Document Schema
                </p>
                <pre className="text-[10px] font-mono text-cyan-400/80 bg-black/40 rounded-lg p-3 overflow-x-auto scrollbar-hide leading-relaxed">{`{
  _id: ObjectId,
  file_id: "AQAD...",       // Telegram file_id (for streaming)
  file_unique_id: "AbCd...", // Stable unique ID
  file_name: "Movie.2024.1080p.mkv",
  file_size: 2147483648,    // bytes
  mime_type: "video/x-matroska",
  message_id: 42,           // channel message ID
  channel_id: "-100...",    // your private channel
  tmdb_id: 550,             // linked TMDB entry
  media_type: "movie",      // "movie" | "tv" | "unknown"
  title: "Fight Club",
  quality: "1080p",
  language: "English",
  season: null,
  episode: null,
  duration: 7851,           // seconds
  indexed_at: ISODate(),
  download_count: 0
}`}</pre>
              </div>
            </motion.div>
          )}

          {/* ─── BACKEND / WEBHOOK TAB ──────────────────────────────────────── */}
          {activeTab === "webhook" && (
            <motion.div key="webhook" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              <SectionHeader
                icon={<FiLink className="text-cyan-400" />}
                title="Backend Server & Webhook"
                subtitle="Connect your deployed bot backend and configure Telegram webhook"
                color="bg-cyan-500/5 border-cyan-500/20 text-cyan-300"
              />

              <InfoBox variant="info">
                <strong>Backend URL</strong> is where your <code className="font-mono bg-white/10 px-1 rounded">bot/index.js</code> is deployed.
                Set it in the <strong>Bot API tab → Backend API URL</strong> field, then use the controls below to
                test the server and configure the Telegram webhook.
              </InfoBox>

              <div className="bg-[#0d1117] border border-white/10 rounded-xl p-4 space-y-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Current Backend URL</p>
                <p className="font-mono text-sm text-cyan-400 break-all">
                  {botForm.backendUrl || <span className="text-gray-600 italic">Not set — go to Bot API tab</span>}
                </p>
              </div>

              <StatusBadge result={webhookTest} />

              {/* Test backend health */}
              <div className="space-y-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">1. Test Backend Health</p>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleTestBackend}
                  disabled={webhookTest.status === "loading"}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {webhookTest.status === "loading" ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiRefreshCw className="w-4 h-4" />}
                  Test /health Endpoint
                </motion.button>
              </div>

              {/* Webhook controls */}
              <div className="space-y-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">2. Configure Webhook</p>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleGetWebhookInfo}
                    disabled={webhookTest.status === "loading"}
                    className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    <FiInfo className="w-4 h-4" />
                    Check Webhook Status
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleSetWebhook}
                    disabled={webhookTest.status === "loading"}
                    className="flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  >
                    <FiZap className="w-4 h-4" />
                    Set Webhook
                  </motion.button>
                </div>
              </div>

              {/* API endpoints reference */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                  <FiServer className="w-3.5 h-3.5" />
                  Bot API Endpoints
                </p>
                {[
                  { method: "GET", path: "/health", desc: "Health check + DB status" },
                  { method: "GET", path: "/api/files", desc: "All indexed files (supports ?type=movie|tv)" },
                  { method: "GET", path: "/api/files?tmdb_id=550", desc: "Files for a specific TMDB entry" },
                  { method: "GET", path: "/api/search?q=avengers", desc: "Full-text search" },
                  { method: "GET", path: "/stream?file_id=AQAD...", desc: "Proxy-stream a file (≤20MB direct)" },
                  { method: "POST", path: "/api/link", desc: "Link file to TMDB entry (admin)" },
                  { method: "POST", path: "/webhook", desc: "Telegram update receiver" },
                ].map(({ method, path, desc }) => (
                  <div key={path} className="flex items-start gap-3">
                    <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      method === "GET" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                    }`}>{method}</span>
                    <div>
                      <code className="font-mono text-xs text-cyan-400">{path}</code>
                      <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Deploy guides */}
              <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Deploy Options</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { name: "Railway", url: "https://railway.app", color: "text-purple-400", desc: "Free tier, auto-deploy from GitHub" },
                    { name: "Render", url: "https://render.com", color: "text-green-400", desc: "Free tier, Node.js supported" },
                    { name: "VPS / DigitalOcean", url: "https://digitalocean.com", color: "text-blue-400", desc: "Full control, PM2 for process management" },
                  ].map(({ name, url, color, desc }) => (
                    <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex flex-col gap-1 p-3 bg-black/30 border border-white/10 rounded-xl hover:border-white/20 transition-all"
                    >
                      <span className={`font-bold text-sm ${color}`}>{name}</span>
                      <span className="text-gray-500 text-xs">{desc}</span>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── HOW-TO TAB ─────────────────────────────────────────────────── */}
          {activeTab === "howto" && (
            <motion.div key="howto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

              <SectionHeader
                icon={<FiShield className="text-yellow-400" />}
                title="Complete Setup Guide"
                subtitle="Step-by-step instructions to get the full system running"
                color="bg-yellow-500/5 border-yellow-500/20 text-yellow-300"
              />

              {[
                {
                  step: "1", color: "text-blue-400 bg-blue-500/10 border-blue-500/30",
                  title: "Create Telegram Bot",
                  items: [
                    "Open Telegram → search @BotFather",
                    "Send /newbot → follow prompts → copy the bot token",
                    "Send /setprivacy → Disable (so bot can read channel messages)",
                    "Paste token in Bot API tab above",
                  ],
                },
                {
                  step: "2", color: "text-green-400 bg-green-500/10 border-green-500/30",
                  title: "Set Up Private Channel",
                  items: [
                    "Create a new private Telegram channel",
                    "Add your bot as Administrator with 'Post Messages' permission",
                    "Get the channel ID (see Bot API tab)",
                    "All files you want to stream MUST be in this channel",
                  ],
                },
                {
                  step: "3", color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
                  title: "Get MTProto Credentials",
                  items: [
                    "Go to my.telegram.org and log in with your phone",
                    "Click 'API Development Tools'",
                    "Create an app → copy API ID and API Hash",
                    "Paste them in the MTProto tab above",
                  ],
                },
                {
                  step: "4", color: "text-orange-400 bg-orange-500/10 border-orange-500/30",
                  title: "Set Up MongoDB Atlas",
                  items: [
                    "Create free account at mongodb.com/cloud/atlas",
                    "Create a cluster → Database → Connect → Drivers",
                    "Copy the connection string (mongodb+srv://...)",
                    "Paste in MongoDB tab above",
                  ],
                },
                {
                  step: "5", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
                  title: "Deploy Bot + Backend",
                  items: [
                    "Clone the bot code (Node.js/Python)",
                    "Set env vars: BOT_TOKEN, CHANNEL_ID, MONGO_URI, API_ID, API_HASH",
                    "Deploy on Railway / Render / VPS",
                    "The bot auto-indexes every file forwarded to it",
                  ],
                },
                {
                  step: "6", color: "text-red-400 bg-red-500/10 border-red-500/30",
                  title: "Start Streaming",
                  items: [
                    "Forward movie/TV files to your private channel",
                    "Bot auto-indexes: extracts file_id, size, name → saves to MongoDB",
                    "On the website Admin page, link indexed files to TMDB entries",
                    "Users can stream via MTProto or download via bot DM",
                  ],
                },
              ].map(({ step, color, title, items }) => (
                <div key={step} className={`border rounded-xl p-4 ${color.split(" ").slice(1).join(" ")}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black border ${color}`}>
                      {step}
                    </span>
                    <h4 className={`font-bold text-sm ${color.split(" ")[0]}`}>{title}</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${color.split(" ")[1].replace("bg-", "bg-")}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <InfoBox variant="tip">
                <strong>Architecture Summary:</strong><br />
                <span className="font-mono text-[11px]">
                  Telegram Channel (files) ← Bot (indexes) → MongoDB<br />
                  Website → MongoDB API (read files) → show to users<br />
                  User clicks stream → Backend MTProto stream → Video player<br />
                  User clicks download → Bot DM → forwards file from channel
                </span>
              </InfoBox>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
