import type { PostType } from "../../types";
import type { TrafficTextAnalysis, TrafficTextCategory } from "../types";

const RULES: Array<{
  category: TrafficTextCategory;
  patterns: RegExp[];
  severity: number;
}> = [
  {
    category: "accident",
    patterns: [
      /tabrak|kecelakaan|accident|crash|collision|tumbuk/i,
      /mobil\s+rusak|truk\s+tabrak/i,
    ],
    severity: 0.85,
  },
  {
    category: "flood",
    patterns: [
      /banjir|genangan|flooded|flood|air\s+tinggi|terendam/i,
    ],
    severity: 0.8,
  },
  {
    category: "closure",
    patterns: [
      /jalan\s+tutup|road\s+closed|ditutup|blokir|tidak\s+bisa\s+lewat/i,
    ],
    severity: 0.75,
  },
  {
    category: "construction",
    patterns: [/proyek|construction|galian|perbaikan\s+jalan|pengerjaan/i],
    severity: 0.55,
  },
  {
    category: "congestion",
    patterns: [
      /macet|padat|antri|stuck|traffic\s+jam|lambat|ramai/i,
    ],
    severity: 0.6,
  },
  {
    category: "clear",
    patterns: [/lancar|clear|normal|sudah\s+normal|tidak\s+macet/i],
    severity: 0.2,
  },
];

const LOCATION_PATTERNS = [
  /(?:di|near|dekat)\s+([A-Za-z0-9\s\-'.]{3,40})/i,
  /(?:jl\.?|jalan)\s+([A-Za-z0-9\s\-'.]{3,40})/i,
];

export function analyzeTrafficTextRuleBased(
  text: string,
  reportType?: PostType
): TrafficTextAnalysis {
  const trimmed = text.trim();
  if (!trimmed && !reportType) {
    return {
      category: "other",
      severity: 0.2,
      confidence: 0.3,
      methodology: "heuristic",
      provider: "rule_based",
      summary: "No text provided",
    };
  }

  let best: TrafficTextAnalysis | null = null;

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        best = {
          category: rule.category,
          severity: rule.severity,
          confidence: 0.55 + Math.min(0.25, trimmed.length / 200),
          methodology: "heuristic",
          provider: "rule_based",
          summary: `Rule match: ${rule.category}`,
        };
        break;
      }
    }
    if (best) break;
  }

  if (!best && reportType) {
    best = {
      category: mapPostTypeToCategory(reportType),
      severity: defaultSeverityForType(reportType),
      confidence: 0.45,
      methodology: "heuristic",
      provider: "rule_based",
      summary: "Derived from report type only",
    };
  }

  if (!best) {
    best = {
      category: "other",
      severity: 0.35,
      confidence: 0.35,
      methodology: "heuristic",
      provider: "rule_based",
    };
  }

  for (const loc of LOCATION_PATTERNS) {
    const m = trimmed.match(loc);
    if (m?.[1]) {
      best = {
        ...best,
        extractedLocation: m[1].trim().slice(0, 80),
      };
      break;
    }
  }

  return best;
}

function mapPostTypeToCategory(type: PostType): TrafficTextCategory {
  switch (type) {
    case "accident":
      return "accident";
    case "flooded":
      return "flood";
    case "road_closed":
      return "closure";
    case "construction":
      return "construction";
    case "heavy_traffic":
      return "congestion";
    default:
      return "other";
  }
}

function defaultSeverityForType(type: PostType): number {
  switch (type) {
    case "accident":
    case "road_closed":
      return 0.85;
    case "flooded":
    case "hazard":
      return 0.75;
    case "heavy_traffic":
      return 0.55;
    default:
      return 0.4;
  }
}
