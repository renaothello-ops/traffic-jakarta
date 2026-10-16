import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { encodeProfileAvatarBlob } from "../assets/lib/profilePhoto";

type Props = {
  file: File;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

export default function ProfilePhotoCropSheet({ file, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save() {
    setBusy(true);
    try {
      const blob = await encodeProfileAvatarBlob(file);
      const cropped = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("profile.photo.cropTitle")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        </div>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="tj-profile-crop-preview"
            width={240}
            height={240}
          />
        ) : null}
        <div className="tj-action-row">
          <button type="button" className="tj-btn tj-btn--ghost" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="tj-btn tj-btn--primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? t("common.loading") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
