import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Vote, VoteType } from "../../types";

function votesCol(postId: string) {
  return collection(db, "posts", postId, "votes");
}

function voteDoc(postId: string, voterId: string) {
  return doc(db, "posts", postId, "votes", voterId);
}

export function countVotes(votes: Vote[]): {
  confirmCount: number;
  denyCount: number;
} {
  let confirmCount = 0;
  let denyCount = 0;
  for (const v of votes) {
    if (v.vote === "confirm") confirmCount += 1;
    else if (v.vote === "deny") denyCount += 1;
  }
  return { confirmCount, denyCount };
}

/**
 * Set the signed-in user's vote for a post.
 * null removes the vote. confirm/deny replace any existing vote.
 */
export async function setUserVote(
  postId: string,
  vote: VoteType | null
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid) {
    throw new Error("Authentication required to vote.");
  }

  if (vote === null) {
    await deleteDoc(voteDoc(postId, authUid));
    return;
  }

  await setDoc(voteDoc(postId, authUid), {
    vote,
    voterId: authUid,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export async function castVote(
  postId: string,
  voterId: string,
  vote: VoteType
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || voterId !== authUid) {
    throw new Error("Authentication required to vote.");
  }
  await setUserVote(postId, vote);
}

export async function clearVote(
  postId: string,
  voterId: string
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || voterId !== authUid) {
    throw new Error("Authentication required to vote.");
  }
  await setUserVote(postId, null);
}

export function listenPostVotes(
  postId: string,
  callback: (votes: Vote[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    votesCol(postId),
    (snap) => {
      const votes = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          postId,
          voterId: (data.voterId as string) ?? d.id,
          vote: data.vote as VoteType,
          createdAt: Number(data.createdAt ?? 0),
        };
      });
      callback(votes);
    },
    (error) => {
      console.error("[listenPostVotes] onSnapshot error:", error);
      onError?.(error instanceof Error ? error.message : String(error));
    }
  );
}

export function getUserVote(votes: Vote[], voterId: string): VoteType | null {
  const found = votes.find((v) => v.voterId === voterId);
  return found?.vote ?? null;
}
