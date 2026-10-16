import { useEffect, useRef } from "react";

/** Tracks mount state so async / Firestore callbacks skip setState after unmount. */
export function useMountedRef(): { readonly current: boolean } {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
