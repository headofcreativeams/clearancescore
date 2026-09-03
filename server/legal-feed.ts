import { XMLParser } from "fast-xml-parser";

// Real, publicly reachable RSS sources. Verified reachable via curl on 2026-09-03.
// Google News RSS search feeds are live and update continuously; IPWatchdog is a
// standing IP-law publication feed. No API key required for either.
const FEED_SOURCES: { id: string; label: string; url: string }[] = [
  {
    id: "gnews-ai-copyright",
    label: "Google News — AI copyright lawsuits",
    url: "https://news.google.com/rss/search?q=AI+copyright+lawsuit&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "gnews-genai-litigation",
    label: "Google News — Generative AI litigation",
    url: "https://news.google.com/rss/search?q=generative+AI+litigation&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "gnews-publicity-ai",
    label: "Google News — AI right of publicity",
    url: "https://news.google.com/rss/search?q=%22right+of+publicity%22+AI&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "gnews-ai-insurance",
    label: "Google News — AI liability insurance",
    url: "https://news.google.com/rss/search?q=AI+insurance+liability&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "ipwatchdog",
    label: "IPWatchdog",
    url: "https://ipwatchdog.com/feed/",
  },
];

export interface LegalFeedItem {
  id: string;
  title: string;
  link: string;
  sourceLabel: string;
  sourceId: string;
  pubDate: string | null;
}

interface CacheEntry {
  fetchedAt: number;
  items: LegalFeedItem[];
  errors: { sourceId: string; label: string; message: string }[];
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes — keeps the feed live without hammering upstream hosts

// Per-source last-known-good items. Google News RSS and other upstream hosts can
// return transient 429/5xx under load; falling back to the last successful pull
// for that specific source keeps the page populated instead of losing items
// every time one source has a bad moment.
const lastGoodBySource = new Map<string, LegalFeedItem[]>();

const parser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: "__cdata",
});

function stripCdata(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value !== null && "__cdata" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).__cdata ?? "");
  }
  return String(value);
}

function parseRss(xml: string, sourceId: string, label: string): LegalFeedItem[] {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) return [];
  const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  return rawItems.slice(0, 12).map((raw: any, idx: number): LegalFeedItem => {
    const title = stripCdata(raw.title).trim();
    const link = stripCdata(raw.link).trim();
    const pubDate = raw.pubDate ? stripCdata(raw.pubDate).trim() : null;
    return {
      id: `${sourceId}-${idx}-${Buffer.from(link || title).toString("base64").slice(0, 16)}`,
      title,
      link,
      sourceLabel: label,
      sourceId,
      pubDate,
    };
  });
}

const MAX_FEED_BYTES = 3 * 1024 * 1024; // 3 MB — real RSS feeds run tens of KB; caps a slow/hostile response

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

async function fetchOneFeed(source: { id: string; label: string; url: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { "User-Agent": "ClearanceScoreLegalFeed/1.0 (+internal triage tool)" },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const xml = await readBodyCapped(res, MAX_FEED_BYTES);
    return { items: parseRss(xml, source.id, source.label), error: null as string | null };
  } catch (err) {
    return { items: [] as LegalFeedItem[], error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getLegalFeed(forceRefresh = false): Promise<CacheEntry> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const results = await Promise.all(FEED_SOURCES.map(fetchOneFeed));
  const items: LegalFeedItem[] = [];
  const errors: { sourceId: string; label: string; message: string }[] = [];

  results.forEach((result, idx) => {
    const source = FEED_SOURCES[idx];
    if (result.error) {
      errors.push({ sourceId: source.id, label: source.label, message: result.error });
      const stale = lastGoodBySource.get(source.id);
      if (stale && stale.length > 0) {
        items.push(...stale);
      }
    } else {
      lastGoodBySource.set(source.id, result.items);
      items.push(...result.items);
    }
  });

  items.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
    return tb - ta;
  });

  cache = { fetchedAt: Date.now(), items: items.slice(0, 40), errors };
  return cache;
}

export function getFeedSourceList() {
  return FEED_SOURCES.map(({ id, label, url }) => ({ id, label, url }));
}
