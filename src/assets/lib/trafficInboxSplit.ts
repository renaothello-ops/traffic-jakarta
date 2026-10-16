import type { TrafficThreadSummary } from "../../types";

/** Client-side split for inbox vs message requests (single Firestore listener). */
export function splitConversationThreads(
  uid: string,
  rows: TrafficThreadSummary[]
): { inbox: TrafficThreadSummary[]; requests: TrafficThreadSummary[] } {
  return {
    inbox: rows.filter((t) => t.status === "active"),
    requests: rows.filter(
      (t) => t.status === "pending" && t.pendingForUid === uid
    ),
  };
}
