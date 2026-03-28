import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiChevronLeft, FiChevronRight, FiClock, FiDownload, FiPlay } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { buildTelegramDownloadLink, formatFileSize } from "../lib/telegram";
import { useStore, type IndexedFile } from "../store/useStore";

interface IndexedFilesRowProps {
  title: string;
  files: IndexedFile[];
  subtitle?: string;
}

export default function IndexedFilesRow({ title, files, subtitle }: IndexedFilesRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { telegramConfig } = useStore();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(files.length > 0);
  const botUser = telegramConfig.botUsername || "StreamyFlixServerBot";

  const scroll = (direction: "left" | "right") => {
    if (!rowRef.current) return;
    const scrollAmount = rowRef.current.clientWidth * 0.85;
    rowRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleScroll = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="relative group/row"
    >
      <div className="flex items-end justify-between gap-4 mb-3 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-white font-bold text-lg sm:text-xl lg:text-2xl">{title}</h2>
          {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <span className="text-[11px] text-cyan-400 font-medium">Auto-syncing from indexed files API</span>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 w-12 sm:w-16 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <div className="w-8 h-8 bg-black/70 border border-white/20 rounded-full flex items-center justify-center text-white">
              <FiChevronLeft className="w-4 h-4" />
            </div>
          </motion.button>
        )}

        {canScrollRight && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 w-12 sm:w-16 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <div className="w-8 h-8 bg-black/70 border border-white/20 rounded-full flex items-center justify-center text-white">
              <FiChevronRight className="w-4 h-4" />
            </div>
          </motion.button>
        )}

        <div
          ref={rowRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {files.map((file, index) => {
            const detailHref = file.tmdb_id && (file.media_type === "movie" || file.media_type === "tv")
              ? `/${file.media_type}/${file.tmdb_id}`
              : "";
            const downloadHref = buildTelegramDownloadLink(botUser, { fileUniqueId: file.file_unique_id });
            const artwork = file.poster || null;

            return (
              <motion.article
                key={file.file_unique_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
                className="w-[230px] flex-shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-gray-900/70 backdrop-blur-xl"
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950">
                  {artwork ? (
                    <img src={artwork} alt={file.title || file.file_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                      <div className="text-4xl mb-3">🎬</div>
                      <p className="text-white text-sm font-semibold line-clamp-3">{file.title || file.file_name}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      file.media_type === "tv"
                        ? "bg-blue-500/80 text-white"
                        : file.media_type === "movie"
                          ? "bg-red-500/80 text-white"
                          : "bg-gray-700/80 text-white"
                    }`}>
                      {file.media_type}
                    </span>
                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black/60 text-cyan-300 border border-white/10">
                      {file.quality || "Unknown"}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-white font-semibold text-sm line-clamp-2">{file.title || file.file_name}</h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                      <span>{file.language || "Unknown language"}</span>
                      <span>{formatFileSize(file.file_size || 0)}</span>
                      {file.season && (
                        <span>
                          S{file.season}{file.episode ? `E${file.episode}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <FiClock className="w-3 h-3" />
                    <span>Indexed {new Date(file.indexed_at).toLocaleString()}</span>
                  </div>

                  <div className="flex gap-2">
                    {detailHref ? (
                      <button
                        onClick={() => navigate(detailHref)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-white/8 hover:bg-white/12 border border-white/10 text-white rounded-xl text-xs font-semibold transition-all"
                      >
                        <FiPlay className="w-3.5 h-3.5" />
                        Open
                      </button>
                    ) : (
                      <div className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-white/5 border border-white/8 text-gray-500 rounded-xl text-xs font-medium">
                        Indexed Only
                      </div>
                    )}

                    <a
                      href={downloadHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold transition-all"
                    >
                      <FiDownload className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
