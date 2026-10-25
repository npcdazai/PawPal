import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { WalkerId } from '../data/careTeam';
import type { UpiReceipt } from '../payments/useUpiPayment';
import type { GearKey, Temperament } from './dogProfile';
import type { LngLat } from './geo';
import type { LoggedEvent, WalkEventKind } from './liveWalk';
import type { SocietyKey } from './societies';
import { minuteOfDay, type Batch, type WalkMinutes, type WalkTier } from './walkPlans';

/**
 * Where Barnaby lives and how he must be handled. Required before booking:
 * it decides which walker is assigned and which plans are allowed.
 */
export interface SocietyProfile {
  society: SocietyKey;
  /** As the resident wrote it, normalised: "Tower B" / "Wing B". */
  tower: string;
  flat: string;
  temperament: Temperament;
  gear: readonly GearKey[];
  notes: string;
}

export type WalkStatus = 'scheduled' | 'enRoute' | 'inProgress' | 'completed' | 'cancelled';

export interface WalkBooking {
  id: string;
  /** The API's booking (POST /bookings), when the walk was booked through it. */
  bookingId?: string | null;
  status: WalkStatus;
  tier: WalkTier;
  minutes: WalkMinutes;
  /** Rupees paid for this booking (a subscription's first month). */
  total: number;
  /** The verified UPI payment for this booking. */
  payment: UpiReceipt | null;
  society: SocietyKey;
  tower: string;
  flat: string;
  /** The tower's lift lobby: walks start and end here. */
  pickup: LngLat;
  /** Where the walker sets off from (the previous slot's tower). */
  walkerFrom: LngLat;
  /** The previous slot's tower, when the walker is stacked straight before Barnaby. */
  walkerFromTower: string | null;
  batch: Batch | null;
  /** Slot start, minutes from midnight (the walk clock counts from here). */
  slotStart: number;
  /** "7:00 – 7:30 AM Daily" or "SOS Express · within 60–90 mins". */
  slotLabel: string;
  /** Dashboard line: "Arriving in 4 mins" etc. */
  whenLabel: string;
  walkerId: WalkerId;
  /** Who was booked; differs from `walkerId` once the backup has taken over. */
  regularWalkerId: WalkerId;
  /** Pre-briefed shadow walker; null once they have taken over. */
  backupWalkerId: WalkerId | null;
  /** The regular walker was out and the backup took the slot. */
  reassigned: boolean;
  /** Handover code the walker enters at the doorstep. */
  otp: string;
  /** When the walker was confirmed (epoch ms); the arrival ETA counts from here. */
  matchedAt: number;
  etaMinutes: number;
  /** When the OTP was verified and the walk (and its insurance) began. */
  startedAt: number | null;
  completedAt: number | null;
  /** Pee / poop / photo stops the walker logged live. */
  loggedEvents: readonly LoggedEvent[];
  distanceKm: number | null;
  rating: number | null;
  tip: number | null;
}

type NewBooking = Omit<
  WalkBooking,
  | 'id'
  | 'matchedAt'
  | 'startedAt'
  | 'completedAt'
  | 'loggedEvents'
  | 'distanceKm'
  | 'rating'
  | 'tip'
  | 'reassigned'
  | 'regularWalkerId'
>;

interface BookingsValue {
  /** Saved once from Screen 5; prefills it next time. */
  societyProfile: SocietyProfile | null;
  setSocietyProfile: (profile: SocietyProfile) => void;
  /** Newest first. */
  bookings: readonly WalkBooking[];
  /** Records a confirmed walker (timestamped now). */
  addBooking: (booking: NewBooking) => WalkBooking;
  /** OTP verified: the walk timer and insurance start now. */
  startWalk: (id: string) => void;
  completeWalk: (id: string, result: { distanceKm: number; rating: number; tip: number }) => void;
  cancelWalk: (id: string) => void;
  /** The regular walker is out: the pre-briefed backup takes the same slot. */
  reassignToBackup: (id: string, etaMinutes: number) => void;
  /** The walker logged a pee / poop / photo stop at fraction `at` of the walk. */
  logEvent: (id: string, kind: WalkEventKind, at: number) => void;
}

const BookingsContext = createContext<BookingsValue | null>(null);

/** In-memory society profile and walk bookings for this session. */
export function BookingsProvider({ children }: { children: ReactNode }) {
  const [societyProfile, setSocietyProfile] = useState<SocietyProfile | null>(null);
  const [bookings, setBookings] = useState<readonly WalkBooking[]>([]);

  const addBooking = useCallback((details: NewBooking) => {
    const matchedAt = Date.now();
    const booking: WalkBooking = {
      ...details,
      id: `walk-${matchedAt}`,
      matchedAt,
      regularWalkerId: details.walkerId,
      reassigned: false,
      startedAt: null,
      completedAt: null,
      loggedEvents: [],
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
    (id: string) => {
      const startedAt = Date.now();
      update(id, (booking) => ({
        status: 'inProgress',
        startedAt,
        // Express walks have no fixed slot: the walk clock starts when the OTP is shared.
        ...(booking.tier === 'express' ? { slotStart: minuteOfDay(new Date(startedAt)) } : {}),
      }));
    },
    [update]
  );
  const completeWalk = useCallback(
    (id: string, result: { distanceKm: number; rating: number; tip: number }) =>
      update(id, () => ({ status: 'completed', completedAt: Date.now(), ...result })),
    [update]
  );
  const cancelWalk = useCallback((id: string) => update(id, () => ({ status: 'cancelled' })), [update]);
  const reassignToBackup = useCallback(
    (id: string, etaMinutes: number) =>
      update(id, (booking) =>
        booking.backupWalkerId
          ? {
              walkerId: booking.backupWalkerId,
              backupWalkerId: null,
              reassigned: true,
              matchedAt: Date.now(),
              etaMinutes,
              whenLabel: `Backup arriving in ${etaMinutes} mins`,
            }
          : {}
      ),
    [update]
  );
  const logEvent = useCallback(
    (id: string, kind: WalkEventKind, at: number) =>
      update(id, (booking) => ({ loggedEvents: [...booking.loggedEvents, { kind, at }] })),
    [update]
  );

  const value = useMemo(
    () => ({
      societyProfile,
      setSocietyProfile,
      bookings,
      addBooking,
      startWalk,
      completeWalk,
      cancelWalk,
      reassignToBackup,
      logEvent,
    }),
    [societyProfile, bookings, addBooking, startWalk, completeWalk, cancelWalk, reassignToBackup, logEvent]
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

/** The walk currently being tracked (walker on the way or walk in progress), if any. */
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

/** Completed walks: the trust history that unlocks SOS Express for reactive dogs. */
export function usePastWalks() {
  const { bookings } = useBookings();
  return bookings.filter((booking) => booking.status === 'completed');
}
