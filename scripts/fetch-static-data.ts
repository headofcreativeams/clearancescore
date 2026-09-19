// Runs on a schedule via GitHub Actions (see .github/workflows/refresh-data.yml).
// Pulls the same live public sources the Express server used to hit on each
// request, and writes the results as static JSON files under client/public/data.
// GitHub Pages then serves those files directly with no backend process at all.
//
// This mirrors server/legal-feed.ts and server/live-signals.ts exactly so the
// static site's data shape matches what the React components already expect.
import { XMLParser } from "fast-xml-parser";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve(import.meta.dirname, "..", "client", "public", "data");

// ---------- shared helpers ----------

const MAX_BYTES = 3 * 1024 * 1024;

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

async function fetchOnce(url: string, timeoutMs: number, userAgent: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await readBodyCapped(res, MAX_BYTES);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url: string, timeoutMs: number, userAgent: string): Promise<string> {
  try {
    return await fetchOnce(url, timeoutMs, userAgent);
  } catch {
    return await fetchOnce(url, timeoutMs, userAgent);
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

// ---------- legal-feed ----------

const FEED_SOURCES = [
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
  { id: "ipwatchdog", label: "IPWatchdog", url: "https://ipwatchdog.com/feed/" },
];

function parseRss(xml: string, sourceId: string, label: string) {
  const doc = rssParser.parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) return [];
  const rawItems = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  return rawItems.slice(0, 12).map((raw: any, idx: number) => {
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

async function buildLegalFeed() {
  const results = await Promise.all(
    FEED_SOURCES.map(async (source) => {
      try {
        const xml = await fetchWithRetry(source.url, 8000, "ClearanceScoreLegalFeed/1.0 (+internal triage tool)");
        return { source, items: parseRss(xml, source.id, source.label), error: null as string | null };
      } catch (err) {
        return { source, items: [] as any[], error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  const items: any[] = [];
  const errors: { sourceId: string; label: string; message: string }[] = [];
  for (const r of results) {
    if (r.error) {
      errors.push({ sourceId: r.source.id, label: r.source.label, message: r.error });
    } else {
      items.push(...r.items);
    }
  }
  items.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
    return tb - ta;
  });

  const payload = {
    items: items.slice(0, 40),
    fetchedAt: Date.now(),
    errors,
    sources: FEED_SOURCES,
  };
  await writeFile(path.join(OUT_DIR, "legal-feed.json"), JSON.stringify(payload, null, 2));
  console.log(`legal-feed.json written: ${payload.items.length} items, ${errors.length} source errors`);
}

// ---------- live-signals ----------

const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4/search/";
const LIVE_UA = "ClearanceScoreLiveSignals/1.0 (+internal triage tool)";
const IP_CAUSE_PATTERN = /copyright|trademark|patent|lanham|digital millennium|right of publicity/i;

const MODEL_SEARCH_ALIASES: Record<string, string> = {
  "gpt-5.6 sol / gpt-6 astra": "OpenAI",
};

function stripVersionSuffix(term: string): string {
  const stripped = term.replace(/\s+(v\d+(\.\d+)?|gen[-\s]?\d+(\.\d+)?|\d+(\.\d+)?)$/i, "").trim();
  return stripped.length > 0 ? stripped : term;
}

function resolveSearchTerm(rawTerm: string): string {
  const alias = MODEL_SEARCH_ALIASES[rawTerm.trim().toLowerCase()];
  return alias ?? stripVersionSuffix(rawTerm);
}

async function searchCaseLaw(rawQuery: string) {
  try {
    const term = resolveSearchTerm(rawQuery.replace(/"/g, ""));
    const phrase = `"${term}" AND (copyright OR trademark OR patent OR "right of publicity" OR "artificial intelligence")`;
    const url = `${COURTLISTENER_BASE}?q=${encodeURIComponent(phrase)}&type=r&order_by=score desc`;
    const raw = await fetchWithRetry(url, 10000, LIVE_UA);
    const doc = JSON.parse(raw);
    const results = Array.isArray(doc.results) ? doc.results : [];
    const relevant = results.filter((r: any) => typeof r.cause === "string" && IP_CAUSE_PATTERN.test(r.cause));
    const hits = relevant.slice(0, 8).map((r: any) => ({
      caseName: String(r.caseName ?? r.case_name_full ?? "Unnamed matter"),
      court: String(r.court_citation_string ?? r.court ?? ""),
      dateFiled: r.dateFiled ? String(r.dateFiled) : null,
      docketNumber: r.docketNumber ? String(r.docketNumber) : null,
      cause: r.cause ? String(r.cause) : null,
      url: r.docket_absolute_url ? `https://www.courtlistener.com${r.docket_absolute_url}` : "",
    }));
    return { hits, error: null as string | null };
  } catch (err) {
    return { hits: [] as any[], error: err instanceof Error ? err.message : String(err) };
  }
}

async function searchNews(query: string) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchWithRetry(url, 10000, LIVE_UA);
    const doc = rssParser.parse(xml);
    const channel = doc?.rss?.channel;
    const rawItems = channel?.item ? (Array.isArray(channel.item) ? channel.item : [channel.item]) : [];
    const hits = rawItems.slice(0, 8).map((raw: any) => ({
      title: stripCdata(raw.title).trim(),
      link: stripCdata(raw.link).trim(),
      pubDate: raw.pubDate ? stripCdata(raw.pubDate).trim() : null,
    }));
    return { hits, error: null as string | null };
  } catch (err) {
    return { hits: [] as any[], error: err instanceof Error ? err.message : String(err) };
  }
}

// Must match GENERATIVE_MODELS in client/src/pages/intake.tsx exactly — the
// dropdown is a closed list, so every possible query can be pre-baked.
const GENERATIVE_MODELS = [
  "Midjourney v6",
  "DALL·E 3",
  "Adobe Firefly",
  "Stable Diffusion",
  "GPT-5.6 Sol / GPT-6 Astra",
  "Veo 3.1",
  "Runway Gen-4",
  "Other / unknown",
];

export function slugifyModel(model: string): string {
  return model
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function buildLiveSignals() {
  await mkdir(path.join(OUT_DIR, "live-signals"), { recursive: true });
  for (const model of GENERATIVE_MODELS) {
    const query = model.trim().slice(0, 120);
    const [caseLawResult, newsResult] = await Promise.all([
      searchCaseLaw(query),
      searchNews(`${query} AI copyright OR lawsuit`),
    ]);
    const errors: { source: string; message: string }[] = [];
    if (caseLawResult.error) errors.push({ source: "CourtListener", message: caseLawResult.error });
    if (newsResult.error) errors.push({ source: "Google News", message: newsResult.error });

    const payload = {
      query,
      caseLaw: caseLawResult.hits,
      news: newsResult.hits,
      fetchedAt: Date.now(),
      errors,
    };
    const slug = slugifyModel(model);
    await writeFile(path.join(OUT_DIR, "live-signals", `${slug}.json`), JSON.stringify(payload, null, 2));
    console.log(`live-signals/${slug}.json written: ${payload.caseLaw.length} case-law, ${payload.news.length} news, ${errors.length} errors`);
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await buildLegalFeed();
  await buildLiveSignals();
  const meta = { generatedAt: new Date().toISOString() };
  await writeFile(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));
  console.log("Static data refresh complete:", meta.generatedAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
