import type { YoupiConfig } from './youpiConfig';

/**
 * Client for YouPI PG's public payment API (openapi.yaml in youpi-pg/YouPI-PG):
 *   POST /api/v1/payments              create a session → checkoutUrl
 *   GET  /api/v1/payments/:id          poll its status
 *   POST /api/v1/checkout/:id/cancel   release it
 * The merchant id travels in the body: the gateway's CORS allow-list doesn't
 * include the X-Merchant-Id header, so the header would break web builds.
 */

/** Lifecycle from the API; the last four are final. */
export type YoupiStatus =
  | 'INITIATED' // created; the customer hasn't signed in on the checkout page yet
  | 'QUEUED' // waiting for the receiving UPI account (one payer at a time)
  | 'ACTIVE' // the customer's 5-minute window to pay is open
  | 'PROCESSING' // paid; matching the bank alert (up to 30s)
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED';

export type YoupiOutcome = 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

const OUTCOMES: readonly string[] = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'];
export const isOutcome = (status: string): status is YoupiOutcome => OUTCOMES.includes(status);

export interface YoupiPayment {
  paymentId: string;
  orderId: string;
  /** Rupees as a string, e.g. "350.00". */
  amount: string;
  status: string;
  queuePosition?: number;
  checkoutUrl?: string;
  completedAt?: string | null;
}

export type YoupiErrorKind = 'network' | 'timeout' | 'server' | 'duplicate' | 'blocked';

export class YoupiError extends Error {
  readonly kind: YoupiErrorKind;
  readonly httpStatus?: number;

  constructor(message: string, kind: YoupiErrorKind, httpStatus?: number) {
    super(message);
    this.name = 'YoupiError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

const REQUEST_TIMEOUT_MS = 15000;
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

const stringField = (data: unknown, key: string): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : undefined;
};

async function request<T>(config: YoupiConfig, path: string, body?: object): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted
      ? new YoupiError('The payment server took too long to answer.', 'timeout')
      : new YoupiError(`Can’t reach the payment server at ${config.baseUrl}.`, 'network');
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      stringField(data, 'message') ?? stringField(data, 'error') ?? `Payment server error (${response.status}).`;
    const kind: YoupiErrorKind = response.status === 409 ? 'duplicate' : response.status === 403 ? 'blocked' : 'server';
    throw new YoupiError(message, kind, response.status);
  }
  return data as T;
}

/**
 * A gateway behind `localhost` hands out localhost checkout links, which a
 * phone can't open; point them at the address the app reached it on instead.
 */
function reachableCheckoutUrl(config: YoupiConfig, checkoutUrl: string): string {
  try {
    const url = new URL(checkoutUrl);
    const base = new URL(config.baseUrl);
    if (LOOPBACK_HOSTS.includes(url.hostname) && url.hostname !== base.hostname) {
      return `${base.origin}${url.pathname}${url.search}`;
    }
  } catch {
    // Leave anything unparseable as the gateway sent it.
  }
  return checkoutUrl;
}

export interface CreatePaymentInput {
  orderId: string;
  /** Rupees. */
  amount: number;
  description: string;
  /** Deep link the checkout page sends the customer back to on success. */
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export async function createPayment(config: YoupiConfig, input: CreatePaymentInput): Promise<YoupiPayment> {
  const payment = await request<YoupiPayment>(config, '/api/v1/payments', {
    orderId: input.orderId,
    amount: input.amount.toFixed(2),
    currency: 'INR',
    description: input.description,
    returnUrl: input.returnUrl,
    metadata: input.metadata,
    // One order id per attempt doubles as the idempotency key, so a retried request never charges twice.
    idempotencyKey: input.orderId,
    ...(config.merchantId ? { merchantId: config.merchantId } : {}),
  });
  if (!payment?.paymentId || !payment.checkoutUrl) {
    throw new YoupiError('The payment server sent an unexpected reply.', 'server');
  }
  return { ...payment, checkoutUrl: reachableCheckoutUrl(config, payment.checkoutUrl) };
}

export const getPayment = (config: YoupiConfig, paymentId: string) =>
  request<YoupiPayment>(config, `/api/v1/payments/${encodeURIComponent(paymentId)}`);

export const cancelPayment = (config: YoupiConfig, paymentId: string) =>
  request<{ success: boolean; status: string }>(
    config,
    `/api/v1/checkout/${encodeURIComponent(paymentId)}/cancel`,
    {}
  );
