import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { WalkerId } from '../data/careTeam';
import type { LngLat } from './geo';
import type { PlaceKey } from './pickupPlaces';
import { DEFAULT_MINUTES, type WalkMinutes, type WalkTiming } from './walkPlans';

/** Choices from "Book a Walk", carried into pickup selection and matching. */
export interface WalkDraft {
  timing: WalkTiming;
  /** Chosen slot label when scheduled, e.g. "Today, 5:30 PM". */
  slotLabel: string | null;
  minutes: WalkMinutes;
  walkerNotes: string;
  /** Favourite walker to request first (Profile "Rebook"). */
  preferredWalkerId: WalkerId | null;
}

export type WalkStatus = 'scheduled' | 'enRoute' | 'inProgress' | 'completed' | 'cancelled';

export interface WalkBooking {
  id: string;
  status: WalkStatus;
  timing: WalkTiming;
  /** "Arriving in 12 mins" or the scheduled slot. */
  whenLabel: string;
  minutes: WalkMinutes;
  total: number;
  placeKey: PlaceKey;
  placeLabel: string;
  address: string;
  /** Where the walker collects Barnaby; walk routes start and end here. */
  pickup: LngLat;
  walkerId: WalkerId;
  /** Handover code the walker enters at pickup. */
  otp: string;
  /** When the walker was matched (epoch ms); the en-route ETA counts from here. */
  matchedAt: number;
  etaMinutes: number;
  /** When the OTP was verified and the walk began. */
  startedAt: number | null;
  completedAt: number | null;
  /** Extra water breaks logged from the live walk screen. */
  extraWater: number;
  distanceKm: number | null;
  rating: number | null;
  tip: number | null;
}

export const DEFAULT_DRAFT: WalkDraft = {
  timing: 'instant',
  slotLabel: null,
  minutes: DEFAULT_MINUTES,
  walkerNotes: 'Watch for squirrels near Elm Creek Park',
  preferredWalkerId: null,
};

type NewBooking = Omit<
  WalkBooking,
  'id' | 'matchedAt' | 'startedAt' | 'completedAt' | 'extraWater' | 'distanceKm' | 'rating' | 'tip'
>;

interface BookingsValue {
  draft: WalkDraft;
  setDraft: (draft: WalkDraft) => void;
  /** Newest first. */
  bookings: readonly WalkBooking[];
  /** Records a matched walker (timestamped now). */
  addBooking: (booking: NewBooking) => WalkBooking;
  /** OTP verified: the walk timer starts now. */
  startWalk: (id: string) => void;
  completeWalk: (id: string, result: { distanceKm: number; rating: number; tip: number }) => void;
  cancelWalk: (id: string) => void;
  logWater: (id: string) => void;
}

const BookingsContext = createContext<BookingsValue | null>(null);

/** In-memory walk bookings and the in-progress draft for this session. */
export function BookingsProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<WalkDraft>(DEFAULT_DRAFT);
  const [bookings, setBookings] = useState<readonly WalkBooking[]>([]);

  const addBooking = useCallback((details: NewBooking) => {
    const matchedAt = Date.now();
    const booking: WalkBooking = {
      ...details,
      id: `walk-${matchedAt}`,
      matchedAt,
      startedAt: null,
      completedAt: null,
      extraWater: 0,
      distanceKm: null,
      rating: null,
      tip: null,
    };
    setBookings((current) => [booking, ...current]);
    return booking;
  }, []);

  const update = useCallback(
    (id: string, patch: (booking: WalkBooking) => Partial<WalkBooking>) => {
      setBookings((current) =>
        current.map((booking) => (booking.id === id ? { ...booking, ...patch(booking) } : booking))
      );
    },
    []
  );

  const startWalk = useCallback(
    (id: string) => update(id, () => ({ status: 'inProgress', startedAt: Date.now() })),
    [update]
  );
  const completeWalk = useCallback(
    (id: string, result: { distanceKm: number; rating: number; tip: number }) =>
      update(id, () => ({ status: 'completed', completedAt: Date.now(), ...result })),
    [update]
  );
  const cancelWalk = useCallback((id: string) => update(id, () => ({ status: 'cancelled' })), [update]);
  const logWater = useCallback(
    (id: string) => update(id, (booking) => ({ extraWater: booking.extraWater + 1 })),
    [update]
  );

  const value = useMemo(
    () => ({ draft, setDraft, bookings, addBooking, startWalk, completeWalk, cancelWalk, logWater }),
    [draft, bookings, addBooking, startWalk, completeWalk, cancelWalk, logWater]
  );
  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const value = useContext(BookingsContext);
  if (!value) throw new Error('useBookings must be used inside <BookingsProvider>');
  return value;
}

const isActive = (booking: WalkBooking) =>
  booking.status === 'enRoute' || booking.status === 'inProgress';

/** The walk currently being tracked (walker en route or walk in progress), if any. */
export function useActiveWalk() {
  const { bookings } = useBookings();
  return bookings.find(isActive);
}

/**
 * The walk a tracking screen opened with, followed by id — so completing or
 * cancelling it doesn't blank the screen while Barnaby is still leaving.
 */
export function useTrackedWalk() {
  const { bookings } = useBookings();
  const [trackedId] = useState(() => bookings.find(isActive)?.id ?? null);
  return bookings.find((booking) => booking.id === trackedId);
}
