import { clearSession, sessionToken } from '../auth/session';
import { devLog, logApiCall, unreachableHint } from '../monitoring/devLog';
import { fetchWithTimeout } from '../net/fetchWithTimeout';
import { apiBaseUrl } from './config';
import { ApiError, apiErrorFrom } from './errors';

/** APP_INTEGRATION §8: the default request timeout. */
const DEFAULT_TIMEOUT_MS = 30_000;

const authLog = devLog('auth');

const TIMEOUT_COPY = 'PawPal took too long to answer. Check your connection and try again.';

/**
 * No answer at all. Development builds name the address and the likely fix
 * (usually the USB phone's missing port forward); release builds keep the
 * plain copy.
 */
function unreachableCopy(base: string): string {
  return __DEV__
    ? `Couldn’t reach the PawPal API at ${base}.${unreachableHint(base)}`
    : 'Couldn’t reach PawPal. Check your connection and try again.';
}

/** The path as logged: DELETE /devices/<push token> carries the token, which never reaches a log. */
const pathForLog = (path: string) => path.replace(/^\/devices\/[^/?]+/, '/devices/[hidden]');

export type QueryParams = Record<string, string | number | undefined>;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  query?: QueryParams;
  timeoutMs?: number;
}

/** "?a=1&b=x%20y" from the defined params, or "" when there are none. */
export function queryString(params: QueryParams | undefined): string {
  const pairs = Object.entries(params ?? {}).flatMap(([key, value]) =>
    value === undefined ? [] : [`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`]
  );
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}

/**
 * One call to the PawPal API with the signed-in session. Resolves with the
 * JSON body (undefined for 204). Rejects with an ApiError carrying the server's
 * `{ error: { code, message } }`, or code `network` / `timeout` when no answer
 * arrived. A 401 `session_required` also ends the session, which sends the app
 * back to sign-in. Each call prints one development console line (logApiCall).
 */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, query, timeoutMs = DEFAULT_TIMEOUT_MS }: ApiRequestOptions = {}
): Promise<T> {
  const base = apiBaseUrl();
  const target = `${path}${queryString(query)}`;
  const token = sessionToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  // The development console line: the JSON body (redacted there), never the headers.
  const started = Date.now();
  const logCall = (status: number, problem?: ApiError) =>
    logApiCall({
      method,
      path: pathForLog(target),
      status,
      ms: Date.now() - started,
      body,
      problem: problem && { code: problem.code, message: problem.message },
      baseUrl: status === 0 ? base : undefined,
    });

  let response: Response;
  try {
    response = await fetchWithTimeout(`${base}${target}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      timeoutMs,
    });
  } catch (cause) {
    const timedOut = (cause as { name?: unknown } | null)?.name === 'AbortError';
    const error = new ApiError(0, timedOut ? 'timeout' : 'network', timedOut ? TIMEOUT_COPY : unreachableCopy(base));
    logCall(0, error);
    throw error;
  }

  if (response.status === 204) {
    logCall(204);
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Not JSON (or cut off): handled below.
  }

  if (!response.ok) {
    const error = apiErrorFrom(response.status, payload);
    logCall(response.status, error);
    // Only the session this request carried; a newer sign-in stays.
    if (error.status === 401 && error.code === 'session_required' && token && sessionToken() === token) {
      authLog.warn('Session expired: signing out', { reason: error.code, path: pathForLog(path) });
      void clearSession();
    }
    throw error;
  }
  if (payload === null) {
    const error = new ApiError(response.status, 'bad_response', 'PawPal sent an answer the app couldn’t read. Try again.');
    logCall(response.status, error);
    throw error;
  }
  logCall(response.status);
  return payload as T;
}
