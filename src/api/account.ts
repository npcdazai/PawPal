import { apiRequest } from './client';
import type { Me, PhoneSession, User, VerificationCodeMethod, VerificationCodeSent } from './types';

/** How the phone number was proven: Firebase Auth SMS (or the server's dev login), or a carrier check. */
export type PhoneProofMethod = 'sms' | 'pnv';

/**
 * POST /auth/phone/code (no session needed). `dev`: the server makes a 6-digit
 * development code, prints it in its console and returns it (403
 * `dev_login_off` when development sign-in is off). `firebase`: Firebase has
 * already texted the code; the server only notes it. 429 `too_many_codes`.
 */
export function requestVerificationCode(input: { phone: string; method: VerificationCodeMethod }) {
  return apiRequest<VerificationCodeSent>('/auth/phone/code', { method: 'POST', body: { ...input, app: 'customer' } });
}

/**
 * POST /auth/phone: proof of a phone number → a customer-app session. The first
 * sign-in creates the account. `code` goes with a "dev:" token: the development
 * code from requestVerificationCode (401 `code_required` / `wrong_code` /
 * `code_locked`).
 */
export function signInWithPhone(input: { token: string; method: PhoneProofMethod; code?: string; name?: string }) {
  return apiRequest<PhoneSession>('/auth/phone', { method: 'POST', body: { ...input, app: 'customer' } });
}

export function getMe() {
  return apiRequest<Me>('/me');
}

export async function updateMe(patch: { name?: string; email?: string | null }): Promise<User> {
  const { user } = await apiRequest<{ user: User }>('/me', { method: 'PATCH', body: patch });
  return user;
}

/** Deletes the account in both apps. 409 `walk_in_progress` during an assigned or active walk. */
export function deleteMe() {
  return apiRequest<void>('/me', { method: 'DELETE' });
}

export type DevicePlatform = 'android' | 'ios' | 'web';

/** This install's FCM token, for push. */
export function registerDevice(token: string, platform: DevicePlatform) {
  return apiRequest<void>('/devices', { method: 'POST', body: { token, platform } });
}

/** On sign-out, so this install stops getting the account's notifications. */
export function unregisterDevice(token: string) {
  return apiRequest<void>(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
}
