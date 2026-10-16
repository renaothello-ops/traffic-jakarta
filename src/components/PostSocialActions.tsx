import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VoteType } from "../types";
import { IconMessageCircle, IconShare, IconThumbsUp } from "./icons/AppIcons";

type Props = {
  confirmCount: number;
  userVote: VoteType | null;
  voting: boolean;
  canInteract: boolean;
  onToggleConfirm: () => void;
  onToggleDeny: () => void;
  onCommentClick: () => void;
  onShare: () => void;
};

export default function PostSocialActions({
  confirmCount,
  userVote,
  voting,
  canInteract,
  onToggleConfirm,
  onToggleDeny,
  onCommentClick,
  onShare,
}: Props) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <div className="tj-social-actions">
      <div className="tj-social-actions__row">
        <button
          type="button"
          className={`tj-social-action${userVote === "confirm" ? " tj-social-action--active" : ""}`}
          onClick={onToggleConfirm}
          disabled={voting || !canInteract}
        >
          <IconThumbsUp size={18} className="tj-social-action__icon" />
          <span>{t("votes.confirm")}</span>
          {confirmCount > 0 && (
            <span className="tj-social-action__count">{confirmCount}</span>
          )}
        </button>
        <button
          type="button"
          className="tj-social-action"
          onClick={onCommentClick}
        >
          <IconMessageCircle size={18} className="tj-social-action__icon" />
          <span>{t("votes.comment")}</span>
        </button>
        <button type="button" className="tj-social-action" onClick={onShare}>
          <IconShare size={18} className="tj-social-action__icon" />
          <span>{t("postDetail.share")}</span>
        </button>
        <div className="tj-social-menu" ref={menuRef}>
          <button
            type="button"
            className={`tj-social-menu__trigger${userVote === "deny" ? " tj-social-action--active" : ""}`}
            aria-label={t("votes.moreActions")}
            aria-expanded={menuOpen}
            disabled={!canInteract}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="tj-social-menu__dropdown" role="menu">
              <button
                type="button"
                role="menuitem"
                className="tj-social-menu__item"
                disabled={voting || !canInteract}
                onClick={() => {
                  setMenuOpen(false);
                  onToggleDeny();
                }}
              >
                {userVote === "deny" ? t("votes.removeDeny") : t("votes.deny")}
              </button>
            </div>
          )}
        </div>
      </div>
      {userVote === "deny" && (
        <p className="tj-social-personal-note">{t("votes.personalDenyNote")}</p>
      )}
    </div>
  );
}
