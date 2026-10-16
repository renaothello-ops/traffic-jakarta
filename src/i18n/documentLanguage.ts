import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { languageMeta, normalizeAppLanguageCode } from "./languagePreference";

/** Sets document lang/dir for RTL (map canvas is not mirrored). */
export function useDocumentLanguageSync(): void {
  const { i18n } = useTranslation();

  useEffect(() => {
    const apply = (lng: string) => {
      const code = normalizeAppLanguageCode(lng);
      const meta = languageMeta(code);
      document.documentElement.lang = meta.bcp47;
      document.documentElement.dir = meta.rtl ? "rtl" : "ltr";
      document.body.classList.toggle("tj-rtl", meta.rtl);
    };
    apply(i18n.language);
    const onChange = (lng: string) => apply(lng);
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, [i18n]);
}
