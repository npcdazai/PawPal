import { useMemo } from 'react';
import type { GeoLine, LngLat } from './geo';
import { HOME_PARK_LOOP, HOME_PICKUP_ROUTE } from './geoFallbacks';
import { isHome, parkLoopWaypoints, walkerStartFor } from './pickupPlaces';
import { useWalkingRoute } from './routing';

/** The walker's street route from where they were matched to the pickup. */
export function usePickupRoute(pickup: LngLat): GeoLine {
  const [lng, lat] = pickup;
  const waypoints = useMemo((): LngLat[] => [walkerStartFor([lng, lat]), [lng, lat]], [lng, lat]);
  return useWalkingRoute(waypoints, isHome(waypoints[1]) ? HOME_PICKUP_ROUTE : waypoints);
}

/** The walk: pickup → Elm Creek (Duboce) Park → Alamo Square → pickup. */
export function useParkLoop(pickup: LngLat): GeoLine {
  const [lng, lat] = pickup;
  const waypoints = useMemo(() => parkLoopWaypoints([lng, lat]), [lng, lat]);
  return useWalkingRoute(waypoints, isHome(waypoints[0]) ? HOME_PARK_LOOP : waypoints);
}
