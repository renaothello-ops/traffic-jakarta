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
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Post, PostType } from "../../types";

const col = collection(db, "posts");

export async function createPost(input: {
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  imageURL?: string;
  username?: string;
  ttlMinutes?: number;
}) {
  const now = Date.now();
  const ttl = input.ttlMinutes ?? 10;
  const expiresAt = now + ttl * 60_000;

  await addDoc(col, {
    type: input.type,
    text: input.text ?? "",
    lat: input.lat,
    lng: input.lng,
    imageURL: input.imageURL ?? "",
    username: input.username ?? "Anonymous",
    createdAt: now,
    expiresAt,
    createdAtServer: serverTimestamp(),
  });
}

export function listenActivePosts(
  filterMin: number,
  callback: (posts: Post[]) => void
) {
  const now = Date.now();

  // 「消えていない投稿」を取る
  const q = query(
    col,
    where("expiresAt", ">", now - 24 * 60 * 60 * 1000),
    orderBy("expiresAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    const current = Date.now();

    const rows: Post[] = snap.docs
      .map((d) => {
        const data = d.data() as any;

        return {
          id: d.id,
          type: data.type ?? "other",
          text: data.text ?? "",
          lat: Number(data.lat ?? 0),
          lng: Number(data.lng ?? 0),
          createdAt: Number(data.createdAt ?? current),
          expiresAt: Number(data.expiresAt ?? current),
          imageURL: data.imageURL ?? "",
          username: data.username ?? "Anonymous",
        };
      })
      // まだ有効な投稿だけ
      .filter((p) => p.expiresAt > current)
      // フィルター時間内だけ表示
      .filter((p) => current - p.createdAt <= filterMin * 60_000)
      // 新しい順
      .sort((a, b) => b.createdAt - a.createdAt);

    callback(rows);
  });
}

export async function updatePost(
  id: string,
  updates: {
    text?: string;
    type?: PostType;
    imageURL?: string;
  }
) {
  const ref = doc(db, "posts", id);

  await updateDoc(ref, {
    ...(updates.text !== undefined ? { text: updates.text } : {}),
    ...(updates.type !== undefined ? { type: updates.type } : {}),
    ...(updates.imageURL !== undefined ? { imageURL: updates.imageURL } : {}),
  });
}

export async function updatePostLocation(
  id: string,
  lat: number,
  lng: number
) {
  const ref = doc(db, "posts", id);

  await updateDoc(ref, {
    lat,
    lng,
  });
}

export async function deletePost(id: string) {
  const ref = doc(db, "posts", id);
  await deleteDoc(ref);
}