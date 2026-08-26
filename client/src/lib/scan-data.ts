// ClearanceScore demo data model.
// All claimant names, matched-source URLs, and scan records in this file are
// DEMO DATA for illustrating the product's UI. They are not the output of a
// real detection pipeline. Legal case citations and insurance/indemnification
// program descriptions are real and sourced — see LEGAL_CASES and
// INSURANCE_BANDS below for citation URLs.

export type AssetKind = "image" | "video";

export interface SubScore {
  id: string;
  label: string;
  shortLabel: string;
  weight: number; // percent weight in the overall score, sums to 100 for the asset kind
  riskValue: number; // 0 (no risk detected) to 100 (severe risk) for this factor
  description: string;
  detectionMethod: string;
}

export interface Claimant {
  id: string;
  name: string;
  claimType: "Trademark / brand mark" | "Copyright — style or training data" | "Right of publicity / likeness" | "Copyright — direct visual match";
  confidence: "Low" | "Medium" | "High";
  matchedSourceUrl: string;
  matchedSourceLabel: string;
  note: string;
}

export interface RemediationItem {
  id: string;
  relatedSubScoreId: string;
  action: string;
  effort: "Low" | "Medium" | "High";
}

export interface ScanResult {
  id: string;
  assetName: string;
  assetKind: AssetKind;
  generativeModel: string;
  intendedUse: string;
  scannedAt: string; // ISO date
  overallScore: number;
  subScores: SubScore[];
  claimants: Claimant[];
  remediations: RemediationItem[];
  reviewer: string;
  status: "Cleared" | "Needs Review" | "Blocked";
}

export function computeOverallScore(subScores: SubScore[]): number {
  const totalWeight = subScores.reduce((sum, s) => sum + s.weight, 0) || 1;
  const weightedRisk =
    subScores.reduce((sum, s) => sum + s.riskValue * s.weight, 0) / totalWeight;
  return Math.round(Math.max(0, Math.min(100, 100 - weightedRisk)));
}

export function scoreBand(score: number): {
  key: "critical" | "high" | "moderate" | "clear";
  label: string;
  cssVar: string;
} {
  if (score < 40) return { key: "critical", label: "Critical Risk", cssVar: "--band-critical" };
  if (score < 70) return { key: "high", label: "High Risk", cssVar: "--band-high" };
  if (score < 90) return { key: "moderate", label: "Moderate Risk", cssVar: "--band-moderate" };
  return { key: "clear", label: "Likely Clear", cssVar: "--band-clear" };
}

export function subScoreDefinitions(assetKind: AssetKind): Omit<SubScore, "riskValue">[] {
  const base: Omit<SubScore, "riskValue">[] = [
    {
      id: "visual-similarity",
      label: "Visual / Element Similarity",
      shortLabel: "Visual match",
      weight: assetKind === "video" ? 28 : 30,
      description: "Near-duplicate or substantially similar match to a specific copyrighted image, frame, character design, or scene via reverse-image and perceptual-hash search.",
      detectionMethod: "Reverse image search (e.g. TinEye-style hash matching) + perceptual hashing across frames",
    },
    {
      id: "style-mimicry",
      label: "Style / Artist Mimicry",
      shortLabel: "Style mimicry",
      weight: 20,
      description: "Output closely mimics a living artist's or studio's identifiable visual style, palette, or technique in a way that has drawn litigation in analogous cases.",
      detectionMethod: "Style-embedding similarity against a reference artist corpus",
    },
    {
      id: "trademark-brand",
      label: "Trademark & Brand Marks",
      shortLabel: "Trademark",
      weight: 15,
      description: "Detectable logos, product designs, uniforms, or other registered trademarks appear in the frame.",
      detectionMethod: "Logo/object detection against a trademark reference set",
    },
    {
      id: "likeness-publicity",
      label: "Likeness & Right of Publicity",
      shortLabel: "Likeness",
      weight: 15,
      description: "A recognizable real person's face, voice, or persona appears without a release, raising state right-of-publicity exposure.",
      detectionMethod: "Facial-embedding match against a public-figure reference set",
    },
    {
      id: "training-provenance",
      label: "Training-Data / Model Provenance",
      shortLabel: "Model provenance",
      weight: 15,
      description: "The generating model's known training-data sourcing and pending litigation posture (e.g. whether the vendor offers IP indemnification).",
      detectionMethod: "C2PA Content Credentials manifest read + vendor indemnification lookup",
    },
  ];

  if (assetKind === "video") {
    return [
      ...base.map((s) => (s.id === "visual-similarity" ? s : s)),
      {
        id: "audio-fingerprint",
        label: "Music / Audio Fingerprint",
        shortLabel: "Audio fingerprint",
        weight: 5,
        description: "Generated or synced audio track matches a registered sound recording or musical composition.",
        detectionMethod: "Acoustic fingerprinting against a rights-registration database",
      },
    ];
  }

  return base;
}

// ---- Demo scan seed (marked DEMO DATA throughout the UI) ----

function buildDemoScan(params: {
  id: string;
  assetName: string;
  assetKind: AssetKind;
  generativeModel: string;
  intendedUse: string;
  scannedAt: string;
  reviewer: string;
  riskValues: Record<string, number>;
  claimants: Claimant[];
}): ScanResult {
  const defs = subScoreDefinitions(params.assetKind);
  const subScores: SubScore[] = defs.map((d) => ({
    ...d,
    riskValue: params.riskValues[d.id] ?? 0,
  }));
  const overallScore = computeOverallScore(subScores);
  const band = scoreBand(overallScore);
  const status: ScanResult["status"] =
    band.key === "critical" || band.key === "high" ? "Blocked" : band.key === "moderate" ? "Needs Review" : "Cleared";

  const remediations: RemediationItem[] = subScores
    .filter((s) => s.riskValue >= 35)
    .map((s, i) => ({
      id: `${params.id}-rem-${i}`,
      relatedSubScoreId: s.id,
      action: remediationCopy(s.id),
      effort: s.riskValue >= 65 ? "High" : s.riskValue >= 45 ? "Medium" : "Low",
    }));

  return {
    id: params.id,
    assetName: params.assetName,
    assetKind: params.assetKind,
    generativeModel: params.generativeModel,
    intendedUse: params.intendedUse,
    scannedAt: params.scannedAt,
    overallScore,
    subScores,
    claimants: params.claimants,
    remediations,
    reviewer: params.reviewer,
    status,
  };
}

function remediationCopy(subScoreId: string): string {
  switch (subScoreId) {
    case "visual-similarity":
      return "Regenerate with a materially different composition, or license the matched source before use.";
    case "style-mimicry":
      return "Adjust the prompt to remove named-artist and named-studio style references; regenerate.";
    case "trademark-brand":
      return "Blur, crop, or prompt-out the detected logo or product design before publishing.";
    case "likeness-publicity":
      return "Obtain a signed release from the identified individual, or regenerate with a fictional face.";
    case "training-provenance":
      return "Switch to a model with a vendor IP indemnification program, or route through enterprise licensing.";
    case "audio-fingerprint":
      return "Replace the audio bed with a cleared library track or an unregistered generated composition.";
    default:
      return "Review this factor with counsel before publishing.";
  }
}

export const DEMO_SCANS: ScanResult[] = [
  buildDemoScan({
    id: "scan-1042",
    assetName: "hero_streetwear_launch_v3.png",
    assetKind: "image",
    generativeModel: "Midjourney v6",
    intendedUse: "Paid social ad — external",
    scannedAt: "2026-08-24T14:32:00-04:00",
    reviewer: "A. Reyes",
    riskValues: {
      "visual-similarity": 18,
      "style-mimicry": 72,
      "trademark-brand": 8,
      "likeness-publicity": 5,
      "training-provenance": 55,
    },
    claimants: [
      {
        id: "c1",
        name: "Independent illustrator (style match — DEMO DATA)",
        claimType: "Copyright — style or training data",
        confidence: "Medium",
        matchedSourceUrl: "https://ailawsuittracker.com/cases/andersen-v-stability-ai-ltd-3-23-cv-00201/",
        matchedSourceLabel: "Andersen v. Stability AI case tracker",
        note: "Palette and linework pattern-match a working-artist style class named in active style-mimicry litigation against image generators.",
      },
    ],
  }),
  buildDemoScan({
    id: "scan-1041",
    assetName: "product_flatlay_sneaker_02.jpg",
    assetKind: "image",
    generativeModel: "Adobe Firefly",
    intendedUse: "Owned e-commerce PDP",
    scannedAt: "2026-08-23T09:05:00-04:00",
    reviewer: "A. Reyes",
    riskValues: {
      "visual-similarity": 6,
      "style-mimicry": 4,
      "trademark-brand": 2,
      "likeness-publicity": 0,
      "training-provenance": 2,
    },
    claimants: [],
  }),
  buildDemoScan({
    id: "scan-1039",
    assetName: "spokesperson_testimonial_cut.mp4",
    assetKind: "video",
    generativeModel: "Runway Gen-4",
    intendedUse: "Broadcast pre-roll",
    scannedAt: "2026-08-21T16:47:00-04:00",
    reviewer: "K. Osei",
    riskValues: {
      "visual-similarity": 22,
      "style-mimicry": 10,
      "trademark-brand": 15,
      "likeness-publicity": 84,
      "training-provenance": 40,
      "audio-fingerprint": 12,
    },
    claimants: [
      {
        id: "c2",
        name: "Unidentified public figure — facial match (DEMO DATA)",
        claimType: "Right of publicity / likeness",
        confidence: "High",
        matchedSourceUrl: "https://en.wikipedia.org/wiki/Right_of_publicity",
        matchedSourceLabel: "Right of publicity — legal overview",
        note: "Generated face pattern-matches a recognizable public figure at high confidence with no release on file.",
      },
    ],
  }),
  buildDemoScan({
    id: "scan-1035",
    assetName: "brand_mascot_explainer_loop.mp4",
    assetKind: "video",
    generativeModel: "Sora 2",
    intendedUse: "Internal pitch deck",
    scannedAt: "2026-08-19T11:15:00-04:00",
    reviewer: "K. Osei",
    riskValues: {
      "visual-similarity": 38,
      "style-mimicry": 20,
      "trademark-brand": 46,
      "likeness-publicity": 0,
      "training-provenance": 20,
      "audio-fingerprint": 5,
    },
    claimants: [
      {
        id: "c3",
        name: "Consumer brand — logo detection (DEMO DATA)",
        claimType: "Trademark / brand mark",
        confidence: "Medium",
        matchedSourceUrl: "https://www.uspto.gov/trademarks/basics",
        matchedSourceLabel: "USPTO trademark basics",
        note: "A registered logo shape appears on packaging in three frames of the generated clip.",
      },
    ],
  }),
];

// ---- Real legal case citations shown in the "Why this score" panel ----

export interface LegalCase {
  id: string;
  name: string;
  summary: string;
  relevantTo: string[]; // sub-score ids
  url: string;
  sourceLabel: string;
}

export const LEGAL_CASES: LegalCase[] = [
  {
    id: "andersen",
    name: "Andersen v. Stability AI, Midjourney, DeviantArt, Runway",
    summary:
      "A group of visual artists sued Stability AI, Midjourney, DeviantArt, and Runway over alleged use of their copyrighted works to train image models and over outputs that mimic their identifiable styles. The case is proceeding toward trial.",
    relevantTo: ["style-mimicry", "training-provenance", "visual-similarity"],
    url: "https://ailawsuittracker.com/cases/andersen-v-stability-ai-ltd-3-23-cv-00201/",
    sourceLabel: "AI Lawsuit Tracker — Andersen v. Stability AI",
  },
  {
    id: "getty",
    name: "Getty Images v. Stability AI",
    summary:
      "The UK High Court rejected Getty's secondary-copyright-infringement claim over Stable Diffusion's outputs, narrowing but not eliminating infringement exposure for image generators trained on licensed stock libraries.",
    relevantTo: ["visual-similarity", "training-provenance"],
    url: "https://www.lw.com/en/insights/getty-images-v-stability-ai-english-high-court-rejects-secondary-copyright-claim",
    sourceLabel: "Latham & Watkins — Getty Images v. Stability AI",
  },
  {
    id: "nyt",
    name: "New York Times v. OpenAI and Microsoft",
    summary:
      "The Times' direct and contributory copyright infringement claims over ChatGPT outputs survived a motion to dismiss and proceeded to summary judgment briefing, establishing that training-data provenance and output similarity remain live legal theories against generative model vendors.",
    relevantTo: ["training-provenance", "visual-similarity"],
    url: "https://ailawsuittracker.com/cases/new-york-times-v-openai/",
    sourceLabel: "AI Lawsuit Tracker — NYT v. OpenAI",
  },
];

// ---- Vendor IP indemnification programs, cited by real source ----

export interface VendorProgram {
  id: string;
  vendor: string;
  productOrProgram: string;
  summary: string;
  url: string;
  sourceLabel: string;
}

export const VENDOR_PROGRAMS: VendorProgram[] = [
  {
    id: "adobe",
    vendor: "Adobe",
    productOrProgram: "Firefly enterprise generative credits",
    summary:
      "Adobe states it will defend and indemnify enterprise customers against third-party IP claims arising from content generated with Firefly, subject to its product terms.",
    url: "https://helpx.adobe.com/legal/product-descriptions/adobe-firefly.html",
    sourceLabel: "Adobe — Firefly product description and legal terms",
  },
  {
    id: "microsoft",
    vendor: "Microsoft",
    productOrProgram: "Copilot Copyright Commitment",
    summary:
      "Microsoft's Copilot Copyright Commitment extends defense and indemnification coverage to commercial Copilot customers for copyright claims tied to Copilot outputs, provided the customer used built-in guardrails.",
    url: "https://blogs.microsoft.com/on-the-issues/2023/09/07/copilot-copyright-commitment-ai-legal-concerns/",
    sourceLabel: "Microsoft On the Issues — Copilot Copyright Commitment",
  },
];

// ---- Insurance / risk transfer guidance shown in the results panel ----

export interface InsuranceBand {
  bandKey: "critical" | "high" | "moderate" | "clear";
  guidance: string;
  sources: { label: string; url: string }[];
}

export const INSURANCE_BANDS: InsuranceBand[] = [
  {
    bandKey: "critical",
    guidance:
      "Do not publish. Standard media E&O policies commonly exclude AI-generated content outright, so this asset likely has no coverage backstop until it is remediated or licensed.",
    sources: [
      { label: "Front Row Insurance — AI production insurance guidance", url: "https://www.frontrowinsurance.com/news/thinking-about-using-ai-in-your-production-heres-what-you-need-to-know-about-insurance/" },
    ],
  },
  {
    bandKey: "high",
    guidance:
      "Route to counsel before publishing. If the campaign must run, confirm whether the agency or client carries an AI-specific media liability endorsement rather than relying on a legacy E&O policy.",
    sources: [
      { label: "Front Row Insurance — AI production insurance guidance", url: "https://www.frontrowinsurance.com/news/thinking-about-using-ai-in-your-production-heres-what-you-need-to-know-about-insurance/" },
      { label: "Vouch — AI technology E&O coverage", url: "https://www.vouch.us/technology/ai" },
    ],
  },
  {
    bandKey: "moderate",
    guidance:
      "Publishable with sign-off. Confirm the agency's media E&O policy has an AI content endorsement in force, and log this scan in the audit trail as evidence of due diligence.",
    sources: [
      { label: "Munich Re HSB — AI liability insurance", url: "https://www.munichre.com/hsb/en/products/ai-liability-insurance.html" },
    ],
  },
  {
    bandKey: "clear",
    guidance:
      "Standard media E&O should apply. Retain the scan record and any vendor indemnification terms as documentation in case a claim surfaces later.",
    sources: [
      { label: "Adobe — Firefly product description and legal terms", url: "https://helpx.adobe.com/legal/product-descriptions/adobe-firefly.html" },
    ],
  },
];

export const DETECTION_APIS = [
  {
    id: "c2pa",
    name: "C2PA Content Credentials",
    category: "Provenance",
    description: "Reads embedded manifest data disclosing whether an asset was AI-generated and by which tool.",
    url: "https://c2pa.org/",
    sourceLabel: "Coalition for Content Provenance and Authenticity",
    connected: true,
  },
  {
    id: "tineye",
    name: "TinEye Reverse Image Search API",
    category: "Visual match",
    description: "Reverse-image and perceptual-hash search against a large indexed corpus of published images.",
    url: "https://github.com/TinEye/tineye-api-php",
    sourceLabel: "TinEye API — GitHub",
    connected: true,
  },
  {
    id: "contentcredentials",
    name: "Content Credentials Verify",
    category: "Provenance",
    description: "Public verification tool for reading and validating C2PA manifests on an asset.",
    url: "https://contentcredentials.org/",
    sourceLabel: "Content Credentials",
    connected: false,
  },
];
