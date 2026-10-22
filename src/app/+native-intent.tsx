import type { NativeIntent } from 'expo-router';
import { PAYMENT_RETURN_PATH } from '../payments/useUpiPayment';

/**
 * The UPI checkout page sends the customer back with pawpal://payment-return.
 * That link only needs to bring the app to the front (the payment sheet then
 * checks the gateway), so it must not open a screen: returning null keeps the
 * current one. If the app was closed meanwhile, start from the home screen.
 */
export const redirectSystemPath: NativeIntent['redirectSystemPath'] = ({ path, initial }) => {
  try {
    if (path.includes(PAYMENT_RETURN_PATH)) return initial ? '/' : null;
    return path;
  } catch {
    return path;
  }
};
