import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, AlertTriangle, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { getLegalFeedUrl } from "@/lib/queryClient";

interface LegalFeedItem {
  id: string;
  title: string;
  link: string;
  sourceLabel: string;
  sourceId: string;
  pubDate: string | null;
}

interface LegalFeedResponse {
  items: LegalFeedItem[];
  fetchedAt: number;
  errors: { sourceId: string; label: string; message: string }[];
  sources: { id: string; label: string; url: string }[];
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Undated";
  const then = Date.parse(dateStr);
  if (Number.isNaN(then)) return "Undated";
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const sourceColors: Record<string, string> = {
  "gnews-ai-copyright": "bg-chart-1/15 text-chart-1 border-chart-1/30",
  "gnews-genai-litigation": "bg-chart-2/15 text-chart-2 border-chart-2/30",
  "gnews-publicity-ai": "bg-chart-3/15 text-chart-3 border-chart-3/30",
  "gnews-ai-insurance": "bg-chart-4/15 text-chart-4 border-chart-4/30",
  ipwatchdog: "bg-chart-5/15 text-chart-5 border-chart-5/30",
};

export default function LegalUpdates() {
  const [refreshNonce, setRefreshNonce] = useState(0);

  const { data, isLoading, isFetching, error, refetch } = useQuery<LegalFeedResponse>({
    queryKey: ["/api/legal-feed"],
    queryFn: async () => {
      const res = await fetch(getLegalFeedUrl(refreshNonce > 0));
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    refetchInterval: 15 * 60 * 1000, // keeps the page live: re-polls the server every 15 minutes
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000,
  });

  function handleRefresh() {
    setRefreshNonce((n) => n + 1);
    refetch();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Legal &amp; regulatory updates</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Live feed of AI copyright, right-of-publicity, and AI-liability-insurance news, pulled
            server-side from public legal and news sources. Auto-refreshes every 15 minutes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
          data-testid="button-refresh-feed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {data?.fetchedAt && (
        <p className="mb-4 text-xs text-muted-foreground">
          Last updated {new Date(data.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          {" · "}
          Sources:{" "}
          {data.sources.map((s, i) => (
            <span key={s.id}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted hover:text-foreground"
              >
                {s.label}
              </a>
              {i < data.sources.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      {data && data.errors.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Some sources did not respond</AlertTitle>
          <AlertDescription>
            {data.errors.map((e) => e.label).join(", ")} failed to load this cycle. Showing items
            from the remaining sources.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Feed unavailable</AlertTitle>
          <AlertDescription>
            Could not reach the legal-updates service. Try refreshing in a moment.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-md border border-border p-4">
              <Skeleton className="h-3.5 w-20 mb-2" />
              <Skeleton className="h-4 w-full mb-1.5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && data && data.items.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <Newspaper className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No items returned this cycle. Try refreshing.</p>
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <ol className="space-y-3">
          {data.items.map((item) => (
            <li key={item.id}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-md border border-border p-4 hover-elevate"
                data-testid={`link-legal-item-${item.id}`}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${sourceColors[item.sourceId] ?? ""}`}
                  >
                    {item.sourceLabel}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(item.pubDate)}</span>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug flex items-start gap-1.5">
                  <span>{item.title}</span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 text-[11px] leading-snug text-muted-foreground border-t border-border pt-4">
        This feed aggregates public news headlines and is provided for situational awareness only.
        It is not a substitute for a Westlaw, Lexis, or Bloomberg Law docket alert, and headlines
        may summarize rulings imprecisely. Confirm any case status directly against the court
        docket or original filing before relying on it.
      </p>
    </div>
  );
}
