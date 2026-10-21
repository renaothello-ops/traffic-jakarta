import type { AppLanguage } from "../../types";

/** Published terms version — set via Vercel env when legal review is complete. */
export function getPublishedTermsVersion(): string | null {
  const raw = import.meta.env.VITE_LEGAL_TERMS_VERSION?.trim();
  return raw || null;
}

export function requiresPublishedTermsAcceptance(): boolean {
  return getPublishedTermsVersion() != null;
}

export const LEGAL_TERMS_URL = "/legal/terms.html";
export const LEGAL_PRIVACY_URL = "/legal/privacy.html";

/** Legal HTML is English draft; `lang` drives UI notice only (not a localized legal text). */
export function legalDocumentUrl(path: string, language: AppLanguage): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}lang=${encodeURIComponent(language)}`;
}

/** Terms HTML is marked draft in-repo until owner sets version + removes draft banner. */
export function isTermsDocumentPublishable(): boolean {
  return requiresPublishedTermsAcceptance();
}
