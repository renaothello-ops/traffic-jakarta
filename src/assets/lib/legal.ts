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

/** Terms HTML is marked draft in-repo until owner sets version + removes draft banner. */
export function isTermsDocumentPublishable(): boolean {
  return requiresPublishedTermsAcceptance();
}
