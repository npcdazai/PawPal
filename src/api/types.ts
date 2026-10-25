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

/** A walker's average over all rated walks (2 decimals). */
export interface WalkerRating {
  average: number;
  count: number;
}

/**
 * Who's walking, as the pet parent sees them: by name only, never a phone
 * number or a location (DASHBOARD_API §5). Older servers sent `{ name, area }`,
 * so everything but the name is optional.
 */
export interface Walker {
  id?: string;
  name: string;
  /** "RD". */
  initials?: string;
  rating?: WalkerRating | null;
  /** Trust tier ≥ 1. */
  verified?: boolean;
  area?: string;
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
   * Who's walking, once a walker is assigned (null if their profile is gone).
   * Older servers left it out of GET /bookings.
   */
  walker?: Walker | null;
  /** The walked distance, 2 decimals, once completed; null before (older servers leave it out). */
  distanceKm?: number | null;
}

/** Express walks come in three lengths (DASHBOARD_API §1). */
export type ExpressMinutes = 30 | 45 | 60;
export const EXPRESS_MINUTES: readonly ExpressMinutes[] = [30, 45, 60];

/** POST /bookings */
export interface NewBooking {
  tier: WalkTier;
  /** Express only (default 30); other tiers must leave it out. */
  minutes?: ExpressMinutes;
  /** Epoch ms; omit for an express walk now. */
  scheduledFor?: number;
  dog: { name: string; breed: string; size: DogSize; temperament?: Temperament; notes?: string };
  pickup: Pickup;
  society?: SocietyAddress | null;
}

/** GET /pricing: what each walk costs at a moment, peak surcharge included. */
export interface Pricing {
  currency: 'INR';
  /** The express prices include the peak-hour surcharge. */
  peak: boolean;
  /** ["07:00–09:00", "17:00–19:00"], India time. */
  peakWindows: string[];
  /** Ascending by length. */
  express: { minutes: ExpressMinutes; price: number }[];
  subscription: {
    perWalk: number;
    walks: number;
    total: number;
    minutes: number;
    /** The daily times a pack can use (the server sends them; empty from older servers). */
    slots: { slotMinute: number; label: string }[];
  };
  trial: { price: number; minutes: number };
}

/** GET /walkers/nearby: how many walkers could take a walk here (never who or where). */
export interface NearbyWalkers {
  /** Online, approved walkers whose radius covers the point. */
  count: number;
  /** Those cleared for the dog's temperament (all of `count` without one). */
  eligible: number;
  nearestKm: number | null;
  /** A 15-minute window; null when nobody is eligible. */
  arrival: { minMinutes: number; maxMinutes: number } | null;
}

export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'thunderstorm'
  | 'snow';

/** GET /weather (503 `weather_unavailable` when off or the provider is down). */
export interface Weather {
  tempC: number;
  condition: WeatherCondition;
  icon: string;
  updatedAt: number;
}

/** POST /bookings/:id/payment */
export interface CheckoutSession {
  /** Null when the open session is already paid or held for review: just check the booking. */
  checkoutUrl: string | null;
  booking: Booking | null;
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'finished';

/** The pack's primary walker: set the first time a walker accepts one of its walks. */
export interface PackWalker {
  id: string;
  name: string;
  initials: string;
  rating: WalkerRating | null;
  verified: boolean;
  /** Last 4 characters of the society gate pass, when verification has one. */
  gatePass: string | null;
}

/** A second walker who covers the slot when the primary can't. */
export interface PackBackup {
  id: string;
  name: string;
  initials: string;
}

export interface PackNextWalk {
  /** Null while the generator hasn't booked that day yet. */
  bookingId: string | null;
  scheduledFor: number;
  /** "2026-10-26", India time. */
  date: string;
  /** A booking status, or "scheduled" before the walk is generated. */
  status: BookingStatus | 'scheduled';
  /** Only while the walk isn't started. */
  pickupOtp: string | null;
}

/** GET /subscriptions: one monthly pack as the pet parent sees it (DASHBOARD_API §4). */
export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  dog: Dog;
  pickup: Pickup;
  society: SocietyAddress | null;
  walksTotal: number;
  walksBooked: number;
  walksDone: number | null;
  /** walksTotal − walksBooked (skipped and cancelled walks are credited back). */
  walksLeft: number | null;
  /** Rupees. */
  perWalk: number | null;
  /** Minutes after midnight, India time. */
  slotMinute: number;
  /** "7:00 – 7:30 AM". */
  slotLabel: string;
  skipDates: string[];
  nextWalk: PackNextWalk | null;
  walker: PackWalker | null;
  backup: PackBackup | null;
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
