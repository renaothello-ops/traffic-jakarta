/** Minimum speed (m/s) before GPS course heading is preferred over compass. */
export const GPS_HEADING_MIN_SPEED_MPS = 1.5;

export type OrientationPermission = "granted" | "denied" | "unsupported";

export function isDeviceOrientationSupported(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

/** True on iOS 13+ Safari where compass requires a user-gesture prompt. */
export function deviceOrientationNeedsPermissionPrompt(): boolean {
  if (!isDeviceOrientationSupported()) return false;
  const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
  };
  return typeof DOE.requestPermission === "function";
}

/**
 * iOS 13+ requires a user-gesture permission prompt. Other platforms do not.
 */
export async function requestDeviceOrientationPermission(): Promise<OrientationPermission> {
  if (!isDeviceOrientationSupported()) return "unsupported";

  const DOE = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
  };

  if (typeof DOE.requestPermission !== "function") {
    return "granted";
  }

  try {
    const result = await DOE.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** Geographic heading (0 = north, clockwise) from a deviceorientation event. */
export function compassHeadingFromEvent(
  event: DeviceOrientationEvent
): number | null {
  const webkit = (
    event as DeviceOrientationEvent & { webkitCompassHeading?: number }
  ).webkitCompassHeading;
  if (webkit != null && Number.isFinite(webkit)) {
    return ((webkit % 360) + 360) % 360;
  }
  if (event.absolute && event.alpha != null && Number.isFinite(event.alpha)) {
    return (((360 - event.alpha) % 360) + 360) % 360;
  }
  if (event.alpha != null && Number.isFinite(event.alpha)) {
    return (((360 - event.alpha) % 360) + 360) % 360;
  }
  return null;
}
