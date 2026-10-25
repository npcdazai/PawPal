import { ApiError } from './errors';
import {
  EXPRESS_MINUTES,
  type BookingStatus,
  type ExpressMinutes,
  type NearbyWalkers,
  type PackBackup,
  type PackNextWalk,
  type PackWalker,
  type Pricing,
  type Subscription,
  type SubscriptionStatus,
  type Weather,
  type WeatherCondition,
  type WalkerRating,
} from './types';

/**
 * Readers for the home-screen endpoints (DASHBOARD_API.md). They keep the app
 * standing when a field is missing or the wrong type (a server mid-upgrade,
 * say): an optional figure comes back null and the screen leaves it out, while
 * a reply that can't be used at all becomes an ApiError `bad_response`. They
 * never make up a price, a count or a walker.
 */

type Json = Record<string, unknown>;

const obj = (value: unknown): Json | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const text = (value: unknown): string | null => {
  const s = str(value)?.trim();
  return s ? s : null;
};

const unreadable = () =>
  new ApiError(200, 'bad_response', 'PawPal sent an answer the app couldn’t read. Try again.');

/** "Rohan Deshmukh" → "RD"; for servers that don't send initials. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase());
  if (letters.length === 0) return '?';
  return letters.length === 1 ? letters[0]! : `${letters[0]}${letters[letters.length - 1]}`;
}

const isExpressMinutes = (value: number | null): value is ExpressMinutes =>
  value !== null && (EXPRESS_MINUTES as readonly number[]).includes(value);

export function parsePricing(raw: unknown): Pricing {
  const body = obj(raw);
  const express = (Array.isArray(body?.express) ? body.express : [])
    .map((entry) => {
      const item = obj(entry);
      const minutes = num(item?.minutes);
      const price = num(item?.price);
      return isExpressMinutes(minutes) && price !== null ? { minutes, price } : null;
    })
    .filter((entry): entry is { minutes: ExpressMinutes; price: number } => entry !== null)
    .sort((a, b) => a.minutes - b.minutes);
  const subscription = obj(body?.subscription);
  const trial = obj(body?.trial);
  const perWalk = num(subscription?.perWalk);
  const walks = num(subscription?.walks);
  const total = num(subscription?.total);
  const trialPrice = num(trial?.price);
  if (!body || express.length === 0 || perWalk === null || walks === null || total === null || trialPrice === null) {
    throw unreadable();
  }
  const slots = (Array.isArray(subscription?.slots) ? subscription.slots : [])
    .map((entry) => {
      const slot = obj(entry);
      const slotMinute = num(slot?.slotMinute);
      const label = text(slot?.label);
      return slotMinute !== null && label ? { slotMinute, label } : null;
    })
    .filter((slot): slot is { slotMinute: number; label: string } => slot !== null);
  return {
    currency: 'INR',
    peak: body.peak === true,
    peakWindows: Array.isArray(body.peakWindows) ? body.peakWindows.filter((w): w is string => typeof w === 'string') : [],
    express,
    subscription: { perWalk, walks, total, minutes: num(subscription?.minutes) ?? 30, slots },
    trial: { price: trialPrice, minutes: num(trial?.minutes) ?? 15 },
  };
}

export function parseNearby(raw: unknown): NearbyWalkers {
  const body = obj(raw);
  const count = num(body?.count);
  if (!body || count === null) throw unreadable();
  const eligible = num(body.eligible) ?? count;
  const arrival = obj(body.arrival);
  const minMinutes = num(arrival?.minMinutes);
  const maxMinutes = num(arrival?.maxMinutes);
  return {
    count: Math.max(0, count),
    eligible: Math.max(0, eligible),
    nearestKm: num(body.nearestKm),
    // No window without someone who could come.
    arrival: eligible > 0 && minMinutes !== null && maxMinutes !== null ? { minMinutes, maxMinutes } : null,
  };
}

const WEATHER_ICONS: Record<WeatherCondition, string> = {
  clear: '☀️',
  'partly-cloudy': '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  thunderstorm: '⛈️',
  snow: '❄️',
};

export function parseWeather(raw: unknown): Weather {
  const body = obj(raw);
  const tempC = num(body?.tempC);
  if (!body || tempC === null) throw unreadable();
  const condition = (str(body.condition) ?? 'clear') as WeatherCondition;
  return {
    tempC,
    condition,
    icon: text(body.icon) ?? WEATHER_ICONS[condition] ?? '🌤️',
    updatedAt: num(body.updatedAt) ?? 0,
  };
}

function parseRating(raw: unknown): WalkerRating | null {
  const rating = obj(raw);
  const average = num(rating?.average);
  const count = num(rating?.count);
  return average !== null && count !== null && count > 0 ? { average, count } : null;
}

function parsePackWalker(raw: unknown): PackWalker | null {
  const walker = obj(raw);
  const name = text(walker?.name);
  if (!walker || !name) return null;
  return {
    id: str(walker.id) ?? '',
    name,
    initials: text(walker.initials) ?? initialsOf(name),
    rating: parseRating(walker.rating),
    verified: walker.verified === true,
    gatePass: text(walker.gatePass),
  };
}

function parseBackup(raw: unknown): PackBackup | null {
  const backup = obj(raw);
  const name = text(backup?.name);
  if (!backup || !name) return null;
  return { id: str(backup.id) ?? '', name, initials: text(backup.initials) ?? initialsOf(name) };
}

function parseNextWalk(raw: unknown): PackNextWalk | null {
  const next = obj(raw);
  const scheduledFor = num(next?.scheduledFor);
  if (!next || scheduledFor === null) return null;
  return {
    bookingId: text(next.bookingId),
    scheduledFor,
    date: str(next.date) ?? '',
    status: (str(next.status) ?? 'scheduled') as BookingStatus | 'scheduled',
    pickupOtp: text(next.pickupOtp),
  };
}

const STATUSES: readonly SubscriptionStatus[] = ['active', 'cancelled', 'finished'];

/** 420 → "7:00 – 7:30 AM" (only for servers that don't send `slotLabel`). */
function slotLabelFor(minute: number): string {
  const clock = (m: number) => {
    const total = ((Math.round(m) % 1440) + 1440) % 1440;
    const hours = Math.floor(total / 60);
    return { time: `${hours % 12 || 12}:${String(total % 60).padStart(2, '0')}`, half: hours < 12 ? 'AM' : 'PM' };
  };
  const start = clock(minute);
  const end = clock(minute + 30);
  return start.half === end.half
    ? `${start.time} – ${end.time} ${end.half}`
    : `${start.time} ${start.half} – ${end.time} ${end.half}`;
}

export function parseSubscription(raw: unknown): Subscription | null {
  const pack = obj(raw);
  const id = text(pack?.id);
  const status = str(pack?.status) as SubscriptionStatus | null;
  const walksTotal = num(pack?.walksTotal);
  const walksBooked = num(pack?.walksBooked);
  const slotMinute = num(pack?.slotMinute);
  if (!pack || !id || !status || !STATUSES.includes(status) || walksTotal === null || walksBooked === null || slotMinute === null) {
    return null;
  }
  const dog = obj(pack.dog);
  const pickup = obj(pack.pickup);
  const society = obj(pack.society);
  return {
    id,
    status,
    dog: {
      name: str(dog?.name) ?? '',
      breed: str(dog?.breed) ?? '',
      size: str(dog?.size) ?? '',
      temperament: (str(dog?.temperament) ?? 'friendly') as Subscription['dog']['temperament'],
      notes: str(dog?.notes) ?? '',
    },
    pickup: { lat: num(pickup?.lat) ?? 0, lng: num(pickup?.lng) ?? 0, address: str(pickup?.address) ?? '' },
    society:
      society && text(society.societyId)
        ? { societyId: String(society.societyId), tower: str(society.tower) ?? '', flat: str(society.flat) ?? '' }
        : null,
    walksTotal,
    walksBooked,
    walksDone: num(pack.walksDone),
    walksLeft: num(pack.walksLeft),
    perWalk: num(pack.perWalk),
    slotMinute,
    slotLabel: text(pack.slotLabel) ?? slotLabelFor(slotMinute),
    skipDates: Array.isArray(pack.skipDates) ? pack.skipDates.filter((d): d is string => typeof d === 'string') : [],
    nextWalk: parseNextWalk(pack.nextWalk),
    walker: parsePackWalker(pack.walker),
    backup: parseBackup(pack.backup),
  };
}

/** `{ subscriptions: [...] }`, newest first; unreadable entries are dropped. */
export function parseSubscriptions(raw: unknown): Subscription[] {
  const list = obj(raw)?.subscriptions;
  if (!Array.isArray(list)) throw unreadable();
  return list.map(parseSubscription).filter((pack): pack is Subscription => pack !== null);
}

/** `{ subscription }` from skip / change time / cancel. */
export function parseSubscriptionReply(raw: unknown): Subscription {
  const pack = parseSubscription(obj(raw)?.subscription);
  if (!pack) throw unreadable();
  return pack;
}
