import { bookingPollInterval } from '../src/api/queries';
import { notificationHref } from '../src/notifications/notificationRoutes';

// Jest can't load @sentry/react-native's ESM build here; without a DSN its calls are no-ops anyway.
jest.mock('../src/monitoring/sentry', () => ({ initMonitoring: jest.fn(), Sentry: { captureException: jest.fn() } }));

describe('notificationHref', () => {
  test('a booking push opens that booking’s tracking screen', () => {
    expect(notificationHref({ type: 'booking', bookingId: 'b-1' })).toEqual({
      pathname: '/walk-tracking',
      params: { id: 'b-1' },
    });
  });

  test('a walk event opens the live walk', () => {
    expect(notificationHref({ type: 'walk_event', bookingId: 'b-1', event: 'pee' })).toEqual({
      pathname: '/live-walk',
      params: { id: 'b-1' },
    });
  });

  test.each([
    [{ type: 'offer', bookingId: 'b-1' }],
    [{ type: 'verification' }],
    [{ type: 'booking' }],
    [{ type: 'booking', bookingId: '  ' }],
    [{ type: 'booking', bookingId: 42 }],
    [null],
    [undefined],
  ])('stays put for %p', (data) => {
    expect(notificationHref(data)).toBeNull();
  });
});

describe('bookingPollInterval', () => {
  test('5 s while a walker is on the way or walking, 10 s while waiting', () => {
    expect(bookingPollInterval('assigned')).toBe(5_000);
    expect(bookingPollInterval('active')).toBe(5_000);
    expect(bookingPollInterval('searching')).toBe(10_000);
    expect(bookingPollInterval('awaiting_payment')).toBe(10_000);
  });

  test('no polling once nothing more will happen', () => {
    expect(bookingPollInterval('completed')).toBe(false);
    expect(bookingPollInterval('cancelled')).toBe(false);
    expect(bookingPollInterval('unmatched')).toBe(false);
    expect(bookingPollInterval(undefined)).toBe(false);
  });
});
