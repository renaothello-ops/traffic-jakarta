import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  onEdit: () => void;
  onDelete: () => void;
};

export default function CommentMenu({ onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="tj-comment-menu" ref={rootRef}>
      <button
        type="button"
        className="tj-comment-menu__trigger"
        aria-label={t("comments.optionsAria")}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ⋯
      </button>
      {open && (
        <div className="tj-comment-menu__dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="tj-comment-menu__item"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            {t("comments.editComment")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="tj-comment-menu__item tj-comment-menu__item--danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            {t("comments.deleteComment")}
          </button>
        </div>
      )}
    </div>
  );
}
