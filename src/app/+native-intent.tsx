import type { NativeIntent } from 'expo-router';
import { ROUTES } from '../navigation/navigation';
import { PAYMENT_RETURN_PATH } from '../payments/useUpiPayment';

/**
 * The route part of an incoming link, without its scheme, Expo Go prefix,
 * query or hash: "pawpal://payment-return?order=…", "/payment-return" and
 * "exp://host:8081/--/payment-return" all give "payment-return".
 */
function routeOf(path: string): string {
  const [location] = path.split(/[?#]/);
  const expoGo = location.indexOf('/--/');
  const route = expoGo >= 0 ? location.slice(expoGo + 4) : location.replace(/^[a-z][a-z\d+.-]*:\/\//i, '');
  return route.replace(/^\/+|\/+$/g, '');
}

/**
 * The UPI checkout page sends the customer back with pawpal://payment-return.
 * That link only needs to bring the app to the front (the payment sheet then
 * checks the gateway), so it must not open a screen: returning null keeps the
 * current one. If the app was closed meanwhile, start from the home screen
 * (not '/': that's the signed-out splash, which the route guard hides from a
 * signed-in customer). Only that exact route is intercepted; every other link
 * passes through.
 */
export const redirectSystemPath: NativeIntent['redirectSystemPath'] = ({ path, initial }) => {
  try {
    if (routeOf(path) === PAYMENT_RETURN_PATH) return initial ? ROUTES.dashboard.path : null;
    return path;
  } catch {
    return path;
  }
};
