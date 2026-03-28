import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiPlay, FiInfo, FiPlus, FiCheck, FiVolume2, FiVolumeX, FiStar } from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { TMDBMovie, TMDB_IMG_ORIGINAL, TMDB_IMG_W500, GENRES } from "../lib/tmdb";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";

interface HeroBannerProps {
  movies: TMDBMovie[];
}

export default function HeroBanner({ movies }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const navigate = useNavigate();
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useStore();

  const current = movies[currentIndex];

  useEffect(() => {
    if (!movies.length) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % Math.min(movies.length, 8));
    }, 7000);
    return () => clearInterval(timer);
  }, [movies.length]);

  if (!current) return null;

  const title = current.title || current.name || "Unknown";
  const mediaType = current.media_type || (current.title ? "movie" : "tv");
  const year = (current.release_date || current.first_air_date || "").slice(0, 4);
  const rating = current.vote_average.toFixed(1);
  const genres = current.genre_ids?.slice(0, 3).map((id) => GENRES[id]).filter(Boolean) || [];
  const inList = isInWatchlist(current.id);

  const handleWatchlist = () => {
    if (inList) {
      removeFromWatchlist(current.id);
      toast("Removed from watchlist", { icon: "🗑️" });
    } else {
      addToWatchlist({
        id: current.id,
        mediaType: mediaType as "movie" | "tv",
        addedAt: new Date().toISOString(),
        movie: current,
      });
      toast.success("Added to watchlist!");
    }
  };

  return (
    <div className="relative h-[85vh] min-h-[550px] max-h-[900px] overflow-hidden">
      {/* Background Images */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
        >
          {current.backdrop_path ? (
            <img
              src={`${TMDB_IMG_ORIGINAL}${current.backdrop_path}`}
              alt={title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
          )}

          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="absolute inset-0 flex items-center">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <div className="max-w-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={`content-${currentIndex}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="space-y-4"
              >
                {/* Badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 bg-red-500 rounded text-white text-xs font-bold uppercase tracking-wider">
                    {mediaType === "tv" ? "Series" : "Movie"}
                  </span>
                  {year && (
                    <span className="px-2.5 py-1 bg-white/10 rounded text-gray-200 text-xs font-medium">
                      {year}
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-400 text-xs font-bold">
                    <FiStar className="w-3 h-3" />
                    {rating}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-tight drop-shadow-2xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {title}
                </h1>

                {/* Genres */}
                {genres.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => (
                      <span key={g} className="text-xs text-gray-300 bg-white/10 border border-white/10 px-3 py-1 rounded-full">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Overview */}
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed line-clamp-3 max-w-xl">
                  {current.overview || "No description available."}
                </p>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(239,68,68,0.5)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/${mediaType}/${current.id}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-red-500/30"
                  >
                    <FiPlay className="w-5 h-5 fill-current" />
                    Watch Now
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/${mediaType}/${current.id}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl backdrop-blur-sm border border-white/20 transition-all"
                  >
                    <FiInfo className="w-5 h-5" />
                    More Info
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleWatchlist}
                    className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/20 backdrop-blur-sm transition-all"
                  >
                    {inList ? (
                      <FiCheck className="w-5 h-5 text-green-400" />
                    ) : (
                      <FiPlus className="w-5 h-5" />
                    )}
                  </motion.button>

                  <motion.a
                    href="https://t.me/StreamyFlixServerBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 px-5 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-xl border border-blue-500/30 backdrop-blur-sm transition-all"
                  >
                    <FaTelegramPlane className="w-5 h-5" />
                    Download
                  </motion.a>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Poster Preview (right side, desktop) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`poster-${currentIndex}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="absolute right-8 lg:right-16 top-1/2 -translate-y-1/2 hidden xl:block"
        >
          {current.poster_path && (
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-3xl scale-110" />
              <img
                src={`${TMDB_IMG_W500}${current.poster_path}`}
                alt={title}
                className="relative w-52 lg:w-64 rounded-2xl shadow-2xl border border-white/10 object-cover"
                style={{ aspectRatio: "2/3" }}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sound Toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        onClick={() => setMuted(!muted)}
        className="absolute right-6 bottom-24 w-10 h-10 bg-black/50 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-all backdrop-blur-sm"
      >
        {muted ? <FiVolumeX className="w-4 h-4" /> : <FiVolume2 className="w-4 h-4" />}
      </motion.button>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {movies.slice(0, 8).map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`transition-all duration-500 rounded-full ${
              i === currentIndex
                ? "w-8 h-2 bg-red-500"
                : "w-2 h-2 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </div>
  );
}
