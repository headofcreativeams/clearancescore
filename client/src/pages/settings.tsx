import { useState } from "react";
import { ExternalLink, Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DETECTION_APIS } from "@/lib/scan-data";

export default function Settings() {
  const [threshold, setThreshold] = useState(70);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detection sources and the score threshold used to flag an asset as needing review.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4 text-muted-foreground" />
            Detection API connections
          </CardTitle>
          <CardDescription>
            Real services this triage model draws on. Connect production credentials to move from demo data to live
            matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DETECTION_APIS.map((api) => (
            <div
              key={api.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border p-4 flex-wrap"
              data-testid={`card-api-${api.id}`}
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{api.name}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {api.category}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-md">{api.description}</p>
                <a
                  href={api.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {api.sourceLabel}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Badge
                variant={api.connected ? "secondary" : "outline"}
                className="text-[10px] shrink-0"
                data-testid={`badge-status-${api.id}`}
              >
                {api.connected ? "Connected (demo)" : "Not connected"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score threshold policy</CardTitle>
          <CardDescription>
            Assets scoring below this threshold are marked "Needs Review" or "Blocked" and routed to a human.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-2">
              <Label htmlFor="threshold-input">Minimum clearance score</Label>
              <Input
                id="threshold-input"
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-28"
                data-testid="input-threshold"
              />
            </div>
            <Button variant="outline" onClick={() => setThreshold(70)} data-testid="button-reset-threshold">
              Reset to default (70)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
