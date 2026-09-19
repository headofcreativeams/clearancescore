import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// Static hosting mode: this build has no live backend process. A scheduled
// GitHub Actions job (.github/workflows/refresh-data.yml) fetches the same
// public sources the server used to call on each request, and writes the
// results as static JSON files that ship with the site. "forceRefresh" here
// just cache-busts the browser/CDN cache to pull the latest committed
// snapshot; it does not trigger a new upstream fetch on demand.
function slugifyModel(model: string): string {
  return model
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Relative (no leading slash) so this resolves correctly whether the site is
// served from a domain root or a GitHub Pages subdirectory (e.g.
// username.github.io/reponame/). The app uses hash-based routing, so the
// document path itself never changes between screens — relative paths are
// always safe here, unlike with a history-based router.
export function getLegalFeedUrl(forceRefresh = false) {
  const cacheBust = forceRefresh ? `?v=${Date.now()}` : "";
  return `${API_BASE}data/legal-feed.json${cacheBust}`;
}

export function getLiveSignalsUrl(query: string, forceRefresh = false) {
  const slug = slugifyModel(query || "other-unknown");
  const cacheBust = forceRefresh ? `?v=${Date.now()}` : "";
  return `${API_BASE}data/live-signals/${slug}.json${cacheBust}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
