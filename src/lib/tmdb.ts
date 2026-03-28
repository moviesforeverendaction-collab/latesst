// TMDB API Configuration
// In production: set VITE_TMDB_API_KEY in your .env file or Netlify/Vercel env vars
// Falls back to a public demo key for development
export const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || "8265bd1679663a7ea12ac168da84d2e8";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";
export const TMDB_IMG_ORIGINAL = `${TMDB_IMG_BASE}/original`;
export const TMDB_IMG_W500 = `${TMDB_IMG_BASE}/w500`;
export const TMDB_IMG_W300 = `${TMDB_IMG_BASE}/w300`;
export const TMDB_IMG_W780 = `${TMDB_IMG_BASE}/w780`;

export const DEFAULT_BOT_USERNAME = "StreamyFlixServerBot";

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  media_type?: string;
  popularity: number;
  original_language: string;
  adult?: boolean;
}

export interface TMDBDetail extends TMDBMovie {
  genres: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  tagline?: string;
  status: string;
  budget?: number;
  revenue?: number;
  production_companies: { name: string; logo_path: string | null }[];
  seasons?: { season_number: number; episode_count: number; name: string; poster_path: string | null }[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  videos?: { results: TMDBVideo[] };
  credits?: { cast: TMDBCast[]; crew: TMDBCrew[] };
  similar?: { results: TMDBMovie[] };
  recommendations?: { results: TMDBMovie[] };
  images?: { backdrops: TMDBImage[]; posters: TMDBImage[] };
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDBCast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrew {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBImage {
  file_path: string;
  width: number;
  height: number;
  vote_average: number;
}

export interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export const GENRES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
  10770: "TV Movie", 37: "Western", 10759: "Action & Adventure",
  10762: "Kids", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy",
  10766: "Soap", 10767: "Talk", 10768: "War & Politics"
};

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

export const tmdb = {
  getTrending: (type: "all" | "movie" | "tv" = "all", time: "day" | "week" = "week") =>
    tmdbFetch<TMDBResponse>(`/trending/${type}/${time}`),
  getPopularMovies: (page = 1) => tmdbFetch<TMDBResponse>("/movie/popular", { page: String(page) }),
  getTopRatedMovies: (page = 1) => tmdbFetch<TMDBResponse>("/movie/top_rated", { page: String(page) }),
  getNowPlayingMovies: (page = 1) => tmdbFetch<TMDBResponse>("/movie/now_playing", { page: String(page) }),
  getUpcomingMovies: (page = 1) => tmdbFetch<TMDBResponse>("/movie/upcoming", { page: String(page) }),
  getPopularTV: (page = 1) => tmdbFetch<TMDBResponse>("/tv/popular", { page: String(page) }),
  getTopRatedTV: (page = 1) => tmdbFetch<TMDBResponse>("/tv/top_rated", { page: String(page) }),
  getAiringTodayTV: (page = 1) => tmdbFetch<TMDBResponse>("/tv/airing_today", { page: String(page) }),
  getMovieDetails: (id: number) => tmdbFetch<TMDBDetail>(`/movie/${id}`, { append_to_response: "videos,credits,similar,recommendations,images" }),
  getTVDetails: (id: number) => tmdbFetch<TMDBDetail>(`/tv/${id}`, { append_to_response: "videos,credits,similar,recommendations,images" }),
  searchMulti: (query: string, page = 1) => tmdbFetch<TMDBResponse>("/search/multi", { query, page: String(page) }),
  searchMovies: (query: string, page = 1) => tmdbFetch<TMDBResponse>("/search/movie", { query, page: String(page) }),
  searchTV: (query: string, page = 1) => tmdbFetch<TMDBResponse>("/search/tv", { query, page: String(page) }),
  getMoviesByGenre: (genreId: number, page = 1) => tmdbFetch<TMDBResponse>("/discover/movie", { with_genres: String(genreId), page: String(page), sort_by: "popularity.desc" }),
  getTVByGenre: (genreId: number, page = 1) => tmdbFetch<TMDBResponse>("/discover/tv", { with_genres: String(genreId), page: String(page), sort_by: "popularity.desc" }),
  getPersonDetails: (id: number) => tmdbFetch<{ name: string; biography: string; profile_path: string | null; known_for_department: string }>(`/person/${id}`),
};
