import type { ReactNode } from "react";
import { IconChevronRight } from "../icons/AppIcons";

type Props = {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
};

export default function SettingsRow({ icon, label, hint, onClick }: Props) {
  return (
    <button type="button" className="tj-settings-row" onClick={onClick}>
      <span className="tj-settings-row__icon">{icon}</span>
      <span className="tj-settings-row__text">
        <span className="tj-settings-row__label">{label}</span>
        {hint ? <span className="tj-settings-row__hint">{hint}</span> : null}
      </span>
      <IconChevronRight size={16} />
    </button>
  );
}
