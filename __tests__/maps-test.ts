import { latLngParam, walkingRoute } from '../src/api/maps';
import { routeEnds } from '../src/booking/routing';

// Jest can't load @sentry/react-native's ESM build here; without a DSN its calls are no-ops anyway.
jest.mock('../src/monitoring/sentry', () => ({ initMonitoring: jest.fn(), Sentry: { captureException: jest.fn() } }));

describe('latLngParam', () => {
  test('lat,lng at 5 decimals', () => {
    expect(latLngParam({ lat: 19.117601234, lng: 72.906 })).toBe('19.11760,72.90600');
    expect(latLngParam({ lat: -33.8688, lng: 151.2093 })).toBe('-33.86880,151.20930');
  });
});

describe('routeEnds', () => {
  test('reads the two [lng, lat] points of a path as lat/lng', () => {
    expect(routeEnds('72.90600,19.11760;72.91000,19.12000')).toEqual({
      from: { lat: 19.1176, lng: 72.906 },
      to: { lat: 19.12, lng: 72.91 },
    });
  });

  test('only two-point paths can be routed', () => {
    expect(routeEnds('72.9,19.1')).toBeNull();
    expect(routeEnds('72.9,19.1;72.91,19.12;72.92,19.13')).toBeNull();
    expect(routeEnds('72.9,19.1;oops')).toBeNull();
  });
});

describe('walkingRoute', () => {
  test('asks /maps/route from → to and returns the route', async () => {
    const route = { distanceMeters: 420, durationSeconds: 300, coordinates: [[72.906, 19.1176], [72.91, 19.12]] };
    const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ route }),
    } as unknown as Response);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(walkingRoute({ lat: 19.1176, lng: 72.906 }, { lat: 19.12, lng: 72.91 })).resolves.toEqual(route);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/maps\/route\?from=19\.11760%2C72\.90600&to=19\.12000%2C72\.91000$/);
  });
});
