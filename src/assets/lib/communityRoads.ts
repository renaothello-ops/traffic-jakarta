import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { isValidImageDataUrl } from "./validation";
import type { CommunityRoad, RoadAccess, RoadVoteType, Vote } from "../../types";
import { displayNameOrFallback } from "./identity";
import { countVotes, getUserVote } from "./votes";

const col = collection(db, "communityRoads");

function roadDoc(id: string) {
  return doc(db, "communityRoads", id);
}

function roadVotesCol(roadId: string) {
  return collection(db, "communityRoads", roadId, "votes");
}

function roadVoteDoc(roadId: string, voterId: string) {
  return doc(db, "communityRoads", roadId, "votes", voterId);
}

export function isRoadVerified(confirmCount: number, denyCount: number): boolean {
  return confirmCount >= 10 && confirmCount > denyCount * 2;
}

export function enrichRoadWithVotes(
  road: CommunityRoad,
  votes: Vote[]
): CommunityRoad {
  const { confirmCount, denyCount } = countVotes(votes);
  return {
    ...road,
    confirmCount,
    denyCount,
    verified: isRoadVerified(confirmCount, denyCount),
  };
}

export async function createCommunityRoad(input: {
  name?: string;
  description?: string;
  access: RoadAccess;
  coordinates: Array<{ lat: number; lng: number }>;
  imageURL?: string;
  ownerUid: string;
  displayName?: string | null;
}): Promise<string> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || input.ownerUid !== authUid) {
    throw new Error("Authentication required to create a community road.");
  }

  const imageURL = input.imageURL?.trim() ?? "";
  if (imageURL && !isValidImageDataUrl(imageURL)) {
    throw new Error("Invalid image upload.");
  }

  const now = Date.now();
  const payload: Record<string, unknown> = {
    access: input.access,
    coordinates: input.coordinates,
    username: displayNameOrFallback(input.displayName),
    ownerUid: authUid,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  };

  const name = input.name?.trim();
  if (name) payload.name = name;

  const description = input.description?.trim();
  if (description) payload.description = description;

  if (imageURL) payload.imageURL = imageURL;

  const ref = await addDoc(col, payload);
  return ref.id;
}

function firestoreErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function listenCommunityRoads(
  callback: (roads: CommunityRoad[]) => void,
  onError?: (message: string) => void
): () => void {
  const q = query(col, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const roads = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: (data.name as string) || undefined,
          description: (data.description as string) || undefined,
          access: (data.access as RoadAccess) ?? "private",
          coordinates: (data.coordinates as Array<{ lat: number; lng: number }>) ?? [],
          imageURL: (data.imageURL as string) || undefined,
          username: (data.username as string) ?? "Anonymous",
          ownerUid: (data.ownerUid as string) || undefined,
          createdAt: Number(data.createdAt ?? 0),
          confirmCount: 0,
          denyCount: 0,
          verified: false,
        };
      });
      callback(roads);
    },
    (error) => {
      console.error("[listenCommunityRoads] onSnapshot error:", error);
      onError?.(firestoreErrorMessage(error));
    }
  );
}

export async function castRoadVote(
  roadId: string,
  voterId: string,
  vote: RoadVoteType
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || voterId !== authUid) {
    throw new Error("Authentication required to vote.");
  }

  await setDoc(roadVoteDoc(roadId, authUid), {
    vote,
    voterId: authUid,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export async function clearRoadVote(
  roadId: string,
  voterId: string
): Promise<void> {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid || voterId !== authUid) {
    throw new Error("Authentication required to vote.");
  }

  await deleteDoc(roadVoteDoc(roadId, authUid));
}

export function listenRoadVotes(
  roadId: string,
  callback: (votes: Vote[]) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    roadVotesCol(roadId),
    (snap) => {
      const votes = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          postId: roadId,
          voterId: (data.voterId as string) ?? d.id,
          vote: data.vote as RoadVoteType,
          createdAt: Number(data.createdAt ?? 0),
        };
      });
      callback(votes);
    },
    (error) => {
      console.error("[listenRoadVotes] onSnapshot error:", error);
      onError?.(error instanceof Error ? error.message : String(error));
    }
  );
}

export { getUserVote };

export async function deleteCommunityRoad(id: string): Promise<void> {
  await deleteDoc(roadDoc(id));
}

export const ROAD_ACCESS_OPTIONS: Array<{ value: RoadAccess; label: string }> =
  [
    { value: "cars", label: "Cars allowed" },
    { value: "motorcycles", label: "Motorcycles allowed" },
    { value: "motorcycle_only", label: "Motorcycle only" },
    { value: "restricted", label: "Restricted" },
    { value: "private", label: "Private / uncertain" },
  ];
