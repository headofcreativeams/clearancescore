import { XMLParser } from "fast-xml-parser";

// Live, keyless, real-time lookups scoped to a specific scan's generative model
// / keyword. Two real public sources, verified reachable without any API key:
//
// 1. CourtListener REST API v4 (Free Law Project) — real federal/state case law
//    search. No API token required for anonymous search requests, confirmed via
//    https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview (authenticated
//    users are capped at 5 req/min, 50/hr, 125/day — anonymous is unspecified, so
//    we cache aggressively and never call on every render).
// 2. Google News RSS search, same mechanism already used by legal-feed.ts, scoped
//    dynamically to the query instead of a fixed set of searches.
//
// This is a real, cited, unfiltered search layer — not a detection engine. It does
// NOT determine or feed into the illustrative 0-100 score; it is surfaced
// separately on the Results page as raw signal for a human reviewer to read.

const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4/search/";
const USER_AGENT = "ClearanceScoreLiveSignals/1.0 (+internal triage tool)";
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap on any single upstream response
const FETCH_TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — CourtListener anonymous limits are tight and case law doesn't move minute to minute

export interface CaseLawHit {
  caseName: string;
  court: string;
  dateFiled: string | null;
  docketNumber: string | null;
  cause: string | null;
  url: string;
}

export interface NewsHit {
  title: string;
  link: string;
  pubDate: string | null;
}

export interface LiveSignalsResult {
  query: string;
  caseLaw: CaseLawHit[];
  news: NewsHit[];
  fetchedAt: number;
  errors: { source: string; message: string }[];
}

const cache = new Map<string, LiveSignalsResult>();

async function readBodyCapped(res: Response, capBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > capBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`Response exceeded ${capBytes} byte cap`);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

async function fetchOnce(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await readBodyCapped(res, MAX_BYTES);
  } finally {
    clearTimeout(timeout);
  }
}

// One retry on transient failure (e.g. a slow first-connection TLS handshake), so a single
// cold-start hiccup doesn't get cached as a 30-minute outage for a query nobody has run yet.
async function fetchWithTimeout(url: string): Promise<string> {
  try {
    return await fetchOnce(url);
  } catch (err) {
    return await fetchOnce(url);
  }
}

const IP_CAUSE_PATTERN = /copyright|trademark|patent|lanham|digital millennium|right of publicity/i;

// Product/version suffixes ("Midjourney v6", "Runway Gen-4", "Sora 2", "Veo 3.1") almost never
// appear verbatim in a docket — litigation captions and filings name the company or the base
// product, not the marketing version string. Tested directly against CourtListener: quoting
// "Runway Gen-4" as an exact phrase returns a single, unrelated result (an EVOX v. Stability AI
// copyright case that does not contain that phrase at all), while stripping to "Runway" recovers
// the real, on-point "David Vance Gardner v. Runway AI, Inc." DMCA docket. Stripping the version
// tag before searching is required, not optional, for the dropdown's own values to work.
function stripVersionSuffix(term: string): string {
  const stripped = term.replace(/\s+(v\d+(\.\d+)?|gen[-\s]?\d+(\.\d+)?|\d+(\.\d+)?)$/i, "").trim();
  return stripped.length > 0 ? stripped : term;
}

// Some dropdown values are internal model-family codenames, not product names that would ever
// appear verbatim in a docket. Tested directly against CourtListener: quoting "GPT-5.6 Sol / GPT-6
// Astra" returns zero results (count 0) since no filing contains that exact internal name, while
// searching the parent company "OpenAI" surfaces the real, on-point litigation (In Re: OpenAI,
// Inc. Copyright Infringement Litigation; The Seattle Times Company v. OpenAI Inc.; and others).
// The generic version-suffix stripper above can't fix this case because the mismatch isn't a
// trailing version number, so this alias table is checked first for known dropdown values.
const MODEL_SEARCH_ALIASES: Record<string, string> = {
  "gpt-5.6 sol / gpt-6 astra": "OpenAI",
};

function resolveSearchTerm(rawTerm: string): string {
  const alias = MODEL_SEARCH_ALIASES[rawTerm.trim().toLowerCase()];
  return alias ?? stripVersionSuffix(rawTerm);
}

async function searchCaseLaw(rawQuery: string): Promise<{ hits: CaseLawHit[]; error: string | null }> {
  try {
    // type=r = RECAP federal docket search (actual filed complaints/dockets, updated as
    // cases are filed). type=o (opinions only) was tested and misses nearly all pending
    // generative-AI IP suits, since most haven't reached a published opinion yet.
    // The query term is quoted for an exact phrase match (an unquoted hyphenated term like
    // DALL-E fragments into single-letter token matches, e.g. bankruptcy cases for people
    // named "Dall") and AND-scoped to common IP causes of action, verified against
    // CourtListener directly: this materially improves precision for generic model names
    // ("Sora", "Runway") that otherwise collide with unrelated personal names and companies.
    const term = resolveSearchTerm(rawQuery.replace(/"/g, ""));
    const phrase = `"${term}" AND (copyright OR trademark OR patent OR "right of publicity" OR "artificial intelligence")`;
    const url = `${COURTLISTENER_BASE}?q=${encodeURIComponent(phrase)}&type=r&order_by=score desc`;
    const raw = await fetchWithTimeout(url);
    const doc = JSON.parse(raw);
    const results = Array.isArray(doc.results) ? doc.results : [];
    // Second pass: CourtListener's AND clause matches anywhere in the docket's indexed text
    // (including attached filings), not just the case's legal cause, so it still lets through
    // some cases whose "cause" field is unrelated (e.g. Fair Labor Standards Act). Keep only
    // hits whose cause is actually IP-flavored, since that field is the reliable relevance
    // signal RECAP provides.
    const relevant = results.filter((r: any) => typeof r.cause === "string" && IP_CAUSE_PATTERN.test(r.cause));
    const hits: CaseLawHit[] = relevant.slice(0, 8).map((r: any) => ({
      caseName: String(r.caseName ?? r.case_name_full ?? "Unnamed matter"),
      court: String(r.court_citation_string ?? r.court ?? ""),
      dateFiled: r.dateFiled ? String(r.dateFiled) : null,
      docketNumber: r.docketNumber ? String(r.docketNumber) : null,
      cause: r.cause ? String(r.cause) : null,
      url: r.docket_absolute_url ? `https://www.courtlistener.com${r.docket_absolute_url}` : "",
    }));
    return { hits, error: null };
  } catch (err) {
    return { hits: [], error: err instanceof Error ? err.message : String(err) };
  }
}

const rssParser = new XMLParser({ ignoreAttributes: false, cdataPropName: "__cdata" });

function stripCdata(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "__cdata" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).__cdata ?? "");
  }
  return String(value);
}

async function searchNews(query: string): Promise<{ hits: NewsHit[]; error: string | null }> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchWithTimeout(url);
    const doc = rssParser.parse(xml);
    const channel = doc?.rss?.channel;
    const rawItems = channel?.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
    const hits: NewsHit[] = rawItems.slice(0, 8).map((raw: any) => ({
      title: stripCdata(raw.title).trim(),
      link: stripCdata(raw.link).trim(),
      pubDate: raw.pubDate ? stripCdata(raw.pubDate).trim() : null,
    }));
    return { hits, error: null };
  } catch (err) {
    return { hits: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getLiveSignals(rawQuery: string, forceRefresh = false): Promise<LiveSignalsResult> {
  const query = rawQuery.trim().slice(0, 120); // bound query length defensively
  if (!query) {
    return { query: "", caseLaw: [], news: [], fetchedAt: Date.now(), errors: [{ source: "input", message: "Empty query" }] };
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const [caseLawResult, newsResult] = await Promise.all([
    searchCaseLaw(query),
    searchNews(`${query} AI copyright OR lawsuit`),
  ]);

  const errors: { source: string; message: string }[] = [];
  if (caseLawResult.error) errors.push({ source: "CourtListener", message: caseLawResult.error });
  if (newsResult.error) errors.push({ source: "Google News", message: newsResult.error });

  // Fall back to stale cached data per-source on a transient failure rather than
  // showing an empty panel, same pattern used in legal-feed.ts.
  const result: LiveSignalsResult = {
    query,
    caseLaw: caseLawResult.error && cached?.caseLaw.length ? cached.caseLaw : caseLawResult.hits,
    news: newsResult.error && cached?.news.length ? cached.news : newsResult.hits,
    fetchedAt: Date.now(),
    errors,
  };

  cache.set(cacheKey, result);
  return result;
}
