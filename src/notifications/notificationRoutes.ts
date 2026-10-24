import type { Href } from 'expo-router';
import { ROUTES } from '../navigation/navigation';

/**
 * Where a tapped push opens (APP_INTEGRATION §5), from its `data`:
 * `booking` → that booking's tracking screen, `walk_event` → its live walk.
 * The partner app's types (`offer`, `verification`) and pushes without a
 * booking id leave the app where it is.
 */
export function notificationHref(data: Record<string, unknown> | null | undefined): Href | null {
  const bookingId = typeof data?.bookingId === 'string' ? data.bookingId.trim() : '';
  if (!bookingId) return null;
  switch (data?.type) {
    case 'booking':
      return { pathname: ROUTES.walkerEnRoute.path, params: { id: bookingId } };
    case 'walk_event':
      return { pathname: ROUTES.liveWalk.path, params: { id: bookingId } };
    default:
      return null;
  }
}
