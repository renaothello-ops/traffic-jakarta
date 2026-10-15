/**
 * External navigation helpers.
 * MapLibre remains the in-app map renderer; these open native map apps.
 */

export function openGoogleMapsNavigation(lat: number, lng: number): void {
  const coords = `${lat},${lng}`;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${coords}`;
  openExternal(url);
}

export function openWazeNavigation(lat: number, lng: number): void {
  const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  openExternal(url);
}

function openExternal(url: string): void {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
