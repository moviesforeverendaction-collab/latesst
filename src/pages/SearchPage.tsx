import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiFilter, FiX } from "react-icons/fi";
import { tmdb, TMDBMovie, GENRES } from "../lib/tmdb";
import MovieCard from "../components/MovieCard";

const GENRE_LIST = Object.entries(GENRES).map(([id, name]) => ({ id: parseInt(id), name }));

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [localQuery, setLocalQuery] = useState(query);
  const [activeFilter, setActiveFilter] = useState<"all" | "movie" | "tv">("all");
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const search = useCallback(async (q: string, p = 1) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await tmdb.searchMulti(q, p);
      const filtered = data.results.filter((m) => m.media_type !== "person" && (m.poster_path || m.backdrop_path));
      if (p === 1) {
        setResults(filtered);
      } else {
        setResults((prev) => [...prev, ...filtered]);
      }
      setTotalPages(data.total_pages);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLocalQuery(query);
    setPage(1);
    search(query, 1);
  }, [query, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setSearchParams({ q: localQuery.trim() });
      setPage(1);
    }
  };

  const filteredResults = results.filter((m) => {
    const mediaOk = activeFilter === "all" || m.media_type === activeFilter;
    const genreOk = !selectedGenre || m.genre_ids?.includes(selectedGenre);
    return mediaOk && genreOk;
  });

  return (
    <div className="min-h-screen bg-black pt-24 pb-20">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <form onSubmit={handleSubmit} className="relative max-w-2xl">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search movies, TV series, anime..."
              className="w-full bg-gray-900 border border-white/10 rounded-2xl pl-12 pr-24 py-4 text-white placeholder-gray-500 text-lg outline-none focus:border-red-500/50 transition-colors"
              autoFocus
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
              {localQuery && (
                <button
                  type="button"
                  onClick={() => { setLocalQuery(""); setSearchParams({}); setResults([]); }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <FiX className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </motion.div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            {(["all", "movie", "tv"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeFilter === f
                    ? "bg-red-600 text-white"
                    : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
                }`}
              >
                {f === "all" ? "All" : f === "movie" ? "Movies" : "TV Series"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              showFilters || selectedGenre
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            <FiFilter className="w-4 h-4" />
            Genre
            {selectedGenre && <span className="w-2 h-2 bg-purple-400 rounded-full" />}
          </button>

          {query && (
            <p className="text-gray-400 text-sm ml-auto">
              {filteredResults.length} result{filteredResults.length !== 1 ? "s" : ""} for "<span className="text-white">{query}</span>"
            </p>
          )}
        </div>

        {/* Genre Filter */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 py-2">
                <button
                  onClick={() => setSelectedGenre(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    !selectedGenre ? "bg-white/20 text-white" : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  All Genres
                </button>
                {GENRE_LIST.map(({ id, name }) => (
                  <button
                    key={id}
                    onClick={() => setSelectedGenre(selectedGenre === id ? null : id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedGenre === id ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {!query && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center mb-6 text-5xl">
              🔍
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Search for anything</h2>
            <p className="text-gray-400 max-w-sm">Find movies, TV series, anime, and more. All content with easy Telegram download links.</p>
          </div>
        ) : loading && results.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden animate-pulse bg-gray-800" style={{ aspectRatio: "2/3" }} />
            ))}
          </div>
        ) : filteredResults.length === 0 && query ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-white text-2xl font-bold mb-2">No results found</h2>
            <p className="text-gray-400">Try different keywords or check the spelling.</p>
          </div>
        ) : (
          <>
            <motion.div
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              <AnimatePresence>
                {filteredResults.map((movie, i) => (
                  <motion.div
                    key={movie.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <MovieCard movie={movie} index={i} size="md" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {page < totalPages && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    search(query, next);
                  }}
                  disabled={loading}
                  className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
