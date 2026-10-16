import { useDocumentLanguageSync } from "../i18n/documentLanguage";

/** Applies html lang/dir when the active locale changes (no map remount). */
export default function LanguageDocumentSync() {
  useDocumentLanguageSync();
  return null;
}
