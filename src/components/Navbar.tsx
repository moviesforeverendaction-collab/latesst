import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSearch, FiX, FiBell, FiMenu, FiSettings, FiUser, FiBookmark, FiLogOut } from "react-icons/fi";
import { FaTelegramPlane } from "react-icons/fa";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store/useStore";

interface NavbarProps {
  onSettingsOpen: () => void;
}

export default function Navbar({ onSettingsOpen }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { watchlist, isAdminMode } = useStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(localQuery.trim())}`);
      setSearchOpen(false);
      setLocalQuery("");
    }
  };

  const navLinks = [
    { label: "Home", path: "/" },
    { label: "Movies", path: "/movies" },
    { label: "TV Series", path: "/tv" },
    { label: "Trending", path: "/trending" },
    { label: "My List", path: "/watchlist" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-black/95 backdrop-blur-xl shadow-2xl border-b border-white/5"
            : "bg-gradient-to-b from-black/80 to-transparent"
        }`}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/30">
                  <span className="text-white font-black text-sm lg:text-base">SF</span>
                </div>
                <span className="text-white font-black text-xl lg:text-2xl tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em" }}>
                  StreamyFlix
                </span>
              </motion.div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-md group ${
                    isActive(link.path) ? "text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive(link.path) && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-full"
                    />
                  )}
                  {link.path === "/watchlist" && watchlist.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                      {watchlist.length > 9 ? "9+" : watchlist.length}
                    </span>
                  )}
                </Link>
              ))}
              {isAdminMode && (
                <>
                  <Link
                    to="/admin"
                    className={`px-4 py-2 text-sm font-medium transition-colors ${isActive("/admin") ? "text-yellow-300" : "text-yellow-400 hover:text-yellow-300"}`}
                  >
                    Admin
                  </Link>
                  <Link
                    to="/config"
                    className={`px-4 py-2 text-sm font-medium transition-colors ${isActive("/config") ? "text-blue-300" : "text-blue-400 hover:text-blue-300"}`}
                  >
                    Config
                  </Link>
                </>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 lg:gap-3">
              {/* Search */}
              <AnimatePresence mode="wait">
                {searchOpen ? (
                  <motion.form
                    key="search-open"
                    onSubmit={handleSearch}
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex items-center gap-2 bg-black/80 border border-white/20 rounded-lg px-3 py-1.5"
                  >
                    <FiSearch className="text-gray-400 w-4 h-4 flex-shrink-0" />
                    <input
                      ref={searchRef}
                      type="text"
                      value={localQuery}
                      onChange={(e) => setLocalQuery(e.target.value)}
                      placeholder="Search movies, series..."
                      className="bg-transparent text-white placeholder-gray-400 text-sm outline-none w-40 lg:w-60"
                    />
                    <button
                      type="button"
                      onClick={() => { setSearchOpen(false); setLocalQuery(""); }}
                      className="text-gray-400 hover:text-white"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </motion.form>
                ) : (
                  <motion.button
                    key="search-closed"
                    onClick={() => setSearchOpen(true)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <FiSearch className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Notifications */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all relative"
              >
                <FiBell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </motion.button>

              {/* Telegram Link */}
              <motion.a
                href="https://t.me/StreamyFlixServerBot"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all"
                title="Open Telegram Bot"
              >
                <FaTelegramPlane className="w-5 h-5" />
              </motion.a>

              {/* Profile */}
              <div className="relative hidden lg:block">
                <motion.button
                  onClick={() => setProfileOpen(!profileOpen)}
                  whileHover={{ scale: 1.05 }}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg"
                >
                  U
                </motion.button>
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-full mt-2 w-52 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="p-3 border-b border-white/10">
                        <p className="text-white font-semibold text-sm">StreamyFlix User</p>
                        <p className="text-gray-400 text-xs">Free Member</p>
                      </div>
                      <div className="py-1">
                        {[
                          { icon: FiUser, label: "Profile", action: () => {} },
                          { icon: FiBookmark, label: "My Watchlist", action: () => { navigate("/watchlist"); setProfileOpen(false); } },
                          { icon: FiSettings, label: "Settings", action: () => { onSettingsOpen(); setProfileOpen(false); } },
                        ].map(({ icon: Icon, label, action }) => (
                          <button
                            key={label}
                            onClick={action}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-300 hover:text-white hover:bg-white/5 transition-all text-sm"
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        ))}
                        {isAdminMode && (
                          <>
                            <button
                              onClick={() => { navigate("/admin"); setProfileOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/5 transition-all text-sm"
                            >
                              <FiLogOut className="w-4 h-4" />
                              Admin Panel
                            </button>
                            <button
                              onClick={() => { navigate("/config"); setProfileOpen(false); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/5 transition-all text-sm"
                            >
                              <FiSettings className="w-4 h-4" />
                              Config
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Settings */}
              <motion.button
                onClick={onSettingsOpen}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                <FiSettings className="w-5 h-5" />
              </motion.button>

              {/* Mobile Menu */}
              <motion.button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                whileHover={{ scale: 1.1 }}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              >
                {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-16 left-0 right-0 z-40 bg-black/98 backdrop-blur-xl border-b border-white/10 lg:hidden"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive(link.path)
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://t.me/StreamyFlixServerBot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-blue-400 hover:bg-blue-500/10 text-sm font-medium"
              >
                <FaTelegramPlane className="w-5 h-5" />
                Open Telegram Bot
              </a>
              {isAdminMode && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive("/admin")
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                        : "text-yellow-400 hover:bg-yellow-500/10"
                    }`}
                  >
                    ⚡ Admin Panel
                  </Link>
                  <Link
                    to="/config"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive("/config")
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "text-blue-400 hover:bg-blue-500/10"
                    }`}
                  >
                    ⚙️ Config
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click outside for profile menu */}
      {profileOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setProfileOpen(false)} />
      )}
    </>
  );
}
