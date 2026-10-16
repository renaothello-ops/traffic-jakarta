import type { PostType } from "../../types";
import type { TrafficTextAnalysis } from "../types";
import { analyzeTrafficTextRuleBased } from "./ruleBasedAnalyzer";

export type TextAnalysisOptions = {
  preferServer?: boolean;
};

/**
 * Client-safe text analysis. LLM requires server route `/api/analyze-report`
 * when OPENAI_API_KEY (or similar) is configured — not exposed to browser.
 */
export async function analyzeTrafficText(
  text: string,
  reportType?: PostType,
  options: TextAnalysisOptions = {}
): Promise<TrafficTextAnalysis> {
  if (options.preferServer && typeof fetch === "function") {
    try {
      const res = await fetch("/api/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, reportType }),
      });
      if (res.ok) {
        const data = (await res.json()) as TrafficTextAnalysis;
        if (data?.category && data.methodology) return data;
      }
    } catch {
      /* fall through to rule-based */
    }
  }

  return analyzeTrafficTextRuleBased(text, reportType);
}
