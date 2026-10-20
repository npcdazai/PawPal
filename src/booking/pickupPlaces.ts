export type PlaceKey = 'home' | 'park' | 'office' | 'dogRun' | 'library' | 'gps';

export interface PickupPlace {
  key: PlaceKey;
  emoji: string;
  icon: string;
  label: string;
  line1: string;
  line2: string;
  spot: string;
  /** Position on the illustrated map, in map units. */
  x: number;
  y: number;
}

/** Size of the illustrated neighbourhood map, in map units (1 unit = 1 dp). */
export const MAP_SIZE = { width: 1100, height: 1100 } as const;

export const PICKUP_PLACES: Record<PlaceKey, PickupPlace> = {
  home: {
    key: 'home',
    emoji: '🏠',
    icon: 'home',
    label: 'Home',
    line1: '742 Evergreen Terrace',
    line2: 'Apt 4B • Springfield District',
    spot: 'Front Porch Gate',
    x: 520,
    y: 560,
  },
  park: {
    key: 'park',
    emoji: '🌳',
    icon: 'park',
    label: 'Elm Creek Park',
    line1: 'Elm Creek Park',
    line2: 'North Gate • Elm Creek Trail',
    spot: 'Main Fountain',
    x: 760,
    y: 300,
  },
  office: {
    key: 'office',
    emoji: '🏢',
    icon: 'business',
    label: 'Work Office',
    line1: '1200 Market Street',
    line2: 'Suite 400 • Downtown',
    spot: 'Lobby Entrance',
    x: 300,
    y: 740,
  },
  dogRun: {
    key: 'dogRun',
    emoji: '🐕',
    icon: 'pets',
    label: 'Riverside Dog Run',
    line1: 'Riverside Dog Run',
    line2: 'Riverwalk • Springfield',
    spot: 'Double-gate Entry',
    x: 230,
    y: 930,
  },
  library: {
    key: 'library',
    emoji: '📚',
    icon: 'local-library',
    label: 'Springfield Library',
    line1: '88 Library Lane',
    line2: 'Civic Center • Springfield',
    spot: 'Bike Racks',
    x: 840,
    y: 660,
  },
  gps: {
    key: 'gps',
    emoji: '📍',
    icon: 'my-location',
    label: 'Current Location',
    line1: 'Near 750 Evergreen Terrace',
    line2: 'GPS • accurate to 12 m',
    spot: 'Where you are now',
    x: 580,
    y: 610,
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
