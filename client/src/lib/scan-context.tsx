import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  DEMO_SCANS,
  computeOverallScore,
  subScoreDefinitions,
  type AssetKind,
  type ScanResult,
  type SubScore,
} from "./scan-data";

interface IntakeInput {
  assetName: string;
  assetKind: AssetKind;
  generativeModel: string;
  intendedUse: string;
}

interface ScanContextValue {
  history: ScanResult[];
  activeScan: ScanResult | null;
  isScanning: boolean;
  runScan: (input: IntakeInput) => Promise<ScanResult>;
  setActiveScanById: (id: string) => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

// Deterministic pseudo-random risk generator seeded by asset name, so the
// same filename always yields the same demo result within a session.
function seededRisk(seed: string, offset: number, min: number, max: number): number {
  let hash = 0;
  const str = seed + offset;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return Math.round(min + normalized * (max - min));
}

function synthesizeSubScores(assetName: string, assetKind: AssetKind): SubScore[] {
  const defs = subScoreDefinitions(assetKind);
  return defs.map((d, i) => ({
    ...d,
    riskValue: seededRisk(assetName, i, 2, 78),
  }));
}

export function ScanProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<ScanResult[]>(DEMO_SCANS);
  const [activeScan, setActiveScan] = useState<ScanResult | null>(DEMO_SCANS[0] ?? null);
  const [isScanning, setIsScanning] = useState(false);

  const runScan = useCallback(async (input: IntakeInput): Promise<ScanResult> => {
    setIsScanning(true);
    // Simulate a detection pipeline call (reverse-image search, C2PA manifest
    // read, style-embedding comparison, etc.) — this is a UI demo timing only.
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const subScores = synthesizeSubScores(input.assetName, input.assetKind);
    const overallScore = computeOverallScore(subScores);
    const status: ScanResult["status"] =
      overallScore < 40 ? "Blocked" : overallScore < 90 ? "Needs Review" : "Cleared";

    const claimants: ScanResult["claimants"] = subScores
      .filter((s) => s.riskValue >= 55)
      .slice(0, 2)
      .map((s, i) => ({
        id: `${input.assetName}-c${i}`,
        name: `Potential claimant — ${s.shortLabel} match (DEMO DATA)`,
        claimType:
          s.id === "trademark-brand"
            ? ("Trademark / brand mark" as const)
            : s.id === "likeness-publicity"
            ? ("Right of publicity / likeness" as const)
            : s.id === "style-mimicry"
            ? ("Copyright — style or training data" as const)
            : ("Copyright — direct visual match" as const),
        confidence: s.riskValue >= 70 ? ("High" as const) : ("Medium" as const),
        matchedSourceUrl: "https://c2pa.org/",
        matchedSourceLabel: "C2PA Content Credentials manifest",
        note: `Elevated ${s.label.toLowerCase()} risk detected during automated triage. Confirm with a licensed reverse-image or provenance lookup before treating this as a confirmed match.`,
      }));

    const remediations: ScanResult["remediations"] = subScores
      .filter((s) => s.riskValue >= 35)
      .map((s, i) => ({
        id: `${input.assetName}-rem-${i}`,
        relatedSubScoreId: s.id,
        action: `Review and reduce ${s.label.toLowerCase()} exposure before publishing.`,
        effort: s.riskValue >= 65 ? ("High" as const) : s.riskValue >= 45 ? ("Medium" as const) : ("Low" as const),
      }));

    const result: ScanResult = {
      id: `scan-${Date.now()}`,
      assetName: input.assetName,
      assetKind: input.assetKind,
      generativeModel: input.generativeModel,
      intendedUse: input.intendedUse,
      scannedAt: new Date().toISOString(),
      overallScore,
      subScores,
      claimants,
      remediations,
      reviewer: "You",
      status,
    };

    setHistory((prev) => [result, ...prev]);
    setActiveScan(result);
    setIsScanning(false);
    return result;
  }, []);

  const setActiveScanById = useCallback(
    (id: string) => {
      const found = history.find((h) => h.id === id);
      if (found) setActiveScan(found);
    },
    [history]
  );

  return (
    <ScanContext.Provider value={{ history, activeScan, isScanning, runScan, setActiveScanById }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within a ScanProvider");
  return ctx;
}
