/**
 * Development console logs, readable in the Metro terminal next to the API's own:
 *
 *   🐾 02:04:31 auth   • Code requested  { phone: "+91••••••3210", method: "dev" }
 *   🐾 02:04:36 api    ✔ 200 POST /auth/phone · 84 ms  { token: [hidden], method: "sms" }
 *   🐾 02:04:40 api    ✖ network GET /me · can't reach http://localhost:4000
 *
 * Release builds print nothing unless EXPO_PUBLIC_DEBUG_LOGS=true (the lines then go
 * to logcat). Secrets are hidden and phone numbers, emails and UPI IDs masked, as on
 * the server. Everything goes through console.log, so an expected failure doesn't
 * raise a LogBox warning in the app.
 */

export type LogFields = Record<string, unknown>;

export interface DevLog {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export const devLogsEnabled = () => __DEV__ || process.env.EXPO_PUBLIC_DEBUG_LOGS === 'true';

/** Field names whose values never reach a log line: tokens, OTPs and SMS codes, signatures, keys. */
const SECRET = /token|secret|password|signature|authorization|cookie|otp|apikey|^code$|smscode/i;
const PHONE = /phone/i;
const HANDLE = /email|vpa|upi/i;
const MAX_DEPTH = 3;
const MAX_ITEMS = 5;
const MAX_KEYS = 12;
const MAX_STRING = 120;
const MAX_LINE = 600;

/** "+919876543210" → "+91••••••3210". */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '••••';
  const prefix = phone.startsWith('+') ? phone.slice(0, 3) : '';
  return `${prefix}${'•'.repeat(Math.max(1, phone.length - prefix.length - 4))}${phone.slice(-4)}`;
}

const maskHandle = (handle: string) => {
  const at = handle.indexOf('@');
  return at > 0 ? `${handle[0]}•••${handle.slice(at)}` : '•••';
};

/** A copy of `value` safe and short enough to log. */
export function redactForLog(value: unknown, key = '', depth = 0): unknown {
  if (key && SECRET.test(key)) return value === null || value === undefined || value === '' ? value : '[hidden]';
  if (typeof value === 'string') {
    if (PHONE.test(key)) return maskPhone(value);
    if (HANDLE.test(key)) return maskHandle(value);
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (${value.length} chars)` : value;
  }
  if (value === null || typeof value !== 'object') return typeof value === 'function' ? undefined : value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof FormData !== 'undefined' && value instanceof FormData) return '<form data>';
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? `<${value.length} items>` : '<…>';
  if (Array.isArray(value)) {
    const shown = value.slice(0, MAX_ITEMS).map((item) => redactForLog(item, key, depth + 1));
    return value.length > MAX_ITEMS ? [...shown, `… ${value.length - MAX_ITEMS} more`] : shown;
  }
  const entries = Object.entries(value);
  const out: Record<string, unknown> = {};
  for (const [name, item] of entries.slice(0, MAX_KEYS)) out[name] = redactForLog(item, name, depth + 1);
  if (entries.length > MAX_KEYS) out['…'] = `${entries.length - MAX_KEYS} more keys`;
  return out;
}

const PLACEHOLDER = /^(\[hidden\]|<.*>|… \d+ more.*)$/;

/** `{ token: [hidden], method: "sms" }`: compact, and ids cut to 8 characters. */
function render(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(render).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const parts = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([name, item]) => (name === '…' ? `…${String(item)}` : `${name}: ${render(item)}`));
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  if (typeof value === 'string') {
    const text = value.replace(/^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '$1…');
    return PLACEHOLDER.test(text) ? text : `"${text}"`;
  }
  return String(value);
}

const two = (n: number) => String(n).padStart(2, '0');
const clock = () => {
  const now = new Date();
  return `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
};

const MARK = { info: '•', warn: '⚠', error: '✖' } as const;

function print(scope: string, line: string, fields?: LogFields) {
  const details = fields && Object.values(fields).some((value) => value !== undefined) ? `  ${render(redactForLog(fields))}` : '';
  const text = `🐾 ${clock()} ${scope.padEnd(6)} ${line}${details}`;
  console.log(text.length > MAX_LINE ? `${text.slice(0, MAX_LINE)}…` : text);
}

/** A named logger: `devLog('auth').info('Code requested', { phone, method })`. */
export function devLog(scope: string): DevLog {
  const at = (level: keyof typeof MARK) => (message: string, fields?: LogFields) => {
    if (devLogsEnabled()) print(scope, `${MARK[level]} ${message}`, fields);
  };
  return { info: at('info'), warn: at('warn'), error: at('error') };
}

export interface ApiCall {
  method: string;
  /** Path and query, without the base URL. */
  path: string;
  /** 0 when no answer arrived. */
  status: number;
  ms: number;
  /** The JSON request body (redacted before printing). */
  body?: unknown;
  /** The server's error, or `network` / `timeout` when status is 0. */
  problem?: { code: string; message: string };
  /** The API base URL, named when the server couldn't be reached. */
  baseUrl?: string;
}

/** The last successful read, so an app polling every few seconds prints one line, not hundreds. */
let repeat: { key: string; count: number; since: string } | null = null;

function flushRepeats() {
  if (repeat && repeat.count > 1) print('api', `✔ ${repeat.key} ×${repeat.count} since ${repeat.since}`);
  repeat = null;
}

/**
 * One line per API call:
 *   ✔ 201 POST /bookings · 84 ms  { body }
 *   ✖ 400 POST /bookings/…/start · 12 ms · wrong_otp: Wrong OTP. 4 tries left.
 *   ✖ network POST /auth/phone · can't reach http://localhost:4000 …
 * Repeats of the same successful read collapse into a "×N" summary line.
 */
export function logApiCall({ method, path, status, ms, body, problem, baseUrl }: ApiCall) {
  if (!devLogsEnabled()) return;
  const shortPath = path.replace(/([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '$1…');
  const took = `${Math.round(ms)} ms`;
  if (status === 0) {
    flushRepeats();
    const where = problem?.code === 'network' && baseUrl ? ` · can't reach ${baseUrl}${unreachableHint(baseUrl)}` : '';
    print('api', `✖ ${problem?.code ?? 'network'} ${method} ${shortPath} · ${took}${where}`);
    return;
  }
  if (problem || status >= 400) {
    flushRepeats();
    print('api', `✖ ${status} ${method} ${shortPath} · ${took} · ${problem ? `${problem.code}: ${problem.message}` : 'failed'}`, body === undefined ? undefined : { body });
    return;
  }
  if (method === 'GET' && body === undefined) {
    const key = `${status} ${method} ${shortPath}`;
    if (repeat?.key === key) {
      repeat.count += 1;
      if (repeat.count % 50 === 0) print('api', `✔ ${key} ×${repeat.count} since ${repeat.since}`);
      return;
    }
    flushRepeats();
    repeat = { key, count: 1, since: clock() };
    print('api', `✔ ${key} · ${took}`);
    return;
  }
  flushRepeats();
  print('api', `✔ ${status} ${method} ${shortPath} · ${took}`, body === undefined ? undefined : { body });
}

/** What usually stops a development build reaching the API on this computer. */
export function unreachableHint(baseUrl: string): string {
  if (/\/\/(localhost|127\.0\.0\.1)[:/]/.test(baseUrl)) {
    return ' (on a USB phone or emulator, port 4000 must be forwarded: adb reverse tcp:4000 tcp:4000 — the API does this itself under npm run dev)';
  }
  if (/\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(baseUrl)) {
    return ' (is the API running, on the same Wi-Fi, and allowed through the computer’s firewall on port 4000?)';
  }
  return ' (is the API running?)';
}
