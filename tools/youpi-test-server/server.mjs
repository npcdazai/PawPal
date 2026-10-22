// YouPI test gateway: a stand-in for a self-hosted YouPI PG (github.com/youpi-pg/YouPI-PG)
// while developing PawPal. It speaks the same public API the app uses:
//   POST /api/v1/payments              create a session → { paymentId, checkoutUrl, status }
//   GET  /api/v1/payments/:id          status: INITIATED → QUEUED/ACTIVE → PROCESSING → SUCCESS | FAILED | EXPIRED | CANCELLED
//   POST /api/v1/checkout/:id/cancel   cancel and free the slot
// and serves a test checkout page at /checkout/:id. No real money moves: instead of a UPI
// QR the page has "simulate" buttons, and nothing here contacts a bank or UPI app.
//
// Run: npm run youpi:test-server   (PORT=7000 and HOST=0.0.0.0 by default, so phones on
// the same Wi-Fi can reach it). Written from YouPI's published API docs, not its code.
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import os from 'node:os';

const PORT = Number(process.env.PORT ?? 7000);
const HOST = process.env.HOST ?? '0.0.0.0';
/** YouPI's windows: 5 minutes to pay, 30 seconds to verify. */
const ACTIVE_WINDOW_MS = Number(process.env.PAYMENT_ACTIVE_WINDOW_MS ?? 5 * 60 * 1000);
/** How long the simulated "bank alert" takes to arrive. */
const VERIFY_DELAY_MS = 3000;

const FINAL = new Set(['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED']);
/** id → session */
const sessions = new Map();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Device-Id',
};

const toPaise = (amount) => {
  const text = String(amount ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [rupees, paise = ''] = text.split('.');
  const value = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  return value > 0 ? value : null;
};
const rupees = (paise) => (paise / 100).toFixed(2);
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function log(message) {
  console.log(`[youpi-test ${new Date().toLocaleTimeString()}] ${message}`);
}

// ---------------------------------------------------------------- lifecycle

/** One customer pays at a time (YouPI's single-slot queue), so amounts can't be confused. */
const slotHolder = () => [...sessions.values()].find((s) => s.status === 'ACTIVE' || s.status === 'PROCESSING');
const queued = () => [...sessions.values()].filter((s) => s.status === 'QUEUED').sort((a, b) => a.queuedAt - b.queuedAt);

function activate(session) {
  session.status = 'ACTIVE';
  session.expiresAt = Date.now() + ACTIVE_WINDOW_MS;
  log(`${session.orderId} ACTIVE (5:00 to pay)`);
}

function finish(session, status) {
  if (FINAL.has(session.status)) return;
  clearTimeout(session.verifyTimer);
  session.status = status;
  session.completedAt = status === 'SUCCESS' ? new Date().toISOString() : null;
  log(`${session.orderId} ${status}`);
  const next = queued()[0];
  if (next && !slotHolder()) activate(next);
}

/** Expire anything whose payment window has passed. */
function sweep() {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (session.status === 'ACTIVE' && session.expiresAt <= now) finish(session, 'EXPIRED');
  }
}
setInterval(sweep, 1000).unref();

const publicView = (session) => ({
  paymentId: session.id,
  orderId: session.orderId,
  amount: rupees(session.amountPaise),
  amountPaise: String(session.amountPaise),
  currency: session.currency,
  status: session.status,
  method: 'UPI',
  completedAt: session.completedAt,
});

// ---------------------------------------------------------------- http helpers

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string';
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json' : 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...CORS,
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw.trim() ? JSON.parse(raw) : {});
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

/** The origin this request reached us on, so checkout links work from a phone on the LAN. */
function originOf(req) {
  const host = /^[\w.\-:[\]]+$/.test(req.headers.host ?? '') ? req.headers.host : `localhost:${PORT}`;
  return `http://${host}`;
}

// ---------------------------------------------------------------- routes

async function createPayment(req, res) {
  const body = await readJson(req);
  if (!body) return send(res, 400, { error: 'Malformed JSON body' });
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim().slice(0, 64) : '';
  const amountPaise = toPaise(body.amount);
  if (!orderId || !amountPaise) return send(res, 400, { error: 'Missing required fields: orderId and amount.' });

  const checkoutBase = `${originOf(req)}/checkout`;
  const existing = [...sessions.values()].find((s) => s.orderId === orderId && (!FINAL.has(s.status) || s.status === 'SUCCESS'));
  if (existing) {
    return send(res, 200, { ...publicView(existing), queuePosition: 0, checkoutUrl: `${checkoutBase}/${existing.id}` });
  }

  const session = {
    id: randomUUID(),
    orderId,
    amountPaise,
    currency: 'INR',
    description: typeof body.description === 'string' ? body.description.slice(0, 120) : '',
    returnUrl: typeof body.returnUrl === 'string' ? body.returnUrl : null,
    status: 'INITIATED',
    createdAt: Date.now(),
    completedAt: null,
  };
  sessions.set(session.id, session);
  log(`${orderId} created: ₹${rupees(amountPaise)} "${session.description}"`);
  return send(res, 201, { ...publicView(session), queuePosition: 0, checkoutUrl: `${checkoutBase}/${session.id}` });
}

function signIn(session) {
  if (session.status !== 'INITIATED') return;
  if (slotHolder()) {
    session.status = 'QUEUED';
    session.queuedAt = Date.now();
    log(`${session.orderId} QUEUED behind ${slotHolder().orderId}`);
  } else {
    activate(session);
  }
}

function simulate(session, outcome) {
  if (session.status !== 'ACTIVE') return false;
  session.status = 'PROCESSING';
  log(`${session.orderId} PROCESSING (simulated ${outcome === 'success' ? 'payment' : 'bad payment'})`);
  session.verifyTimer = setTimeout(() => finish(session, outcome === 'success' ? 'SUCCESS' : 'FAILED'), VERIFY_DELAY_MS);
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  sweep();

  if (req.method === 'POST' && pathname === '/api/v1/payments') return createPayment(req, res);

  let match = pathname.match(/^\/api\/v1\/payments\/([\w-]+)$/);
  if (req.method === 'GET' && match) {
    const session = sessions.get(match[1]);
    return session ? send(res, 200, publicView(session)) : send(res, 404, { error: `Payment session not found: ${match[1]}` });
  }

  match = pathname.match(/^\/api\/v1\/checkout\/([\w-]+)\/cancel$/);
  if (req.method === 'POST' && match) {
    const session = sessions.get(match[1]);
    if (!session) return send(res, 404, { error: 'Session not found.' });
    finish(session, 'CANCELLED');
    return send(res, 200, { success: true, status: session.status });
  }

  // Test-only checkout actions (the real gateway does these through WhatsApp OTP and bank alerts).
  match = pathname.match(/^\/checkout\/([\w-]+)\/(signin|pay|fail)$/);
  if (req.method === 'POST' && match) {
    const session = sessions.get(match[1]);
    if (!session) return send(res, 404, { error: 'Session not found.' });
    if (match[2] === 'signin') signIn(session);
    else simulate(session, match[2] === 'pay' ? 'success' : 'failure');
    return send(res, 200, publicView(session));
  }

  match = pathname.match(/^\/checkout\/([\w-]+)$/);
  if (req.method === 'GET' && match) {
    const session = sessions.get(match[1]);
    return session ? send(res, 200, checkoutPage(session)) : send(res, 404, '<h1>Checkout not found</h1>');
  }

  if (req.method === 'GET' && pathname === '/') {
    const open = [...sessions.values()]
      .filter((s) => !FINAL.has(s.status))
      .map((s) => ({ orderId: s.orderId, status: s.status, checkoutUrl: `${originOf(req)}/checkout/${s.id}` }));
    return send(res, 200, { name: 'YouPI test gateway (no real money)', sessions: sessions.size, open });
  }
  return send(res, 404, { error: `Route not found: ${req.method} ${pathname}` });
});

// ---------------------------------------------------------------- checkout page

function checkoutPage(session) {
  const data = JSON.stringify({ id: session.id, returnUrl: session.returnUrl }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pay ₹${rupees(session.amountPaise)} · YouPI test checkout</title>
<style>
  :root { --ink:#181A20; --slate:#757B8A; --blue:#2962FF; --tint:#E8F0FE; --peach:#FFF3E8; --green:#178A4C; --coral:#C8432A; }
  * { box-sizing:border-box; } body { margin:0; font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:var(--ink); background:#FFFDF9; }
  main { max-width:420px; margin:0 auto; padding:16px; display:grid; gap:14px; }
  .test { background:#FFF1DA; color:#9A5B00; border-radius:12px; padding:10px 12px; font-weight:700; font-size:13px; }
  .card { background:#fff; border-radius:20px; padding:18px; box-shadow:0 12px 32px rgba(24,26,32,.06); display:grid; gap:10px; }
  .amount { font-size:34px; font-weight:800; letter-spacing:-.5px; } .muted { color:var(--slate); font-size:13px; }
  button { font:inherit; font-weight:700; border:0; border-radius:999px; padding:14px 18px; cursor:pointer; }
  .primary { background:var(--blue); color:#fff; } .secondary { background:var(--tint); color:var(--blue); } .danger { background:none; color:var(--coral); }
  .status { font-weight:800; font-size:18px; } .ok { color:var(--green); } .bad { color:var(--coral); }
  [hidden] { display:none !important; }
</style></head>
<body><main>
  <div class="test">TEST GATEWAY — no real money moves. A real YouPI checkout shows a UPI QR and app buttons here.</div>
  <div class="card">
    <div class="muted">${escapeHtml(session.description || 'PawPal payment')}</div>
    <div class="amount">₹${rupees(session.amountPaise)}</div>
    <div class="muted">Order ${escapeHtml(session.orderId)} · payee PawPal (test)</div>
  </div>
  <div class="card">
    <div id="status" class="status">Loading…</div>
    <div id="detail" class="muted"></div>
    <button id="signin" class="primary" hidden>Sign in as test customer</button>
    <button id="pay" class="primary" hidden>✓ Simulate successful UPI payment</button>
    <button id="fail" class="secondary" hidden>Simulate payment that can’t be verified</button>
    <button id="cancel" class="danger" hidden>Cancel payment</button>
    <a id="back" class="muted" hidden>Return to PawPal</a>
  </div>
</main>
<script>
  const S = ${data};
  const $ = (id) => document.getElementById(id);
  const TEXT = {
    INITIATED: ['Sign in to pay', 'The real gateway verifies your number with a WhatsApp code first.'],
    QUEUED: ['You’re in line', 'Another payment to this account is finishing — you’re next.'],
    ACTIVE: ['Pay with your UPI app', 'You have 5 minutes. In this test, press a simulate button.'],
    PROCESSING: ['Checking with the bank…', 'Waiting for the (simulated) bank credit alert.'],
    SUCCESS: ['Payment received ✓', 'Taking you back to PawPal…'],
    FAILED: ['Couldn’t verify the payment', 'No matching bank alert arrived in time.'],
    EXPIRED: ['Payment window closed', 'The 5 minutes ran out. Nothing was charged.'],
    CANCELLED: ['Payment cancelled', 'Nothing was charged.'],
  };
  let redirected = false;
  function render(p) {
    const [title, detail] = TEXT[p.status] || [p.status, ''];
    $('status').textContent = title;
    $('status').className = 'status ' + (p.status === 'SUCCESS' ? 'ok' : ['FAILED','EXPIRED','CANCELLED'].includes(p.status) ? 'bad' : '');
    $('detail').textContent = detail;
    $('signin').hidden = p.status !== 'INITIATED';
    $('pay').hidden = $('fail').hidden = p.status !== 'ACTIVE';
    $('cancel').hidden = !['INITIATED','QUEUED','ACTIVE'].includes(p.status);
    const done = ['SUCCESS','FAILED','EXPIRED','CANCELLED'].includes(p.status);
    if (done && S.returnUrl) { $('back').hidden = false; $('back').href = S.returnUrl; }
    // Like YouPI: on success, send the customer back to the merchant after 2 seconds.
    if (p.status === 'SUCCESS' && S.returnUrl && !redirected) { redirected = true; setTimeout(() => { location.href = S.returnUrl; }, 2000); }
  }
  async function refresh() {
    try { render(await (await fetch('/api/v1/payments/' + S.id, { cache: 'no-store' })).json()); } catch (e) {}
  }
  async function act(path) { await fetch(path, { method: 'POST' }); refresh(); }
  $('signin').onclick = () => act('/checkout/' + S.id + '/signin');
  $('pay').onclick = () => act('/checkout/' + S.id + '/pay');
  $('fail').onclick = () => act('/checkout/' + S.id + '/fail');
  $('cancel').onclick = () => act('/api/v1/checkout/' + S.id + '/cancel');
  refresh(); setInterval(refresh, 1500);
</script>
</body></html>`;
}

server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => `http://${net.address}:${PORT}`);
  console.log(`YouPI test gateway (no real money) on http://localhost:${PORT}`);
  if (lan.length) console.log(`Phones on this Wi-Fi: ${lan.join('  ')}`);
});
