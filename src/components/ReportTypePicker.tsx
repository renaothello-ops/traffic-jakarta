import { useTranslation } from "react-i18next";
import type { PostType } from "../types";
import { ALL_POST_TYPES, REPORT_TYPE_META } from "../assets/lib/reportTypes";
import { reportTypeShortLabel } from "../assets/lib/reportTypeI18n";

type Props = {
  value: PostType;
  onChange: (type: PostType) => void;
  columns?: number;
};

export default function ReportTypePicker({
  value,
  onChange,
  columns = 3,
}: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="tj-type-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {ALL_POST_TYPES.map((postType) => {
        const meta = REPORT_TYPE_META[postType];
        const selected = postType === value;
        return (
          <button
            key={postType}
            type="button"
            className={`tj-type-btn${selected ? " tj-type-btn--selected" : ""}`}
            onClick={() => onChange(postType)}
            aria-pressed={selected}
          >
            <span className="tj-type-btn__emoji" aria-hidden>
              {meta.emoji}
            </span>
            <span className="tj-type-btn__label">
              {reportTypeShortLabel(t, postType)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
