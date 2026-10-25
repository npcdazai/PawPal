import { clearSession } from '../src/auth/session';
import { createBooking } from '../src/api/bookings';
import { getNearbyWalkers, getPricing, getWeather } from '../src/api/home';
import { initialsOf, parseNearby, parsePricing, parseSubscription, parseSubscriptions } from '../src/api/parse';
import { isWeatherOff } from '../src/api/queries';
import { cancelSubscription, changeSubscriptionSlot, listSubscriptions, skipSubscriptionWalk } from '../src/api/subscriptions';
import { ApiError } from '../src/api/errors';

// Jest can't load @sentry/react-native's ESM build here; without a DSN its calls are no-ops anyway.
jest.mock('../src/monitoring/sentry', () => ({ initMonitoring: jest.fn(), Sentry: { captureException: jest.fn() } }));

const respond = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
let logSpy: jest.SpyInstance;

beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await clearSession();
});

afterEach(() => logSpy.mockRestore());

const PRICING = {
  currency: 'INR',
  peak: false,
  peakWindows: ['07:00–09:00', '17:00–19:00'],
  express: [
    { minutes: 60, price: 449 },
    { minutes: 30, price: 299 },
    { minutes: 45, price: 379 },
  ],
  subscription: {
    perWalk: 120,
    walks: 26,
    total: 3120,
    minutes: 30,
    // A malformed entry is dropped, never guessed at.
    slots: [{ slotMinute: 360, label: '6:00 – 6:30 AM' }, { slotMinute: 1170, label: '7:30 – 8:00 PM' }, { label: 'x' }],
  },
  trial: { price: 99, minutes: 15 },
};

const PACK = {
  id: 'p1',
  status: 'active',
  dog: { name: 'Barnaby', breed: 'Corgi', size: 'medium', temperament: 'friendly', notes: '' },
  pickup: { lat: 19.1, lng: 72.9, address: 'Hiranandani Estate' },
  society: { societyId: 'hiranandani', tower: 'A', flat: '1402' },
  walksTotal: 26,
  walksBooked: 18,
  walksDone: 17,
  walksLeft: 8,
  perWalk: 120,
  slotMinute: 420,
  slotLabel: '7:00 – 7:30 AM',
  skipDates: ['2026-10-27'],
  nextWalk: { bookingId: 'b1', scheduledFor: 1792900000000, date: '2026-10-26', status: 'assigned', pickupOtp: '7391' },
  walker: { id: 'w1', name: 'Rohan Deshmukh', initials: 'RD', rating: { average: 4.96, count: 25 }, verified: true, gatePass: '4092' },
  backup: { id: 'w2', name: 'Pratik K.', initials: 'PK' },
};

describe('GET /pricing', () => {
  test('reads the server’s prices, express sorted by length', async () => {
    fetchMock.mockResolvedValue(respond(200, PRICING));
    const pricing = await getPricing();
    expect(pricing.express).toEqual([
      { minutes: 30, price: 299 },
      { minutes: 45, price: 379 },
      { minutes: 60, price: 449 },
    ]);
    expect(pricing.subscription).toEqual({
      perWalk: 120,
      walks: 26,
      total: 3120,
      minutes: 30,
      slots: [
        { slotMinute: 360, label: '6:00 – 6:30 AM' },
        { slotMinute: 1170, label: '7:30 – 8:00 PM' },
      ],
    });
    expect(pricing.trial.price).toBe(99);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/pricing$/);
  });

  test('asks for a moment when given one; peak prices come through untouched', async () => {
    fetchMock.mockResolvedValue(
      respond(200, { ...PRICING, peak: true, express: [{ minutes: 30, price: 349 }, { minutes: 45, price: 429 }] })
    );
    const pricing = await getPricing(1792876932443);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/pricing\?at=1792876932443$/);
    expect(pricing.peak).toBe(true);
    expect(pricing.express.map((e) => e.price)).toEqual([349, 429]);
  });

  test('a reply without express prices is unreadable, never filled in', () => {
    expect(() => parsePricing({ ...PRICING, express: [] })).toThrow(ApiError);
    expect(() => parsePricing({ ...PRICING, express: [{ minutes: 20, price: 199 }] })).toThrow(ApiError);
    expect(() => parsePricing({ ...PRICING, subscription: undefined })).toThrow(ApiError);
  });
});

describe('GET /walkers/nearby', () => {
  test('sends the pickup point and temperament', async () => {
    fetchMock.mockResolvedValue(respond(200, { count: 2, eligible: 2, nearestKm: 0.4, arrival: { minMinutes: 15, maxMinutes: 30 } }));
    await expect(getNearbyWalkers({ lat: 19.25851234, lng: 72.97126 }, 'pulls')).resolves.toEqual({
      count: 2,
      eligible: 2,
      nearestKm: 0.4,
      arrival: { minMinutes: 15, maxMinutes: 30 },
    });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/walkers\/nearby\?lat=19\.2585&lng=72\.9713&temperament=pulls$/);
  });

  test('no arrival window when nobody is eligible; eligible defaults to count', () => {
    expect(parseNearby({ count: 3, eligible: 0, nearestKm: null, arrival: { minMinutes: 10, maxMinutes: 25 } }).arrival).toBeNull();
    expect(parseNearby({ count: 3, nearestKm: 1 })).toMatchObject({ count: 3, eligible: 3, arrival: null });
    expect(() => parseNearby({ eligible: 1 })).toThrow(ApiError);
  });
});

describe('GET /weather', () => {
  test('reads the temperature and icon', async () => {
    fetchMock.mockResolvedValue(respond(200, { tempC: 28.4, condition: 'clear', icon: '☀️', updatedAt: 1 }));
    await expect(getWeather({ lat: 19.1, lng: 72.9 })).resolves.toEqual({
      tempC: 28.4,
      condition: 'clear',
      icon: '☀️',
      updatedAt: 1,
    });
  });

  test('503 weather_unavailable is recognised so the pill hides', async () => {
    fetchMock.mockResolvedValue(
      respond(503, { error: { code: 'weather_unavailable', message: 'Weather isn’t available right now.' } })
    );
    const error = await getWeather({ lat: 19.1, lng: 72.9 }).catch((e: unknown) => e);
    expect(isWeatherOff(error)).toBe(true);
    expect(isWeatherOff(new ApiError(0, 'network', 'offline'))).toBe(false);
  });
});

describe('subscriptions', () => {
  test('GET /subscriptions reads the pack view', async () => {
    fetchMock.mockResolvedValue(respond(200, { subscriptions: [PACK] }));
    const [pack] = await listSubscriptions();
    expect(pack).toMatchObject({
      id: 'p1',
      walksBooked: 18,
      walksLeft: 8,
      perWalk: 120,
      slotLabel: '7:00 – 7:30 AM',
      nextWalk: { bookingId: 'b1', pickupOtp: '7391', status: 'assigned' },
      walker: { name: 'Rohan Deshmukh', initials: 'RD', gatePass: '4092', verified: true },
      backup: { name: 'Pratik K.', initials: 'PK' },
    });
  });

  test('an older server’s pack: missing figures stay null, the slot label is formatted from the minute', () => {
    const pack = parseSubscription({
      id: 'p0',
      status: 'active',
      walksTotal: 26,
      walksBooked: 3,
      slotMinute: 1050,
      dog: PACK.dog,
      pickup: PACK.pickup,
      society: null,
    });
    expect(pack).toMatchObject({
      walksLeft: null,
      perWalk: null,
      walksDone: null,
      slotLabel: '5:30 – 6:00 PM',
      nextWalk: null,
      walker: null,
      backup: null,
    });
  });

  test('unreadable packs are dropped; a body without the list is an error', () => {
    expect(parseSubscriptions({ subscriptions: [PACK, { id: 'broken' }] })).toHaveLength(1);
    expect(() => parseSubscriptions({})).toThrow(ApiError);
  });

  test('walker without initials or rating', () => {
    const pack = parseSubscription({ ...PACK, walker: { id: 'w', name: 'Sneha Patil', verified: false, rating: null } });
    expect(pack?.walker).toEqual({ id: 'w', name: 'Sneha Patil', initials: 'SP', rating: null, verified: false, gatePass: null });
    expect(initialsOf('Imran')).toBe('I');
  });

  test('skip, change time and cancel send the right calls and read the pack back', async () => {
    fetchMock.mockResolvedValue(respond(200, { subscription: PACK }));

    await skipSubscriptionWalk('p1', '2026-10-26');
    await changeSubscriptionSlot('p1', 1050);
    await cancelSubscription('p1');
    await skipSubscriptionWalk('p1');

    const calls = fetchMock.mock.calls.map(([url, init]) => [init.method, url.replace(/^https?:\/\/[^/]+/, ''), init.body]);
    expect(calls).toEqual([
      ['POST', '/subscriptions/p1/skip', '{"date":"2026-10-26"}'],
      ['PATCH', '/subscriptions/p1', '{"slotMinute":1050}'],
      ['POST', '/subscriptions/p1/cancel', undefined],
      ['POST', '/subscriptions/p1/skip', '{}'],
    ]);
  });

  test('a refusal comes back with the server’s message', async () => {
    fetchMock.mockResolvedValue(
      respond(409, { error: { code: 'cannot_skip', message: 'That walk has already started.' } })
    );
    await expect(skipSubscriptionWalk('p1')).rejects.toMatchObject({ code: 'cannot_skip', message: 'That walk has already started.' });
  });
});

describe('POST /bookings', () => {
  test('sends express minutes', async () => {
    fetchMock.mockResolvedValue(respond(201, { booking: { id: 'b1', tier: 'express', minutes: 45, price: 379 } }));
    await createBooking({
      tier: 'express',
      minutes: 45,
      dog: { name: 'Barnaby', breed: 'Corgi', size: 'medium' },
      pickup: { lat: 19.1, lng: 72.9, address: 'Tower A' },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ tier: 'express', minutes: 45 });
  });
});
