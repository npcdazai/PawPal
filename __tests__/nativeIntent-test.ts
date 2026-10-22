import { redirectSystemPath } from '../src/app/+native-intent';

const redirect = (path: string, initial = false) => redirectSystemPath?.({ path, initial });

describe('redirectSystemPath', () => {
  test.each([
    'pawpal://payment-return?order=PAWPAL-1',
    'pawpal://payment-return/',
    'pawpal:///payment-return',
    '/payment-return?order=PAWPAL-1',
    'exp://192.168.1.5:8081/--/payment-return?order=PAWPAL-1',
  ])('keeps the current screen for the payment return link %s', (path) => {
    expect(redirect(path)).toBeNull();
    // Cold start from the payment return: open the home screen.
    expect(redirect(path, true)).toBe('/');
  });

  test.each([
    'pawpal://dashboard',
    'pawpal://walk-plan?next=payment-return',
    'pawpal://payment-return-later',
    'pawpal://shop/payment-return',
    'https://example.com/payment-return',
    '/live-walk',
  ])('passes other links through untouched: %s', (path) => {
    expect(redirect(path)).toBe(path);
    expect(redirect(path, true)).toBe(path);
  });
});
