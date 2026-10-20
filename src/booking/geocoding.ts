import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { LngLat } from './geo';

export interface AddressLines {
  line1: string;
  line2: string;
}

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' ');

/**
 * Street address for a map position. Uses the platform geocoder when the app
 * already has location permission (never prompts just for moving a pin),
 * otherwise OpenStreetMap's Nominatim. Callers only ask once a drag settles,
 * which keeps well inside Nominatim's one-request-per-second policy.
 */
export async function reverseGeocode([lng, lat]: LngLat): Promise<AddressLines | null> {
  try {
    if (Platform.OS !== 'web') {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.granted) {
        const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (place) {
          return {
            line1: join(place.streetNumber, place.street) || place.name || 'Dropped pin',
            line2: [place.district ?? place.subregion, place.city].filter(Boolean).join(' • '),
          };
        }
      }
    }

    const response = await fetch(
      `${NOMINATIM_REVERSE}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      Platform.OS === 'web' ? undefined : { headers: { 'User-Agent': 'PawPal/1.0 (pet-care demo app)' } }
    );
    if (!response.ok) return null;
    const json = (await response.json()) as {
      name?: string;
      address?: Record<string, string | undefined>;
    };
    const address = json.address ?? {};
    // Buildings can carry several numbers ("477;479;481"): show the first.
    const houseNumber = address.house_number?.split(/[;,]/)[0]?.trim();
    return {
      line1: join(houseNumber, address.road ?? address.pedestrian ?? address.footway) || json.name || 'Dropped pin',
      line2: [address.neighbourhood ?? address.suburb, address.city ?? address.town].filter(Boolean).join(' • '),
    };
  } catch {
    return null;
  }
}

/** The device's position, asking for permission first. Null if denied or unavailable. */
export async function currentPosition(): Promise<LngLat | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return [position.coords.longitude, position.coords.latitude];
  } catch {
    return null;
  }
}
