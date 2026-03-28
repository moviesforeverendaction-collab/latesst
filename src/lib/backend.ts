const RAW_API_URL = import.meta.env.VITE_API_URL?.trim() || "";

export interface BackendPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface BackendFilesResponse<T> {
  ok: boolean;
  files: T[];
  pagination: BackendPagination;
  error?: string;
}

function stripKnownApiSuffix(pathname: string) {
  const stripped = pathname
    .replace(/\/api\/files\/?$/i, "")
    .replace(/\/api\/?$/i, "")
    .replace(/\/+$/g, "");
  return stripped || (pathname.startsWith("/") ? "/" : "");
}

export function normalizeBackendUrl(input?: string | null) {
  const value = input?.trim();
  if (!value) return "";

  try {
    const hasScheme = /^[a-z][a-z\d+\-.]*:/i.test(value);
    const url = new URL(value, hasScheme ? undefined : window.location.origin);
    url.search = "";
    url.hash = "";
    url.pathname = stripKnownApiSuffix(url.pathname);

    if (hasScheme) {
      return `${url.origin}${url.pathname}`.replace(/\/+$/g, "");
    }

    return url.pathname || "/";
  } catch {
    return stripKnownApiSuffix(value);
  }
}

export function getBackendUrl(override?: string | null) {
  return normalizeBackendUrl(override) || normalizeBackendUrl(RAW_API_URL);
}

export function buildBackendUrl(path: string, override?: string | null) {
  const base = getBackendUrl(override);
  if (!base) return "";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchBackendJson<T>(path: string, init?: RequestInit, override?: string | null) {
  const url = buildBackendUrl(path, override);
  if (!url) {
    throw new Error("Backend URL is not configured");
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
