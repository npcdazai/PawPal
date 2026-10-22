import * as Location from 'expo-location';
import type { LngLat } from './geo';

/**
 * The device's position, asking for permission first. A fix from the last
 * few minutes is reused so booking doesn't wait on the GPS. Null if denied
 * or unavailable.
 */
export async function currentPosition(): Promise<LngLat | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 200 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return [position.coords.longitude, position.coords.latitude];
  } catch {
    return null;
  }
}

/**
 * Wakes the GPS ahead of the pickup map when location is already allowed,
 * so the user's position is ready the moment it opens. Never prompts.
 */
export async function warmUpLocation() {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (permission.granted) await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    // Best effort only.
  }
}
