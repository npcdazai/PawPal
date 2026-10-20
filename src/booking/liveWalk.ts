import type { WalkBooking } from './BookingsProvider';

/**
 * Prototype time compression for the walker simulation: 1 real second = 12
 * walk seconds, so a 45-minute walk plays out in under 4 minutes. A live
 * deployment would read positions from GPS and use 1 here.
 */
export const DEMO_TIME_SCALE = 12;

export const PICKUP_OTP = '4829';

/** A ~12 kg corgi burns ~80 kcal per km at a brisk walk (~240 kcal on a 3 km loop). */
const KCAL_PER_KM = 80;

const simSecondsSince = (start: number, now: number) => ((now - start) / 1000) * DEMO_TIME_SCALE;

/** Real milliseconds until `simSeconds` of walk time have passed. */
export const realMsFor = (simSeconds: number) => (simSeconds * 1000) / DEMO_TIME_SCALE;

/** When a started walk arrives back at its start (epoch ms), or null before it starts. */
export const walkReturnsAt = (booking: Pick<WalkBooking, 'startedAt' | 'minutes'>) =>
  booking.startedAt === null ? null : booking.startedAt + realMsFor(booking.minutes * 60);

/** The walker's approach: progress along their `routeKm`-long route to the pickup. */
export function enRouteStatus(
  booking: Pick<WalkBooking, 'matchedAt' | 'etaMinutes'>,
  now: number,
  routeKm: number
) {
  const totalSec = booking.etaMinutes * 60;
  const remainingSec = Math.max(0, totalSec - simSecondsSince(booking.matchedAt, now));
  const progress = 1 - remainingSec / totalSec;
  return {
    totalSec,
    remainingSec,
    remainingMin: Math.ceil(remainingSec / 60),
    km: routeKm * (1 - progress),
    progress,
    arrived: remainingSec <= 0,
  };
}

export type WalkEventKind = 'pee' | 'water' | 'poo' | 'photo';

export interface WalkEvent {
  kind: WalkEventKind;
  /** Fraction of the walk at which it happens. */
  at: number;
  pin?: string;
  title: string;
}

/** Scripted walk milestones (fractions of a 45-minute walk). */
export const WALK_EVENTS: readonly WalkEvent[] = [
  { kind: 'pee', at: 8 / 45, title: 'Pee break' },
  { kind: 'water', at: 12 / 45, pin: '💧', title: 'Water Break' },
  { kind: 'poo', at: 19 / 45, pin: '💩', title: 'Potty Logged' },
  { kind: 'photo', at: 24 / 45, pin: '📸', title: 'Photo Snapped' },
];

const WALKER_UPDATES: readonly { at: number; text: string; photo?: boolean }[] = [
  { at: 0, text: 'Picked up Barnaby! Leash on, tail going a mile a minute 🐾' },
  { at: 12 / 45, text: 'Water break at the park fountain 💧 He drank half the bowl!' },
  { at: 19 / 45, text: 'Potty logged ✔️ Such a good boy on the loop.' },
  {
    at: 24 / 45,
    text: 'Barnaby just met a Golden Retriever and drank some water! Looping back toward your street now.',
    photo: true,
  },
  { at: 1, text: "We're back home! Barnaby is tired, happy and ready for a nap 🏠" },
];

/** The walk's progress along its `routeKm`-long loop; distance and energy follow the route. */
export function liveWalkStatus(
  booking: Pick<WalkBooking, 'minutes' | 'startedAt' | 'extraWater'>,
  now: number,
  routeKm: number
) {
  const totalSec = booking.minutes * 60;
  const elapsedSec = booking.startedAt ? Math.min(totalSec, simSecondsSince(booking.startedAt, now)) : 0;
  const progress = elapsedSec / totalSec;
  const reached = WALK_EVENTS.filter((event) => progress >= event.at);
  const count = (kind: WalkEventKind) => reached.filter((event) => event.kind === kind).length;
  const update = [...WALKER_UPDATES].reverse().find((item) => progress >= item.at) ?? WALKER_UPDATES[0];
  const updateAgoMin = Math.max(0, Math.round(((progress - update.at) * totalSec) / 60));

  return {
    totalSec,
    elapsedSec,
    remainingSec: totalSec - elapsedSec,
    progress,
    done: progress >= 1,
    km: routeKm * progress,
    kcal: Math.round(routeKm * progress * KCAL_PER_KM),
    pee: count('pee'),
    poo: count('poo'),
    // Barnaby also drinks at the photo stop (Golden Retriever meet-up).
    water: count('water') + count('photo') + booking.extraWater,
    reached,
    update,
    updateAgo: updateAgoMin === 0 ? 'just now' : `${updateAgoMin} min${updateAgoMin === 1 ? '' : 's'} ago`,
    // The walk loops out from the pickup and back, wherever that is.
    phase:
      progress >= 1
        ? 'Back home'
        : progress < 0.15
          ? 'Heading out'
          : progress < 0.85
            ? 'Exploring the neighbourhood'
            : 'Heading home',
  };
}

/** "18:42" style countdown. */
export function formatCountdown(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

export const formatClockTime = (epochMs: number) =>
  new Date(epochMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Minute label for a milestone in a walk of `minutes` length. */
export const eventMinute = (event: WalkEvent, minutes: number) => `${Math.round(event.at * minutes)}m`;
