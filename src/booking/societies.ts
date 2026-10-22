import type { WalkerId } from '../data/careTeam';
import { distanceKm, offsetMeters, type LngLat } from './geo';
import { BATCHES, batchSlots, type Batch } from './walkPlans';

/**
 * Gated townships PawPal operates in. Each has a dedicated batch of walkers
 * who only walk inside the complex, so slots stack back-to-back with zero
 * travel between them.
 */
export type SocietyKey = 'hiranandani' | 'palava' | 'urbania' | 'oberoi';

/** Another dog already in the assigned walker's stacked schedule. */
export interface StackedWalk {
  startMin: number;
  tower: string;
  breed: string;
}

export interface Society {
  key: SocietyKey;
  label: string;
  shortName: string;
  /** Approximate township centre (real coordinates). */
  center: LngLat;
  towers: readonly string[];
  /** Dedicated walkers working only inside this society. */
  walkers: number;
  primaryWalker: WalkerId;
  backupWalker: WalkerId;
  /** Gate app the walkers' passes are registered on. */
  gateApp: string;
  /** Where the walk loop's first pee stop usually is. */
  landmark: string;
  /** The primary walker's already-booked slots, per batch. */
  stacked: Record<Batch, readonly StackedWalk[]>;
}

export const SOCIETIES: Record<SocietyKey, Society> = {
  hiranandani: {
    key: 'hiranandani',
    label: 'Hiranandani Estate, Thane',
    shortName: 'Hiranandani Estate',
    center: [72.9712, 19.2585],
    towers: ['A', 'B', 'C', 'D', 'E', 'F'],
    walkers: 4,
    primaryWalker: 'rohan',
    backupWalker: 'pratik',
    gateApp: 'MyGate',
    landmark: 'Clubhouse Lawn',
    stacked: {
      morning: [
        { startMin: 360, tower: 'A', breed: 'Golden Retriever' },
        { startMin: 390, tower: 'B', breed: 'Beagle' },
        { startMin: 510, tower: 'D', breed: 'Labrador' },
      ],
      evening: [
        { startMin: 1020, tower: 'C', breed: 'Shih Tzu' },
        { startMin: 1080, tower: 'A', breed: 'Indie' },
        { startMin: 1170, tower: 'E', breed: 'Husky' },
      ],
    },
  },
  palava: {
    key: 'palava',
    label: 'Lodha Palava / Powai',
    shortName: 'Lodha Palava',
    center: [73.0858, 19.1655],
    towers: ['A', 'B', 'C', 'D', 'E'],
    walkers: 5,
    primaryWalker: 'sneha',
    backupWalker: 'amit',
    gateApp: 'MyGate',
    landmark: 'Central Park Lawn',
    stacked: {
      morning: [
        { startMin: 360, tower: 'C', breed: 'Pug' },
        { startMin: 390, tower: 'A', breed: 'German Shepherd' },
        { startMin: 480, tower: 'E', breed: 'Cocker Spaniel' },
      ],
      evening: [
        { startMin: 1050, tower: 'B', breed: 'Labrador' },
        { startMin: 1110, tower: 'D', breed: 'Beagle' },
      ],
    },
  },
  urbania: {
    key: 'urbania',
    label: 'Rustomjee Urbania, Thane',
    shortName: 'Rustomjee Urbania',
    center: [72.9806, 19.2193],
    towers: ['A', 'B', 'C', 'D'],
    walkers: 3,
    primaryWalker: 'imran',
    backupWalker: 'kunal',
    gateApp: 'NoBrokerHood',
    landmark: 'Podium Garden',
    stacked: {
      morning: [
        { startMin: 390, tower: 'D', breed: 'Shih Tzu' },
        { startMin: 420, tower: 'B', breed: 'Indie' },
        { startMin: 510, tower: 'A', breed: 'Golden Retriever' },
      ],
      evening: [
        { startMin: 1020, tower: 'A', breed: 'Dachshund' },
        { startMin: 1140, tower: 'C', breed: 'Labrador' },
      ],
    },
  },
  oberoi: {
    key: 'oberoi',
    label: 'Oberoi Garden City, Goregaon',
    shortName: 'Oberoi Garden City',
    center: [72.8604, 19.1718],
    towers: ['A', 'B', 'C', 'D', 'E', 'F'],
    walkers: 6,
    primaryWalker: 'priya',
    backupWalker: 'farhan',
    gateApp: 'MyGate',
    landmark: 'Jogging Track Lawn',
    stacked: {
      morning: [
        { startMin: 360, tower: 'B', breed: 'Beagle' },
        { startMin: 390, tower: 'F', breed: 'Labrador' },
        { startMin: 450, tower: 'C', breed: 'Pomeranian' },
      ],
      evening: [
        { startMin: 1050, tower: 'E', breed: 'Golden Retriever' },
        { startMin: 1080, tower: 'A', breed: 'Pug' },
      ],
    },
  },
};

export const SOCIETY_KEYS = Object.keys(SOCIETIES) as SocietyKey[];
export const DEFAULT_SOCIETY: SocietyKey = 'hiranandani';

/** "✓ 4 Dedicated Society Walkers Assigned (Morning Batch: 6:00 AM – 9:30 AM)" */
export const supplyLine = (society: Society, batch: Batch = 'morning') =>
  `✓ ${society.walkers} Dedicated Society Walkers Assigned (${BATCHES[batch].label}: ${BATCHES[batch].range})`;

/** "Tower B" → "B", "wing c" → "C", "12" → "12"; null if nothing usable. */
export function towerCode(input: string): string | null {
  const cleaned = input.trim().replace(/^(tower|wing|bldg|building|block)\s*/i, '').toUpperCase();
  const match = cleaned.match(/^[A-Z0-9]{1,3}/);
  return match ? match[0] : null;
}

/** "Tower B" (or "Wing B" if that's how the resident wrote it). */
export function towerName(input: string): string {
  const code = towerCode(input);
  if (!code) return 'Main Gate';
  return /^\s*wing/i.test(input) ? `Wing ${code}` : `Tower ${code}`;
}

/** Each tower's lift lobby, laid out around the township centre (metres east, north). */
const TOWER_OFFSETS: readonly (readonly [number, number])[] = [
  [-170, 110],
  [60, -70],
  [190, 120],
  [-60, -190],
  [230, -150],
  [-240, -40],
];

export function towerLobby(society: Society, tower: string): LngLat {
  const code = towerCode(tower);
  const index = code ? society.towers.indexOf(code) : -1;
  const [east, north] = index >= 0 ? TOWER_OFFSETS[index % TOWER_OFFSETS.length] : [0, 0];
  return offsetMeters(society.center, east, north);
}

export type SlotState =
  | { kind: 'booked'; walk: StackedWalk }
  | { kind: 'open'; /** The walker is already in the complex from the previous slot. */ after: StackedWalk | null };

/** The assigned walker's 30-minute schedule for a batch: who's booked, what's open. */
export function stackedSchedule(society: Society, batch: Batch): { startMin: number; state: SlotState }[] {
  const booked = society.stacked[batch];
  return batchSlots(batch).map((startMin) => {
    const walk = booked.find((entry) => entry.startMin === startMin);
    if (walk) return { startMin, state: { kind: 'booked', walk } };
    const previous = booked.find((entry) => entry.startMin === startMin - 30) ?? null;
    return { startMin, state: { kind: 'open', after: previous } };
  });
}

/** The first open slot right after a booked one (zero travel), else the first open slot. */
export function suggestedSlot(society: Society, batch: Batch): number | null {
  const schedule = stackedSchedule(society, batch);
  const stacked = schedule.find((slot) => slot.state.kind === 'open' && slot.state.after);
  return (stacked ?? schedule.find((slot) => slot.state.kind === 'open'))?.startMin ?? null;
}

/** Where the walker is coming from for a slot: the tower of the walk just before it. */
export function walkerOrigin(society: Society, batch: Batch | null, slotStart: number): { tower: string | null; at: LngLat } {
  const previous = batch ? society.stacked[batch].find((entry) => entry.startMin === slotStart - 30) : undefined;
  if (previous) return { tower: previous.tower, at: towerLobby(society, previous.tower) };
  return { tower: null, at: offsetMeters(society.center, -260, 220) };
}

/** The nearest partner township to a GPS fix, with how far away it is. */
export function nearestSociety(here: LngLat): { society: Society; km: number } {
  return SOCIETY_KEYS.map((key) => ({ society: SOCIETIES[key], km: distanceKm(here, SOCIETIES[key].center) })).reduce(
    (best, next) => (next.km < best.km ? next : best)
  );
}
