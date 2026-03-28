import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SettingsModal from "./components/SettingsModal";

import HomePage from "./pages/HomePage";
import MoviesPage from "./pages/MoviesPage";
import DetailPage from "./pages/DetailPage";
import SearchPage from "./pages/SearchPage";
import WatchlistPage from "./pages/WatchlistPage";
import TrendingPage from "./pages/TrendingPage";
import AdminPage from "./pages/AdminPage";
import ConfigPage from "./pages/ConfigPage";

// Page transition wrapper
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3, ease: "easeInOut" }}
  >
    {children}
  </motion.div>
);

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-black text-white overflow-x-hidden">
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#1a1a2e",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              backdropFilter: "blur(20px)",
            },
          }}
        />

        {/* Navbar */}
        <Navbar onSettingsOpen={() => setSettingsOpen(true)} />

        {/* Settings Modal */}
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* Routes */}
        <AnimatePresence mode="wait">
          <Routes>
            <Route
              path="/"
              element={
                <PageWrapper>
                  <HomePage />
                </PageWrapper>
              }
            />
            <Route
              path="/movies"
              element={
                <PageWrapper>
                  <MoviesPage defaultType="movie" />
                </PageWrapper>
              }
            />
            <Route
              path="/tv"
              element={
                <PageWrapper>
                  <MoviesPage defaultType="tv" />
                </PageWrapper>
              }
            />
            <Route
              path="/movie/:id"
              element={
                <PageWrapper>
                  <DetailPage />
                </PageWrapper>
              }
            />
            <Route
              path="/tv/:id"
              element={
                <PageWrapper>
                  <DetailPage />
                </PageWrapper>
              }
            />
            <Route
              path="/search"
              element={
                <PageWrapper>
                  <SearchPage />
                </PageWrapper>
              }
            />
            <Route
              path="/watchlist"
              element={
                <PageWrapper>
                  <WatchlistPage />
                </PageWrapper>
              }
            />
            <Route
              path="/trending"
              element={
                <PageWrapper>
                  <TrendingPage />
                </PageWrapper>
              }
            />
            <Route
              path="/admin"
              element={
                <PageWrapper>
                  <AdminPage />
                </PageWrapper>
              }
            />
            <Route
              path="/config"
              element={
                <PageWrapper>
                  <ConfigPage />
                </PageWrapper>
              }
            />
            <Route
              path="*"
              element={
                <PageWrapper>
                  <NotFoundPage />
                </PageWrapper>
              }
            />
          </Routes>
        </AnimatePresence>

        {/* Footer */}
        <Footer />
      </div>
    </Router>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center pt-20 gap-6 text-center px-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-8xl"
      >
        🎬
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <h1 className="text-6xl font-black text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          404 — Not Found
        </h1>
        <p className="text-gray-400 text-lg">The page you're looking for doesn't exist.</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all mt-4"
        >
          Go to Home
        </a>
      </motion.div>
    </div>
  );
}
