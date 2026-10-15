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
import { auth, db } from "./firebase";
import type { Comment } from "../../types";
import { displayNameOrFallback } from "./identity";
import { MAX_COMMENT_LENGTH, sanitizeText } from "./validation";

function commentsCol(postId: string) {
  return collection(db, "posts", postId, "comments");
}

export async function addComment(
  postId: string,
  text: string,
  authorUid: string,
  displayName?: string | null
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || authorUid !== authUid) {
    throw new Error("Authentication required to comment.");
  }

  const trimmed = sanitizeText(text, MAX_COMMENT_LENGTH);
  if (!trimmed) return;

  await addDoc(commentsCol(postId), {
    text: trimmed,
    username: displayNameOrFallback(displayName),
    authorUid: authUid,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export async function updateComment(
  postId: string,
  commentId: string,
  text: string,
  authorUid: string
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || authorUid !== authUid) {
    throw new Error("Authentication required to edit this comment.");
  }

  const trimmed = sanitizeText(text, MAX_COMMENT_LENGTH);
  if (!trimmed) {
    throw new Error("Comment cannot be empty.");
  }

  await updateDoc(doc(db, "posts", postId, "comments", commentId), {
    text: trimmed,
  });
}

export async function deleteComment(
  postId: string,
  commentId: string,
  authorUid: string
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || authorUid !== authUid) {
    throw new Error("Authentication required to delete this comment.");
  }

  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
}

export function listenComments(
  postId: string,
  callback: (comments: Comment[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(commentsCol(postId), orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    (snap) => {
      const comments = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          postId,
          text: (data.text as string) ?? "",
          username: (data.username as string) ?? "Anonymous",
          createdAt: Number(data.createdAt ?? 0),
          authorUid: (data.authorUid as string) || undefined,
        };
      });
      callback(comments);
    },
    (error) => {
      console.error("[listenComments] onSnapshot error:", error);
      onError?.(error instanceof Error ? error.message : String(error));
    }
  );
}
