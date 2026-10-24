import { useEffect, useMemo, useState } from 'react';
import { walkingRoute } from '../api/maps';
import type { LatLng } from '../api/types';
import { makeLine, type GeoLine, type LngLat } from './geo';

/**
 * Walking routes come from the PawPal API (GET /maps/route), which proxies
 * OSRM's foot profile, caches each answer for a day and keeps to the public
 * server's usage policy. It routes between two points only.
 */
const cache = new Map<string, readonly LngLat[]>();

/** "lng,lat;lng,lat;…" at 5 decimals (the precision the server caches by): the cache key. */
const pathFor = (waypoints: readonly LngLat[]) =>
  waypoints.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');

/** The start and end of a two-point path, or null for any other path. */
export function routeEnds(path: string): { from: LatLng; to: LatLng } | null {
  const points = path.split(';').map((pair) => pair.split(',').map(Number));
  if (points.length !== 2 || points.some((point) => point.length !== 2 || !point.every(Number.isFinite))) {
    return null;
  }
  const [[fromLng, fromLat], [toLng, toLat]] = points;
  return { from: { lat: fromLat, lng: fromLng }, to: { lat: toLat, lng: toLng } };
}

async function fetchRoute(path: string): Promise<readonly LngLat[] | null> {
  const hit = cache.get(path);
  if (hit) return hit;
  // The API takes a start and an end; multi-stop paths keep their local shape.
  const ends = routeEnds(path);
  if (!ends) return null;
  try {
    const { coordinates } = await walkingRoute(ends.from, ends.to);
    if (coordinates.length < 2) return null;
    const route = coordinates.map(([lng, lat]): LngLat => [lng, lat]);
    cache.set(path, route);
    return route;
  } catch {
    // No route (404), maps busy, or offline: the caller keeps its fallback line.
    return null;
  }
}

/** Fetch a walking route through `waypoints` (null if there's none to be had). */
export const fetchWalkingRoute = (waypoints: readonly LngLat[]) => fetchRoute(pathFor(waypoints));

/**
 * A walking route through `waypoints`: the `fallback` geometry straight away,
 * swapped for the routed street path as soon as the API answers.
 */
export function useWalkingRoute(waypoints: readonly LngLat[], fallback: readonly LngLat[]): GeoLine {
  const path = pathFor(waypoints);
  const [routed, setRouted] = useState<{ path: string; coords: readonly LngLat[] } | null>(() => {
    const hit = cache.get(path);
    return hit ? { path, coords: hit } : null;
  });

  useEffect(() => {
    let live = true;
    fetchRoute(path).then((coords) => {
      if (live && coords) setRouted({ path, coords });
    });
    return () => {
      live = false;
    };
  }, [path]);

  const coords = routed?.path === path ? routed.coords : fallback;
  return useMemo(() => makeLine(coords), [coords]);
}
