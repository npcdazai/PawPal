import type {
  Booking,
  ExpressMinutes,
  LatLng,
  NearbyWalkers,
  PackNextWalk,
  Pricing,
  SocietyAddress,
  Subscription,
  Temperament,
} from '../api/types';
import type { SocietyProfile } from './BookingsProvider';
import { SOCIETIES, towerLobby, towerName, type SocietyKey } from './societies';
import { batchSlots, clockLabel, formatMoney, slotRange } from './walkPlans';

/**
 * What the home screen and the Subscription tab show, worked out from the API's
 * answers (DASHBOARD_API.md). Pure functions, so every empty state and display
 * rule is unit-tested. Nothing here invents a price, a count or a walker: a
 * missing figure leaves its words out.
 *
 * Days and times are India time, like the server's, whatever the phone's zone.
 */

const DAY_MS = 24 * 60 * 60_000;
const IST_OFFSET_MS = 5.5 * 60 * 60_000;

/** "2026-10-26" for the India-time day containing `at`. */
export const istDate = (at: number) => new Date(at + IST_OFFSET_MS).toISOString().slice(0, 10);
/** Minutes after midnight in India. */
export const istMinute = (at: number) => {
  const date = new Date(at + IST_OFFSET_MS);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
};
/** 1792876932443 → "6:15 PM" (India time). */
export const istClock = (at: number) => clockLabel(istMinute(at));

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Whole India-time days from `now`'s day to the day of `date` ("YYYY-MM-DD"). */
function daysFromToday(date: string, now: number): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${istDate(now)}T00:00:00Z`)) / DAY_MS);
}

const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;

/** "today" / "tomorrow" / "Monday" (within a week) / "12 Nov", for an upcoming India-time date. */
export function dayWordAhead(date: string, now: number): string {
  const days = daysFromToday(date, now);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1 && days < 7) return weekdayOf(date);
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

/** "Today" / "Yesterday" / "Monday" (within a week) / "12 Oct", for a past instant. */
export function dayWordPast(at: number, now: number): string {
  const date = istDate(at);
  const days = -daysFromToday(date, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekdayOf(date);
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

export type DayPart = 'morning' | 'afternoon' | 'evening';
export const dayPart = (at: number): DayPart => {
  const minute = istMinute(at);
  return minute < 12 * 60 ? 'morning' : minute < 17 * 60 ? 'afternoon' : 'evening';
};

const capitalize = (word: string) => (word ? word[0]!.toUpperCase() + word.slice(1) : word);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// ─── Which walk, which pack ──────────────────────────────────────────────────

export const isLiveBooking = (booking: Booking) => booking.status === 'assigned' || booking.status === 'active';

/** The pack the home card follows: the active one, else a finished pack with walks still to come. */
export function currentPack(packs: readonly Subscription[]): Subscription | null {
  return (
    packs.find((pack) => pack.status === 'active') ??
    packs.find((pack) => pack.status === 'finished' && pack.nextWalk?.bookingId) ??
    null
  );
}

/** The walk under way, else the soonest one a walker has taken. */
export function liveWalk(bookings: readonly Booking[]): Booking | null {
  const active = bookings.find((booking) => booking.status === 'active');
  if (active) return active;
  return (
    bookings
      .filter((booking) => booking.status === 'assigned')
      .sort((a, b) => a.scheduledFor - b.scheduledFor)[0] ?? null
  );
}

/** The most recently finished walk, for the proof card. */
export function latestCompletedWalk(bookings: readonly Booking[]): Booking | null {
  let latest: Booking | null = null;
  for (const booking of bookings) {
    if (booking.status !== 'completed') continue;
    const at = booking.completedAt ?? booking.scheduledFor;
    if (!latest || at > (latest.completedAt ?? latest.scheduledFor)) latest = booking;
  }
  return latest;
}

/** Walks of one pack that haven't happened yet, soonest first. */
export function upcomingPackWalks(bookings: readonly Booking[], packId: string): Booking[] {
  return bookings
    .filter(
      (booking) => booking.subscriptionId === packId && booking.status !== 'completed' && booking.status !== 'cancelled'
    )
    .sort((a, b) => a.scheduledFor - b.scheduledFor);
}

// ─── Insurance pill (decision 3) ─────────────────────────────────────────────

export const INSURED_COPY = '🛡️ INSURED SOCIETY WALKS';

/**
 * A cover amount only from a walk that's under way with its doorstep-activated
 * insurance; otherwise the neutral line with no amount.
 */
export function insurancePill(bookings: readonly Booking[]): { text: string; active: boolean } {
  const covered = bookings.find(
    (booking) =>
      booking.status === 'active' &&
      booking.insurance?.active === true &&
      typeof booking.insurance.coverInr === 'number' &&
      booking.insurance.coverInr > 0
  );
  return covered?.insurance
    ? { text: `🛡️ ${formatMoney(covered.insurance.coverInr)} WALK VET COVER ACTIVE`, active: true }
    : { text: INSURED_COPY, active: false };
}

// ─── Where and who ───────────────────────────────────────────────────────────

export interface HomeContext {
  dogName: string | null;
  temperament: Temperament | undefined;
  /** For the walker radar and the weather; null until the app knows where the dog lives. */
  pickup: LatLng | null;
  society: SocietyAddress | null;
  address: string | null;
}

const usablePoint = (point: { lat: number; lng: number } | null | undefined): LatLng | null =>
  point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && (point.lat !== 0 || point.lng !== 0)
    ? { lat: point.lat, lng: point.lng }
    : null;

/**
 * Where the dog lives and how they walk: the latest booking first (its pickup
 * point, the dog's temperament, its society), then the pack, then the society
 * profile filled in on this phone.
 */
export function homeContext({
  bookings,
  pack,
  profile,
}: {
  bookings: readonly Booking[];
  pack: Subscription | null;
  profile: SocietyProfile | null;
}): HomeContext {
  const latest = bookings.reduce<Booking | null>(
    (newest, booking) => (!newest || booking.createdAt > newest.createdAt ? booking : newest),
    null
  );
  const source = latest ?? pack;
  if (source) {
    return {
      dogName: source.dog.name.trim() || null,
      temperament: source.dog.temperament,
      pickup: usablePoint(source.pickup),
      society: source.society,
      address: source.pickup.address.trim() || null,
    };
  }
  if (profile) {
    const society = SOCIETIES[profile.society];
    const [lng, lat] = towerLobby(society, profile.tower);
    return {
      dogName: null,
      temperament: profile.temperament,
      pickup: { lat, lng },
      society: { societyId: profile.society, tower: profile.tower, flat: profile.flat },
      address: society.label,
    };
  }
  return { dogName: null, temperament: undefined, pickup: null, society: null, address: null };
}

const societyName = (society: SocietyAddress | null, address: string | null) =>
  (society && SOCIETIES[society.societyId as SocietyKey]?.shortName) || address?.split(',')[0]?.trim() || null;

/** "Hiranandani Estate • Wing B, 1402"; null when the app doesn't know yet. */
export function placeLine(context: HomeContext): string | null {
  const name = societyName(context.society, context.address);
  if (!context.society) return name;
  const unit = [context.society.tower.trim() ? towerName(context.society.tower) : '', context.society.flat.trim()]
    .filter(Boolean)
    .join(', ');
  return [name, unit].filter(Boolean).join(' • ') || null;
}

// ─── Walker radar ────────────────────────────────────────────────────────────

export const NOBODY_FREE = 'No walkers free right now';

/** Top bar: "4 Walkers Active in Society", or the honest empty line. */
export function walkersActiveLine(nearby: NearbyWalkers): string {
  return nearby.count > 0 ? `${plural(nearby.count, 'Walker')} Active in Society` : NOBODY_FREE;
}

const TEMPERAMENT_BADGE: Record<Temperament, string> = {
  friendly: '🟢 Low-Pull Approved',
  pulls: '🟡 Heavy-Duty Cleared',
  reactive: '🟠 Reactive-Dog Cleared',
};

/** Express card radar: who's free for this dog, near which tower. */
export function radarLine(
  nearby: NearbyWalkers,
  context: Pick<HomeContext, 'society' | 'temperament'>
): { text: string; badge: string | null } {
  if (nearby.eligible <= 0) return { text: NOBODY_FREE, badge: null };
  const tower = context.society?.tower.trim();
  const where = tower ? `near ${towerName(tower)}` : 'near you';
  return {
    text: `${plural(nearby.eligible, 'Society Walker')} available ${where}`,
    badge: TEMPERAMENT_BADGE[context.temperament ?? 'friendly'],
  };
}

/** "Arrives in 15–30 mins"; null when nobody could come. */
export function arrivalLine(nearby: NearbyWalkers | undefined): string | null {
  if (!nearby?.arrival || nearby.eligible <= 0) return null;
  return `Arrives in ${nearby.arrival.minMinutes}–${nearby.arrival.maxMinutes} mins`;
}

// ─── Prices (always the server's) ────────────────────────────────────────────

export interface ExpressChoice {
  minutes: ExpressMinutes;
  price: number;
}

/** The express lengths the server prices, shortest first. */
export const expressChoices = (pricing: Pricing): ExpressChoice[] => pricing.express;

/** The chosen length's server price, falling back to the shortest the server offers. */
export function expressChoice(pricing: Pricing, minutes: ExpressMinutes): ExpressChoice {
  return pricing.express.find((choice) => choice.minutes === minutes) ?? pricing.express[0]!;
}

/** "₹120/walk × 26 walks" for the plan pitch. */
export const planPriceLine = (pricing: Pricing) =>
  `${formatMoney(pricing.subscription.perWalk)}/walk × ${pricing.subscription.walks} walks`;

// ─── The pack card ───────────────────────────────────────────────────────────

/** "Next walk begins tomorrow morning", from the pack's next walk. */
export function nextWalkLine(next: PackNextWalk | null, now: number): string {
  if (!next) return 'No walks left in this pack';
  if (next.status === 'active') return 'Walk under way right now 🐾';
  const date = next.date || istDate(next.scheduledFor);
  const day = dayWordAhead(date, now);
  const part = dayPart(next.scheduledFor);
  if (day === 'today') return `Next walk begins this ${part}`;
  if (day === 'tomorrow') return `Next walk begins tomorrow ${part}`;
  return `Next walk: ${day} ${part}`;
}

/** "8 walks left • ₹120/walk", leaving out what the server didn't send. */
export function packAccentLine(pack: Subscription): string | null {
  const parts = [
    pack.walksLeft !== null ? plural(pack.walksLeft, 'walk') + ' left' : null,
    pack.perWalk !== null ? `${formatMoney(pack.perWalk)}/walk` : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(' • ') : null;
}

/** "Skip tomorrow’s walk" / "Skip Monday’s walk". */
export function skipLabel(next: PackNextWalk | null, now: number): string | null {
  if (!next || next.status === 'active') return null;
  return `Skip ${dayWordAhead(next.date || istDate(next.scheduledFor), now)}’s walk`;
}

/** The daily times a pack can move to: every 30 minutes 6:00–9:00 AM and 5:00–8:00 PM. */
export const PACK_SLOTS: readonly number[] = [...batchSlots('morning'), ...batchSlots('evening')];

/** The server's slot list from /pricing when it sends one, else the batch slots (DASHBOARD_API §4). */
export function packSlots(pricing: Pricing | undefined): { slotMinute: number; label: string }[] {
  if (pricing?.subscription.slots.length) return pricing.subscription.slots;
  return PACK_SLOTS.map((slotMinute) => ({ slotMinute, label: slotRange(slotMinute) }));
}

// ─── The proof card ──────────────────────────────────────────────────────────

export interface ProofCard {
  title: string;
  subtitle: string;
  time: string | null;
  pee: number;
  poop: number;
  photo: boolean;
}

/** The latest finished walk, as the strip under the cards shows it. */
export function proofCard(walk: Booking, now: number): ProofCard {
  const finished = walk.completedAt ?? walk.scheduledFor;
  const day = dayWordPast(finished, now);
  const km = typeof walk.distanceKm === 'number' ? `${walk.distanceKm.toFixed(2)} km Walked` : 'Walk complete';
  const part = capitalize(dayPart(walk.startedAt ?? walk.scheduledFor));
  const where = walk.society ? 'society loop' : 'walk';
  const walker = walk.walker?.name ? ` with ${firstName(walk.walker.name)}` : '';
  const count = (type: string) => walk.events.filter((event) => event.type === type).length;
  return {
    title: `${day} • ${km}`,
    subtitle: `${part} ${where}${walker}`,
    time: walk.completedAt ? istClock(walk.completedAt) : null,
    pee: count('pee'),
    poop: count('poop'),
    photo: count('photo') > 0,
  };
}

export const peeLabel = (n: number) => `💧 ${n} Pee`;
export const poopLabel = (n: number) => `💩 ${n} Poop`;

// ─── Upcoming walk rows (Subscription tab) ───────────────────────────────────

const STATUS_COPY: Partial<Record<Booking['status'], string>> = {
  awaiting_payment: 'Awaiting payment',
  searching: 'Finding a walker',
  assigned: 'Walker assigned',
  active: 'Walking now',
  unmatched: 'No walker yet',
};

/** "Sun, 26 Oct • 7:00 AM" and a status word, for one upcoming pack walk. */
export function upcomingRow(walk: Booking, now: number): { when: string; status: string } {
  const date = istDate(walk.scheduledFor);
  const day = dayWordAhead(date, now);
  const [, month, dayOfMonth] = date.split('-').map(Number);
  const label =
    day === 'today' || day === 'tomorrow'
      ? capitalize(day)
      : `${weekdayOf(date).slice(0, 3)}, ${dayOfMonth} ${MONTHS[(month ?? 1) - 1]}`;
  return { when: `${label} • ${istClock(walk.scheduledFor)}`, status: STATUS_COPY[walk.status] ?? '' };
}
