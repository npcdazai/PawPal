import { apiRequest } from './client';
import type { Booking, CheckoutSession, NewBooking } from './types';

const bookingPath = (id: string) => `/bookings/${encodeURIComponent(id)}`;

/**
 * 201: priced by the server; `awaiting_payment` when payments are on, else
 * straight to `searching`. `minutes` only for express (400 `minutes_not_allowed`).
 */
export async function createBooking(input: NewBooking): Promise<Booking> {
  const { booking } = await apiRequest<{ booking: Booking }>('/bookings', { method: 'POST', body: input });
  return booking;
}

/** Own walks, newest `scheduledFor` first, each with its `walker` and `distanceKm` (DASHBOARD_API §5). */
export async function listBookings(): Promise<Booking[]> {
  const { bookings } = await apiRequest<{ bookings: Booking[] }>('/bookings');
  return bookings;
}

export async function getBooking(id: string): Promise<Booking> {
  const { booking } = await apiRequest<{ booking: Booking }>(bookingPath(id));
  return booking;
}

/** Before the walk starts (409 `wrong_status` after). A paid walk comes back with `payment.refundDue`. */
export async function cancelBooking(id: string): Promise<Booking> {
  const { booking } = await apiRequest<{ booking: Booking }>(`${bookingPath(id)}/cancel`, { method: 'POST' });
  return booking;
}

/** Looks for a walker again after `unmatched`. */
export async function retryBooking(id: string): Promise<Booking> {
  const { booking } = await apiRequest<{ booking: Booking }>(`${bookingPath(id)}/retry`, { method: 'POST' });
  return booking;
}

/** 1–5 stars, once, after `completed` (409 `already_rated`). */
export async function rateBooking(id: string, rating: number): Promise<Booking> {
  const { booking } = await apiRequest<{ booking: Booking }>(`${bookingPath(id)}/rating`, {
    method: 'POST',
    body: { rating },
  });
  return booking;
}

/**
 * Opens (or reuses) the checkout for an `awaiting_payment` booking. 409
 * `nothing_to_pay` when it needs no payment; 503 `payments_off` when the
 * server takes none.
 */
export function startPayment(id: string): Promise<CheckoutSession> {
  return apiRequest<CheckoutSession>(`${bookingPath(id)}/payment`, { method: 'POST' });
}

/** Asks the gateway whether the booking is paid yet, and returns it updated. */
export async function refreshPayment(id: string): Promise<Booking> {
  const { booking } = await apiRequest<{ booking: Booking }>(`${bookingPath(id)}/payment`);
  return booking;
}
