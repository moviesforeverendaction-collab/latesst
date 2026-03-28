import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TMDBMovie } from "../lib/tmdb";

export interface TelegramConfig {
  botToken: string;
  channelId: string;
  botUsername: string;
  forceSubChannelLink: string;
  backendUrl: string;
  adminApiKey: string; // NEW: matches ADMIN_API_KEY on the bot backend
}

export interface MTProtoConfig {
  apiId: string;
  apiHash: string;
  sessionString: string;
}

export interface MongoConfig {
  uri: string;
  dbName: string;
  collectionName: string;
}

export interface IndexedFile {
  _id?: string;
  file_id: string;
  file_unique_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  message_id: number;
  channel_id: string;
  tmdb_id: number | null;
  media_type: "movie" | "tv" | "unknown";
  title: string;
  quality: string;
  language: string;
  season?: number;
  episode?: number;
  duration?: number;
  indexed_at: string;
  download_count: number;
  thumb?: string;
}

export interface LocalContent {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  telegramFileId: string;
  telegramMessageId?: number;
  quality: string;
  size: string;
  language: string;
  addedAt: string;
  season?: number;
  episode?: number;
  downloadCount: number;
}

export interface WatchlistItem {
  id: number;
  mediaType: "movie" | "tv";
  addedAt: string;
  movie: TMDBMovie;
}

interface AppState {
  telegramConfig: TelegramConfig;
  setTelegramConfig: (config: TelegramConfig) => void;

  mtprotoConfig: MTProtoConfig;
  setMtprotoConfig: (config: MTProtoConfig) => void;

  mongoConfig: MongoConfig;
  setMongoConfig: (config: MongoConfig) => void;

  contentLibrary: LocalContent[];
  addContent: (content: LocalContent) => void;
  removeContent: (id: string) => void;
  updateDownloadCount: (id: string) => void;

  indexedFiles: IndexedFile[];
  setIndexedFiles: (files: IndexedFile[]) => void;
  addIndexedFile: (file: IndexedFile) => void;
  removeIndexedFile: (fileId: string) => void;

  watchlist: WatchlistItem[];
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (id: number) => void;
  isInWatchlist: (id: number) => boolean;

  watchHistory: { id: number; mediaType: string; watchedAt: string; progress: number }[];
  addToHistory: (id: number, mediaType: string, progress: number) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  activeGenre: number | null;
  setActiveGenre: (id: number | null) => void;

  isAdminMode: boolean;
  adminPassword: string;
  setAdminMode: (val: boolean) => void;
  setAdminPassword: (pass: string) => void;

  accentColor: string;
  setAccentColor: (color: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      telegramConfig: {
        botToken: "",
        channelId: "",
        botUsername: "",
        forceSubChannelLink: "",
        backendUrl: "",
        adminApiKey: "",
      },
      setTelegramConfig: (config) => set({ telegramConfig: config }),

      mtprotoConfig: { apiId: "", apiHash: "", sessionString: "" },
      setMtprotoConfig: (config) => set({ mtprotoConfig: config }),

      mongoConfig: { uri: "", dbName: "streamyflix", collectionName: "files" },
      setMongoConfig: (config) => set({ mongoConfig: config }),

      contentLibrary: [],
      addContent: (content) => set((s) => ({ contentLibrary: [content, ...s.contentLibrary] })),
      removeContent: (id) => set((s) => ({ contentLibrary: s.contentLibrary.filter((c) => c.id !== id) })),
      updateDownloadCount: (id) =>
        set((s) => ({
          contentLibrary: s.contentLibrary.map((c) =>
            c.id === id ? { ...c, downloadCount: c.downloadCount + 1 } : c
          ),
        })),

      indexedFiles: [],
      setIndexedFiles: (files) => set({ indexedFiles: files }),
      addIndexedFile: (file) =>
        set((s) => ({ indexedFiles: [file, ...s.indexedFiles.filter((f) => f.file_unique_id !== file.file_unique_id)] })),
      removeIndexedFile: (fileId) =>
        set((s) => ({ indexedFiles: s.indexedFiles.filter((f) => f.file_id !== fileId) })),

      watchlist: [],
      addToWatchlist: (item) => set((s) => ({ watchlist: [item, ...s.watchlist] })),
      removeFromWatchlist: (id) => set((s) => ({ watchlist: s.watchlist.filter((w) => w.id !== id) })),
      isInWatchlist: (id) => get().watchlist.some((w) => w.id === id),

      watchHistory: [],
      addToHistory: (id, mediaType, progress) =>
        set((s) => ({
          watchHistory: [
            { id, mediaType, watchedAt: new Date().toISOString(), progress },
            ...s.watchHistory.filter((h) => h.id !== id),
          ].slice(0, 50),
        })),

      searchQuery: "",
      setSearchQuery: (q) => set({ searchQuery: q }),

      activeGenre: null,
      setActiveGenre: (id) => set({ activeGenre: id }),

      isAdminMode: false,
      adminPassword: "streamyflix2024",
      setAdminMode: (val) => set({ isAdminMode: val }),
      setAdminPassword: (pass) => set({ adminPassword: pass }),

      accentColor: "#e50914",
      setAccentColor: (color) => set({ accentColor: color }),
    }),
    {
      name: "streamyflix-store",
      partialize: (state) => ({
        telegramConfig: state.telegramConfig,
        mtprotoConfig: state.mtprotoConfig,
        mongoConfig: state.mongoConfig,
        contentLibrary: state.contentLibrary,
        indexedFiles: state.indexedFiles,
        watchlist: state.watchlist,
        watchHistory: state.watchHistory,
        adminPassword: state.adminPassword,
        accentColor: state.accentColor,
      }),
    }
  )
);
