import { apiRequest } from './client';
import type { LatLng, Place, WalkingRoute } from './types';

/**
 * Addresses, search and walking routes through the API, which caches the
 * OpenStreetMap services and keeps to their rate limits for every install at
 * once. Look addresses up on a user action, never on every map move.
 */

/** Coordinates at 5 decimals (about a metre), the precision the server caches by. */
const fixed = (value: number) => value.toFixed(5);

/** "19.11760,72.90600": the `from` / `to` format of /maps/route. */
export const latLngParam = ({ lat, lng }: LatLng) => `${fixed(lat)},${fixed(lng)}`;

/** The address at a point. 404 `not_found` when there is none; 503 `maps_busy` when the lookup queue is full. */
export async function reverseGeocode(at: LatLng): Promise<Place> {
  const { place } = await apiRequest<{ place: Place }>('/maps/reverse-geocode', {
    query: { lat: fixed(at.lat), lng: fixed(at.lng) },
  });
  return place;
}

/** Points for a typed address (3–300 characters). */
export async function geocode(address: string): Promise<Place[]> {
  const { places } = await apiRequest<{ places: Place[] }>('/maps/geocode', { query: { address } });
  return places;
}

/** Search as you type (2–200 characters), nearest `near` first. */
export async function autocomplete(input: string, near?: LatLng): Promise<Place[]> {
  const { places } = await apiRequest<{ places: Place[] }>('/maps/autocomplete', {
    query: { input, lat: near ? fixed(near.lat) : undefined, lng: near ? fixed(near.lng) : undefined },
  });
  return places;
}

/** A walking route between two points. 404 `not_found` when there is no route. */
export async function walkingRoute(from: LatLng, to: LatLng): Promise<WalkingRoute> {
  const { route } = await apiRequest<{ route: WalkingRoute }>('/maps/route', {
    query: { from: latLngParam(from), to: latLngParam(to) },
  });
  return route;
}
