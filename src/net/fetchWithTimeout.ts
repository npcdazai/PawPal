const DEFAULT_TIMEOUT_MS = 10_000;

export interface FetchWithTimeoutInit extends Omit<RequestInit, 'signal'> {
  /** Give up after this long (ms). */
  timeoutMs?: number;
}

/**
 * fetch() that aborts if no response arrives within `timeoutMs`, rejecting
 * with an AbortError, so a stalled connection can't leave the caller (and a
 * spinner) waiting forever.
 */
export async function fetchWithTimeout(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: FetchWithTimeoutInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
