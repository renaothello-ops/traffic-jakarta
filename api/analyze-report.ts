import {
  applyRateLimit,
  rateLimitHeaders,
  safeErrorMessage,
} from "../server/apiSecurity";

type TrafficTextCategory =
  | "accident"
  | "flood"
  | "construction"
  | "closure"
  | "congestion"
  | "clear"
  | "other";

/** Server-side rule mirror — keep in sync with src/intelligence/textAnalysis/ruleBasedAnalyzer.ts */
function analyzeRuleBased(text: string, reportType?: string) {
  const trimmed = (text ?? "").trim();
  const patterns: Array<{ category: TrafficTextCategory; re: RegExp; severity: number }> = [
    { category: "accident", re: /tabrak|kecelakaan|accident|crash/i, severity: 0.85 },
    { category: "flood", re: /banjir|genangan|flooded|flood/i, severity: 0.8 },
    { category: "closure", re: /jalan\s+tutup|road\s+closed|ditutup/i, severity: 0.75 },
    { category: "construction", re: /proyek|construction|galian/i, severity: 0.55 },
    { category: "congestion", re: /macet|padat|antri|traffic\s+jam/i, severity: 0.6 },
    { category: "clear", re: /lancar|clear|tidak\s+macet/i, severity: 0.2 },
  ];

  for (const p of patterns) {
    if (p.re.test(trimmed)) {
      return {
        category: p.category,
        severity: p.severity,
        confidence: 0.6,
        methodology: "heuristic" as const,
        provider: "rule_based" as const,
        llmAvailable: false,
      };
    }
  }

  const typeMap: Record<string, TrafficTextCategory> = {
    accident: "accident",
    flooded: "flood",
    road_closed: "closure",
    construction: "construction",
    heavy_traffic: "congestion",
  };

  if (reportType && typeMap[reportType]) {
    return {
      category: typeMap[reportType],
      severity: 0.45,
      confidence: 0.45,
      methodology: "heuristic" as const,
      provider: "rule_based" as const,
      llmAvailable: false,
    };
  }

  return {
    category: "other" as const,
    severity: 0.35,
    confidence: 0.35,
    methodology: "heuristic" as const,
    provider: "rule_based" as const,
    llmAvailable: Boolean(process.env.OPENAI_API_KEY),
    note: process.env.OPENAI_API_KEY
      ? undefined
      : "LLM not configured — rule-based analysis only",
  };
}

export default async function handler(
  req: { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (name: string, value: string) => void;
  }
) {
  const limit = applyRateLimit(req, "analyzeReport");
  for (const [name, value] of Object.entries(rateLimitHeaders(limit))) {
    res.setHeader(name, value);
  }
  if (!limit.allowed) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body ?? {}) as { text?: string; reportType?: string };
    const result = analyzeRuleBased(body.text ?? "", body.reportType);
    res.status(200).json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: safeErrorMessage(e, "Server error") });
  }
}
