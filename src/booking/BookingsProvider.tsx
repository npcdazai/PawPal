import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { PetChoice, WalkerId } from '../data/careTeam';
import type { AddOnKey, DurationKey, WalkStyle, WindowKey } from './walkPricing';

export interface WalkBooking {
  id: string;
  walkerId: WalkerId;
  pets: PetChoice;
  style: WalkStyle;
  duration: DurationKey;
  /** yyyy-mm-dd */
  date: string;
  dateLabel: string;
  window: WindowKey;
  startLabel: string;
  recurring: boolean;
  addOns: readonly AddOnKey[];
  notes: string;
  total: number;
}

interface BookingsValue {
  /** Newest first. */
  bookings: readonly WalkBooking[];
  addBooking: (booking: Omit<WalkBooking, 'id'>) => WalkBooking;
}

const BookingsContext = createContext<BookingsValue | null>(null);

/** In-memory walk bookings for this session (Dashboard, Profile and booking flow). */
export function BookingsProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<readonly WalkBooking[]>([]);

  const addBooking = useCallback((draft: Omit<WalkBooking, 'id'>) => {
    const booking = { ...draft, id: `walk-${Date.now()}` };
    setBookings((current) => [booking, ...current]);
    return booking;
  }, []);

  const value = useMemo(() => ({ bookings, addBooking }), [bookings, addBooking]);
  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
}

export function useBookings() {
  const value = useContext(BookingsContext);
  if (!value) throw new Error('useBookings must be used inside <BookingsProvider>');
  return value;
}
