import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FavoritePlace, FavoritePlaceKind, FavoritePlaceRadiusKm } from "../types";
import {
  deleteFavoritePlace,
  listenFavoritePlaces,
  saveFavoritePlace,
} from "../assets/lib/favoritePlaces";

type Props = {
  uid: string;
  pickMode: boolean;
  pickedLat: number | null;
  pickedLng: number | null;
  onClose: () => void;
  onStartPick: () => void;
};

export default function FavoritePlacesSheet({
  uid,
  pickMode,
  pickedLat,
  pickedLng,
  onClose,
  onStartPick,
}: Props) {
  const { t } = useTranslation();
  const [places, setPlaces] = useState<FavoritePlace[]>([]);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<FavoritePlaceKind>("home");
  const [radiusKm, setRadiusKm] = useState<FavoritePlaceRadiusKm>(3);
  const [saving, setSaving] = useState(false);

  useEffect(() => listenFavoritePlaces(uid, setPlaces), [uid]);

  async function saveCurrentPick() {
    if (pickedLat == null || pickedLng == null || !label.trim()) return;
    setSaving(true);
    try {
      await saveFavoritePlace(uid, {
        label: label.trim(),
        kind,
        lat: pickedLat,
        lng: pickedLng,
        radiusKm,
      });
      setLabel("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("favorites.title")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="tj-hint">{t("favorites.pushNote")}</p>

        <ul className="tj-favorites-list">
          {places.map((p) => (
            <li key={p.id} className="tj-favorites-row">
              <div>
                <strong>{p.label}</strong>
                <span>
                  {t(`favorites.kind.${p.kind}`)} · {p.radiusKm} km
                </span>
              </div>
              <button
                type="button"
                className="tj-btn tj-btn--ghost tj-btn--compact"
                onClick={() => void deleteFavoritePlace(uid, p.id)}
              >
                {t("common.delete")}
              </button>
            </li>
          ))}
        </ul>

        <h3 className="tj-comment-section__title">{t("favorites.add")}</h3>
        <label className="tj-field">
          <span>{t("favorites.label")}</span>
          <input className="tj-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="tj-field">
          <span>{t("favorites.kindLabel")}</span>
          <select
            className="tj-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as FavoritePlaceKind)}
          >
            {(["home", "school", "work", "other"] as FavoritePlaceKind[]).map((k) => (
              <option key={k} value={k}>
                {t(`favorites.kind.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="tj-field">
          <span>{t("favorites.radius")}</span>
          <select
            className="tj-select"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value) as FavoritePlaceRadiusKm)}
          >
            {[1, 3, 5, 10].map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="tj-btn tj-btn--ghost" onClick={onStartPick}>
          {pickMode ? t("favorites.picking") : t("favorites.pickOnMap")}
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--primary"
          disabled={saving || pickedLat == null || !label.trim()}
          onClick={() => void saveCurrentPick()}
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
