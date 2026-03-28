import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { TMDBMovie } from "../lib/tmdb";
import MovieCard from "./MovieCard";

interface ContentRowProps {
  title: string;
  movies: TMDBMovie[];
  loading?: boolean;
  showRank?: boolean;
  cardSize?: "sm" | "md" | "lg";
  onLoadMore?: () => void;
}

export default function ContentRow({
  title,
  movies,
  loading = false,
  showRank = false,
  cardSize = "md",
  onLoadMore,
}: ContentRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scroll = (direction: "left" | "right") => {
    if (!rowRef.current) return;
    const scrollAmount = rowRef.current.clientWidth * 0.8;
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
    if (onLoadMore && scrollLeft + clientWidth >= scrollWidth - 200) {
      onLoadMore();
    }
  };

  const skeletonCount = 8;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5 }}
      className="relative group/row"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-lg sm:text-xl lg:text-2xl">{title}</h2>
          <div className="w-1 h-1 rounded-full bg-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity" />
        </div>
        <button
          className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          onClick={onLoadMore}
        >
          See all
          <FiChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Scroll Container */}
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 w-12 sm:w-16 bg-gradient-to-r from-black/80 to-transparent flex items-center justify-start pl-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="w-8 h-8 bg-black/70 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <FiChevronLeft className="w-4 h-4" />
            </motion.div>
          </motion.button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 w-12 sm:w-16 bg-gradient-to-l from-black/80 to-transparent flex items-center justify-end pr-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="w-8 h-8 bg-black/70 border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <FiChevronRight className="w-4 h-4" />
            </motion.div>
          </motion.button>
        )}

        {/* Cards Row */}
        <div
          ref={rowRef}
          onScroll={handleScroll}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loading
            ? Array.from({ length: skeletonCount }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 rounded-xl overflow-hidden animate-pulse bg-gray-800"
                  style={{
                    width: cardSize === "sm" ? 128 : cardSize === "lg" ? 176 : 144,
                    aspectRatio: "2/3",
                  }}
                />
              ))
            : movies.map((movie, i) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  index={i}
                  size={cardSize}
                  showRank={showRank}
                />
              ))}
        </div>
      </div>
    </motion.section>
  );
}
