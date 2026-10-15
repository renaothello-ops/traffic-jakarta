import type { AppTab } from "../types";

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: "map", label: "🗺 Map" },
  { id: "comment", label: "💬 Comment" },
  { id: "profile", label: "👤 Profile" },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="tj-bottom-nav" aria-label="Main navigation">
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
