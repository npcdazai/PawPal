import { useQuery } from '@tanstack/react-query';
import { getMe } from './account';
import type { BookingStatus } from './types';

/** Every query key in one place, so mutations invalidate the right ones. */
export const queryKeys = {
  me: ['me'] as const,
  bookings: ['bookings'] as const,
  booking: (id: string) => ['bookings', id] as const,
  subscriptions: ['subscriptions'] as const,
};

/**
 * APP_INTEGRATION §3: how often to poll one booking while its screen is
 * focused and the app is in front. False once nothing more will happen.
 */
export function bookingPollInterval(status: BookingStatus | undefined): number | false {
  switch (status) {
    case 'assigned':
    case 'active':
      return 5_000;
    case 'searching':
    case 'awaiting_payment':
      return 10_000;
    default:
      return false;
  }
}

/** The signed-in person (GET /me). Seeded at sign-in, so it's there straight away. */
export function useMe(enabled = true) {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe, enabled });
}
