import { useEffect, useState } from "react";

/** Shared clock for time-window verification; ticks every 45s by default. */
export function useVerificationClock(
  enabled = true,
  intervalMs = 45_000
): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}
