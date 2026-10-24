/**
 * The PawPal API's shapes, as the customer app sees them. Mirrors the
 * backend's src/domain/types.ts and the views its routes return (the customer
 * view of a booking keeps `pickupOtp` and `payment`, and adds `walker` once one
 * is assigned). Money is in rupees; times are epoch ms.
 */

export type AppKind = 'customer' | 'partner';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  /** E.164, e.g. "+919876543210". */
  phone: string;
  /** Empty until the person tells us their name. */
  name: string;
  email: string | null;
  apps: AppKind[];
}

/** GET /me */
export interface Me {
  user: User;
  app: AppKind;
  /** Always null in the customer app. */
  partner: null;
}

/** POST /auth/phone */
export interface PhoneSession {
  sessionToken: string;
  user: User;
}

/**
 * How the code reaches the person: `dev` asks the server for a development
 * code (printed in its console, no SMS); `firebase` tells it Firebase already
 * texted one from this device.
 */
export type VerificationCodeMethod = 'dev' | 'firebase';

/** POST /auth/phone/code */
export type VerificationCodeSent =
  | {
      method: 'dev';
      /** Epoch ms: the code works for 10 minutes. */
      expiresAt: number;
      /** The development code. Never sent for Firebase SMS. */
      devCode: string;
    }
  | { method: 'firebase' };

export type WalkTier = 'subscription' | 'trial' | 'express';
export type Temperament = 'friendly' | 'pulls' | 'reactive';
export type DogSize = 'small' | 'medium' | 'large' | 'giant';

/** `awaiting_payment` → (paid) `searching` → `assigned` → `active` → `completed`, or `cancelled` / `unmatched`. */
export type BookingStatus =
  | 'awaiting_payment'
  | 'searching'
  | 'assigned'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'unmatched';

export type PaymentStatus =
  /** Payments are switched off on the server (development). */
  | 'not_required'
  /** Covered by a paid monthly pack. */
  | 'prepaid'
  | 'unpaid'
  /** A checkout is open at the gateway. */
  | 'pending'
  | 'paid'
  /** The gateway says paid but it isn't confirmed against a bank alert yet. */
  | 'review'
  | 'failed';

export interface BookingPayment {
  provider: 'youpi' | 'subscription' | 'none';
  status: PaymentStatus;
  /** Rupees charged for this booking (the whole pack for a subscription's first walk). */
  amount: number;
  orderId: string | null;
  attempts: number;
  paymentId: string | null;
  checkoutUrl: string | null;
  utr: string | null;
  verificationLevel: number | null;
  paidAt: number | null;
  /** Paid, then cancelled or released: refunded by hand. */
  refundDue: boolean;
}

export interface SocietyAddress {
  societyId: string;
  tower: string;
  flat: string;
}

export interface Dog {
  name: string;
  breed: string;
  size: string;
  temperament: Temperament;
  notes: string;
}

export interface Pickup extends LatLng {
  address: string;
}

export type WalkEventType = 'pee' | 'poop' | 'photo' | 'note';

export interface WalkEvent {
  type: WalkEventType;
  at: number;
  lat: number | null;
  lng: number | null;
  note: string | null;
}

export interface Walker {
  name: string;
  area: string;
}

export interface Booking {
  id: string;
  customerId: string;
  status: BookingStatus;
  tier: WalkTier;
  minutes: number;
  /** Rupees for this walk, priced by the server. */
  price: number;
  currency: 'INR';
  payout: number;
  scheduledFor: number;
  dog: Dog;
  pickup: Pickup;
  society: SocietyAddress | null;
  payment: BookingPayment;
  subscriptionId: string | null;
  partnerId: string | null;
  /** The 4 digits the walker types in at the door. */
  pickupOtp: string;
  walkerLocation: (LatLng & { at: number }) | null;
  shiftVerifiedAt: number | null;
  /** Vet & accident cover, on only once the walker's doorstep check passes. */
  insurance: { active: boolean; coverInr: number; activatedAt: number } | null;
  events: WalkEvent[];
  /** The walked route, [lng, lat, at]. */
  track: [number, number, number][];
  rating: number | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  /**
   * Who's walking: on GET /bookings/:id and the booking mutations once a walker
   * is assigned (null if their profile is gone). GET /bookings leaves it out.
   */
  walker?: Walker | null;
}

/** POST /bookings */
export interface NewBooking {
  tier: WalkTier;
  /** Epoch ms; omit for an express walk now. */
  scheduledFor?: number;
  dog: { name: string; breed: string; size: DogSize; temperament?: Temperament; notes?: string };
  pickup: Pickup;
  society?: SocietyAddress | null;
}

/** POST /bookings/:id/payment */
export interface CheckoutSession {
  /** Null when the open session is already paid or held for review: just check the booking. */
  checkoutUrl: string | null;
  booking: Booking | null;
}

export interface Subscription {
  id: string;
  customerId: string;
  status: 'active' | 'cancelled' | 'finished';
  walksTotal: number;
  walksBooked: number;
  /** Minutes after midnight, India time. */
  slotMinute: number;
  dog: Dog;
  pickup: Pickup;
  society: SocietyAddress | null;
  lastScheduledFor: number;
  createdAt: number;
  updatedAt: number;
}

export interface Place {
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** "N123" / "W456" / "R789" (OpenStreetMap node / way / relation). */
  placeId: string | null;
}

export interface WalkingRoute {
  distanceMeters: number;
  durationSeconds: number;
  /** [lng, lat] pairs, ready for a map line. */
  coordinates: [number, number][];
}
