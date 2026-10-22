/**
 * How PawPal takes UPI payments.
 *
 *  - Direct UPI (default): the customer's UPI app (GPay, PhonePe, Paytm, BHIM…)
 *    pays PawPal's UPI ID through a standard upi://pay link, and the customer
 *    confirms with the 12-digit UPI reference (UTR) from their app.
 *  - YouPI gateway: set EXPO_PUBLIC_YOUPI_URL to a self-hosted YouPI PG (its
 *    checkout portal URL; it also serves /api/v1). The gateway then confirms
 *    payments from bank alerts, so no reference has to be typed in. Set
 *    EXPO_PUBLIC_YOUPI_MERCHANT_ID too if it hosts more than one merchant.
 *    For the local test gateway: EXPO_PUBLIC_YOUPI_URL=http://<this-computer's-LAN-IP>:7000
 */

/** PawPal's receiving UPI ID; override with EXPO_PUBLIC_UPI_VPA. */
export const DEFAULT_UPI_VPA = 'aefuzz16-3@okhdfcbank';
const DEFAULT_PAYEE_NAME = 'PawPal';

const ENV_URL = process.env.EXPO_PUBLIC_YOUPI_URL;
const ENV_MERCHANT_ID = process.env.EXPO_PUBLIC_YOUPI_MERCHANT_ID;
const ENV_VPA = process.env.EXPO_PUBLIC_UPI_VPA;
const ENV_PAYEE_NAME = process.env.EXPO_PUBLIC_UPI_PAYEE_NAME;

export interface YoupiConfig {
  /** Gateway origin, no trailing slash. */
  baseUrl: string;
  merchantId: string | null;
}

/** The YouPI gateway, if one is configured. */
export function youpiConfig(): YoupiConfig | null {
  const url = ENV_URL?.trim();
  if (!url) return null;
  return { baseUrl: url.replace(/\/+$/, ''), merchantId: ENV_MERCHANT_ID?.trim() || null };
}

export interface UpiPayee {
  /** UPI ID (VPA), e.g. name@okhdfcbank. */
  vpa: string;
  /** Shown to the customer in their UPI app. */
  name: string;
}

/** Who direct UPI payments go to. */
export function upiPayee(): UpiPayee {
  return { vpa: ENV_VPA?.trim() || DEFAULT_UPI_VPA, name: ENV_PAYEE_NAME?.trim() || DEFAULT_PAYEE_NAME };
}
