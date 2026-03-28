import { motion } from "framer-motion";
import { FaTelegramPlane, FaGithub, FaTwitter } from "react-icons/fa";
import { FiMail, FiShield, FiHeart } from "react-icons/fi";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-black border-t border-white/5">
      {/* Top Section */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                <span className="text-white font-black text-sm">SF</span>
              </div>
              <span className="text-white font-black text-xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                StreamyFlix
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your ultimate destination for movies and TV series. Stream anything, download via Telegram.
            </p>
            <div className="flex gap-3">
              <motion.a
                href="https://t.me/StreamyFlixServerBot"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                className="w-9 h-9 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all"
              >
                <FaTelegramPlane className="w-4 h-4" />
              </motion.a>
              <motion.a
                href="#"
                whileHover={{ scale: 1.1 }}
                className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <FaGithub className="w-4 h-4" />
              </motion.a>
              <motion.a
                href="#"
                whileHover={{ scale: 1.1 }}
                className="w-9 h-9 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <FaTwitter className="w-4 h-4" />
              </motion.a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Explore</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Home", path: "/" },
                { label: "Movies", path: "/movies" },
                { label: "TV Series", path: "/tv" },
                { label: "Trending", path: "/trending" },
                { label: "My Watchlist", path: "/watchlist" },
              ].map(({ label, path }) => (
                <li key={label}>
                  <Link to={path} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Telegram */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Telegram</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Download Bot", href: "https://t.me/StreamyFlixServerBot" },
                { label: "Join Channel", href: "https://t.me/StreamyFlixServerBot" },
                { label: "Get Updates", href: "https://t.me/StreamyFlixServerBot" },
                { label: "Support", href: "https://t.me/StreamyFlixServerBot" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-400 text-sm transition-colors flex items-center gap-1.5 group"
                  >
                    <FaTelegramPlane className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2.5">
              {["Privacy Policy", "Terms of Service", "DMCA Notice", "Contact Us"].map((label) => (
                <li key={label}>
                  <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <FiShield className="w-3.5 h-3.5" />
              Powered by TMDB API
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-white/5">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-4 mb-6">
            <p className="text-gray-500 text-xs leading-relaxed">
              <strong className="text-gray-400">Disclaimer:</strong> All videos, movies, and media shown on this platform are publicly available on the internet and belong to their respective owners. StreamyFlix only provides links and metadata to content already hosted by third-party services (including Telegram). This platform does not host, upload, or store any copyrighted content. Movie information, posters, and metadata are provided by{" "}
              <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                The Movie Database (TMDB)
              </a>. If you believe any content is violating your rights, please contact the original hosting platform.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <p>© {year} StreamyFlix. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              Made with <FiHeart className="w-3 h-3 text-red-500" /> using React & TMDB API
            </p>
            <p className="flex items-center gap-1">
              <FiMail className="w-3 h-3" />
              contact@streamyflix.dev
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
