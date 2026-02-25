export type Suggestion = {
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
};

export async function suggest(query: string): Promise<Suggestion[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  const data = await res.json();
  return (data || []).map((x: any) => ({
    title: x.display_name?.split(",")[0] ?? x.display_name ?? "Unknown",
    subtitle: x.display_name ?? "",
    lat: Number(x.lat),
    lng: Number(x.lon),
  }));
}
