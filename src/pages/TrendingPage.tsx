import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { tmdb, TMDBMovie } from "../lib/tmdb";
import MovieCard from "../components/MovieCard";

type TimeWindow = "day" | "week";
type MediaType = "all" | "movie" | "tv";

export default function TrendingPage() {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("week");
  const [mediaType, setMediaType] = useState<MediaType>("all");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await tmdb.getTrending(mediaType, timeWindow);
        setMovies(data.results);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetch();
  }, [timeWindow, mediaType]);

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
            🔥 Trending Now
          </h1>
          <p className="text-gray-400 text-sm">The most popular content right now</p>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex gap-1 bg-gray-900/50 border border-white/10 rounded-xl p-1">
            {(["day", "week"] as TimeWindow[]).map((tw) => (
              <button
                key={tw}
                onClick={() => setTimeWindow(tw)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeWindow === tw ? "bg-red-600 text-white shadow-lg shadow-red-500/30" : "text-gray-400 hover:text-white"
                }`}
              >
                {tw === "day" ? "Today" : "This Week"}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-gray-900/50 border border-white/10 rounded-xl p-1">
            {(["all", "movie", "tv"] as MediaType[]).map((mt) => (
              <button
                key={mt}
                onClick={() => setMediaType(mt)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  mediaType === mt ? "bg-white/20 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {mt === "all" ? "All" : mt === "movie" ? "Movies" : "TV"}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden animate-pulse bg-gray-800" style={{ aspectRatio: "2/3" }} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${timeWindow}-${mediaType}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              {movies.map((movie, i) => (
                <MovieCard key={movie.id} movie={movie} index={i} showRank={true} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
