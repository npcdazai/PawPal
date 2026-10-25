import type { Booking, NearbyWalkers, Pricing, Subscription } from '../src/api/types';
import {
  INSURED_COPY,
  NOBODY_FREE,
  PACK_SLOTS,
  arrivalLine,
  currentPack,
  dayWordAhead,
  dayWordPast,
  expressChoice,
  homeContext,
  insurancePill,
  latestCompletedWalk,
  liveWalk,
  nextWalkLine,
  packAccentLine,
  packSlots,
  placeLine,
  planPriceLine,
  proofCard,
  radarLine,
  skipLabel,
  upcomingPackWalks,
  upcomingRow,
  walkersActiveLine,
} from '../src/booking/homeModel';

/** An instant in India time: 2026-10-25 at hh:mm IST. */
const ist = (date: string, hours: number, minutes = 0) =>
  Date.parse(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+05:30`);

const NOW = ist('2026-10-25', 15, 0);

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    customerId: 'c1',
    status: 'searching',
    tier: 'express',
    minutes: 30,
    price: 299,
    currency: 'INR',
    payout: 254.15,
    scheduledFor: NOW,
    dog: { name: 'Bruno', breed: 'Indie', size: 'medium', temperament: 'friendly', notes: '' },
    pickup: { lat: 19.2585, lng: 72.9712, address: '1402, Wing B, Hiranandani Estate, Thane' },
    society: { societyId: 'hiranandani', tower: 'Wing B', flat: '1402' },
    payment: {
      provider: 'none',
      status: 'not_required',
      amount: 299,
      orderId: null,
      attempts: 0,
      paymentId: null,
      checkoutUrl: null,
      utr: null,
      verificationLevel: null,
      paidAt: null,
      refundDue: false,
    },
    subscriptionId: null,
    partnerId: null,
    pickupOtp: '7391',
    walkerLocation: null,
    shiftVerifiedAt: null,
    insurance: null,
    events: [],
    track: [],
    rating: null,
    createdAt: NOW - 60_000,
    updatedAt: NOW,
    startedAt: null,
    completedAt: null,
    walker: null,
    distanceKm: null,
    ...overrides,
  };
}

function pack(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'p1',
    status: 'active',
    dog: { name: 'Bruno', breed: 'Indie', size: 'medium', temperament: 'friendly', notes: '' },
    pickup: { lat: 19.2585, lng: 72.9712, address: 'Hiranandani Estate, Thane' },
    society: { societyId: 'hiranandani', tower: 'A', flat: '1402' },
    walksTotal: 26,
    walksBooked: 18,
    walksDone: 17,
    walksLeft: 8,
    perWalk: 120,
    slotMinute: 420,
    slotLabel: '7:00 – 7:30 AM',
    skipDates: [],
    nextWalk: { bookingId: 'b9', scheduledFor: ist('2026-10-26', 7), date: '2026-10-26', status: 'assigned', pickupOtp: '7391' },
    walker: { id: 'w1', name: 'Rohan Deshmukh', initials: 'RD', rating: { average: 4.96, count: 25 }, verified: true, gatePass: '4092' },
    backup: { id: 'w2', name: 'Pratik K.', initials: 'PK' },
    ...overrides,
  };
}

const PRICING: Pricing = {
  currency: 'INR',
  peak: false,
  peakWindows: ['07:00–09:00', '17:00–19:00'],
  express: [
    { minutes: 30, price: 299 },
    { minutes: 45, price: 379 },
    { minutes: 60, price: 449 },
  ],
  subscription: { perWalk: 120, walks: 26, total: 3120, minutes: 30, slots: [] },
  trial: { price: 99, minutes: 15 },
};

describe('insurancePill (decision 3)', () => {
  test('shows the cover amount only for a walk under way with active insurance', () => {
    const covered = booking({ status: 'active', insurance: { active: true, coverInr: 25000, activatedAt: NOW } });
    expect(insurancePill([covered])).toEqual({ text: '🛡️ ₹25,000 WALK VET COVER ACTIVE', active: true });
  });

  test('never an amount otherwise: no walk, a finished walk, inactive cover, or no cover yet', () => {
    const cases: Booking[][] = [
      [],
      [booking({ status: 'completed', insurance: { active: true, coverInr: 10000, activatedAt: NOW } })],
      [booking({ status: 'active', insurance: { active: false, coverInr: 10000, activatedAt: NOW } })],
      [booking({ status: 'active', insurance: null })],
      [booking({ status: 'assigned', insurance: { active: true, coverInr: 10000, activatedAt: NOW } })],
    ];
    for (const bookings of cases) {
      expect(insurancePill(bookings)).toEqual({ text: INSURED_COPY, active: false });
      expect(insurancePill(bookings).text).not.toMatch(/₹/);
    }
  });
});

describe('which pack and which walk', () => {
  test('the active pack, else a finished one with walks still to come, else none (empty state)', () => {
    expect(currentPack([pack({ id: 'old', status: 'cancelled' }), pack({ id: 'now' })])?.id).toBe('now');
    expect(currentPack([pack({ status: 'finished' })])?.id).toBe('p1');
    expect(currentPack([pack({ status: 'finished', nextWalk: null })])).toBeNull();
    expect(currentPack([pack({ status: 'cancelled' })])).toBeNull();
    expect(currentPack([])).toBeNull();
  });

  test('the live walk prefers one under way, then the soonest assigned', () => {
    const later = booking({ id: 'later', status: 'assigned', scheduledFor: NOW + 7_200_000 });
    const sooner = booking({ id: 'sooner', status: 'assigned', scheduledFor: NOW + 3_600_000 });
    expect(liveWalk([later, sooner])?.id).toBe('sooner');
    expect(liveWalk([later, booking({ id: 'walking', status: 'active' })])?.id).toBe('walking');
    expect(liveWalk([booking({ status: 'completed' })])).toBeNull();
  });

  test('the proof card follows the most recently completed walk; none hides it', () => {
    const older = booking({ id: 'older', status: 'completed', completedAt: NOW - 2 * 86_400_000 });
    const newer = booking({ id: 'newer', status: 'completed', completedAt: NOW - 86_400_000 });
    expect(latestCompletedWalk([older, booking({ status: 'active' }), newer])?.id).toBe('newer');
    expect(latestCompletedWalk([booking({ status: 'cancelled' })])).toBeNull();
  });

  test('upcoming pack walks: this pack only, not finished, soonest first', () => {
    const walks = [
      booking({ id: 'b', subscriptionId: 'p1', scheduledFor: NOW + 2 }),
      booking({ id: 'a', subscriptionId: 'p1', scheduledFor: NOW + 1, status: 'assigned' }),
      booking({ id: 'done', subscriptionId: 'p1', status: 'completed' }),
      booking({ id: 'gone', subscriptionId: 'p1', status: 'cancelled' }),
      booking({ id: 'other', subscriptionId: 'p2' }),
    ];
    expect(upcomingPackWalks(walks, 'p1').map((walk) => walk.id)).toEqual(['a', 'b']);
  });
});

describe('homeContext', () => {
  test('uses the latest booking: pickup, temperament, society and dog', () => {
    const first = booking({ id: 'first', createdAt: 1, dog: { ...booking().dog, name: 'Old' } });
    const latest = booking({
      id: 'latest',
      createdAt: 2,
      dog: { ...booking().dog, name: 'Bruno', temperament: 'pulls' },
    });
    expect(homeContext({ bookings: [latest, first], pack: pack(), profile: null })).toMatchObject({
      dogName: 'Bruno',
      temperament: 'pulls',
      pickup: { lat: 19.2585, lng: 72.9712 },
      society: { societyId: 'hiranandani', tower: 'Wing B', flat: '1402' },
    });
  });

  test('falls back to the pack, then the phone’s society profile, then nothing', () => {
    expect(homeContext({ bookings: [], pack: pack(), profile: null }).society?.tower).toBe('A');
    const fromProfile = homeContext({
      bookings: [],
      pack: null,
      profile: { society: 'palava', tower: 'Tower C', flat: '201', temperament: 'reactive', gear: [], notes: '' },
    });
    expect(fromProfile.dogName).toBeNull();
    expect(fromProfile.temperament).toBe('reactive');
    expect(fromProfile.pickup).not.toBeNull();
    expect(homeContext({ bookings: [], pack: null, profile: null })).toEqual({
      dogName: null,
      temperament: undefined,
      pickup: null,
      society: null,
      address: null,
    });
  });

  test('placeLine reads the society, tower and flat', () => {
    const context = homeContext({ bookings: [booking()], pack: null, profile: null });
    expect(placeLine(context)).toBe('Hiranandani Estate • Wing B, 1402');
    expect(
      placeLine({ ...context, society: { societyId: 'unknown', tower: 'A', flat: '7' }, address: 'Green Acres, Pune' })
    ).toBe('Green Acres • Tower A, 7');
    expect(placeLine({ dogName: null, temperament: undefined, pickup: null, society: null, address: null })).toBeNull();
  });
});

describe('walker radar', () => {
  const nearby = (overrides: Partial<NearbyWalkers>): NearbyWalkers => ({
    count: 4,
    eligible: 2,
    nearestKm: 0.4,
    arrival: { minMinutes: 15, maxMinutes: 30 },
    ...overrides,
  });

  test('counts who could take this dog near its tower, with the temperament badge', () => {
    expect(radarLine(nearby({}), { society: { societyId: 'x', tower: 'A', flat: '1' }, temperament: 'friendly' })).toEqual({
      text: '2 Society Walkers available near Tower A',
      badge: '🟢 Low-Pull Approved',
    });
    expect(radarLine(nearby({ eligible: 1 }), { society: null, temperament: 'pulls' }).text).toBe(
      '1 Society Walker available near you'
    );
  });

  test('nobody nearby: no count and no arrival window', () => {
    const empty = nearby({ count: 0, eligible: 0, arrival: null });
    expect(radarLine(empty, { society: null, temperament: 'friendly' })).toEqual({ text: NOBODY_FREE, badge: null });
    expect(walkersActiveLine(empty)).toBe(NOBODY_FREE);
    expect(arrivalLine(empty)).toBeNull();
    expect(arrivalLine(undefined)).toBeNull();
  });

  test('top bar and arrival copy', () => {
    expect(walkersActiveLine(nearby({}))).toBe('4 Walkers Active in Society');
    expect(walkersActiveLine(nearby({ count: 1 }))).toBe('1 Walker Active in Society');
    expect(arrivalLine(nearby({}))).toBe('Arrives in 15–30 mins');
  });
});

describe('prices come from /pricing', () => {
  test('the chosen express length shows its server price, peak included as sent', () => {
    expect(expressChoice(PRICING, 45)).toEqual({ minutes: 45, price: 379 });
    const peak = { ...PRICING, peak: true, express: PRICING.express.map((e) => ({ ...e, price: e.price + 50 })) };
    expect(expressChoice(peak, 60)).toEqual({ minutes: 60, price: 499 });
  });

  test('a length the server doesn’t offer falls back to its shortest', () => {
    expect(expressChoice({ ...PRICING, express: [{ minutes: 30, price: 310 }] }, 60)).toEqual({ minutes: 30, price: 310 });
  });

  test('the plan pitch reads per-walk price and walk count from the server', () => {
    expect(planPriceLine(PRICING)).toBe('₹120/walk × 26 walks');
    expect(
      planPriceLine({ ...PRICING, subscription: { perWalk: 135, walks: 24, total: 3240, minutes: 30, slots: [] } })
    ).toBe('₹135/walk × 24 walks');
  });
});

describe('pack card copy', () => {
  test('next walk line in India time', () => {
    expect(nextWalkLine(pack().nextWalk, NOW)).toBe('Next walk begins tomorrow morning');
    expect(
      nextWalkLine({ bookingId: 'x', scheduledFor: ist('2026-10-25', 18), date: '2026-10-25', status: 'assigned', pickupOtp: null }, NOW)
    ).toBe('Next walk begins this evening');
    expect(
      nextWalkLine({ bookingId: null, scheduledFor: ist('2026-10-28', 7), date: '2026-10-28', status: 'scheduled', pickupOtp: null }, NOW)
    ).toBe('Next walk: Wednesday morning');
    expect(nextWalkLine({ ...pack().nextWalk!, status: 'active' }, NOW)).toMatch(/under way/);
    expect(nextWalkLine(null, NOW)).toBe('No walks left in this pack');
  });

  test('accent line leaves out what the server didn’t send', () => {
    expect(packAccentLine(pack())).toBe('8 walks left • ₹120/walk');
    expect(packAccentLine(pack({ walksLeft: 1 }))).toBe('1 walk left • ₹120/walk');
    expect(packAccentLine(pack({ walksLeft: null }))).toBe('₹120/walk');
    expect(packAccentLine(pack({ walksLeft: null, perWalk: null }))).toBeNull();
  });

  test('skip label names the day', () => {
    expect(skipLabel(pack().nextWalk, NOW)).toBe('Skip tomorrow’s walk');
    expect(skipLabel({ ...pack().nextWalk!, status: 'active' }, NOW)).toBeNull();
    expect(skipLabel(null, NOW)).toBeNull();
  });

  test('reschedule offers the batch slots: 6:00–9:00 AM and 5:00–8:00 PM every 30 minutes', () => {
    expect(PACK_SLOTS).toEqual([360, 390, 420, 450, 480, 510, 540, 1020, 1050, 1080, 1110, 1140, 1170, 1200]);
  });

  test('the slot list comes from /pricing when the server sends one', () => {
    const slots = [
      { slotMinute: 420, label: '7:00 – 7:30 AM' },
      { slotMinute: 1080, label: '6:00 – 6:30 PM' },
    ];
    expect(packSlots({ ...PRICING, subscription: { ...PRICING.subscription, slots } })).toEqual(slots);
    // Before /pricing answers (or from an older server): the same 14 batch slots, labelled.
    const fallback = packSlots(undefined);
    expect(fallback).toHaveLength(14);
    expect(fallback[0]).toEqual({ slotMinute: 360, label: '6:00 – 6:30 AM' });
    expect(fallback[13]).toEqual({ slotMinute: 1200, label: '8:00 – 8:30 PM' });
  });
});

describe('day words', () => {
  test('ahead', () => {
    expect(dayWordAhead('2026-10-25', NOW)).toBe('today');
    expect(dayWordAhead('2026-10-26', NOW)).toBe('tomorrow');
    expect(dayWordAhead('2026-10-30', NOW)).toBe('Friday');
    expect(dayWordAhead('2026-11-12', NOW)).toBe('12 Nov');
  });

  test('past, in India time even near midnight', () => {
    expect(dayWordPast(ist('2026-10-25', 0, 10), NOW)).toBe('Today');
    expect(dayWordPast(ist('2026-10-24', 23, 50), NOW)).toBe('Yesterday');
    expect(dayWordPast(ist('2026-10-21', 9), NOW)).toBe('Wednesday');
    expect(dayWordPast(ist('2026-10-02', 9), NOW)).toBe('2 Oct');
  });
});

describe('proofCard', () => {
  const walk = booking({
    status: 'completed',
    startedAt: ist('2026-10-24', 17, 45),
    completedAt: ist('2026-10-24', 18, 15),
    scheduledFor: ist('2026-10-24', 17, 45),
    distanceKm: 1.45,
    walker: { id: 'w1', name: 'Rohan Deshmukh', initials: 'RD', rating: null, verified: true },
    events: [
      { type: 'pee', at: 1, lat: null, lng: null, note: null },
      { type: 'pee', at: 2, lat: null, lng: null, note: null },
      { type: 'poop', at: 3, lat: null, lng: null, note: null },
      { type: 'photo', at: 4, lat: null, lng: null, note: null },
    ],
  });

  test('reads distance, walker, time and events from the booking', () => {
    expect(proofCard(walk, NOW)).toEqual({
      title: 'Yesterday • 1.45 km Walked',
      subtitle: 'Evening society loop with Rohan',
      time: '6:15 PM',
      pee: 2,
      poop: 1,
      photo: true,
    });
  });

  test('no photo event → no photo pill; no distance yet → no km', () => {
    const plain = proofCard({ ...walk, events: [], distanceKm: null, walker: null, society: null }, NOW);
    expect(plain).toMatchObject({ title: 'Yesterday • Walk complete', subtitle: 'Evening walk', photo: false, pee: 0 });
  });
});

describe('upcomingRow', () => {
  test('day, India-time clock and status', () => {
    expect(upcomingRow(booking({ scheduledFor: ist('2026-10-26', 7), status: 'assigned' }), NOW)).toEqual({
      when: 'Tomorrow • 7:00 AM',
      status: 'Walker assigned',
    });
    expect(upcomingRow(booking({ scheduledFor: ist('2026-10-29', 17, 30) }), NOW).when).toBe('Thu, 29 Oct • 5:30 PM');
  });
});
