import { apiRequest } from './client';
import { parseNearby, parsePricing, parseWeather } from './parse';
import type { LatLng, NearbyWalkers, Pricing, Temperament, Weather } from './types';

/**
 * The home screen's live figures (DASHBOARD_API.md §1–3). The server prices
 * walks, counts walkers and reads the weather; the app only shows them.
 */

/** Coordinates at 4 decimals (~10 m): plenty for a count or the weather, and kinder to the caches. */
const coord = (value: number) => value.toFixed(4);

/** Prices at `at` (default now), peak surcharge included. Public: no session needed. */
export async function getPricing(at?: number): Promise<Pricing> {
  return parsePricing(await apiRequest<unknown>('/pricing', { query: { at } }));
}

/** How many walkers could take a walk at a pickup point, and how soon the nearest could arrive. */
export async function getNearbyWalkers(at: LatLng, temperament?: Temperament): Promise<NearbyWalkers> {
  return parseNearby(
    await apiRequest<unknown>('/walkers/nearby', {
      query: { lat: coord(at.lat), lng: coord(at.lng), temperament },
    })
  );
}

/** The weather at a point. 503 `weather_unavailable` when the server has none: hide the pill. */
export async function getWeather(at: LatLng): Promise<Weather> {
  return parseWeather(await apiRequest<unknown>('/weather', { query: { lat: coord(at.lat), lng: coord(at.lng) } }));
}
