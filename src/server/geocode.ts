/**
 * Address → map pin, via OpenStreetMap's Nominatim (free; one request per
 * venue, well inside its usage policy). Best effort: if it's slow, down or
 * finds nothing, the venue is saved without a pin and the map is hidden.
 * Set GEOCODING=off to skip it entirely.
 */
import "server-only";

export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  if (process.env.GEOCODING === "off") return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": `EVENT HUB (${process.env.EMAIL_FROM ?? "venue geocoding"})`, "Accept-Language": "en" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
