/** Codes the app adds for failures that never reached the server. */
export type ClientErrorCode = 'network' | 'timeout' | 'bad_response';

/**
 * A failed API call. `message` is user-facing copy (the server writes it for
 * people); branch on `code`. `status` is 0 when no response arrived.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  /** Worth trying again: no answer, or the server or a service behind it was down. */
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** Copy for an inline error state, whatever was thrown. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isApiError(error)) return error.message;
  return fallback;
}

/**
 * `{ error: { code, message } }` from the server, or a generic error for a
 * body that isn't one (a proxy's HTML page, say).
 */
export function apiErrorFrom(status: number, body: unknown): ApiError {
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (error && typeof error.code === 'string' && typeof error.message === 'string') {
    return new ApiError(status, error.code, error.message);
  }
  return new ApiError(
    status,
    `http_${status}`,
    status >= 500 ? 'PawPal is having trouble right now. Try again in a moment.' : 'Something went wrong. Try again.'
  );
}
