import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlay, FiPlus, FiCheck, FiStar, FiClock, FiCalendar,
  FiArrowLeft, FiDownload, FiShare2, FiGlobe, FiUsers, FiX,
} from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import {
  tmdb, TMDBDetail, TMDBVideo, TMDBCast,
  TMDB_IMG_ORIGINAL, TMDB_IMG_W500, TMDB_IMG_W300,
} from "../lib/tmdb";
import { useStore } from "../store/useStore";
import ContentRow from "../components/ContentRow";
import toast from "react-hot-toast";

export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState<TMDBDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "cast" | "seasons" | "download">("overview");
  const { addToWatchlist, removeFromWatchlist, isInWatchlist, telegramConfig } = useStore();
  const videoRef = useRef<HTMLIFrameElement>(null);

  const mediaType = location.pathname.startsWith("/tv") ? "tv" : "movie";
  const numId = parseInt(id || "0");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = mediaType === "tv"
          ? await tmdb.getTVDetails(numId)
          : await tmdb.getMovieDetails(numId);
        setDetail(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    load();
    window.scrollTo(0, 0);
  }, [id, mediaType, numId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-20">
        <div className="animate-pulse space-y-4 p-8">
          <div className="h-96 bg-gray-800 rounded-2xl" />
          <div className="h-8 bg-gray-800 rounded w-1/2" />
          <div className="h-4 bg-gray-800 rounded w-3/4" />
          <div className="h-4 bg-gray-800 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-20">
        <div className="text-center">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-white text-2xl font-bold mb-2">Not Found</h2>
          <button onClick={() => navigate(-1)} className="text-red-400 hover:text-red-300">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const title = detail.title || detail.name || "Unknown";
  const year = (detail.release_date || detail.first_air_date || "").slice(0, 4);
  const rating = detail.vote_average?.toFixed(1);
  const runtime = detail.runtime || (detail.episode_run_time?.[0]);
  const genres = detail.genres || [];
  const inList = isInWatchlist(detail.id);

  const trailer: TMDBVideo | undefined = detail.videos?.results?.find(
    (v) => v.type === "Trailer" && v.site === "YouTube" && v.official
  ) || detail.videos?.results?.find((v) => v.type === "Trailer" && v.site === "YouTube");

  const cast: TMDBCast[] = detail.credits?.cast?.slice(0, 20) || [];
  const director = detail.credits?.crew?.find((c) => c.job === "Director");

  const recommendations = [
    ...(detail.recommendations?.results || []),
    ...(detail.similar?.results || []),
  ].filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i).slice(0, 15);

  const handleWatchlist = () => {
    if (inList) {
      removeFromWatchlist(detail.id);
      toast("Removed from watchlist", { icon: "🗑️" });
    } else {
      addToWatchlist({
        id: detail.id,
        mediaType,
        addedAt: new Date().toISOString(),
        movie: detail,
      });
      toast.success("Added to watchlist!");
    }
  };

  const handleDownload = () => {
    const botUser = telegramConfig.botUsername || "StreamyFlixServerBot";
    window.open(`https://t.me/${botUser}?start=dl_${mediaType}_${detail.id}`, "_blank");
    toast.success("Redirecting to Telegram bot...", {
      style: { background: "#1a1a2e", color: "#fff" },
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "cast" as const, label: "Cast" },
    ...(mediaType === "tv" ? [{ id: "seasons" as const, label: "Seasons" }] : []),
    { id: "download" as const, label: "Download" },
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Backdrop */}
      <div className="relative h-[60vh] sm:h-[70vh] overflow-hidden">
        {detail.backdrop_path ? (
          <img
            src={`${TMDB_IMG_ORIGINAL}${detail.backdrop_path}`}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-20 left-4 sm:left-8 w-10 h-10 bg-black/60 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-all z-10"
        >
          <FiArrowLeft className="w-5 h-5" />
        </button>

        {/* Play Button */}
        {trailer && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTrailerOpen(true)}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-sm border-2 border-white/50 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all group"
            >
              <FiPlay className="w-7 h-7 sm:w-9 sm:h-9 fill-current ml-1 group-hover:scale-110 transition-transform" />
            </motion.button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-shrink-0 mx-auto lg:mx-0"
          >
            <div className="relative w-48 sm:w-56 lg:w-64">
              {detail.poster_path ? (
                <img
                  src={`${TMDB_IMG_W500}${detail.poster_path}`}
                  alt={title}
                  className="w-full rounded-2xl shadow-2xl border border-white/10"
                  style={{ aspectRatio: "2/3", objectFit: "cover" }}
                />
              ) : (
                <div className="w-full rounded-2xl bg-gray-800 flex items-center justify-center" style={{ aspectRatio: "2/3" }}>
                  <span className="text-6xl">🎬</span>
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            </div>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 space-y-4 pb-4"
          >
            {/* Badges */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                mediaType === "tv" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}>
                {mediaType === "tv" ? "TV Series" : "Movie"}
              </span>
              {year && (
                <span className="flex items-center gap-1 text-gray-400 text-sm">
                  <FiCalendar className="w-3.5 h-3.5" />
                  {year}
                </span>
              )}
              {runtime && (
                <span className="flex items-center gap-1 text-gray-400 text-sm">
                  <FiClock className="w-3.5 h-3.5" />
                  {runtime} min
                </span>
              )}
              <span className="flex items-center gap-1 text-yellow-400 text-sm font-bold">
                <FiStar className="w-4 h-4 fill-yellow-400" />
                {rating} <span className="text-gray-500 font-normal text-xs">({detail.vote_count?.toLocaleString()})</span>
              </span>
              <span className="flex items-center gap-1 text-gray-400 text-xs">
                <FiGlobe className="w-3.5 h-3.5" />
                {detail.original_language?.toUpperCase()}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              {title}
            </h1>

            {/* Tagline */}
            {detail.tagline && (
              <p className="text-gray-400 italic text-sm">"{detail.tagline}"</p>
            )}

            {/* Genres */}
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g.id} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-gray-300 text-xs hover:bg-white/10 transition-colors cursor-pointer">
                  {g.name}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={trailer ? () => setTrailerOpen(true) : undefined}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!trailer}
              >
                <FiPlay className="w-4 h-4 fill-current" />
                {trailer ? "Watch Trailer" : "No Trailer"}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold rounded-xl border border-blue-500/30 transition-all"
              >
                <FaTelegramPlane className="w-4 h-4" />
                Download
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleWatchlist}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl border font-semibold transition-all ${
                  inList
                    ? "bg-green-500/20 border-green-500/30 text-green-400"
                    : "bg-white/5 border-white/20 text-white hover:bg-white/10"
                }`}
              >
                {inList ? <FiCheck className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                {inList ? "In Watchlist" : "Add to List"}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleShare}
                className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/20 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <FiShare2 className="w-4 h-4" />
              </motion.button>
            </div>

            {/* TV Season/Episode info */}
            {mediaType === "tv" && (
              <div className="flex gap-4 text-sm">
                {detail.number_of_seasons && (
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <span className="w-6 h-6 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">S</span>
                    {detail.number_of_seasons} Season{detail.number_of_seasons > 1 ? "s" : ""}
                  </div>
                )}
                {detail.number_of_episodes && (
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <span className="w-6 h-6 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center text-xs font-bold">E</span>
                    {detail.number_of_episodes} Episodes
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="mt-8">
          <div className="flex border-b border-white/10 mb-6 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-all relative ${
                  activeTab === tab.id ? "text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="detailTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Overview */}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <p className="text-gray-300 text-base leading-relaxed max-w-3xl">
                  {detail.overview || "No description available."}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {director && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Director</p>
                      <p className="text-white text-sm font-medium">{director.name}</p>
                    </div>
                  )}
                  {detail.status && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Status</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        detail.status === "Released" || detail.status === "Ended"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}>{detail.status}</span>
                    </div>
                  )}
                  {detail.original_language && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Language</p>
                      <p className="text-white text-sm font-medium">{detail.original_language.toUpperCase()}</p>
                    </div>
                  )}
                  {detail.popularity && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Popularity</p>
                      <p className="text-white text-sm font-medium">{Math.round(detail.popularity).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Cast */}
            {activeTab === "cast" && (
              <motion.div
                key="cast"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {cast.length === 0 ? (
                  <p className="text-gray-400">No cast information available.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {cast.map((actor) => (
                      <motion.div
                        key={actor.id}
                        whileHover={{ scale: 1.03 }}
                        className="bg-gray-900/50 border border-white/5 rounded-xl overflow-hidden"
                      >
                        {actor.profile_path ? (
                          <img
                            src={`${TMDB_IMG_W300}${actor.profile_path}`}
                            alt={actor.name}
                            className="w-full object-cover"
                            style={{ aspectRatio: "2/3" }}
                          />
                        ) : (
                          <div className="w-full bg-gray-800 flex items-center justify-center" style={{ aspectRatio: "2/3" }}>
                            <FiUsers className="w-8 h-8 text-gray-600" />
                          </div>
                        )}
                        <div className="p-2.5">
                          <p className="text-white text-xs font-semibold leading-tight">{actor.name}</p>
                          <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-1">{actor.character}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Seasons */}
            {activeTab === "seasons" && mediaType === "tv" && (
              <motion.div
                key="seasons"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Season Selector */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {detail.seasons?.map((s) => (
                    <button
                      key={s.season_number}
                      onClick={() => setSelectedSeason(s.season_number)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        selectedSeason === s.season_number
                          ? "bg-red-600 text-white"
                          : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>

                {detail.seasons?.filter((s) => s.season_number === selectedSeason).map((season) => (
                  <div key={season.season_number} className="bg-gray-900/50 border border-white/10 rounded-2xl p-4">
                    <div className="flex gap-4 items-start">
                      {season.poster_path && (
                        <img
                          src={`${TMDB_IMG_W300}${season.poster_path}`}
                          alt={season.name}
                          className="w-20 rounded-xl flex-shrink-0 border border-white/10"
                          style={{ aspectRatio: "2/3", objectFit: "cover" }}
                        />
                      )}
                      <div className="space-y-2">
                        <h3 className="text-white font-bold text-lg">{season.name}</h3>
                        <p className="text-gray-400 text-sm">{season.episode_count} Episodes</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: Math.min(season.episode_count, 12) }, (_, i) => i + 1).map((ep) => (
                            <motion.button
                              key={ep}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                const botUser = telegramConfig.botUsername || "StreamyFlixServerBot";
                                window.open(`https://t.me/${botUser}?start=dl_tv_${detail.id}_s${season.season_number}_e${ep}`, "_blank");
                              }}
                              className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                            >
                              <FaTelegramPlane className="w-2.5 h-2.5" />
                              E{ep}
                            </motion.button>
                          ))}
                          {season.episode_count > 12 && (
                            <button
                              onClick={() => {
                                const botUser = telegramConfig.botUsername || "StreamyFlixServerBot";
                                window.open(`https://t.me/${botUser}?start=dl_tv_${detail.id}_s${season.season_number}`, "_blank");
                              }}
                              className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-xs transition-all hover:bg-white/10"
                            >
                              +{season.episode_count - 12} more on Telegram
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Download */}
            {activeTab === "download" && (
              <motion.div
                key="download"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 max-w-xl"
              >
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-3">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <FaTelegramPlane className="w-5 h-5 text-blue-400" />
                    Download via Telegram Bot
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Files are securely stored on Telegram. Click the button below to open our bot and request your download. The bot will send you the file directly.
                  </p>
                  <div className="space-y-2">
                    {["1080p HD", "720p HD", "480p SD", "Full Batch"].map((quality) => (
                      <motion.a
                        key={quality}
                        href={`https://t.me/${telegramConfig.botUsername || "StreamyFlixServerBot"}?start=dl_${mediaType}_${detail.id}_${quality.replace(/\s/g, "_").toLowerCase()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.02, x: 4 }}
                        className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center">
                            <FiDownload className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="font-medium text-sm">{title} — {quality}</span>
                        </div>
                        <FaTelegramPlane className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.a>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-gray-900/50 border border-white/5 rounded-2xl text-xs text-gray-500 space-y-1">
                  <p>⚠️ Make sure you've joined our Telegram channel before downloading.</p>
                  <p>📱 Files are delivered directly to your Telegram DM via our bot.</p>
                  <p>🔒 All files are scanned and safely distributed via Telegram's secure servers.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-12 pb-20">
            <ContentRow
              title="You Might Also Like"
              movies={recommendations}
              showRank={false}
            />
          </div>
        )}
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {trailerOpen && trailer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTrailerOpen(false)}
              className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="text-white font-bold">{title} — Trailer</h3>
                  <button
                    onClick={() => setTrailerOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    ref={videoRef}
                    src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&modestbranding=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title={`${title} Trailer`}
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
