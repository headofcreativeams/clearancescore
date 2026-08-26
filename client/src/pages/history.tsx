import { useLocation } from "wouter";
import { FileImage, FileVideo } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useScan } from "@/lib/scan-context";
import { scoreBand } from "@/lib/scan-data";

const statusVariant: Record<string, "secondary" | "default" | "destructive"> = {
  Cleared: "secondary",
  "Needs Review": "default",
  Blocked: "destructive",
};

export default function History() {
  const { history, setActiveScanById } = useScan();
  const [, navigate] = useLocation();

  function openScan(id: string) {
    setActiveScanById(id);
    navigate("/results");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Scan history &amp; audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every scan is retained here as evidence of due-diligence review.
        </p>
      </header>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((scan) => {
              const band = scoreBand(scan.overallScore);
              return (
                <TableRow
                  key={scan.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => openScan(scan.id)}
                  data-testid={`row-history-${scan.id}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        {scan.assetKind === "video" ? (
                          <FileVideo className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileImage className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground truncate max-w-[220px]">
                        {scan.assetName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(scan.scannedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    <span
                      className="font-mono text-sm font-bold tabular-nums"
                      style={{ color: `hsl(var(${band.cssVar}))` }}
                    >
                      {scan.overallScore}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[scan.status]} className="text-[10px]">
                      {scan.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{scan.reviewer}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
