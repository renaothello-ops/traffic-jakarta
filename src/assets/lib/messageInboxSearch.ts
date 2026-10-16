import type { TrafficThreadSummary } from "../../types";

export type PeerSearchLabels = Record<
  string,
  { displayName: string; username: string | null }
>;

/** Filter active inbox threads by peer name, @username, or last message preview. */
export function filterInboxBySearch(
  threads: TrafficThreadSummary[],
  query: string,
  peerLabels: PeerSearchLabels
): TrafficThreadSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads;
  return threads.filter((t) => {
    const peer = peerLabels[t.peerUid];
    const name = (peer?.displayName ?? "").toLowerCase();
    const handle = (peer?.username ?? "").toLowerCase();
    const preview = (t.lastPreview ?? "").toLowerCase();
    return (
      name.includes(q) ||
      handle.includes(q) ||
      (handle && `@${handle}`.includes(q)) ||
      preview.includes(q)
    );
  });
}
