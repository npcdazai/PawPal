import { useEffect, useMemo, useState } from 'react';
import { makeLine, type GeoLine, type LngLat } from './geo';

/**
 * OSRM servers, tried in order. The OSM community server runs the real foot
 * profile (sidewalks, park paths). The public project-osrm.org demo only has
 * the car network loaded — it ignores the `foot` profile — so it's the backup.
 */
const OSRM_ROUTE_URLS = [
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
  'https://router.project-osrm.org/route/v1/foot',
] as const;
const ROUTE_TIMEOUT_MS = 6000;

const cache = new Map<string, readonly LngLat[]>();

/** "lng,lat;lng,lat;…" — the OSRM coordinate path, also the cache key. */
const pathFor = (waypoints: readonly LngLat[]) =>
  waypoints.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');

async function fetchRoute(path: string): Promise<readonly LngLat[] | null> {
  const hit = cache.get(path);
  if (hit) return hit;
  for (const base of OSRM_ROUTE_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}/${path}?overview=full&geometries=geojson`, {
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const json = (await response.json()) as {
        code?: string;
        routes?: { geometry?: { coordinates?: [number, number][] } }[];
      };
      const coordinates = json.routes?.[0]?.geometry?.coordinates;
      if (json.code === 'Ok' && coordinates && coordinates.length >= 2) {
        const route = coordinates.map(([lng, lat]): LngLat => [lng, lat]);
        cache.set(path, route);
        return route;
      }
    } catch {
      // Offline, timed out or rate limited: try the next server.
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

/** Fetch a walking route through `waypoints` (null if no server answered). */
export const fetchWalkingRoute = (waypoints: readonly LngLat[]) => fetchRoute(pathFor(waypoints));

/**
 * A walking route through `waypoints`: the `fallback` geometry straight away,
 * swapped for the routed street path as soon as OSRM answers.
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
