import { useEffect, useMemo, useState } from 'react';
import { makeLine, offsetMeters, type GeoLine, type LngLat } from './geo';
import { fetchWalkingRoute, useWalkingRoute } from './routing';

/** The walker's path inside the township, from the previous slot's tower to Barnaby's lobby. */
export function usePickupRoute(from: LngLat, to: LngLat): GeoLine {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const waypoints = useMemo(
    (): LngLat[] => [
      [fromLng, fromLat],
      [toLng, toLat],
    ],
    [fromLng, fromLat, toLng, toLat]
  );
  return useWalkingRoute(waypoints, waypoints);
}

// ─── The walk itself ─────────────────────────────────────────────────────────

/**
 * The township loop from Barnaby's tower lobby: out past the clubhouse lawn,
 * round the internal jogging track and back. Offsets in metres (east, north).
 * The API routes two points only, so the loop keeps this local shape.
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
/**
 * Tried in turn until the routed loop fits a 30-minute society walk
 * (~1.4 km at a dog's sniffing pace); internal paths vary a lot by complex.
 */
const LOOP_SCALES = [0.42, 0.32, 0.24] as const;
const MAX_LOOP_KM = 1.9;

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
