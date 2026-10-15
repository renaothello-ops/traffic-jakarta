import { useEffect, useState } from "react";

/** Shared clock for time-window verification; ticks every 45s by default. */
export function useVerificationClock(intervalMs = 45_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
