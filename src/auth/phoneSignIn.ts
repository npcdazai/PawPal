import { requestVerificationCode, signInWithPhone } from '../api/account';
import { isApiError } from '../api/errors';
import type { PhoneSession } from '../api/types';
import { devLog, maskPhone } from '../monitoring/devLog';
import { Sentry } from '../monitoring/sentry';
import { describeFirebaseError, firebaseAuth, type FirebaseUser, type PhoneConfirmation } from './firebaseAuth';
import { cleanSmsCode, isSmsCode, SMS_CODE_LENGTH, toE164 } from './phoneNumber';

/**
 * APP_INTEGRATION §2, phone sign-in:
 * - firebase: Firebase Auth SMS, then POST /auth/phone with the ID token (release
 *   builds). The API is also told the SMS went out (POST /auth/phone/code,
 *   method firebase), for its console only;
 * - dev: development builds without Firebase ask the API for a development code
 *   (POST /auth/phone/code, method dev: printed in the API console and Metro, no
 *   SMS), then sign in with "dev:<E.164>" and the code the person types;
 * - unconfigured: a release build without Firebase can't sign anyone in.
 */
export type SignInMethod = 'firebase' | 'dev' | 'unconfigured';

const log = devLog('auth');

const METHOD_NOTE: Record<SignInMethod, string> = {
  firebase: 'Firebase SMS, then POST /auth/phone',
  dev: 'development code: no SMS, the code is printed in the API console and here; the API must allow dev logins',
  unconfigured: 'no Firebase in this release build: nobody can sign in',
};

/** A development code as the API sends it: printed only when it really is one. */
const DEV_CODE = /^\d{6}$/;

let methodLogged = false;

export function signInMethod(): SignInMethod {
  const method: SignInMethod = firebaseAuth() ? 'firebase' : __DEV__ ? 'dev' : 'unconfigured';
  if (!methodLogged) {
    methodLogged = true;
    (method === 'unconfigured' ? log.warn : log.info)(`Sign-in method: ${method}`, { how: METHOD_NOTE[method] });
  }
  return method;
}

/** One console line per failed step: our own reason, or the API's code and status. */
function logFailure(step: string, error: unknown) {
  if (error instanceof PhoneSignInError) {
    log.warn(`${step} failed`, { reason: error.code, message: error.message });
  } else if (isApiError(error)) {
    log.warn(`${step} failed`, { reason: error.code, status: error.status, message: error.message });
  } else {
    log.error(`${step} failed`, { error });
  }
}

export type PhoneSignInErrorCode = 'invalid_phone' | 'invalid_code' | 'no_code' | 'unconfigured' | 'firebase';

/** A sign-in step that failed before reaching the API. `message` is user-facing copy. */
export class PhoneSignInError extends Error {
  readonly code: PhoneSignInErrorCode;

  constructor(code: PhoneSignInErrorCode, message: string) {
    super(message);
    this.name = 'PhoneSignInError';
    this.code = code;
  }
}

export const UNCONFIGURED_MESSAGE = 'Sign-in isn’t configured in this build.';

type PendingCode =
  | { method: 'firebase'; phone: string; confirmation: PhoneConfirmation }
  | { method: 'dev'; phone: string };

/** The number a code was last sent to, until it's confirmed. */
let pending: PendingCode | null = null;

function firebaseFailure(error: unknown): PhoneSignInError {
  const { message, known } = describeFirebaseError(error);
  if (!known) Sentry.captureException(error);
  const firebaseError = (error as { code?: unknown } | null)?.code;
  log.warn('Firebase Auth error', { firebaseError: typeof firebaseError === 'string' ? firebaseError : 'unknown', known });
  return new PhoneSignInError('firebase', message);
}

/**
 * Sends the code (a fresh one each call): Firebase's SMS, or in development a
 * code from the API, asked for before the code step so an API that can't be
 * reached fails at "Send code". Resolves with the number, in E.164. Rejects with
 * PhoneSignInError, or the API's ApiError (`too_many_codes`, `dev_login_off`, no
 * connection).
 */
export async function requestCode(phone: string): Promise<string> {
  try {
    return await sendCode(phone);
  } catch (error) {
    logFailure('Code request', error);
    throw error;
  }
}

async function sendCode(phone: string): Promise<string> {
  const e164 = toE164(phone);
  if (!e164) {
    throw new PhoneSignInError('invalid_phone', 'Enter your 10-digit mobile number, or the full number with its country code.');
  }

  const auth = firebaseAuth();
  if (auth) {
    try {
      const confirmation = await auth.signInWithPhoneNumber(auth.getAuth(), e164);
      pending = { method: 'firebase', phone: e164, confirmation };
    } catch (error) {
      throw firebaseFailure(error);
    }
    log.info('Code requested: SMS sent by Firebase', { phone: e164, method: 'firebase' });
    noteFirebaseSms(e164);
    return e164;
  }

  if (!__DEV__) throw new PhoneSignInError('unconfigured', UNCONFIGURED_MESSAGE);
  const sent = await requestVerificationCode({ phone: e164, method: 'dev' });
  pending = { method: 'dev', phone: e164 };
  // The one code a log may show: a development code, never an SMS code.
  const devCode = sent.method === 'dev' && DEV_CODE.test(String(sent.devCode)) ? sent.devCode : null;
  const minutesLeft = sent.method === 'dev' ? Math.round((sent.expiresAt - Date.now()) / 60_000) : NaN;
  log.info(
    devCode
      ? `📨 Verification code ${devCode} sent to ${maskPhone(e164)} (development: also in the API console)`
      : `📨 Verification code sent to ${maskPhone(e164)} (development: see the API console)`,
    { expires: Number.isFinite(minutesLeft) && minutesLeft > 0 ? `in ${minutesLeft} min` : undefined }
  );
  return e164;
}

/** Tells the API that Firebase texted a code, for its console. Never shown, never blocks sign-in. */
function noteFirebaseSms(phone: string) {
  void requestVerificationCode({ phone, method: 'firebase' }).catch((error: unknown) => {
    log.warn(
      'Couldn’t tell the API the SMS was sent (sign-in carries on)',
      isApiError(error) ? { reason: error.code, status: error.status, message: error.message } : { error }
    );
  });
}

/** The Firebase user the SMS signed in: from confirm(), or the one Android auto-verified meanwhile. */
async function confirmedUser(code: PendingCode & { method: 'firebase' }, digits: string): Promise<FirebaseUser> {
  const current = () => {
    const user = firebaseAuth()?.getAuth().currentUser ?? null;
    return user?.phoneNumber === code.phone ? user : null;
  };
  try {
    const credential = await code.confirmation.confirm(digits);
    const user = credential?.user ?? current();
    if (user) return user;
  } catch (error) {
    // An auto-verified code can't be used twice, but the sign-in already happened.
    const user = current();
    if (user) return user;
    throw firebaseFailure(error);
  }
  throw new PhoneSignInError('firebase', 'We couldn’t verify your number. Send a new code.');
}

/**
 * Checks the code and opens an API session (the first sign-in creates the
 * account). Rejects with PhoneSignInError, or the API's ApiError (e.g.
 * `wrong_code`, `code_locked`, `phone_token_used`, `invalid_phone_token`, or no
 * connection).
 */
export async function confirmCode(input: string): Promise<PhoneSession> {
  try {
    return await verifyCode(input);
  } catch (error) {
    logFailure('Sign-in', error);
    throw error;
  }
}

async function verifyCode(input: string): Promise<PhoneSession> {
  const digits = cleanSmsCode(input);
  if (!isSmsCode(digits)) throw new PhoneSignInError('invalid_code', `Enter the ${SMS_CODE_LENGTH}-digit code.`);
  const code = pending;
  if (!code) throw new PhoneSignInError('no_code', 'Send a code to your number first.');

  let session: PhoneSession;
  if (code.method === 'dev') {
    // The server checks the development code it issued.
    try {
      session = await signInWithPhone({ token: `dev:${code.phone}`, method: 'sms', code: digits });
    } catch (error) {
      // Too many wrong codes: the server dropped this one, so a new code has to be sent.
      if (isApiError(error) && error.code === 'code_locked' && pending === code) pending = null;
      throw error;
    }
  } else {
    const user = await confirmedUser(code, digits);
    let token: string;
    try {
      token = await user.getIdToken();
    } catch (error) {
      throw firebaseFailure(error);
    }
    log.info('Code confirmed by Firebase', { phone: code.phone });
    session = await signInWithPhone({ token, method: 'sms' });
  }

  pending = null;
  // A new account has no name yet (the name step comes next).
  const needsName = !session.user?.name?.trim();
  log.info(needsName ? 'Signed in: no name yet (new account), name step next' : 'Signed in', {
    user: session.user?.id,
    phone: session.user?.phone,
    method: code.method,
  });
  return session;
}

/** On sign-out: forget any pending code and end the Firebase session too. */
export async function signOutOfPhone(): Promise<void> {
  pending = null;
  const auth = firebaseAuth();
  if (!auth) return;
  try {
    await auth.signOut(auth.getAuth());
  } catch {
    // Already signed out of Firebase.
  }
}
