import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiPlus, FiTrash2, FiSearch, FiDownload, FiX, FiSave, FiRefreshCw, FiDatabase, FiLink } from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useStore, LocalContent, IndexedFile } from "../store/useStore";
import { buildBackendUrl, fetchBackendJson, getBackendUrl, type BackendFilesResponse } from "../lib/backend";
import { tmdb } from "../lib/tmdb";
import { TMDB_IMG_W300 } from "../lib/tmdb";
import { buildTelegramDownloadLink } from "../lib/telegram";
import toast from "react-hot-toast";

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

const QUALITY_OPTIONS = ["4K UHD", "1080p HD", "720p HD", "480p SD", "360p"];
const LANGUAGE_OPTIONS = ["English", "Hindi", "Tamil", "Telugu", "Malayalam", "Kannada", "Spanish", "French", "Korean", "Japanese"];

export default function AdminPage() {
  const { contentLibrary, addContent, removeContent, telegramConfig, isAdminMode, indexedFiles, setIndexedFiles, removeIndexedFile } = useStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TMDBSearchResult | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"library" | "indexed">("library");
  const [fetchingFiles, setFetchingFiles] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkingFile, setLinkingFile] = useState<IndexedFile | null>(null);
  const [linkTmdbSearch, setLinkTmdbSearch] = useState("");
  const [linkTmdbResults, setLinkTmdbResults] = useState<TMDBSearchResult[]>([]);
  const [linkSearching, setLinkSearching] = useState(false);

  const backendUrl = getBackendUrl(telegramConfig.backendUrl);
  const adminApiKey = telegramConfig.adminApiKey?.trim();
  const usingEnvBackend = !telegramConfig.backendUrl?.trim() && !!backendUrl;

  // Helper: headers with optional admin key
  const adminHeaders = (): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(adminApiKey ? { "x-admin-key": adminApiKey } : {}),
  });

  // Fetch indexed files from backend
  const fetchIndexedFiles = async () => {
    if (!backendUrl) {
      toast.error("Backend URL not configured. Set VITE_API_URL or go to Config → Bot API tab.");
      return;
    }
    setFetchingFiles(true);
    try {
      const data = await fetchBackendJson<BackendFilesResponse<IndexedFile>>("/api/files?limit=200", undefined, backendUrl);
      if (data.ok) {
        setIndexedFiles(data.files);
        toast.success(`✅ Loaded ${data.files.length} indexed files`);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (e: unknown) {
      toast.error(`❌ Failed to fetch: ${String(e)}`);
    } finally {
      setFetchingFiles(false);
    }
  };

  // Delete indexed file from backend + local store
  const handleDeleteIndexedFile = async (file: IndexedFile) => {
    if (!backendUrl) return;
    if (!confirm(`Delete "${file.title || file.file_name}" from the index?`)) return;
    try {
      const id = file._id || file.file_unique_id;
      const res = await fetch(buildBackendUrl(`/api/file/${encodeURIComponent(id)}`, backendUrl), {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        removeIndexedFile(file.file_id);
        toast.success("Deleted from index");
      } else {
        toast.error(`❌ Delete failed: ${data.error}`);
      }
    } catch (e: unknown) {
      toast.error(`❌ ${String(e)}`);
    }
  };

  // Link file to TMDB entry via backend
  const handleLinkFile = async (tmdbResult: TMDBSearchResult) => {
    if (!linkingFile || !backendUrl) return;
    try {
      const res = await fetch(buildBackendUrl("/api/link", backendUrl), {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          file_unique_id: linkingFile.file_unique_id,
          tmdb_id: tmdbResult.id,
          media_type: tmdbResult.media_type === "tv" ? "tv" : "movie",
          title: tmdbResult.title || tmdbResult.name || "",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`✅ Linked to TMDB: ${tmdbResult.title || tmdbResult.name}`);
        setLinkModalOpen(false);
        setLinkingFile(null);
        await fetchIndexedFiles(); // refresh
      } else {
        toast.error(`❌ Link failed: ${data.error}`);
      }
    } catch (e: unknown) {
      toast.error(`❌ ${String(e)}`);
    }
  };

  useEffect(() => {
    if (backendUrl && isAdminMode) {
      fetchIndexedFiles();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl, isAdminMode]);

  const [form, setForm] = useState({
    telegramFileId: "",
    telegramMessageId: "",
    quality: "1080p HD",
    size: "",
    language: "English",
    season: "",
    episode: "",
  });

  if (!isAdminMode) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center pt-20 gap-4 text-center p-8">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-4xl">
          🔒
        </div>
        <h2 className="text-white text-2xl font-bold">Admin Access Required</h2>
        <p className="text-gray-400 max-w-sm">Please enable admin mode in Settings to access the admin panel.</p>
        <button onClick={() => navigate("/")} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all">
          Go Home
        </button>
      </div>
    );
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await tmdb.searchMulti(searchQuery);
      setSearchResults(data.results.filter((r) => r.media_type !== "person" && (r.title || r.name)));
    } catch {
      toast.error("Search failed");
    }
    setSearching(false);
  };

  const handleSelectMovie = (movie: TMDBSearchResult) => {
    setSelectedMovie(movie);
    setAddModalOpen(true);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleAddContent = () => {
    if (!selectedMovie || !form.telegramFileId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const content: LocalContent = {
      id: `${Date.now()}-${selectedMovie.id}`,
      tmdbId: selectedMovie.id,
      mediaType: (selectedMovie.media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
      title: selectedMovie.title || selectedMovie.name || "Unknown",
      telegramFileId: form.telegramFileId,
      telegramMessageId: form.telegramMessageId ? parseInt(form.telegramMessageId) : undefined,
      quality: form.quality,
      size: form.size,
      language: form.language,
      addedAt: new Date().toISOString(),
      season: form.season ? parseInt(form.season) : undefined,
      episode: form.episode ? parseInt(form.episode) : undefined,
      downloadCount: 0,
    };

    addContent(content);
    setAddModalOpen(false);
    setSelectedMovie(null);
    setForm({ telegramFileId: "", telegramMessageId: "", quality: "1080p HD", size: "", language: "English", season: "", episode: "" });
    toast.success(`✅ "${content.title}" added to library!`);
  };

  const filteredLibrary = contentLibrary.filter((c) =>
    c.title.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black pt-24 pb-20">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-yellow-500/20 border border-yellow-500/30 rounded-xl flex items-center justify-center">
              <span className="text-yellow-400 text-lg">⚡</span>
            </div>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              Admin Panel
            </h1>
            <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold rounded-full">
              ACTIVE
            </span>
          </div>
          <p className="text-gray-400 text-sm">Manage your content library. Files stored on Telegram.</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Content", value: contentLibrary.length, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
            { label: "Movies", value: contentLibrary.filter((c) => c.mediaType === "movie").length, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            { label: "TV Series", value: contentLibrary.filter((c) => c.mediaType === "tv").length, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            { label: "Total Downloads", value: contentLibrary.reduce((acc, c) => acc + c.downloadCount, 0), color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`border rounded-2xl p-4 ${bg}`}>
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-gray-400 text-sm">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          {[
            { id: "library" as const, label: "📚 Content Library", count: contentLibrary.length },
            { id: "indexed" as const, label: "📁 Bot Indexed Files", count: indexedFiles.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all relative ${
                activeTab === tab.id ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-red-500/20 text-red-400" : "bg-white/5 text-gray-500"
              }`}>{tab.count}</span>
              {activeTab === tab.id && (
                <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
              )}
            </button>
          ))}
        </div>

        {/* Search & Add */}
        <div className="bg-gray-900/50 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <FiPlus className="w-5 h-5 text-green-400" />
            Add New Content
          </h2>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search TMDB for movie or series name..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 transition-colors"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <FiSearch className="w-4 h-4" />
              {searching ? "..." : "Search"}
            </button>
          </div>

          {/* TMDB Results */}
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-80 overflow-y-auto"
            >
              {searchResults.map((m) => (
                <motion.button
                  key={m.id}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => handleSelectMovie(m)}
                  className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-red-500/30 transition-all text-left"
                  style={{ aspectRatio: "2/3" }}
                >
                  {m.poster_path ? (
                    <img src={`${TMDB_IMG_W300}${m.poster_path}`} alt={m.title || m.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center text-3xl">🎬</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                    <p className="text-white text-xs font-bold line-clamp-2">{m.title || m.name}</p>
                    <p className="text-gray-400 text-[10px]">{(m.release_date || m.first_air_date || "").slice(0, 4)} · {m.media_type}</p>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Indexed Files Tab ─────────────────────────────────────────── */}
        {activeTab === "indexed" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <FiDatabase className="w-5 h-5 text-cyan-400" />
                  Bot Indexed Files
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">Files auto-indexed by your bot from the private channel</p>
                {usingEnvBackend && (
                  <p className="text-cyan-500 text-xs mt-1 font-mono">Using VITE_API_URL fallback: {backendUrl}</p>
                )}
              </div>
              <div className="flex gap-2">
                {!backendUrl && (
                  <button
                    onClick={() => navigate("/config")}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-xl text-sm font-semibold transition-all hover:bg-yellow-500/20"
                  >
                    ⚙️ Set Backend URL
                  </button>
                )}
                <button
                  onClick={fetchIndexedFiles}
                  disabled={fetchingFiles || !backendUrl}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <FiRefreshCw className={`w-4 h-4 ${fetchingFiles ? "animate-spin" : ""}`} />
                  {fetchingFiles ? "Fetching..." : "Refresh"}
                </button>
              </div>
            </div>

            {!backendUrl ? (
              <div className="py-16 text-center space-y-3">
                <p className="text-4xl">🔗</p>
                <p className="text-white font-semibold">Backend URL not configured</p>
                <p className="text-gray-500 text-sm">Set <strong>VITE_API_URL</strong> or go to <strong>Config → Bot API tab</strong> and enter your backend URL to load indexed files.</p>
                <button onClick={() => navigate("/config")} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-all">
                  Open Config
                </button>
              </div>
            ) : indexedFiles.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <p className="text-4xl">📂</p>
                <p className="text-gray-400">No files indexed yet.</p>
                <p className="text-gray-500 text-sm">Send files to your bot or forward them to the private channel.<br />Then press Refresh to load them here.</p>
                <button onClick={fetchIndexedFiles} disabled={fetchingFiles} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                  {fetchingFiles ? "Loading..." : "Load Files"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {indexedFiles.map((file) => (
                  <motion.div
                    key={file.file_unique_id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 bg-gray-900/50 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-sm truncate max-w-xs">{file.file_name}</h3>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          file.media_type === "tv" ? "bg-blue-500/20 text-blue-400" :
                          file.media_type === "movie" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400"
                        }`}>{file.media_type}</span>
                        <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded">{file.quality}</span>
                        {file.tmdb_id && (
                          <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded">TMDB ✓</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{file.language}</span>
                        <span>{file.file_size ? `${(file.file_size / 1024 / 1024 / 1024).toFixed(2)} GB` : "?"}</span>
                        <span>{new Date(file.indexed_at).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><FiDownload className="w-3 h-3" />{file.download_count}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!file.tmdb_id && (
                        <button
                          onClick={() => { setLinkingFile(file); setLinkModalOpen(true); setLinkTmdbSearch(file.title || ""); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 rounded-lg text-xs transition-all"
                        >
                          <FiLink className="w-3 h-3" />
                          Link TMDB
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteIndexedFile(file)}
                        className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Remove from index"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Library Tab ──────────────────────────────────────────────── */}
        {activeTab === "library" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-lg">Content Library</h2>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter..."
                className="bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm outline-none focus:border-red-500/50 transition-colors w-48"
              />
            </div>
          </div>

          {filteredLibrary.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-500 text-4xl mb-3">📂</p>
              <p className="text-gray-400">
                {contentLibrary.length === 0
                  ? "No content added yet. Search and add movies/series above."
                  : "No results match your filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLibrary.map((content) => {
                const botUser = telegramConfig.botUsername || "StreamyFlixServerBot";
                const downloadLink = buildTelegramDownloadLink(botUser, content.id);

                return (
                  <motion.div
                    key={content.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 bg-gray-900/50 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-sm">{content.title}</h3>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          content.mediaType === "tv" ? "bg-blue-500/20 text-blue-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {content.mediaType}
                        </span>
                        <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded">
                          {content.quality}
                        </span>
                        {content.season && (
                          <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">
                            S{content.season}{content.episode ? `E${content.episode}` : ""}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span>{content.language}</span>
                        {content.size && <span>{content.size}</span>}
                        <span>{new Date(content.addedAt).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                          <FiDownload className="w-3 h-3" />
                          {content.downloadCount}
                        </span>
                      </div>
                      <p className="text-gray-600 text-[10px] mt-1 font-mono truncate max-w-xs">
                        File ID: {content.telegramFileId}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={downloadLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-xs transition-all"
                      >
                        <FaTelegramPlane className="w-3 h-3" />
                        Test Link
                      </a>
                      <button
                        onClick={() => {
                          removeContent(content.id);
                          toast("Content removed", { icon: "🗑️" });
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg transition-all"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
         </div>
           )}
         </div>
         )}

       </div>

       {/* Add Content Modal */}
      <AnimatePresence>
        {addModalOpen && selectedMovie && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-md bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                  <div>
                    <h3 className="text-white font-bold">Add to Library</h3>
                    <p className="text-gray-400 text-sm">{selectedMovie.title || selectedMovie.name}</p>
                  </div>
                  <button onClick={() => setAddModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10">
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1.5">Telegram File ID <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={form.telegramFileId}
                      onChange={(e) => setForm((f) => ({ ...f, telegramFileId: e.target.value }))}
                      placeholder="BQACAgI..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 transition-colors font-mono"
                    />
                    <p className="text-gray-500 text-xs mt-1">Forward file to your bot and get the file_id from API</p>
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1.5">Message ID (optional)</label>
                    <input
                      type="number"
                      value={form.telegramMessageId}
                      onChange={(e) => setForm((f) => ({ ...f, telegramMessageId: e.target.value }))}
                      placeholder="12345"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-1.5">Quality</label>
                      <select
                        value={form.quality}
                        onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-red-500/50 transition-colors"
                      >
                        {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm font-medium mb-1.5">Language</label>
                      <select
                        value={form.language}
                        onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-red-500/50 transition-colors"
                      >
                        {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-1.5">File Size (e.g. 1.4 GB)</label>
                    <input
                      type="text"
                      value={form.size}
                      onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                      placeholder="1.4 GB"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>

                  {selectedMovie.media_type === "tv" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-1.5">Season</label>
                        <input
                          type="number"
                          value={form.season}
                          onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
                          placeholder="1"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 text-sm font-medium mb-1.5">Episode</label>
                        <input
                          type="number"
                          value={form.episode}
                          onChange={(e) => setForm((f) => ({ ...f, episode: e.target.value }))}
                          placeholder="1"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 text-sm outline-none focus:border-red-500/50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 p-6 border-t border-white/10">
                  <button
                    onClick={() => setAddModalOpen(false)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all border border-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddContent}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <FiSave className="w-4 h-4" />
                    Add to Library
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
