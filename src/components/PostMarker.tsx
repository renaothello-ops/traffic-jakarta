import { useTranslation } from "react-i18next";
import { Marker } from "react-map-gl/maplibre";
import type { Post } from "../types";
import type { TrustLevel, VerificationTier } from "../assets/lib/trust";
import {
  getReportTypeMeta,
  postAgeOpacity,
} from "../assets/lib/reportTypes";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import { trustMarkerOpacity } from "../assets/lib/trust";

type Props = {
  post: Post;
  filterMin: number;
  isDragging: boolean;
  isSelected: boolean;
  draggable: boolean;
  verificationTier: VerificationTier;
  trustLevel: TrustLevel;
  onSelect: (post: Post) => void;
  onDragEnd: (post: Post, lat: number, lng: number) => void;
};

export default function PostMarker({
  post,
  filterMin,
  isDragging,
  isSelected,
  draggable,
  verificationTier,
  trustLevel,
  onSelect,
  onDragEnd,
}: Props) {
  const { t } = useTranslation();
  const meta = getReportTypeMeta(post.type);
  const typeLabel = reportTypeLabel(t, post.type);
  const baseOpacity = postAgeOpacity(post.createdAt, filterMin);
  const opacity = trustMarkerOpacity(trustLevel, baseOpacity);

  return (
    <Marker
      longitude={post.lng}
      latitude={post.lat}
      anchor="bottom"
      draggable={draggable}
      onDragEnd={(e) => onDragEnd(post, e.lngLat.lat, e.lngLat.lng)}
    >
      <div
        className={`tj-post-marker-wrap${isSelected ? " tj-post-marker-wrap--selected" : ""}${verificationTier > 0 ? ` tj-post-marker-wrap--tier-${verificationTier}` : ""}`}
      >
        {verificationTier >= 2 && (
          <span
            className={`tj-post-marker__badge${verificationTier >= 3 ? " tj-post-marker__badge--strong" : ""}`}
            aria-hidden
          >
            ✓
          </span>
        )}
        <button
          type="button"
          className="tj-post-marker"
          onClick={() => onSelect(post)}
          style={{
            background: isDragging ? "#f97316" : meta.color,
            opacity,
            cursor: isDragging ? "grab" : "pointer",
          }}
          aria-label={
            verificationTier >= 2
              ? t("postMarker.ariaVerified", { type: typeLabel })
              : t("postMarker.aria", { type: typeLabel })
          }
        >
          <span className="tj-post-marker__emoji" aria-hidden>
            {meta.emoji}
          </span>
        </button>
      </div>
    </Marker>
  );
}
