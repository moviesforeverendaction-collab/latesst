import { useState } from "react";
import { motion } from "framer-motion";
import { FiPlay, FiPlus, FiCheck, FiStar, FiInfo } from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { TMDBMovie, TMDB_IMG_W500, TMDB_IMG_W300, GENRES } from "../lib/tmdb";
import { useStore } from "../store/useStore";
import toast from "react-hot-toast";

interface MovieCardProps {
  movie: TMDBMovie;
  index?: number;
  size?: "sm" | "md" | "lg";
  showRank?: boolean;
}

export default function MovieCard({ movie, index = 0, size = "md", showRank = false }: MovieCardProps) {
  const [hovered, setHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useStore();

  const title = movie.title || movie.name || "Unknown";
  const mediaType = movie.media_type || (movie.title ? "movie" : "tv");
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
  const rating = movie.vote_average?.toFixed(1) || "N/A";
  const genres = movie.genre_ids?.slice(0, 2).map((id) => GENRES[id]).filter(Boolean) || [];
  const inList = isInWatchlist(movie.id);

  const posterSrc = movie.poster_path
    ? (size === "sm" ? `${TMDB_IMG_W300}${movie.poster_path}` : `${TMDB_IMG_W500}${movie.poster_path}`)
    : null;

  const handleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inList) {
      removeFromWatchlist(movie.id);
      toast("Removed from watchlist", { icon: "🗑️" });
    } else {
      addToWatchlist({
        id: movie.id,
        mediaType: mediaType as "movie" | "tv",
        addedAt: new Date().toISOString(),
        movie,
      });
      toast.success("Added to watchlist!", {
        style: { background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" },
      });
    }
  };

  const handleClick = () => navigate(`/${mediaType}/${movie.id}`);
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://t.me/StreamyFlixServerBot?start=dl_${mediaType}_${movie.id}`, "_blank");
  };

  const sizeClasses = {
    sm: "w-32 sm:w-36",
    md: "w-36 sm:w-44",
    lg: "w-44 sm:w-52",
  };

  return (
    <motion.div
      className={`relative flex-shrink-0 ${sizeClasses[size]} cursor-pointer group`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Rank Number */}
      {showRank && (
        <div className="absolute -left-3 bottom-2 z-10 text-gray-500 font-black select-none"
          style={{ fontSize: "clamp(3rem, 8vw, 6rem)", fontFamily: "'Bebas Neue', sans-serif", WebkitTextStroke: "2px rgba(255,255,255,0.15)", color: "transparent" }}>
          {index + 1}
        </div>
      )}

      {/* Card */}
      <motion.div
        whileHover={{ scale: 1.05, zIndex: 20 }}
        transition={{ duration: 0.3 }}
        className="relative rounded-xl overflow-hidden shadow-lg shadow-black/50"
        style={{ aspectRatio: "2/3" }}
      >
        {/* Poster */}
        {posterSrc && !imageError ? (
          <img
            src={posterSrc}
            alt={title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center p-3 gap-2">
            <span className="text-4xl">🎬</span>
            <span className="text-gray-400 text-xs text-center font-medium leading-tight">{title}</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Rating Badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5">
          <FiStar className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
          <span className="text-yellow-400 text-[10px] font-bold">{rating}</span>
        </div>

        {/* Media Type Badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
            mediaType === "tv" ? "bg-blue-500/80 text-white" : "bg-red-500/80 text-white"
          }`}>
            {mediaType === "tv" ? "TV" : "Film"}
          </span>
        </div>

        {/* Hover Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={hovered ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-0 left-0 right-0 p-3 space-y-2"
        >
          <h3 className="text-white text-xs font-bold leading-tight line-clamp-2">{title}</h3>
          <div className="flex items-center gap-1 flex-wrap">
            {year && <span className="text-gray-400 text-[10px]">{year}</span>}
            {genres.slice(0, 1).map((g) => (
              <span key={g} className="text-gray-400 text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                {g}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleClick(); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white text-[10px] font-bold transition-colors"
            >
              <FiPlay className="w-2.5 h-2.5" />
              Play
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center p-1.5 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-400 transition-colors border border-blue-500/30"
              title="Download via Telegram"
            >
              <FaTelegramPlane className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={handleWatchlist}
              className={`flex items-center justify-center p-1.5 rounded-lg transition-colors border ${
                inList
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : "bg-white/10 border-white/20 text-white"
              }`}
            >
              {inList ? (
                <FiCheck className="w-2.5 h-2.5" />
              ) : (
                <FiPlus className="w-2.5 h-2.5" />
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
