import { useTranslation } from "react-i18next";
import type { AppTab } from "../types";

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

export default function BottomNav({ active, onChange }: Props) {
  const { t } = useTranslation();
  const TABS: Array<{ id: AppTab; label: string }> = [
    { id: "map", label: t("nav.map") },
    { id: "comment", label: t("nav.community") },
    { id: "profile", label: t("nav.profile") },
  ];
  return (
    <nav className="tj-bottom-nav" aria-label={t("nav.mainAria")}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tj-bottom-nav__btn${active === tab.id ? " tj-bottom-nav__btn--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
