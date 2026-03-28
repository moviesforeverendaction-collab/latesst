import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiGrid, FiList, FiChevronDown } from "react-icons/fi";
import { tmdb, TMDBMovie, GENRES } from "../lib/tmdb";
import MovieCard from "../components/MovieCard";

const MOVIE_GENRES = [28, 12, 16, 35, 80, 18, 14, 27, 10749, 878, 53, 37];
const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "top_rated", label: "Top Rated" },
  { value: "now_playing", label: "Now Playing" },
  { value: "upcoming", label: "Upcoming" },
];

interface MoviesPageProps {
  defaultType?: "movie" | "tv";
}

export default function MoviesPage({ defaultType = "movie" }: MoviesPageProps) {
  const isTV = defaultType === "tv";
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("popular");
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchMovies = useCallback(async (p = 1, append = false) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      let data;
      if (selectedGenre) {
        data = isTV
          ? await tmdb.getTVByGenre(selectedGenre, p)
          : await tmdb.getMoviesByGenre(selectedGenre, p);
      } else {
        if (isTV) {
          data = sortBy === "popular"
            ? await tmdb.getPopularTV(p)
            : await tmdb.getTopRatedTV(p);
        } else {
          data = sortBy === "popular" ? await tmdb.getPopularMovies(p)
            : sortBy === "top_rated" ? await tmdb.getTopRatedMovies(p)
            : sortBy === "now_playing" ? await tmdb.getNowPlayingMovies(p)
            : await tmdb.getUpcomingMovies(p);
        }
      }
      if (append) {
        setMovies((prev) => [...prev, ...data.results]);
      } else {
        setMovies(data.results);
      }
      setTotalPages(data.total_pages);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [sortBy, selectedGenre, isTV]);

  useEffect(() => {
    setPage(1);
    fetchMovies(1, false);
  }, [sortBy, selectedGenre, fetchMovies]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchMovies(next, true);
  };

  const genres = MOVIE_GENRES.map((id) => ({ id, name: GENRES[id] })).filter((g) => g.name);

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
            {isTV ? "📺 TV Series" : "🎬 Movies"}
          </h1>
          <p className="text-gray-400 text-sm">
            {isTV ? "Discover the best TV series from around the world" : "Explore thousands of movies across all genres"}
          </p>
        </motion.div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Sort */}
          {!isTV && (
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-gray-900 border border-white/10 text-white rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-red-500/50 cursor-pointer transition-colors"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* View Mode */}
          <div className="flex gap-1 bg-gray-900 border border-white/10 rounded-xl p-1 ml-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
            >
              <FiGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
            >
              <FiList className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Genre Filter */}
        <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setSelectedGenre(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              !selectedGenre ? "bg-red-600 text-white shadow-lg shadow-red-500/30" : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            All Genres
          </button>
          {genres.map(({ id, name }) => (
            <button
              key={id}
              onClick={() => setSelectedGenre(selectedGenre === id ? null : id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                selectedGenre === id ? "bg-red-600 text-white shadow-lg shadow-red-500/30" : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className={`grid gap-4 ${
            viewMode === "grid"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              : "grid-cols-1"
          }`}>
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden animate-pulse bg-gray-800" style={{ aspectRatio: "2/3" }} />
            ))}
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${sortBy}-${selectedGenre}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`grid gap-4 ${
                  viewMode === "grid"
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {movies.map((movie, i) => (
                  <MovieCard key={movie.id} movie={movie} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>

            {page < totalPages && (
              <div className="mt-10 flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-10 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center gap-3"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
