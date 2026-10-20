import { useEffect, useState } from "react";
import { checkUsernameAvailability } from "../assets/lib/userProfile";
import { validateUsername } from "../assets/lib/username";

export type UsernameAvailabilityState =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export function useUsernameAvailability(
  raw: string,
  currentUid: string | null,
  currentUsernameLower: string | null
): UsernameAvailabilityState {
  const [state, setState] = useState<UsernameAvailabilityState>("idle");

  useEffect(() => {
    const validated = validateUsername(raw);
    if (!validated.ok) {
      setState(raw.trim().length === 0 ? "idle" : "invalid");
      return;
    }
    if (currentUsernameLower === validated.normalized) {
      setState("available");
      return;
    }
    if (!currentUid) {
      setState("idle");
      return;
    }

    let cancelled = false;
    setState("checking");
    const timer = window.setTimeout(() => {
      void checkUsernameAvailability(validated.normalized, currentUid).then(
        (result) => {
          if (cancelled) return;
          setState(result);
        }
      );
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [raw, currentUid, currentUsernameLower]);

  return state;
}
