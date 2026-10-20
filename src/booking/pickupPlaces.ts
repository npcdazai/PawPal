import { offsetMeters, type LngLat } from './geo';

export type PlaceKey = 'home' | 'park' | 'office' | 'dogRun' | 'library' | 'gps' | 'pin';

export interface PickupPlace {
  key: PlaceKey;
  emoji: string;
  icon: string;
  label: string;
  line1: string;
  line2: string;
  spot: string;
  /** Where the walker meets Barnaby: real San Francisco coordinates. */
  lngLat: LngLat;
}

/** Sarah & Barnaby's home in the Lower Haight; walks loop through the parks nearby. */
const HOME: LngLat = [-122.42941, 37.77218];

export const PICKUP_PLACES: Record<PlaceKey, PickupPlace> = {
  home: {
    key: 'home',
    emoji: '🏠',
    icon: 'home',
    label: 'Home',
    line1: 'Haight St & Webster St',
    line2: 'Apt 4B • Lower Haight, San Francisco',
    spot: 'Front Porch Gate',
    lngLat: HOME,
  },
  park: {
    key: 'park',
    emoji: '🌳',
    icon: 'park',
    label: 'Elm Creek Park',
    line1: 'Duboce Park dog play area',
    line2: 'Duboce Ave & Steiner St • San Francisco',
    spot: 'Steiner St entrance',
    lngLat: [-122.43195, 37.7696],
  },
  office: {
    key: 'office',
    emoji: '🏢',
    icon: 'business',
    label: 'Office',
    line1: '1200 Market Street',
    line2: 'Suite 400 • Civic Center, San Francisco',
    spot: 'Lobby Entrance',
    lngLat: [-122.4148, 37.7783],
  },
  dogRun: {
    key: 'dogRun',
    emoji: '🐕',
    icon: 'pets',
    label: 'Alamo Square Dog Run',
    line1: 'Alamo Square Park',
    line2: 'Hayes St & Steiner St • San Francisco',
    spot: 'Off-leash area gate',
    lngLat: [-122.4327, 37.7757],
  },
  library: {
    key: 'library',
    emoji: '📚',
    icon: 'local-library',
    label: 'Park Branch Library',
    line1: 'Page St near Cole St',
    line2: 'Haight-Ashbury • San Francisco',
    spot: 'Bike Racks',
    lngLat: [-122.4498, 37.77],
  },
  // GPS and dropped pins are filled in from the device location / the map centre.
  gps: {
    key: 'gps',
    emoji: '📍',
    icon: 'my-location',
    label: 'Current Location',
    line1: 'Near Haight St & Webster St',
    line2: 'GPS • approximate',
    spot: 'Where you are now',
    lngLat: offsetMeters(HOME, 45, -30),
  },
  pin: {
    key: 'pin',
    emoji: '📌',
    icon: 'place',
    label: 'Dropped Pin',
    line1: 'Dropped pin',
    line2: 'Move the map to adjust',
    spot: 'Meet at the pin',
    lngLat: HOME,
  },
};

export const SAVED_PLACES: readonly PlaceKey[] = ['home', 'park', 'office'];
export const SEARCHABLE_PLACES: readonly PlaceKey[] = ['home', 'park', 'office', 'dogRun', 'library'];

export function searchPlaces(query: string): PickupPlace[] {
  const needle = query.trim().toLowerCase();
  return SEARCHABLE_PLACES.map((key) => PICKUP_PLACES[key]).filter(
    (place) =>
      !needle ||
      place.label.toLowerCase().includes(needle) ||
      place.line1.toLowerCase().includes(needle) ||
      place.line2.toLowerCase().includes(needle)
  );
}

/** The matched walker sets off ~800 m (as the crow flies) north-west of the pickup. */
export const walkerStartFor = (pickup: LngLat): LngLat => offsetMeters(pickup, -650, 450);

export const isHome = (lngLat: LngLat) => lngLat[0] === HOME[0] && lngLat[1] === HOME[1];
