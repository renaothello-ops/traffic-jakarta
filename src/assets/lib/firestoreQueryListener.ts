import { FirebaseError } from "firebase/app";
import {
  onSnapshot,
  type Query,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";

/**
 * Safe Firestore query listener — one unsubscribe path, no work after stop,
 * errors never throw into React, deferred unsubscribe avoids re-entrancy crashes.
 */
export function listenQuerySnapshot(
  debugLabel: string,
  q: Query,
  onNext: (snap: QuerySnapshot) => void,
  onError?: (error: FirebaseError) => void
): Unsubscribe {
  let stopped = false;
  let innerUnsub: Unsubscribe | null = null;

  if (import.meta.env.DEV) {
    console.debug("[TrafficMessages] subscribe", debugLabel);
  }

  innerUnsub = onSnapshot(
    q,
    (snap) => {
      if (stopped) return;
      onNext(snap);
    },
    (error) => {
      if (stopped) return;
      const fbError =
        error instanceof FirebaseError
          ? error
          : new FirebaseError("unknown", String(error));
      console.error(
        "[TrafficMessages] listener error",
        debugLabel,
        fbError.code,
        fbError.message
      );
      onError?.(fbError);
    }
  );

  return function unsubscribeQuerySnapshot() {
    if (stopped) return;
    stopped = true;
    const u = innerUnsub;
    innerUnsub = null;
    if (import.meta.env.DEV) {
      console.debug("[TrafficMessages] unsubscribe", debugLabel);
    }
    if (!u) return;
    try {
      u();
    } catch (err) {
      console.error("[TrafficMessages] unsubscribe failed", debugLabel, err);
    }
  };
}

/** Idempotent wrapper — safe to call multiple times. */
export function chainUnsubscribe(unsub: Unsubscribe | undefined): Unsubscribe {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    unsub?.();
  };
}
