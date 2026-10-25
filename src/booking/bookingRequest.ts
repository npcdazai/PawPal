import type { Booking, ExpressMinutes, NewBooking } from '../api/types';
import type { SocietyProfile } from './BookingsProvider';
import { GEAR, type DogIdentity } from './dogProfile';
import { SOCIETIES, towerLobby, towerName } from './societies';
import { nextSlotTime, type WalkTier } from './walkPlans';

const NOTES_MAX = 500;

/**
 * POST /bookings for the plan picked on the plan screen: the society
 * profile's tower lobby as the pickup, the dog's temperament and handling
 * notes, and `minutes` only for express (other tiers have a fixed length).
 * Subscription and trial walks start at the chosen slot's next occurrence.
 */
export function bookingRequest({
  profile,
  dog,
  tier,
  minutes,
  slotStart,
  now = new Date(),
}: {
  profile: SocietyProfile;
  dog: DogIdentity;
  tier: WalkTier;
  minutes: ExpressMinutes;
  slotStart: number | null;
  now?: Date;
}): NewBooking {
  const society = SOCIETIES[profile.society];
  const [lng, lat] = towerLobby(society, profile.tower);
  const gear = GEAR.filter((item) => profile.gear.includes(item.key)).map((item) => item.label);
  const notes = [profile.notes.trim(), gear.length ? `Gear: ${gear.join(', ')}` : '']
    .filter(Boolean)
    .join(' • ')
    .slice(0, NOTES_MAX);
  return {
    tier,
    ...(tier === 'express' ? { minutes } : { scheduledFor: nextSlotTime(slotStart ?? 0, now) }),
    dog: { ...dog, temperament: profile.temperament, notes },
    pickup: { lat, lng, address: `${profile.flat}, ${towerName(profile.tower)}, ${society.label}` },
    society: { societyId: society.key, tower: profile.tower, flat: profile.flat },
  };
}

/** The server wants paying before it looks for a walker. */
export const needsPayment = (booking: Booking) =>
  booking.status === 'awaiting_payment' ||
  booking.payment.status === 'unpaid' ||
  booking.payment.status === 'pending' ||
  booking.payment.status === 'failed';

/** What the server charges for this booking (the whole pack for a subscription's first walk). */
export const amountDue = (booking: Booking) => (booking.payment.amount > 0 ? booking.payment.amount : booking.price);
