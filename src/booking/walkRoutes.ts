import { useEffect, useMemo, useState } from 'react';
import { makeLine, offsetMeters, type GeoLine, type LngLat } from './geo';
import { HOME_PICKUP_ROUTE } from './geoFallbacks';
import { isHome, walkerStartFor } from './pickupPlaces';
import { fetchWalkingRoute, useWalkingRoute } from './routing';

/** The walker's street route from where they were matched to the pickup. */
export function usePickupRoute(pickup: LngLat): GeoLine {
  const [lng, lat] = pickup;
  const waypoints = useMemo((): LngLat[] => [walkerStartFor([lng, lat]), [lng, lat]], [lng, lat]);
  return useWalkingRoute(waypoints, isHome(waypoints[1]) ? HOME_PICKUP_ROUTE : waypoints);
}

// ─── The walk itself ─────────────────────────────────────────────────────────

/**
 * A neighbourhood loop around wherever Barnaby was picked up — no fixed
 * route, so it works in any city. Offsets in metres (east, north); the
 * routing engine snaps them onto real streets and paths.
 */
const LOOP_SHAPE: readonly (readonly [east: number, north: number])[] = [
  [0, 0],
  [-280, -200],
  [-560, 120],
  [-360, 480],
  [40, 520],
  [240, 200],
  [0, 0],
];
/** Tried in turn until the routed loop is a walkable length (street grids vary a lot). */
const LOOP_SCALES = [1, 0.65, 0.45] as const;
const MAX_LOOP_KM = 4.2;

export const walkLoopWaypoints = (pickup: LngLat, scale: number = LOOP_SCALES[0]): LngLat[] =>
  LOOP_SHAPE.map(([east, north]) => offsetMeters(pickup, east * scale, north * scale));

const loopKey = ([lng, lat]: LngLat) => `${lng.toFixed(5)},${lat.toFixed(5)}`;
const loops = new Map<string, readonly LngLat[]>();
const pendingLoops = new Map<string, Promise<readonly LngLat[] | null>>();

/** Routes the loop at shrinking sizes until it's at most MAX_LOOP_KM (else the shortest). */
function fetchWalkLoop(pickup: LngLat): Promise<readonly LngLat[] | null> {
  const key = loopKey(pickup);
  const cached = loops.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = pendingLoops.get(key);
  if (pending) return pending;

  const request = (async () => {
    let shortest: readonly LngLat[] | null = null;
    for (const scale of LOOP_SCALES) {
      const coords = await fetchWalkingRoute(walkLoopWaypoints(pickup, scale));
      if (!coords) continue;
      if (makeLine(coords).lengthKm <= MAX_LOOP_KM) {
        shortest = coords;
        break;
      }
      if (!shortest || makeLine(coords).lengthKm < makeLine(shortest).lengthKm) shortest = coords;
    }
    if (shortest) loops.set(key, shortest);
    pendingLoops.delete(key);
    return shortest;
  })();
  pendingLoops.set(key, request);
  return request;
}

/** Start routing the walk early (e.g. while the walker is still on the way). */
export const prefetchWalkLoop = (pickup: LngLat) => {
  void fetchWalkLoop(pickup);
};

/**
 * The walk's street route around the pickup. Until the router answers it's
 * a local loop through the waypoints — never a line across the map.
 */
export function useWalkLoop(pickup: LngLat): GeoLine {
  const [lng, lat] = pickup;
  const key = loopKey(pickup);
  const [routed, setRouted] = useState<{ key: string; coords: readonly LngLat[] } | null>(() => {
    const cached = loops.get(key);
    return cached ? { key, coords: cached } : null;
  });

  useEffect(() => {
    let live = true;
    fetchWalkLoop([lng, lat]).then((coords) => {
      if (live && coords) setRouted({ key, coords });
    });
    return () => {
      live = false;
    };
  }, [key, lng, lat]);

  const fallback = useMemo(() => walkLoopWaypoints([lng, lat], LOOP_SCALES[1]), [lng, lat]);
  const coords = routed?.key === key ? routed.coords : fallback;
  return useMemo(() => makeLine(coords), [coords]);
}
