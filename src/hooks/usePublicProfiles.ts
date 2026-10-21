import { useEffect, useMemo, useState } from "react";
import type { PublicUserProfile } from "../types";
import { getPublicProfile } from "../assets/lib/publicProfile";

/** Batch-load public profiles for display (latest app displayName / username). */
export function usePublicProfiles(uids: string[]): Record<string, PublicUserProfile | null> {
  const key = useMemo(
    () => [...new Set(uids.filter(Boolean))].sort().join(","),
    [uids]
  );
  const [map, setMap] = useState<Record<string, PublicUserProfile | null>>({});

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setMap({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        ids.map(async (uid) => [uid, await getPublicProfile(uid)] as const)
      );
      if (cancelled) return;
      setMap(Object.fromEntries(entries));
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  return map;
}

export function usePublicProfile(
  uid: string | null | undefined
): PublicUserProfile | null {
  const map = usePublicProfiles(uid ? [uid] : []);
  return uid ? map[uid] ?? null : null;
}
