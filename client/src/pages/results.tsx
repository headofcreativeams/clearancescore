import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ExternalLink, ShieldCheck, ShieldAlert, Gavel, Landmark, CheckSquare, Square } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/score-gauge";
import { SubScoreChart } from "@/components/subscore-chart";
import { useScan } from "@/lib/scan-context";
import { LEGAL_CASES, VENDOR_PROGRAMS, INSURANCE_BANDS, scoreBand } from "@/lib/scan-data";

const confidenceVariant: Record<string, "secondary" | "default" | "destructive"> = {
  Low: "secondary",
  Medium: "default",
  High: "destructive",
};

export default function Results() {
  const { activeScan } = useScan();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--band-high))]" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Automated risk estimate for triage only. Not legal advice. Confirm with IP counsel and a licensed broker
          before publishing or binding coverage.
        </p>
      </div>
    </div>
  );
}
