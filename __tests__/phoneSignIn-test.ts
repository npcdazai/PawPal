import { describeFirebaseError } from '../src/auth/firebaseAuth';
import { cleanSmsCode, formatPhone, isSmsCode, toE164 } from '../src/auth/phoneNumber';
import { confirmCode, PhoneSignInError, requestCode, signInMethod } from '../src/auth/phoneSignIn';

// Jest can't load @sentry/react-native's ESM build here; without a DSN its calls are no-ops anyway.
jest.mock('../src/monitoring/sentry', () => ({ initMonitoring: jest.fn(), Sentry: { captureException: jest.fn() } }));

describe('toE164', () => {
  test.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    ['(+44) 7700 900123', '+447700900123'],
    ['+1 650-555-3434', '+16505553434'],
  ])('%s → %s', (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  test.each([
    '',
    '12345',
    '1234567890', // 10 digits, but not an Indian mobile
    '+91 12345 67890',
    '+0 1234 5678',
    '98765abcde',
    '+9198765432101',
  ])('rejects %p', (input) => {
    expect(toE164(input)).toBeNull();
  });
});

describe('formatPhone', () => {
  test('groups Indian numbers and leaves others alone', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('+447700900123')).toBe('+447700900123');
  });
});

describe('SMS codes', () => {
  test('six digits, spaces ignored', () => {
    expect(isSmsCode(cleanSmsCode('123 456'))).toBe(true);
    expect(isSmsCode('12345')).toBe(false);
    expect(isSmsCode('1234567')).toBe(false);
    expect(isSmsCode('12a456')).toBe(false);
  });
});

describe('describeFirebaseError', () => {
  test('known codes get their own copy', () => {
    expect(describeFirebaseError({ code: 'auth/invalid-verification-code' })).toEqual({
      message: 'That code isn’t right. Check the SMS and try again.',
      known: true,
    });
    expect(describeFirebaseError({ code: 'auth/too-many-requests' }).known).toBe(true);
  });

  test('setup problems get generic copy and are flagged for reporting', () => {
    expect(describeFirebaseError({ code: 'auth/app-not-authorized' })).toEqual({
      message: 'We couldn’t verify your number. Try again.',
      known: false,
    });
    expect(describeFirebaseError(new Error('boom')).known).toBe(false);
  });
});

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
/** Every development console line printed during the test. */
let lines: string[] = [];
let logSpy: jest.SpyInstance;

const respond = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;
const refusal = (status: number, code: string, message: string) => respond(status, { error: { code, message } });
const devCodeSent = (devCode = '482913') => respond(200, { method: 'dev', expiresAt: Date.now() + 600_000, devCode });
const sentBody = (call: number) => JSON.parse(String(fetchMock.mock.calls[call][1].body));
const printed = () => lines.join('\n');
/** Lets a request the caller didn't wait for settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  lines = [];
  logSpy = jest.spyOn(console, 'log').mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => logSpy.mockRestore());

describe('phone sign-in in a development build without Firebase', () => {
  test('uses the server’s development codes', () => {
    expect(signInMethod()).toBe('dev');
  });

  test('a code can’t be confirmed before one is requested', async () => {
    await expect(confirmCode('123456')).rejects.toMatchObject({ code: 'no_code' });
  });

  test('rejects a number that isn’t one, without calling anything', async () => {
    await expect(requestCode('12345')).rejects.toBeInstanceOf(PhoneSignInError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('asks the API for a development code before the code step, and prints it', async () => {
    fetchMock.mockResolvedValueOnce(devCodeSent('482913'));
    await expect(requestCode('98765 43210')).resolves.toBe('+919876543210');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/phone\/code$/);
    expect(init.method).toBe('POST');
    expect(sentBody(0)).toEqual({ phone: '+919876543210', method: 'dev', app: 'customer' });
    expect(lines).toContainEqual(
      expect.stringMatching(
        /auth {3}• 📨 Verification code 482913 sent to \+91••••••3210 \(development: also in the API console\) {2}\{ expires: "in 10 min" \}$/
      )
    );
    expect(printed()).not.toContain('9876543210');
  });

  test('signs in as dev:<E.164> with the code the person typed', async () => {
    fetchMock.mockResolvedValueOnce(devCodeSent());
    await requestCode('9876543210');
    await expect(confirmCode('12')).rejects.toMatchObject({ code: 'invalid_code' });

    const session = { sessionToken: 'session-1', user: { id: 'u1', phone: '+919876543210', name: '' } };
    fetchMock.mockResolvedValueOnce(respond(200, session));
    lines = [];
    await expect(confirmCode('424 242')).resolves.toEqual(session);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toMatch(/\/auth\/phone$/);
    expect(init.method).toBe('POST');
    expect(sentBody(1)).toEqual({ token: 'dev:+919876543210', method: 'sms', code: '424242', app: 'customer' });
    expect(printed()).toMatch(/✔ 200 POST \/auth\/phone · \d+ ms/);
    expect(printed()).toMatch(/auth {3}• Signed in: no name yet \(new account\), name step next {2}\{ user: "u1", phone: "\+91••••••3210", method: "dev" \}/);
    // Neither the typed code, nor the dev token, nor the session.
    expect(printed()).not.toMatch(/424242|dev:\+91|session-1/);
  });

  test('an API that can’t be reached fails at “Send code”, naming the address', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    const error = (await requestCode('9876543210').catch((caught: unknown) => caught)) as Error;
    expect(error).toMatchObject({ status: 0, code: 'network' });
    expect(error.message).toMatch(/^Couldn’t reach the PawPal API at http:\/\/\S+\. \(/);
    expect(printed()).toMatch(/auth {3}⚠ Code request failed {2}\{ reason: "network", status: 0, message: "Couldn’t reach/);
    // Still on the phone step: there's no code to confirm.
    await expect(confirmCode('123456')).rejects.toMatchObject({ code: 'no_code' });
  });

  test('a refused code request shows the server’s message', async () => {
    const message = 'Too many codes requested. Wait a few minutes and try again.';
    fetchMock.mockResolvedValueOnce(refusal(429, 'too_many_codes', message));
    await expect(requestCode('9876543210')).rejects.toMatchObject({ code: 'too_many_codes', message });
    expect(printed()).toContain('⚠ Code request failed  { reason: "too_many_codes", status: 429');
  });

  test('wrong codes show the server’s message; once locked, a new code is needed', async () => {
    fetchMock.mockResolvedValueOnce(devCodeSent());
    await requestCode('9876543210');

    fetchMock.mockResolvedValueOnce(refusal(401, 'wrong_code', 'That code isn’t right. 4 tries left.'));
    await expect(confirmCode('111111')).rejects.toMatchObject({
      code: 'wrong_code',
      message: 'That code isn’t right. 4 tries left.',
    });
    expect(printed()).toContain('⚠ Sign-in failed  { reason: "wrong_code", status: 401, message: "That code isn’t right. 4 tries left." }');

    fetchMock.mockResolvedValueOnce(refusal(401, 'code_locked', 'Too many wrong codes. Send a new code.'));
    await expect(confirmCode('222222')).rejects.toMatchObject({ code: 'code_locked' });
    await expect(confirmCode('333333')).rejects.toMatchObject({ code: 'no_code' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(printed()).not.toMatch(/111111|222222|333333/);
  });

  test('a server with development sign-in off says so at “Send code”', async () => {
    const message = 'Development sign-in is turned off on this server.';
    fetchMock.mockResolvedValueOnce(refusal(403, 'dev_login_off', message));
    await expect(requestCode('9876543210')).rejects.toMatchObject({ code: 'dev_login_off', message });
  });
});

describe('phone sign-in with Firebase', () => {
  test('tells the API the SMS went out without waiting for it, and sends no code to the API', async () => {
    const user = { phoneNumber: '+919876543210', getIdToken: jest.fn(async () => 'firebase-id-token') };
    const confirmation = { confirm: jest.fn(async () => ({ user })) };
    const firebase = {
      getAuth: () => ({ currentUser: null }),
      signInWithPhoneNumber: jest.fn(async () => confirmation),
      signOut: jest.fn(async () => undefined),
    };

    let signIn: { signInMethod: typeof signInMethod; requestCode: typeof requestCode; confirmCode: typeof confirmCode };
    jest.isolateModules(() => {
      jest.doMock('../src/auth/firebaseAuth', () => ({
        ...jest.requireActual('../src/auth/firebaseAuth'),
        firebaseAuth: () => firebase,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh copy that sees the mocked Firebase
      signIn = require('../src/auth/phoneSignIn');
    });
    // Loading a fresh copy of expo re-installs its fetch.
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(signIn!.signInMethod()).toBe('firebase');

    // The API's answer is still out when the code step opens.
    let answer: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );
    await expect(signIn!.requestCode('9876543210')).resolves.toBe('+919876543210');
    expect(firebase.signInWithPhoneNumber).toHaveBeenCalledWith(expect.anything(), '+919876543210');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/auth\/phone\/code$/);
    expect(sentBody(0)).toEqual({ phone: '+919876543210', method: 'firebase', app: 'customer' });

    // Its failure is only logged.
    answer(refusal(500, 'internal', 'PawPal is having trouble right now.'));
    await settle();
    expect(printed()).toContain('⚠ Couldn’t tell the API the SMS was sent (sign-in carries on)  { reason: "internal", status: 500');

    const session = { sessionToken: 'session-1', user: { id: 'u1', phone: '+919876543210', name: 'Maya' } };
    fetchMock.mockResolvedValueOnce(respond(200, session));
    await expect(signIn!.confirmCode('424242')).resolves.toEqual(session);
    expect(confirmation.confirm).toHaveBeenCalledWith('424242');
    expect(sentBody(1)).toEqual({ token: 'firebase-id-token', method: 'sms', app: 'customer' });
    expect(printed()).not.toMatch(/firebase-id-token|424242|session-1|9876543210/);
  });
});
