import type { PostType } from "../types";
import { ALL_POST_TYPES, REPORT_TYPE_META } from "../assets/lib/reportTypes";

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
  return (
    <div
      className="tj-type-grid"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {ALL_POST_TYPES.map((t) => {
        const meta = REPORT_TYPE_META[t];
        const selected = t === value;
        return (
          <button
            key={t}
            type="button"
            className={`tj-type-btn${selected ? " tj-type-btn--selected" : ""}`}
            onClick={() => onChange(t)}
            aria-pressed={selected}
          >
            <span className="tj-type-btn__emoji" aria-hidden>
              {meta.emoji}
            </span>
            <span className="tj-type-btn__label">{meta.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
