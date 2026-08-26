import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { UploadCloud, Link2, Loader2, FileImage, FileVideo, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScan } from "@/lib/scan-context";
import type { AssetKind } from "@/lib/scan-data";

const GENERATIVE_MODELS = [
  "Midjourney v6",
  "DALL·E 3",
  "Adobe Firefly",
  "Stable Diffusion",
  "Sora 2",
  "Veo 3.1",
  "Runway Gen-4",
  "Other / unknown",
];

const INTENDED_USES = [
  "Paid social ad — external",
  "Owned e-commerce PDP",
  "Broadcast pre-roll",
  "Internal pitch deck",
  "Editorial / owned blog",
  "Client deliverable — final",
];

export default function Intake() {
  const [, navigate] = useLocation();
  const { runScan, isScanning } = useScan();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [assetKind, setAssetKind] = useState<AssetKind>("image");
  const [linkUrl, setLinkUrl] = useState("");
  const [model, setModel] = useState("");
  const [use, setUse] = useState("");

  const activeAssetName = fileName ?? (linkUrl ? linkUrl.split("/").pop() || linkUrl : "");
  const canScan = Boolean(activeAssetName && model && use && !isScanning);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setAssetKind(file.type.startsWith("video") ? "video" : "image");
    setLinkUrl("");
  }

  function handleLinkChange(value: string) {
    setLinkUrl(value);
    setFileName(null);
    setAssetKind(/\.(mp4|mov|webm|m4v)(\?|$)/i.test(value) ? "video" : "image");
  }

  async function handleScan() {
    if (!canScan) return;
    await runScan({
      assetName: activeAssetName,
      assetKind,
      generativeModel: model,
      intendedUse: use,
    });
    navigate("/results");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Scan an asset before you publish</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Upload or link a generative-AI image or video. ClearanceScore triages likely copyright, trademark, and
          likeness exposure and returns a 0–100 clearance score with sourced context.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <Tabs defaultValue="upload" onValueChange={() => { setFileName(null); setLinkUrl(""); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" data-testid="tab-upload">
                <UploadCloud className="mr-1.5 h-4 w-4" />
                Upload file
              </TabsTrigger>
              <TabsTrigger value="link" data-testid="tab-link">
                <Link2 className="mr-1.5 h-4 w-4" />
                Paste link
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file"
              />
              {!fileName ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-10 text-center hover-elevate active-elevate-2"
                  data-testid="button-choose-file"
                >
                  <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Click to choose an image or video</span>
                  <span className="text-xs text-muted-foreground">PNG, JPG, WEBP, MP4, MOV — up to 500MB</span>
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-4 py-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {assetKind === "video" ? (
                      <FileVideo className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <FileImage className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="truncate text-sm font-medium text-foreground" data-testid="text-filename">
                      {fileName}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setFileName(null)} data-testid="button-clear-file">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="link" className="mt-4 space-y-2">
              <Label htmlFor="asset-link">Asset URL</Label>
              <Input
                id="asset-link"
                placeholder="https://cdn.example.com/render_final.mp4"
                value={linkUrl}
                onChange={(e) => handleLinkChange(e.target.value)}
                data-testid="input-link"
              />
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model-select">Generative model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="model-select" data-testid="select-model">
                  <SelectValue placeholder="Select the generator used" />
                </SelectTrigger>
                <SelectContent>
                  {GENERATIVE_MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="use-select">Intended use</Label>
              <Select value={use} onValueChange={setUse}>
                <SelectTrigger id="use-select" data-testid="select-use">
                  <SelectValue placeholder="Where will this run" />
                </SelectTrigger>
                <SelectContent>
                  {INTENDED_USES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!canScan}
            onClick={handleScan}
            data-testid="button-scan-asset"
          >
            {isScanning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning asset…
              </>
            ) : (
              "Scan Asset"
            )}
          </Button>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Automated risk estimate for triage only. Not legal advice. Confirm with IP counsel and a licensed broker
        before publishing or binding coverage.
      </p>
    </div>
  );
}
