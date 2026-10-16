import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { FavoritePlace, FavoritePlaceKind, FavoritePlaceRadiusKm } from "../../types";

function placesCol(uid: string) {
  return collection(db, "users", uid, "favoritePlaces");
}

export function listenFavoritePlaces(
  uid: string,
  callback: (places: FavoritePlace[]) => void
): () => void {
  const q = query(placesCol(uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          label: String(data.label ?? ""),
          kind: (data.kind as FavoritePlaceKind) ?? "other",
          lat: Number(data.lat),
          lng: Number(data.lng),
          radiusKm: (Number(data.radiusKm) as FavoritePlaceRadiusKm) || 3,
          createdAt: Number(data.createdAt ?? 0),
          updatedAt: Number(data.updatedAt ?? 0),
        };
      })
    );
  });
}

export async function saveFavoritePlace(
  uid: string,
  input: {
    id?: string;
    label: string;
    kind: FavoritePlaceKind;
    lat: number;
    lng: number;
    radiusKm: FavoritePlaceRadiusKm;
  }
): Promise<string> {
  const now = Date.now();
  const payload = {
    label: input.label.slice(0, 80),
    kind: input.kind,
    lat: input.lat,
    lng: input.lng,
    radiusKm: input.radiusKm,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, "users", uid, "favoritePlaces", input.id), payload);
    return input.id;
  }

  const ref = await addDoc(placesCol(uid), {
    ...payload,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteFavoritePlace(uid: string, placeId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "favoritePlaces", placeId));
}
