import {
  NAVIGATION,
  ROUTES,
  STACK_SCREENS,
  TABS,
  TAB_ROUTES,
  activeTabFor,
  resolveTabKey,
  routeForPath,
} from '../src/navigation/navigation';
import {
  clearPlanIntent,
  peekPlanIntent,
  planIntentFromParams,
  planIntentParams,
  setPlanIntent,
} from '../src/booking/planIntent';
import { amountDue, bookingRequest, needsPayment } from '../src/booking/bookingRequest';
import { APP_DOG, dogForBooking } from '../src/booking/dogProfile';
import { nextSlotTime } from '../src/booking/walkPlans';
import type { Booking } from '../src/api/types';

describe('tab bar config', () => {
  test('four tabs: Home, Book Walk, Subscription, Profile', () => {
    expect(TABS.map((tab) => tab.label)).toEqual(['Home', 'Book Walk', 'Subscription', 'Profile']);
  });

  test('Book Walk starts the booking flow at the society profile instead of showing a tab screen', () => {
    const bookWalk = TABS.find((tab) => tab.key === 'bookWalk')!;
    expect('flow' in bookWalk && bookWalk.flow).toBe('bookWalk');
    const flow = NAVIGATION.flows.bookWalk;
    expect(ROUTES[flow.to].path).toBe('/book-walk');
  });

  test('Home, Subscription and Profile are tab screens in tab order', () => {
    expect(TAB_ROUTES.map((route) => route.path)).toEqual(['/dashboard', '/subscription', '/profile']);
    expect(activeTabFor('dashboard')?.key).toBe('home');
    expect(activeTabFor('subscription')?.key).toBe('subscription');
    expect(activeTabFor('profile')?.key).toBe('profile');
    expect(routeForPath('/subscription')?.tabBar).toBe(true);
  });

  test('the old Activities / Health sections are gone; their keys still land somewhere', () => {
    const labels: readonly string[] = TABS.map((tab) => tab.label);
    expect(labels).not.toContain('Activities');
    expect(labels).not.toContain('Health');
    expect(resolveTabKey('activities')).toBe('subscription');
    expect(resolveTabKey('health')).toBe('home');
    expect(resolveTabKey('profile')).toBe('profile');
  });

  test('the root stack hosts the tab navigator once, and task screens hide the tab bar', () => {
    expect(STACK_SCREENS.filter((screen) => screen.name === '(tabs)')).toHaveLength(1);
    expect(routeForPath('/walk-plan')?.tabBar).toBe(false);
    expect(NAVIGATION.flows.planWalk).toEqual({ to: 'walkPlan', action: 'push' });
  });
});

describe('plan intent (home card → plan screen)', () => {
  afterEach(clearPlanIntent);

  test('held until taken or cleared', () => {
    setPlanIntent({ tier: 'express', minutes: 45 });
    expect(peekPlanIntent()).toEqual({ tier: 'express', minutes: 45 });
    clearPlanIntent();
    expect(peekPlanIntent()).toBeNull();
  });

  test('round-trips through route params', () => {
    expect(planIntentParams({ tier: 'express', minutes: 60 })).toEqual({ tier: 'express', minutes: '60' });
    expect(planIntentFromParams({ tier: 'express', minutes: '60' })).toEqual({ tier: 'express', minutes: 60 });
    expect(planIntentFromParams(planIntentParams({ tier: 'subscription' }))).toEqual({ tier: 'subscription' });
  });

  test('bad params: unknown tier → none; unknown length → 30', () => {
    expect(planIntentFromParams({})).toBeNull();
    expect(planIntentFromParams({ tier: 'vip' })).toBeNull();
    expect(planIntentFromParams({ tier: 'express', minutes: '50' })).toEqual({ tier: 'express', minutes: 30 });
  });
});

describe('bookingRequest', () => {
  const profile = {
    society: 'hiranandani' as const,
    tower: 'Wing B',
    flat: '1402',
    temperament: 'pulls' as const,
    gear: ['harness', 'otpHandover'] as const,
    notes: 'Scared of scooters',
  };

  test('express: minutes, no time (now), the tower lobby as pickup', () => {
    const request = bookingRequest({ profile, dog: APP_DOG, tier: 'express', minutes: 45, slotStart: null });
    expect(request).toMatchObject({
      tier: 'express',
      minutes: 45,
      dog: { name: 'Barnaby', breed: 'Corgi', size: 'medium', temperament: 'pulls' },
      society: { societyId: 'hiranandani', tower: 'Wing B', flat: '1402' },
      pickup: { address: '1402, Wing B, Hiranandani Estate, Thane' },
    });
    expect(request.scheduledFor).toBeUndefined();
    expect(request.dog.notes).toBe('Scared of scooters • Gear: Chest Harness Only, Doorstep OTP Handover');
    expect(request.pickup.lat).toBeCloseTo(19.2585, 2);
  });

  test('subscription: no minutes, starts at the slot’s next occurrence', () => {
    const now = new Date(2026, 9, 25, 15, 0);
    const request = bookingRequest({ profile, dog: APP_DOG, tier: 'subscription', minutes: 30, slotStart: 420, now });
    expect(request.minutes).toBeUndefined();
    expect(request.scheduledFor).toBe(new Date(2026, 9, 26, 7, 0).getTime());
  });

  test('nextSlotTime: later today when still ahead, else tomorrow', () => {
    const now = new Date(2026, 9, 25, 6, 50);
    expect(nextSlotTime(420, now)).toBe(new Date(2026, 9, 25, 7, 0).getTime());
    expect(nextSlotTime(390, now)).toBe(new Date(2026, 9, 26, 6, 30).getTime());
  });

  test('the dog from the server when it has one', () => {
    expect(dogForBooking({ name: 'Bruno', breed: 'Indie', size: 'large' })).toEqual({ name: 'Bruno', breed: 'Indie', size: 'large' });
    expect(dogForBooking({ name: 'Bruno', breed: 'Indie', size: 'huge' }).size).toBe('medium');
    expect(dogForBooking(null)).toBe(APP_DOG);
  });

  test('payment: what the server asks for', () => {
    const base = { status: 'searching', price: 120, payment: { status: 'not_required', amount: 0 } } as unknown as Booking;
    expect(needsPayment(base)).toBe(false);
    expect(amountDue(base)).toBe(120);
    const unpaid = { ...base, status: 'awaiting_payment', payment: { status: 'unpaid', amount: 3120 } } as unknown as Booking;
    expect(needsPayment(unpaid)).toBe(true);
    expect(amountDue(unpaid)).toBe(3120);
  });
});
