import { devLog, logApiCall, maskPhone, redactForLog, unreachableHint } from '../src/monitoring/devLog';

let lines: string[] = [];
let spy: jest.SpyInstance;

beforeEach(() => {
  lines = [];
  spy = jest.spyOn(console, 'log').mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => spy.mockRestore());

describe('redactForLog', () => {
  test('hides secrets and SMS codes, masks people, trims bulk', () => {
    expect(
      redactForLog({
        token: 'dev:+919876543210',
        sessionToken: 'eyJhbGciOiJIUzI1NiJ9.x.y',
        code: '123456',
        pickupOtp: '4821',
        phone: '+919876543210',
        payoutVpa: 'ravi@okhdfcbank',
        note: 'x'.repeat(200),
        list: [1, 2, 3, 4, 5, 6],
        deep: { a: { b: { c: 1 } } },
      })
    ).toEqual({
      token: '[hidden]',
      sessionToken: '[hidden]',
      code: '[hidden]',
      pickupOtp: '[hidden]',
      phone: '+91••••••3210',
      payoutVpa: 'r•••@okhdfcbank',
      note: `${'x'.repeat(120)}… (200 chars)`,
      list: [1, 2, 3, 4, 5, '… 1 more'],
      deep: { a: { b: '<…>' } },
    });
  });

  test('masks short and local numbers too', () => {
    expect(maskPhone('9876543210')).toBe('••••••3210');
    expect(maskPhone('123')).toBe('••••');
  });
});

describe('devLog', () => {
  test('one line per event with scope, mark and redacted fields', () => {
    devLog('auth').info('Code requested', { phone: '+919876543210', method: 'dev', code: '123456' });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^🐾 \d\d:\d\d:\d\d auth {3}• Code requested {2}\{ phone: "\+91••••••3210", method: "dev", code: \[hidden\] \}$/
    );
  });
});

describe('logApiCall', () => {
  test('writes, failures and unreachable servers', () => {
    logApiCall({ method: 'POST', path: '/auth/phone', status: 200, ms: 84.4, body: { token: 'dev:+91', method: 'sms' } });
    logApiCall({
      method: 'POST',
      path: '/bookings/3f2a1c2b-1111-4222-8333-944445555666/start',
      status: 400,
      ms: 12,
      problem: { code: 'wrong_otp', message: 'Wrong OTP. 4 tries left.' },
    });
    logApiCall({
      method: 'GET',
      path: '/me',
      status: 0,
      ms: 3,
      problem: { code: 'network', message: 'Couldn’t reach PawPal.' },
      baseUrl: 'http://localhost:4000',
    });
    expect(lines[0]).toContain('api    ✔ 200 POST /auth/phone · 84 ms  { body: { token: [hidden], method: "sms" } }');
    expect(lines[1]).toContain('✖ 400 POST /bookings/3f2a1c2b…/start · 12 ms · wrong_otp: Wrong OTP. 4 tries left.');
    expect(lines[2]).toContain('✖ network GET /me · 3 ms · can\'t reach http://localhost:4000 (on a USB phone or emulator');
  });

  test('repeated successful reads collapse into one summary line', () => {
    for (let i = 0; i < 4; i++) logApiCall({ method: 'GET', path: '/partners/me/offers', status: 200, ms: 5 });
    logApiCall({ method: 'POST', path: '/offers/1/decline', status: 204, ms: 6 });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('✔ 200 GET /partners/me/offers · 5 ms');
    expect(lines[1]).toMatch(/✔ 200 GET \/partners\/me\/offers ×4 since \d\d:\d\d:\d\d$/);
    expect(lines[2]).toContain('✔ 204 POST /offers/1/decline · 6 ms');
  });
});

describe('unreachableHint', () => {
  test('names the likely fix for each kind of address', () => {
    expect(unreachableHint('http://localhost:4000')).toContain('adb reverse tcp:4000 tcp:4000');
    expect(unreachableHint('http://192.168.0.104:4000')).toContain('firewall');
    expect(unreachableHint('https://api.pawpal.in')).toBe(' (is the API running?)');
  });
});
