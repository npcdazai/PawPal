import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BookingsProvider } from '../src/booking/BookingsProvider';
import { MascotProvider } from '../src/mascot/MascotProvider';
import { DashboardScreen } from '../src/screens/DashboardScreen';

// Jest can't load @sentry/react-native's ESM build here; without a DSN its calls are no-ops anyway.
jest.mock('../src/monitoring/sentry', () => ({ initMonitoring: jest.fn(), Sentry: { captureException: jest.fn() } }));

// @expo/vector-icons needs expo-asset, which isn't installed for tests.
jest.mock('../src/components/Icon', () => ({ Icon: () => null }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    dismissTo: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: () => false,
    canDismiss: () => false,
  }),
  useNavigationContainerRef: () => ({ isReady: () => false }),
}));

const NOW = Date.now();

const PRICING = {
  currency: 'INR',
  peak: false,
  peakWindows: ['07:00–09:00', '17:00–19:00'],
  express: [
    { minutes: 30, price: 299 },
    { minutes: 45, price: 379 },
    { minutes: 60, price: 449 },
  ],
  subscription: { perWalk: 120, walks: 26, total: 3120, minutes: 30 },
  trial: { price: 99, minutes: 15 },
};

const BOOKING = {
  id: 'b1',
  customerId: 'c1',
  status: 'active',
  tier: 'subscription',
  minutes: 30,
  price: 120,
  currency: 'INR',
  payout: 102,
  scheduledFor: NOW - 600_000,
  dog: { name: 'Bruno', breed: 'Indie', size: 'medium', temperament: 'friendly', notes: '' },
  pickup: { lat: 19.2585, lng: 72.9712, address: 'Hiranandani Estate, Thane' },
  society: { societyId: 'hiranandani', tower: 'Wing B', flat: '1402' },
  payment: { provider: 'subscription', status: 'prepaid', amount: 0 },
  subscriptionId: 'p1',
  partnerId: 'w1',
  pickupOtp: '7391',
  walkerLocation: null,
  shiftVerifiedAt: NOW - 500_000,
  insurance: { active: true, coverInr: 15000, activatedAt: NOW - 500_000 },
  events: [],
  track: [],
  rating: null,
  createdAt: NOW - 86_400_000,
  updatedAt: NOW,
  startedAt: NOW - 500_000,
  completedAt: null,
  walker: { id: 'w1', name: 'Rohan Deshmukh', initials: 'RD', rating: { average: 4.96, count: 25 }, verified: true },
  distanceKm: null,
};

type Routes = Record<string, { status: number; body: unknown }>;

function serve(routes: Routes) {
  globalThis.fetch = jest.fn(async (url: string) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]!;
    const route = routes[path] ?? { status: 404, body: { error: { code: 'not_found', message: 'No such endpoint.' } } };
    return { status: route.status, ok: route.status < 300, json: async () => route.body } as unknown as Response;
  }) as unknown as typeof fetch;
}

let client: QueryClient;

async function renderDashboard() {
  // No garbage-collection timers, so nothing keeps Jest running after the screen unmounts.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 411, height: 891 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={client}>
        <MascotProvider>
          <BookingsProvider>
            <DashboardScreen />
          </BookingsProvider>
        </MascotProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

let logSpy: jest.SpyInstance;
beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  mockPush.mockReset();
});
afterEach(() => {
  client.clear();
  logSpy.mockRestore();
});

test('a new customer: start-a-plan card priced from /pricing, express chips from /pricing, no proof card', async () => {
  serve({
    '/pricing': { status: 200, body: PRICING },
    '/subscriptions': { status: 200, body: { subscriptions: [] } },
    '/bookings': { status: 200, body: { bookings: [] } },
    '/me': { status: 200, body: { user: { id: 'u', phone: '+911', name: 'Bharat Dev', email: null, apps: ['customer'] }, app: 'customer', partner: null } },
  });
  await renderDashboard();

  expect(await screen.findByText('Start a monthly society plan')).toBeOnTheScreen();
  expect(screen.getByText(/₹120\/walk × 26 walks/)).toBeOnTheScreen();
  expect(screen.getByText('30 Mins (₹299)')).toBeOnTheScreen();
  expect(screen.getByText('45 Mins (₹379)')).toBeOnTheScreen();
  expect(screen.getByText('⚡ Book Instant Walk Now (₹299)')).toBeOnTheScreen();
  // Neutral insurance line, generic greeting, nothing about a last walk.
  expect(screen.getByText('🛡️ INSURED SOCIETY WALKS')).toBeOnTheScreen();
  expect(screen.getByText('Ready for a walk? 🐾')).toBeOnTheScreen();
  expect(screen.queryByText(/km Walked|Walk complete/)).toBeNull();
  expect(screen.getByText('BD')).toBeOnTheScreen();

  // Picking 45 minutes updates the header price and the CTA.
  await act(async () => fireEvent.press(screen.getByText('45 Mins (₹379)')));
  expect(screen.getByText('⚡ Book Instant Walk Now (₹379)')).toBeOnTheScreen();
  expect(screen.getByText(/\/ 45 Mins/)).toBeOnTheScreen();
});

test('a walk under way: cover amount from the booking, pack card, radar, weather hidden on 503', async () => {
  serve({
    '/pricing': { status: 200, body: PRICING },
    '/subscriptions': {
      status: 200,
      body: {
        subscriptions: [
          {
            id: 'p1',
            status: 'active',
            dog: BOOKING.dog,
            pickup: BOOKING.pickup,
            society: BOOKING.society,
            walksTotal: 26,
            walksBooked: 18,
            walksDone: 17,
            walksLeft: 8,
            perWalk: 120,
            slotMinute: 420,
            slotLabel: '7:00 – 7:30 AM',
            skipDates: [],
            nextWalk: { bookingId: 'b2', scheduledFor: NOW + 86_400_000, date: '2099-01-01', status: 'assigned', pickupOtp: '5521' },
            walker: { id: 'w1', name: 'Rohan Deshmukh', initials: 'RD', rating: { average: 4.96, count: 25 }, verified: true, gatePass: '4092' },
            backup: { id: 'w2', name: 'Pratik K.', initials: 'PK' },
          },
        ],
      },
    },
    '/bookings': { status: 200, body: { bookings: [BOOKING] } },
    '/walkers/nearby': { status: 200, body: { count: 0, eligible: 0, nearestKm: null, arrival: null } },
    '/weather': { status: 503, body: { error: { code: 'weather_unavailable', message: 'No weather.' } } },
    '/me': { status: 200, body: { user: { id: 'u', phone: '+911', name: '', email: null, apps: ['customer'] }, app: 'customer', partner: null } },
  });
  await renderDashboard();

  expect(await screen.findByText('Daily 7:00 – 7:30 AM Slot')).toBeOnTheScreen();
  expect(screen.getByText('🛡️ ₹15,000 WALK VET COVER ACTIVE')).toBeOnTheScreen();
  expect(screen.getByText('Ready for a walk, Bruno? 🐾')).toBeOnTheScreen();
  expect(screen.getByText('8 walks left • ₹120/walk')).toBeOnTheScreen();
  expect(screen.getByText('🔑 View OTP (5521)')).toBeOnTheScreen();
  expect(screen.getByText('Hiranandani Estate • Wing B, 1402')).toBeOnTheScreen();
  // Top bar and radar strip both say so; no count, no arrival window.
  expect(await screen.findAllByText(/No walkers free right now/)).toHaveLength(2);
  expect(screen.queryByText(/Arrives in/)).toBeNull();
  expect(screen.queryByText(/°C/)).toBeNull();

  // The call button never dials: masked calling isn't built yet.
  await act(async () => fireEvent.press(screen.getByLabelText('Call Rohan Deshmukh')));
  expect(screen.getByText('Calling your walker is coming soon')).toBeOnTheScreen();
});

test('errors become retry rows, not a blank screen', async () => {
  serve({
    '/pricing': { status: 500, body: { error: { code: 'internal', message: 'Something went wrong on our side.' } } },
    '/subscriptions': { status: 500, body: { error: { code: 'internal', message: 'Something went wrong on our side.' } } },
    '/bookings': { status: 500, body: { error: { code: 'internal', message: 'Something went wrong on our side.' } } },
    '/me': { status: 500, body: {} },
  });
  await renderDashboard();

  expect(await screen.findByText('Couldn’t load your monthly plan.')).toBeOnTheScreen();
  expect(screen.getByText('Couldn’t load today’s prices.')).toBeOnTheScreen();
  expect(screen.getByText('Couldn’t load your walks.')).toBeOnTheScreen();
  expect(screen.getAllByText('Retry')).toHaveLength(3);
  // The express card still lets you start a booking (the server prices it).
  expect(screen.getByText('⚡ Book Instant Walk Now')).toBeOnTheScreen();
});
