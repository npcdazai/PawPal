/** E.164: "+", a country code that doesn't start with 0, up to 15 digits in all. */
const E164 = /^\+[1-9]\d{7,14}$/;
/** Indian mobile numbers: 10 digits starting 6–9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * A typed phone number in E.164 ("+919876543210"), or null if it isn't one.
 * A bare 10-digit number is Indian (+91); spaces, dashes, brackets and the
 * "0" / "91" / "0091" prefixes people type are understood.
 */
export function toE164(input: string): string | null {
  const compact = input.trim().replace(/[\s().-]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  if (international.startsWith('+')) {
    if (!E164.test(international)) return null;
    // Indian numbers in full still have to be mobiles to get the SMS.
    if (international.startsWith('+91') && !INDIAN_MOBILE.test(international.slice(3))) return null;
    return international;
  }

  if (!/^\d+$/.test(compact)) return null;
  let national = compact;
  if (national.length === 11 && national.startsWith('0')) national = national.slice(1);
  else if (national.length === 12 && national.startsWith('91')) national = national.slice(2);
  return INDIAN_MOBILE.test(national) ? `+91${national}` : null;
}

/** "+919876543210" → "+91 98765 43210"; other countries stay as they are. */
export function formatPhone(e164: string): string {
  const indian = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return indian ? `+91 ${indian[1]} ${indian[2]}` : e164;
}

/** The SMS code's length (Firebase Auth sends 6 digits). */
export const SMS_CODE_LENGTH = 6;

/** The code as typed, without spaces; valid when it's exactly 6 digits. */
export const cleanSmsCode = (input: string) => input.replace(/\s/g, '');
export const isSmsCode = (code: string) => new RegExp(`^\\d{${SMS_CODE_LENGTH}}$`).test(code);
