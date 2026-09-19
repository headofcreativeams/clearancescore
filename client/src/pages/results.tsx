import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, ShieldCheck, ShieldAlert, Gavel, Landmark, CheckSquare, Square, Radar, RefreshCw, Scale, Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/score-gauge";
import { SubScoreChart } from "@/components/subscore-chart";
import { useScan } from "@/lib/scan-context";
import { LEGAL_CASES, VENDOR_PROGRAMS, INSURANCE_BANDS, scoreBand } from "@/lib/scan-data";
import { getLiveSignalsUrl } from "@/lib/queryClient";

interface CaseLawHit {
  caseName: string;
  court: string;
  dateFiled: string | null;
  docketNumber: string | null;
  cause: string | null;
  url: string;
}
interface NewsHit {
  title: string;
  link: string;
  pubDate: string | null;
}
interface LiveSignalsResponse {
  query: string;
  caseLaw: CaseLawHit[];
  news: NewsHit[];
  fetchedAt: number;
  errors: { source: string; message: string }[];
}

const confidenceVariant: Record<string, "secondary" | "default" | "destructive"> = {
  Low: "secondary",
  Medium: "default",
  High: "destructive",
};

export default function Results() {
  const { activeScan } = useScan();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // A ref, not state: handleRefreshLive() needs the incremented value visible
  // to queryFn on the SAME call that triggers refetch(). A state setter is
  // not applied until the next render, so refetch() would still read the
  // pre-increment closure value and hit the same cached URL — invisible
  // against the old Express server, but static JSON on GitHub Pages is
  // served with a 10-minute cache-control, which made stale results
  // reappear after clicking Refresh.
  const liveRefreshNonce = useRef(0);

  const liveQuery = activeScan?.generativeModel ?? "";
  const {
    data: liveData,
    isLoading: liveLoading,
    isFetching: liveFetching,
    error: liveError,
    refetch: refetchLive,
  } = useQuery<LiveSignalsResponse>({
    queryKey: ["/api/live-signals", liveQuery],
    queryFn: async () => {
      const res = await fetch(getLiveSignalsUrl(liveQuery, liveRefreshNonce.current > 0));
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    enabled: Boolean(liveQuery),
    staleTime: 5 * 60 * 1000,
  });

  function handleRefreshLive() {
    liveRefreshNonce.current += 1;
    refetchLive();
  }

  if (!activeScan) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">No scan yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Run a scan from the Intake screen to see a clearance score here.
        </p>
        <Link href="/">
          <Button className="mt-6" data-testid="button-go-intake">
            Go to Intake
          </Button>
        </Link>
      </div>
    );
  }

  const band = scoreBand(activeScan.overallScore);
  const relevantCases = LEGAL_CASES.filter((c) =>
    activeScan.subScores.some((s) => s.riskValue >= 30 && c.relevantTo.includes(s.id))
  );
  const insuranceBand = INSURANCE_BANDS.find((b) => b.bandKey === band.key);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scan result</p>
          <h1 className="mt-1 text-xl font-bold text-foreground" data-testid="text-asset-name">
            {activeScan.assetName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeScan.generativeModel} · {activeScan.intendedUse} ·{" "}
            {new Date(activeScan.scannedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <Badge
          className="text-xs"
          variant={band.key === "critical" || band.key === "high" ? "destructive" : "secondary"}
          data-testid="badge-status"
        >
          {activeScan.status}
        </Badge>
      </div>

      {/* Score + sub-scores */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr]">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 pt-6">
            <ScoreGauge score={activeScan.overallScore} />
            <p className="text-sm font-semibold" style={{ color: `hsl(var(${band.cssVar}))` }}>
              {band.label}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk factor breakdown</CardTitle>
            <CardDescription>Weighted risk contribution per factor, highest risk first.</CardDescription>
          </CardHeader>
          <CardContent>
            <SubScoreChart subScores={activeScan.subScores} />
          </CardContent>
        </Card>
      </div>

      {/* Potential claimants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Potential claimants</CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wide">
              Demo data
            </Badge>
          </div>
          <CardDescription>
            Illustrative matches from this triage pass. Confirm every match with a licensed reverse-image, provenance,
            or trademark search before treating it as a real claim.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeScan.claimants.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[hsl(var(--band-clear))]" />
              No claimant matches surfaced in this pass.
            </div>
          ) : (
            activeScan.claimants.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-border p-4"
                data-testid={`card-claimant-${c.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.claimType}</p>
                  </div>
                  <Badge variant={confidenceVariant[c.confidence]} className="text-[10px]">
                    {c.confidence} confidence
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-foreground/85 leading-relaxed">{c.note}</p>
                <a
                  href={c.matchedSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  data-testid={`link-claimant-source-${c.id}`}
                >
                  {c.matchedSourceLabel}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Why this score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gavel className="h-4 w-4 text-muted-foreground" />
            Why this score
          </CardTitle>
          <CardDescription>
            Precedents that inform how each risk factor above is weighted. These are real, currently active or
            resolved cases — not this asset's litigation history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(relevantCases.length ? relevantCases : LEGAL_CASES).map((legalCase) => (
            <div key={legalCase.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <p className="text-sm font-semibold text-foreground">{legalCase.name}</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{legalCase.summary}</p>
              <a
                href={legalCase.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                data-testid={`link-case-${legalCase.id}`}
              >
                {legalCase.sourceLabel}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Live legal signals — real, unfiltered, keyless search, not part of the score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Radar className="h-4 w-4 text-muted-foreground" />
              Live legal signals
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wide">
                Real-time · live data
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshLive}
                disabled={liveFetching}
                data-testid="button-refresh-live-signals"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${liveFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
          <CardDescription>
            Unfiltered, real-time search of federal court dockets (CourtListener RECAP / Free Law Project) and news for &quot;{activeScan.generativeModel}&quot;.
            This is a raw search layer for a human reviewer, not a detection result, and it does not feed the score above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {liveError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Live signals unavailable</AlertTitle>
              <AlertDescription>Could not reach the live search service. Try refreshing in a moment.</AlertDescription>
            </Alert>
          )}

          {liveData && liveData.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Some sources did not respond</AlertTitle>
              <AlertDescription>
                {liveData.errors.map((e) => e.source).join(", ")} failed to load this cycle.
              </AlertDescription>
            </Alert>
          )}

          {liveLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {!liveLoading && liveData && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" /> Case law ({liveData.caseLaw.length})
                </p>
                {liveData.caseLaw.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching filings found on this pass.</p>
                ) : (
                  <ul className="space-y-2">
                    {liveData.caseLaw.map((c, i) => (
                      <li key={i}>
                        <a
                          href={c.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="group block rounded-md border border-border p-3 hover-elevate"
                          data-testid={`link-live-case-${i}`}
                        >
                          <p className="text-sm font-medium text-foreground leading-snug flex items-start gap-1.5">
                            <span>{c.caseName}</span>
                            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {c.court || "Court not specified"}
                            {c.dateFiled ? ` · Filed ${new Date(c.dateFiled).toLocaleDateString("en-US")}` : ""}
                            {c.docketNumber ? ` · No. ${c.docketNumber}` : ""}
                          </p>
                          {c.cause && <p className="mt-0.5 text-xs text-muted-foreground/80">{c.cause}</p>}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Newspaper className="h-3.5 w-3.5" /> News ({liveData.news.length})
                </p>
                {liveData.news.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No matching headlines found on this pass.</p>
                ) : (
                  <ul className="space-y-2">
                    {liveData.news.map((n, i) => (
                      <li key={i}>
                        <a
                          href={n.link || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="group block rounded-md border border-border p-3 hover-elevate"
                          data-testid={`link-live-news-${i}`}
                        >
                          <p className="text-sm font-medium text-foreground leading-snug flex items-start gap-1.5">
                            <span>{n.title}</span>
                            <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {n.pubDate ? new Date(n.pubDate).toLocaleDateString("en-US") : "Undated"}
                          </p>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {liveData?.fetchedAt && (
            <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
              Fetched {new Date(liveData.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} from{" "}
              <a href="https://www.courtlistener.com/api/rest/v4/search/" target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-foreground">
                CourtListener
              </a>{" "}
              and{" "}
              <a href="https://news.google.com/" target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-foreground">
                Google News
              </a>
              . Results are query-matched only, not reviewed for relevance, and are not a substitute for a docket-monitoring or legal-research subscription.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Remediation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Remediation actions</CardTitle>
          <CardDescription>Address these before this asset is safe to publish as-is.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {activeScan.remediations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No remediation actions required at this risk level.</p>
          ) : (
            activeScan.remediations.map((r) => {
              const isChecked = Boolean(checked[r.id]);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setChecked((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                  className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover-elevate active-elevate-2"
                  data-testid={`button-remediation-${r.id}`}
                >
                  {isChecked ? (
                    <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={`text-sm flex-1 ${isChecked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {r.action}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {r.effort} effort
                  </Badge>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Insurance & risk transfer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            Insurance &amp; risk transfer
          </CardTitle>
          <CardDescription>Guidance for this score band. Confirm actual coverage with a licensed broker.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">{insuranceBand?.guidance}</p>
          <div className="space-y-1.5">
            {insuranceBand?.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                {s.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Vendor indemnification to check
            </p>
            <div className="space-y-2">
              {VENDOR_PROGRAMS.map((v) => (
                <div key={v.id} className="text-sm">
                  <span className="font-semibold text-foreground">{v.vendor}</span>
                  <span className="text-muted-foreground"> — {v.summary} </span>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {v.sourceLabel}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-md border border-[hsl(var(--band-high))]/40 bg-[hsl(var(--band-high))]/10 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--band-high))]" />
        <div className="text-xs text-foreground leading-relaxed space-y-1">
          <p className="font-semibold">Internal triage estimate only. Not legal advice. Not an insurance recommendation. Not for client-facing use.</p>
          <p className="text-muted-foreground">
            No US court has issued a merits ruling on whether AI-generated output infringes copyright as of this
            writing, so this score has no adjudicated outcomes to be validated against. Provenance and reverse-image
            checks detect exact or near-exact matches only, not legal substantial similarity, and they cannot detect
            right-of-publicity or trade dress risk at all. Vendor indemnities (Adobe, Microsoft) carry dollar caps and
            exclusions that are voided by ordinary edits such as compositing or retouching. Route every score below
            "Clear" to IP counsel and confirm any coverage decision with a licensed insurance broker before this
            asset is shown to a client or published.
          </p>
        </div>
      </div>
    </div>
  );
}
