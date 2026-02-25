import { db } from "./firebase";
import type { Post, PostType } from "../../types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

const col = collection(db, "posts");

// ==========================
// ✅ Listen (既存仕様のまま)
// ==========================
export function listenActivePosts(minutes: number, cb: (posts: Post[]) => void) {
  const now = Date.now();
  const limit = now - minutes * 60_000;

  // createdAt >= limit AND orderBy createdAt desc
  const qy = query(col, where("createdAt", ">=", limit), orderBy("createdAt", "desc"));

  return onSnapshot(qy, (snap) => {
    const list: Post[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;

      const p: Post = {
        id: d.id,
        type: data.type,
        text: data.text,
        lat: data.lat,
        lng: data.lng,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        imageURL: data.imageURL,
        username: data.username ?? "Anonymous",
      };

      // expiresAt が未来のものだけ返す（既存仕様のまま）
      if (typeof p.expiresAt === "number" && p.expiresAt >= Date.now()) {
        list.push(p);
      }
    });

    cb(list);
  });
}

// ==========================
// ✅ Create (既存仕様のまま)
// ==========================
export async function createPost(input: {
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  imageURL?: string;
  username?: string;
  ttlMinutes: number;
}) {
  const now = Date.now();
  const expiresAt = now + 10 * 60_000;

  await addDoc(col, {
    type: input.type,
    text: input.text ?? "",
    lat: input.lat,
    lng: input.lng,
    imageURL: input.imageURL ?? "",
    username: input.username ?? "Anonymous",
    createdAt: now,
    expiresAt,
  });
}

// ==========================
// ✅ Update (追加：編集)
// ==========================
export async function updatePost(
  id: string,
  patch: Partial<Pick<Post, "text" | "type" | "lat" | "lng" | "imageURL" | "username">>
) {
  await updateDoc(doc(db, "posts", id), {
    ...patch,
    updatedAt: Date.now(),
  });
}

// ==========================
// ✅ Delete (追加：削除)
// ==========================
export async function deletePost(id: string) {
  await deleteDoc(doc(db, "posts", id));
}
// ==========================
// ✅ Move marker (追加：位置だけ更新)
// ==========================
export async function updatePostLocation(id: string, lat: number, lng: number) {
  await updateDoc(doc(db, "posts", id), {
    lat,
    lng,
    updatedAt: Date.now(),
  });
}

