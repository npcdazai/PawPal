/**
 * Geographic primitives for the real maps: [lng, lat] points (GeoJSON order),
 * distances, and walking along a route polyline.
 */

export type LngLat = [lng: number, lat: number];

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km. */
export function distanceKm([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A point `east` / `north` metres away (small offsets only). */
export function offsetMeters([lng, lat]: LngLat, east: number, north: number): LngLat {
  const dLat = north / 111_320;
  const dLng = east / (111_320 * Math.cos(toRad(lat)));
  return [lng + dLng, lat + dLat];
}

/** A walking route with each vertex's distance from the start. */
export interface GeoLine {
  coords: readonly LngLat[];
  /** Cumulative km at each vertex. */
  cumKm: readonly number[];
  lengthKm: number;
}

export function makeLine(coords: readonly LngLat[]): GeoLine {
  const cumKm = [0];
  for (let i = 1; i < coords.length; i += 1) {
    cumKm.push(cumKm[i - 1] + distanceKm(coords[i - 1], coords[i]));
  }
  return { coords, cumKm, lengthKm: cumKm[cumKm.length - 1] ?? 0 };
}

/** Index of the segment containing `km`, and how far along it (0–1). */
function locate(line: GeoLine, km: number) {
  const { cumKm } = line;
  let index = 1;
  while (index < cumKm.length - 1 && cumKm[index] < km) index += 1;
  const span = cumKm[index] - cumKm[index - 1] || 1;
  return { index, local: Math.max(0, Math.min(1, (km - cumKm[index - 1]) / span)) };
}

/** Position at fraction `t` (0–1) of the route's length. */
export function pointAlong(line: GeoLine, t: number): LngLat {
  const { coords } = line;
  if (coords.length < 2) return coords[0] ?? [0, 0];
  const km = Math.max(0, Math.min(1, t)) * line.lengthKm;
  const { index, local } = locate(line, km);
  const [a, b] = [coords[index - 1], coords[index]];
  return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
}

/** The walked part and the remaining part of the route at fraction `t`. */
export function splitLine(line: GeoLine, t: number): { done: LngLat[]; rest: LngLat[] } {
  const { coords } = line;
  if (coords.length < 2) return { done: [...coords], rest: [...coords] };
  const here = pointAlong(line, t);
  const { index } = locate(line, Math.max(0, Math.min(1, t)) * line.lengthKm);
  return {
    done: [...coords.slice(0, index), here],
    rest: [here, ...coords.slice(index)],
  };
}

/** Which way (east = 1, west = -1) the route heads at fraction `t`, for Barnaby's facing. */
export function headingAlong(line: GeoLine, t: number): 1 | -1 {
  const here = pointAlong(line, t);
  const ahead = pointAlong(line, Math.min(1, t + 0.004));
  return ahead[0] >= here[0] ? 1 : -1;
}

/** Compass bearing (0 = north, clockwise) of travel at fraction `t`. */
export function bearingAlong(line: GeoLine, t: number): number {
  const [lng1, lat1] = pointAlong(line, t);
  const [lng2, lat2] = pointAlong(line, Math.min(1, t + 0.004));
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** [west, south, east, north] around the given points. */
export function boundsOf(points: readonly LngLat[]): [number, number, number, number] {
  const lngs = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export const lineFeature = (coords: readonly LngLat[]): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: coords.map(([lng, lat]) => [lng, lat]) },
});
