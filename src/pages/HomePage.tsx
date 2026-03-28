import { useEffect, useState } from "react";
import { tmdb, TMDBMovie } from "../lib/tmdb";
import HeroBanner from "../components/HeroBanner";
import ContentRow from "../components/ContentRow";
import { motion } from "framer-motion";
import { FiTrendingUp, FiStar, FiClock, FiFilm } from "react-icons/fi";

const STATS = [
  { icon: FiFilm, label: "Movies", value: "10K+", color: "text-red-400" },
  { icon: FiTrendingUp, label: "Trending", value: "Daily", color: "text-blue-400" },
  { icon: FiStar, label: "Top Rated", value: "9.0+", color: "text-yellow-400" },
  { icon: FiClock, label: "New Daily", value: "50+", color: "text-green-400" },
];

export default function HomePage() {
  const [trending, setTrending] = useState<TMDBMovie[]>([]);
  const [popular, setPopular] = useState<TMDBMovie[]>([]);
  const [topRated, setTopRated] = useState<TMDBMovie[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TMDBMovie[]>([]);
  const [popularTV, setPopularTV] = useState<TMDBMovie[]>([]);
  const [topRatedTV, setTopRatedTV] = useState<TMDBMovie[]>([]);
  const [upcoming, setUpcoming] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          trendingData,
          popularData,
          topRatedData,
          nowPlayingData,
          popularTVData,
          topRatedTVData,
          upcomingData,
        ] = await Promise.all([
          tmdb.getTrending("all", "week"),
          tmdb.getPopularMovies(),
          tmdb.getTopRatedMovies(),
          tmdb.getNowPlayingMovies(),
          tmdb.getPopularTV(),
          tmdb.getTopRatedTV(),
          tmdb.getUpcomingMovies(),
        ]);

        setTrending(trendingData.results);
        setPopular(popularData.results);
        setTopRated(topRatedData.results);
        setNowPlaying(nowPlayingData.results);
        setPopularTV(popularTVData.results);
        setTopRatedTV(topRatedTVData.results);
        setUpcoming(upcomingData.results);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Banner */}
      {trending.length > 0 ? (
        <HeroBanner movies={trending} />
      ) : (
        <div className="h-[85vh] min-h-[550px] bg-gradient-to-br from-gray-900 to-black animate-pulse" />
      )}

      {/* Stats Bar */}
      <div className="relative -mt-8 z-10 mx-4 sm:mx-6 lg:mx-8 mb-8">
        <div className="max-w-screen-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {STATS.map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-lg font-black ${color}`}>{value}</p>
                  <p className="text-gray-400 text-xs">{label}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Content Rows */}
      <div className="space-y-8 pb-20">
        <ContentRow title="🔥 Trending This Week" movies={trending} loading={loading} showRank={false} />
        <ContentRow title="🎬 Now Playing" movies={nowPlaying} loading={loading} />
        <ContentRow title="🏆 Top Rated Movies" movies={topRated} loading={loading} showRank />
        <ContentRow title="⭐ Popular Movies" movies={popular} loading={loading} />
        <ContentRow title="📺 Popular Series" movies={popularTV} loading={loading} />
        <ContentRow title="🌟 Top Rated Series" movies={topRatedTV} loading={loading} showRank />
        <ContentRow title="🎭 Coming Soon" movies={upcoming} loading={loading} />

        {/* Telegram CTA */}
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="max-w-screen-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/50 via-blue-800/30 to-purple-900/50 border border-blue-500/20 p-8 lg:p-12"
            >
              {/* Background decoration */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
              </div>

              <div className="relative flex flex-col lg:flex-row items-center gap-6 lg:gap-12">
                <div className="flex-1 text-center lg:text-left">
                  <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto lg:mx-0 mb-4">
                    <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.476c-.147.66-.537.819-1.084.51l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.18 14.238l-2.956-.924c-.643-.2-.656-.643.136-.953l11.553-4.456c.537-.194 1.006.133.649.343z"/>
                    </svg>
                  </div>
                  <h3 className="text-white font-bold text-2xl lg:text-3xl mb-2">
                    Download via Telegram
                  </h3>
                  <p className="text-gray-300 text-sm lg:text-base max-w-md mx-auto lg:mx-0">
                    All files are stored securely on Telegram. Subscribe to our channel and get instant access to download any movie or series directly to your device.
                  </p>
                </div>
                <div className="flex flex-col gap-3 w-full lg:w-auto">
                  <a
                    href="https://t.me/StreamyFlixServerBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 text-center"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.476c-.147.66-.537.819-1.084.51l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.18 14.238l-2.956-.924c-.643-.2-.656-.643.136-.953l11.553-4.456c.537-.194 1.006.133.649.343z"/>
                    </svg>
                    Start Bot & Download
                  </a>
                  <a
                    href="https://t.me/StreamyFlixServerBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-all border border-white/10 text-sm"
                  >
                    Join Channel for Updates
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
