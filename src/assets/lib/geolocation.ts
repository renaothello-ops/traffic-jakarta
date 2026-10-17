export type GeoPoint = { lat: number; lng: number };

export function geolocationErrorMessage(code: number, message: string): string {
  switch (code) {
    case 1:
      return "Location access is required to show your current position.";
    case 2:
      return `Location unavailable (${message}). Check that device location services are enabled.`;
    case 3:
      return "Location request timed out. Try again or tap Retry.";
    default:
      return `Could not get current location (${message}).`;
  }
}

/** i18n key for map locate UI (nav.* / errors.*). */
export function geolocationErrorI18nKey(code: number): string {
  switch (code) {
    case 1:
      return "nav.locationDeniedLong";
    case 2:
      return "nav.locationUnavailable";
    case 3:
      return "nav.locationTimeout";
    case -1:
      return "nav.locationUnsupported";
    default:
      return "nav.locationUnavailable";
  }
}

export function requestCurrentPosition(
  onSuccess: (point: GeoPoint, accuracy: number) => void,
  onError: (message: string, code: number, rawMessage: string) => void
): void {
  if (!navigator.geolocation) {
    const msg = "This browser does not support geolocation.";
    console.error("Geolocation error", { code: -1, message: msg });
    onError(geolocationErrorI18nKey(-1), -1, msg);
    return;
  }

  if (!window.isSecureContext) {
    const msg =
      "Geolocation requires HTTPS (or localhost). Open the app via https:// or http://localhost.";
    console.error("Geolocation error", { code: -1, message: msg });
    onError(geolocationErrorI18nKey(-1), -1, msg);
    return;
  }

  if (import.meta.env.DEV && navigator.permissions?.query) {
    void navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        console.info("GEOLOCATION_PERMISSION_STATE", result.state);
      })
      .catch(() => {
        console.info("GEOLOCATION_PERMISSION_STATE", "unsupported");
      });
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (import.meta.env.DEV) {
        console.info("GEOLOCATION_SUCCESS", {
          lat,
          lng,
          accuracy: pos.coords.accuracy,
        });
      }
      onSuccess({ lat, lng }, pos.coords.accuracy);
    },
    (err) => {
      if (import.meta.env.DEV) {
        console.info("GEOLOCATION_ERROR_CODE", err.code);
        console.info("GEOLOCATION_ERROR_MESSAGE", err.message);
      }
      onError(
        geolocationErrorI18nKey(err.code),
        err.code,
        geolocationErrorMessage(err.code, err.message)
      );
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}
