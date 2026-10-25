import { apiRequest, queryString } from '../src/api/client';
import { apiBaseUrl } from '../src/api/config';
import { ApiError, apiErrorFrom, errorMessage } from '../src/api/errors';
import { shouldRetry } from '../src/api/queryClient';
import { clearSession, onSessionCleared, saveSession, sessionToken } from '../src/auth/session';
import { unreachableHint } from '../src/monitoring/devLog';

// Jest can't load @sentry/react-native's ESM build here; without a DSN its calls are no-ops anyway.
jest.mock('../src/monitoring/sentry', () => ({ initMonitoring: jest.fn(), Sentry: { captureException: jest.fn() } }));

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
  }) as unknown as Response;

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();

/** Every development console line printed during the test. */
let lines: string[] = [];
let logSpy: jest.SpyInstance;

beforeEach(async () => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  lines = [];
  logSpy = jest.spyOn(console, 'log').mockImplementation((line: string) => {
    lines.push(line);
  });
  await clearSession();
});

afterEach(() => logSpy.mockRestore());

const apiLines = () => lines.filter((line) => / api {4}/.test(line));

describe('queryString', () => {
  test('encodes the defined params', () => {
    expect(queryString({ from: '19.11760,72.90600', input: 'Tower A', lat: undefined })).toBe(
      '?from=19.11760%2C72.90600&input=Tower%20A'
    );
  });

  test('is empty without params', () => {
    expect(queryString(undefined)).toBe('');
    expect(queryString({ lat: undefined })).toBe('');
  });
});

describe('apiRequest', () => {
  test('sends the session and JSON body, and returns the parsed answer', async () => {
    await saveSession('session-1');
    fetchMock.mockResolvedValue(respond(200, { user: { id: 'u1' } }));

    await expect(apiRequest('/me', { method: 'PATCH', body: { name: 'Maya' } })).resolves.toEqual({
      user: { id: 'u1' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/^https?:\/\/[^/]+\/me$/);
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"name":"Maya"}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer session-1',
      'Content-Type': 'application/json',
    });
  });

  test('resolves 204 with nothing', async () => {
    fetchMock.mockResolvedValue(respond(204));
    await expect(apiRequest('/devices', { method: 'POST', body: { token: 't' } })).resolves.toBeUndefined();
  });

  test('turns the server’s error body into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      respond(409, { error: { code: 'walk_in_progress', message: 'Finish or cancel your current walk first.' } })
    );
    const error = await apiRequest('/me', { method: 'DELETE' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'walk_in_progress', message: 'Finish or cancel your current walk first.' });
  });

  test('a 401 session_required ends the session', async () => {
    await saveSession('stale');
    const cleared = jest.fn();
    const unsubscribe = onSessionCleared(cleared);
    fetchMock.mockResolvedValue(respond(401, { error: { code: 'session_required', message: 'Sign in again.' } }));

    await expect(apiRequest('/bookings')).rejects.toMatchObject({ code: 'session_required' });
    await Promise.resolve();
    expect(sessionToken()).toBeNull();
    expect(cleared).toHaveBeenCalled();
    unsubscribe();
  });

  test('other 401s (a bad phone token) leave the session alone', async () => {
    await saveSession('kept');
    fetchMock.mockResolvedValue(respond(401, { error: { code: 'phone_token_used', message: 'Verify again.' } }));
    await expect(apiRequest('/auth/phone', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'phone_token_used',
    });
    expect(sessionToken()).toBe('kept');
  });

  test('no answer is a retryable network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const error = (await apiRequest('/bookings').catch((caught: unknown) => caught)) as ApiError;
    expect(error).toMatchObject({ status: 0, code: 'network' });
    expect(error.retryable).toBe(true);
  });

  test('an aborted request is a timeout', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    await expect(apiRequest('/bookings')).rejects.toMatchObject({ status: 0, code: 'timeout' });
  });

  test('a success that isn’t JSON is a bad response', async () => {
    fetchMock.mockResolvedValue(respond(200));
    await expect(apiRequest('/bookings')).rejects.toMatchObject({ code: 'bad_response' });
  });
});

describe('development console lines', () => {
  test('one line per call with status, path and query, and the redacted body, never the headers', async () => {
    await saveSession('session-secret-1');
    fetchMock.mockResolvedValueOnce(respond(200, { sessionToken: 'session-secret-2', user: { id: 'u1' } }));
    await apiRequest('/auth/phone', {
      method: 'POST',
      body: { token: 'dev:+919876543210', method: 'sms', code: '424242', app: 'customer' },
    });
    fetchMock.mockResolvedValueOnce(respond(200, { route: null }));
    await apiRequest('/maps/route', { query: { from: '19.1,72.9', to: undefined } });

    const [signIn, route] = apiLines();
    expect(signIn).toMatch(
      /✔ 200 POST \/auth\/phone · \d+ ms {2}\{ body: \{ token: \[hidden\], method: "sms", code: \[hidden\], app: "customer" \} \}$/
    );
    expect(route).toMatch(/✔ 200 GET \/maps\/route\?from=19\.1%2C72\.9 · \d+ ms$/);
    expect(lines.join('\n')).not.toMatch(/session-secret|Bearer|Authorization|424242|9876543210/);
  });

  test('a refusal prints the server’s code and message', async () => {
    fetchMock.mockResolvedValue(
      respond(409, { error: { code: 'walk_in_progress', message: 'Finish or cancel your current walk first.' } })
    );
    await apiRequest('/me', { method: 'DELETE' }).catch(() => undefined);
    expect(apiLines()).toEqual([
      expect.stringMatching(/✖ 409 DELETE \/me · \d+ ms · walk_in_progress: Finish or cancel your current walk first\.$/),
    ]);
  });

  test('no answer names the address and the likely fix', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await apiRequest('/bookings').catch(() => undefined);
    const base = apiBaseUrl();
    expect(apiLines()).toEqual([
      expect.stringContaining(`✖ network GET /bookings · `),
    ]);
    expect(apiLines()[0]).toContain(`can't reach ${base}.${unreachableHint(base)}`);
  });

  test('a push token in the path never reaches the console', async () => {
    fetchMock.mockResolvedValue(respond(204));
    await apiRequest(`/devices/${encodeURIComponent('fcm-token:abc/123')}`, { method: 'DELETE' });
    expect(apiLines()).toEqual([expect.stringMatching(/✔ 204 DELETE \/devices\/\[hidden\] · \d+ ms$/)]);
    expect(lines.join('\n')).not.toContain('fcm-token');
  });

  test('a 401 session_required also logs the sign-out', async () => {
    await saveSession('stale');
    fetchMock.mockResolvedValue(respond(401, { error: { code: 'session_required', message: 'Sign in again.' } }));
    await apiRequest('/bookings').catch(() => undefined);
    expect(lines.some((line) => /auth {3}⚠ Session expired: signing out/.test(line))).toBe(true);
  });
});

describe('the unreachable-API message', () => {
  const setDev = (value: boolean) => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
  };

  afterEach(() => setDev(true));

  test('development builds name the API address and the fix', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const error = (await apiRequest('/auth/phone/code', { method: 'POST', body: {} }).catch((caught: unknown) => caught)) as ApiError;
    const base = apiBaseUrl();
    expect(error).toMatchObject({ status: 0, code: 'network' });
    expect(error.message).toBe(`Couldn’t reach the PawPal API at ${base}.${unreachableHint(base)}`);
  });

  test('release builds keep the plain copy', async () => {
    apiBaseUrl(); // resolved (and cached) as a development build
    setDev(false);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiRequest('/bookings')).rejects.toMatchObject({
      code: 'network',
      message: 'Couldn’t reach PawPal. Check your connection and try again.',
    });
    expect(lines).toEqual([]);
  });
});

describe('apiErrorFrom', () => {
  test('falls back to generic copy for bodies that aren’t the API’s', () => {
    expect(apiErrorFrom(502, '<html>Bad gateway</html>')).toMatchObject({ status: 502, code: 'http_502' });
    expect(apiErrorFrom(404, null).message).toBe('Something went wrong. Try again.');
  });
});

describe('errorMessage', () => {
  test('shows the API’s copy, or the fallback for anything else', () => {
    expect(errorMessage(new ApiError(400, 'in_the_past', 'Pick a time that hasn’t passed.'))).toBe(
      'Pick a time that hasn’t passed.'
    );
    expect(errorMessage(new Error('boom'), 'Couldn’t save.')).toBe('Couldn’t save.');
  });
});

describe('shouldRetry', () => {
  test('retries no-answer and server errors, twice at most', () => {
    expect(shouldRetry(0, new ApiError(0, 'network', 'offline'))).toBe(true);
    expect(shouldRetry(1, new ApiError(503, 'maps_busy', 'busy'))).toBe(true);
    expect(shouldRetry(2, new ApiError(503, 'maps_busy', 'busy'))).toBe(false);
  });

  test('never retries what the server refused, or app bugs', () => {
    expect(shouldRetry(0, new ApiError(409, 'already_rated', 'Already rated.'))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, 'session_required', 'Sign in again.'))).toBe(false);
    expect(shouldRetry(0, new TypeError('x is undefined'))).toBe(false);
  });
});
