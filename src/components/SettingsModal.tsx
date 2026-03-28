import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiSave, FiEye, FiEyeOff, FiShield, FiSettings, FiServer, FiExternalLink } from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { SiMongodb } from "react-icons/si";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";
import { TelegramBot } from "../lib/telegram";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { telegramConfig, setTelegramConfig, isAdminMode, adminPassword, setAdminMode, setAdminPassword, accentColor, setAccentColor } = useStore();
  const [form, setForm] = useState({ ...telegramConfig });
  const [showToken, setShowToken] = useState(false);
  const [testingBot, setTestingBot] = useState(false);
  const [activeTab, setActiveTab] = useState<"telegram" | "admin" | "appearance">("telegram");
  const [adminInput, setAdminInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();

  const handleSave = () => {
    setTelegramConfig(form);
    toast.success("Settings saved!", {
      style: { background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" },
    });
    onClose();
  };

  const handleTestBot = async () => {
    if (!form.botToken) {
      toast.error("Please enter a bot token first");
      return;
    }
    setTestingBot(true);
    try {
      const bot = new TelegramBot(form.botToken);
      const result = await bot.getMe();
      if (result.ok) {
        toast.success(`✅ Bot connected: @${result.result.username}`, {
          duration: 4000,
          style: { background: "#1a1a2e", color: "#fff" },
        });
        setForm((f) => ({ ...f, botUsername: result.result.username }));
      } else {
        toast.error("❌ Invalid bot token");
      }
    } catch {
      toast.error("❌ Connection failed. Check your token.");
    }
    setTestingBot(false);
  };

  const handleAdminLogin = () => {
    if (adminInput === adminPassword) {
      setAdminMode(true);
      toast.success("🔓 Admin mode activated!");
      setAdminInput("");
    } else {
      toast.error("❌ Invalid admin password");
    }
  };

  const accentColors = [
    { name: "Red", value: "#e50914" },
    { name: "Blue", value: "#2563eb" },
    { name: "Purple", value: "#7c3aed" },
    { name: "Green", value: "#16a34a" },
    { name: "Orange", value: "#ea580c" },
    { name: "Pink", value: "#db2777" },
    { name: "Cyan", value: "#0891b2" },
  ];

  const tabs = [
    { id: "telegram" as const, icon: FaTelegramPlane, label: "Telegram" },
    { id: "admin" as const, icon: FiShield, label: "Admin" },
    { id: "appearance" as const, icon: FiSettings, label: "Theme" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-white font-bold text-xl">Settings</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/10">
                {tabs.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all relative ${
                      activeTab === id ? "text-white" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {activeTab === id && (
                      <motion.div
                        layoutId="settingsTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
                {/* Telegram Tab */}
                {activeTab === "telegram" && (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs">
                      <strong>📱 Telegram Integration</strong>: Connect your Telegram bot to enable file delivery and downloads. Files are stored securely in your private channel.
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-1.5">Bot Token</label>
                      <div className="relative">
                        <input
                          type={showToken ? "text" : "password"}
                          value={form.botToken}
                          onChange={(e) => setForm((f) => ({ ...f, botToken: e.target.value }))}
                          placeholder="1234567890:ABCdef..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 pr-10 transition-colors"
                        />
                        <button
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showToken ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-1.5">Private Channel ID</label>
                      <input
                        type="text"
                        value={form.channelId}
                        onChange={(e) => setForm((f) => ({ ...f, channelId: e.target.value }))}
                        placeholder="-100xxxxxxxxxx"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-1.5">Bot Username</label>
                      <input
                        type="text"
                        value={form.botUsername}
                        onChange={(e) => setForm((f) => ({ ...f, botUsername: e.target.value }))}
                        placeholder="StreamyFlixServerBot"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-1.5">Force Subscribe Channel Link</label>
                      <input
                        type="text"
                        value={form.forceSubChannelLink}
                        onChange={(e) => setForm((f) => ({ ...f, forceSubChannelLink: e.target.value }))}
                        placeholder="https://t.me/yourchannel"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 transition-colors"
                      />
                    </div>

                    <button
                      onClick={handleTestBot}
                      disabled={testingBot}
                      className="w-full py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <FaTelegramPlane className="w-4 h-4" />
                      {testingBot ? "Testing..." : "Test Bot Connection"}
                    </button>

                    {isAdminMode && (
                      <button
                        onClick={() => { onClose(); navigate("/config"); }}
                        className="w-full py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <FiServer className="w-4 h-4" />
                        Advanced Config (MTProto + MongoDB)
                        <FiExternalLink className="w-3 h-3 ml-auto" />
                      </button>
                    )}

                    <div className="p-3 bg-white/3 border border-white/8 rounded-xl text-gray-500 text-xs space-y-1">
                      <p className="flex items-center gap-1.5"><SiMongodb className="text-green-500 w-3 h-3" /> MongoDB config → Advanced Config page</p>
                      <p className="flex items-center gap-1.5"><FiServer className="text-purple-400 w-3 h-3" /> MTProto streaming → Advanced Config page</p>
                    </div>
                  </div>
                )}

                {/* Admin Tab */}
                {activeTab === "admin" && (
                  <div className="space-y-4">
                    {!isAdminMode ? (
                      <>
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-300 text-xs">
                          🔐 Enter admin password to enable admin mode (add/edit content, manage library).
                        </div>
                        <div>
                          <label className="block text-gray-300 text-sm font-medium mb-1.5">Admin Password</label>
                          <input
                            type="password"
                            value={adminInput}
                            onChange={(e) => setAdminInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                            placeholder="Enter password..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-yellow-500/50 transition-colors"
                          />
                        </div>
                        <p className="text-gray-500 text-xs">Default password: <code className="text-yellow-400">streamyflix2024</code></p>
                        <button
                          onClick={handleAdminLogin}
                          className="w-full py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm font-medium transition-all"
                        >
                          🔓 Unlock Admin Mode
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-300 text-xs">
                          ✅ Admin mode is active. You can now add, edit, and delete content.
                        </div>
                        <div>
                          <label className="block text-gray-300 text-sm font-medium mb-1.5">Change Admin Password</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-green-500/50 transition-colors"
                          />
                        </div>
                        {newPassword && (
                          <button
                            onClick={() => { setAdminPassword(newPassword); setNewPassword(""); toast.success("Password updated!"); }}
                            className="w-full py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium transition-all"
                          >
                            Update Password
                          </button>
                        )}
                        <button
                          onClick={() => { setAdminMode(false); toast("Admin mode disabled"); }}
                          className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-all"
                        >
                          🔒 Disable Admin Mode
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Appearance Tab */}
                {activeTab === "appearance" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-3">Accent Color</label>
                      <div className="grid grid-cols-4 gap-2">
                        {accentColors.map(({ name, value }) => (
                          <button
                            key={value}
                            onClick={() => setAccentColor(value)}
                            className={`relative h-10 rounded-xl transition-all flex items-center justify-center ${
                              accentColor === value ? "ring-2 ring-white scale-105" : "hover:scale-105"
                            }`}
                            style={{ background: value }}
                            title={name}
                          >
                            {accentColor === value && (
                              <span className="text-white text-xs font-bold">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-white/10">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  <FiSave className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
