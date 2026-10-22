import type { UpiPayee } from './youpiConfig';

/**
 * A standard UPI deep link (NPCI "UPI Linking Specification"): every UPI app
 * on the phone (GPay, PhonePe, Paytm, BHIM, bank apps) can open it, prefilled
 * with the payee, amount and note. Only the widely supported person-to-person
 * fields are used; merchant-only fields (tr, mc) make some apps reject
 * payments to a personal UPI ID.
 */
export function upiPayUrl(payee: UpiPayee, amount: number, note: string): string {
  const params = [
    ['pa', payee.vpa],
    ['pn', payee.name],
    ['am', amount.toFixed(2)],
    ['cu', 'INR'],
    // UPI apps cap the note at ~50 characters; it carries the order id for matching.
    ['tn', note.slice(0, 50)],
  ];
  // Keep "@" literal: some UPI apps don't decode %40 inside the payee address.
  const encode = (value: string) => encodeURIComponent(value).replace(/%40/g, '@');
  return `upi://pay?${params.map(([key, value]) => `${key}=${encode(value)}`).join('&')}`;
}

/** UPI transaction references (UTR / RRN) are 12 digits. */
export const UTR_LENGTH = 12;

export const cleanUtr = (input: string) => input.replace(/\D/g, '').slice(0, UTR_LENGTH);

export const isValidUtr = (utr: string) => /^\d{12}$/.test(utr);
