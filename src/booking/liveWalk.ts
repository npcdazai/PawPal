import type { WalkBooking } from './BookingsProvider';
import { SOCIETIES } from './societies';
import { clockLabel } from './walkPlans';

/**
 * Prototype time compression for the walker simulation: 1 real second = 12
 * walk seconds, so a 30-minute society walk plays out in 2.5 minutes. A live
 * deployment would read positions from GPS and use 1 here.
 */
export const DEMO_TIME_SCALE = 12;

/** Doorstep handover code: starts the GPS timer and the walk's insurance. */
export const PICKUP_OTP = '7391';

/** A ~12 kg corgi burns ~80 kcal per km at a brisk walk. */
const KCAL_PER_KM = 80;

const simSecondsSince = (start: number, now: number) => ((now - start) / 1000) * DEMO_TIME_SCALE;

/** Real milliseconds until `simSeconds` of walk time have passed. */
export const realMsFor = (simSeconds: number) => (simSeconds * 1000) / DEMO_TIME_SCALE;

/** When a started walk arrives back at its start (epoch ms), or null before it starts. */
export const walkReturnsAt = (booking: Pick<WalkBooking, 'startedAt' | 'minutes'>) =>
  booking.startedAt === null ? null : booking.startedAt + realMsFor(booking.minutes * 60);

/** The walker's approach: progress along their `routeKm`-long route to the tower lobby. */
export function enRouteStatus(
  booking: Pick<WalkBooking, 'matchedAt' | 'etaMinutes'>,
  now: number,
  routeKm: number
) {
  const totalSec = booking.etaMinutes * 60;
  const remainingSec = Math.max(0, totalSec - simSecondsSince(booking.matchedAt, now));
  const progress = totalSec > 0 ? 1 - remainingSec / totalSec : 1;
  return {
    totalSec,
    remainingSec,
    remainingMin: Math.ceil(remainingSec / 60),
    km: routeKm * (1 - progress),
    progress,
    arrived: remainingSec <= 0,
  };
}

// ─── Proof-of-care events dropped on the trail ───────────────────────────────

export type WalkEventKind = 'pee' | 'poop' | 'photo';

/** An event the walker logged from their partner app (fraction of the walk). */
export interface LoggedEvent {
  kind: WalkEventKind;
  at: number;
}

export interface WalkEvent extends LoggedEvent {
  id: string;
  /** Logged live by the walker (vs. the walk's routine stops). */
  logged: boolean;
}

export const EVENT_META: Record<WalkEventKind, { emoji: string; title: string }> = {
  pee: { emoji: '💧', title: 'Pee Logged' },
  poop: { emoji: '💩', title: 'Poop Logged' },
  photo: { emoji: '📸', title: 'Mandatory Halfway Live Photo' },
};

/** Barnaby's routine on a 30-minute society walk: pee at 8 min, poop at 14, photo at 16. */
const ROUTINE: readonly LoggedEvent[] = [
  { kind: 'pee', at: 8 / 30 },
  { kind: 'poop', at: 14 / 30 },
  { kind: 'photo', at: 16 / 30 },
];

/** The order "Simulate Walker Action" cycles through. */
export const SIMULATED_ACTIONS: readonly WalkEventKind[] = ['pee', 'poop', 'photo'];

/** "7:08 AM": the walk clock, counted from the booked slot's start. */
export const walkClock = (booking: Pick<WalkBooking, 'slotStart' | 'minutes'>, at: number) =>
  clockLabel(booking.slotStart + at * booking.minutes);

/** "Near Clubhouse Lawn" / "Scoop Verified ✓" / "Captured via In-App Live Camera". */
export function eventDetail(booking: Pick<WalkBooking, 'society'>, kind: WalkEventKind): string {
  switch (kind) {
    case 'pee':
      return `Near ${SOCIETIES[booking.society].landmark}`;
    case 'poop':
      return 'Scoop Verified ✓';
    case 'photo':
      return 'In-App Live Camera';
  }
}

const WALKER_UPDATES: readonly { at: number; text: string }[] = [
  { at: 0, text: 'OTP verified at the lobby — harness double-checked, heading to the garden loop 🐾' },
  { at: 8 / 30, text: 'Pee break near the lawn 💧 Water bowl topped up too.' },
  { at: 14 / 30, text: 'Poop scooped & binned ✔️ Such a good boy on the jogging track.' },
  { at: 16 / 30, text: 'Doing his morning stretch on the lawn — halfway photo sent 📸' },
  { at: 0.85, text: 'Turning back towards your tower for a calm handover.' },
  { at: 1, text: "Back at your door! Barnaby is tired, happy and ready for a nap 🏠" },
];

/** The walk's progress along its `routeKm`-long loop, and the proof-of-care log so far. */
export function liveWalkStatus(
  booking: Pick<WalkBooking, 'minutes' | 'startedAt' | 'loggedEvents' | 'tower'>,
  now: number,
  routeKm: number
) {
  const totalSec = booking.minutes * 60;
  const elapsedSec = booking.startedAt ? Math.min(totalSec, simSecondsSince(booking.startedAt, now)) : 0;
  const progress = elapsedSec / totalSec;

  const events: WalkEvent[] = [
    ...ROUTINE.filter((event) => progress >= event.at).map((event, index) => ({
      ...event,
      id: `routine-${index}`,
      logged: false,
    })),
    ...booking.loggedEvents.map((event, index) => ({ ...event, id: `logged-${index}`, logged: true })),
  ].sort((a, b) => a.at - b.at);
  const count = (kind: WalkEventKind) => events.filter((event) => event.kind === kind).length;
  const km = routeKm * progress;
  const elapsedMin = elapsedSec / 60;
  const update = [...WALKER_UPDATES].reverse().find((item) => progress >= item.at) ?? WALKER_UPDATES[0];

  return {
    totalSec,
    elapsedSec,
    remainingSec: totalSec - elapsedSec,
    progress,
    done: progress >= 1,
    km,
    kcal: Math.round(km * KCAL_PER_KM),
    /** Minutes per km so far ("18 min/km"); null until there's distance to measure. */
    pace: km > 0.05 ? elapsedMin / km : null,
    events,
    pee: count('pee'),
    poop: count('poop'),
    photos: events.filter((event) => event.kind === 'photo'),
    update,
    phase: progress >= 0.85 ? 'Return & Handover' : progress >= 0.12 ? 'Garden Loop' : `${booking.tower} Gate`,
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
