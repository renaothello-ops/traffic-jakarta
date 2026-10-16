import { useEffect, useState } from "react";
import { listFollowingUids } from "../assets/lib/socialGraph";

export function useFollowingUids(uid: string | null | undefined) {
  const [uids, setUids] = useState<string[]>([]);

  useEffect(() => {
    if (!uid) {
      setUids([]);
      return;
    }
    void listFollowingUids(uid, 100).then(({ uids: next }) => setUids(next));
  }, [uid]);

  return uids;
}
