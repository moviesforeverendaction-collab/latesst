import { motion, AnimatePresence } from "framer-motion";
import { FiTrash2, FiPlay, FiCalendar, FiStar } from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";
import { TMDB_IMG_W500 } from "../lib/tmdb";
import toast from "react-hot-toast";

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist, telegramConfig } = useStore();
  const navigate = useNavigate();

  const handleRemove = (id: number, title: string) => {
    removeFromWatchlist(id);
    toast(`Removed "${title}" from watchlist`, { icon: "🗑️" });
  };

  return (
    <div className="min-h-screen bg-black pt-24 pb-20">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            📋 My Watchlist
          </h1>
          <p className="text-gray-400 text-sm">
            {watchlist.length} title{watchlist.length !== 1 ? "s" : ""} saved
          </p>
        </motion.div>

        {watchlist.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-32 text-center"
          >
            <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-6 text-5xl">
              📋
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Your watchlist is empty</h2>
            <p className="text-gray-400 max-w-sm mb-6">Browse movies and TV series, then click the + button to save them here.</p>
            <button
              onClick={() => navigate("/movies")}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all"
            >
              Browse Movies
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence>
              {watchlist.map((item, index) => {
                const title = item.movie.title || item.movie.name || "Unknown";
                const year = (item.movie.release_date || item.movie.first_air_date || "").slice(0, 4);
                const rating = item.movie.vote_average?.toFixed(1);
                const botUser = telegramConfig.botUsername || "StreamyFlixServerBot";

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative"
                  >
                    {/* Poster */}
                    <div
                      className="relative rounded-xl overflow-hidden cursor-pointer shadow-lg shadow-black/50"
                      style={{ aspectRatio: "2/3" }}
                      onClick={() => navigate(`/${item.mediaType}/${item.id}`)}
                    >
                      {item.movie.poster_path ? (
                        <img
                          src={`${TMDB_IMG_W500}${item.movie.poster_path}`}
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                          <span className="text-4xl">🎬</span>
                        </div>
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Rating */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5">
                        <FiStar className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-yellow-400 text-[10px] font-bold">{rating}</span>
                      </div>

                      {/* Type badge */}
                      <div className="absolute top-2 left-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          item.mediaType === "tv" ? "bg-blue-500/80 text-white" : "bg-red-500/80 text-white"
                        }`}>
                          {item.mediaType === "tv" ? "TV" : "Film"}
                        </span>
                      </div>

                      {/* Hover Actions */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 space-y-2">
                        <h3 className="text-white text-xs font-bold line-clamp-2">{title}</h3>
                        <div className="flex gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/${item.mediaType}/${item.id}`); }}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-[10px] font-bold transition-colors"
                          >
                            <FiPlay className="w-2.5 h-2.5" />
                            Play
                          </button>
                          <a
                            href={`https://t.me/${botUser}?start=dl_${item.mediaType}_${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center p-1.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 rounded-lg text-blue-400"
                          >
                            <FaTelegramPlane className="w-2.5 h-2.5" />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemove(item.id, title); }}
                            className="flex items-center justify-center p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 rounded-lg text-red-400"
                          >
                            <FiTrash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Info below */}
                    <div className="mt-2 px-0.5">
                      <h3 className="text-white text-xs font-semibold leading-tight line-clamp-1">{title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {year && (
                          <span className="flex items-center gap-0.5 text-gray-500 text-[10px]">
                            <FiCalendar className="w-2.5 h-2.5" />
                            {year}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
