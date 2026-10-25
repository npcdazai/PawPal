import { useBookingList, useNearbyWalkers, usePricing, useSubscriptionList, useWeather, isWeatherOff } from '../api/queries';
import type { Booking } from '../api/types';
import { useBookings } from './BookingsProvider';
import { currentPack, homeContext } from './homeModel';

const NO_BOOKINGS: readonly Booking[] = [];

/**
 * Everything the home screen reads from the API, and where the dog lives
 * (for the walker radar and the weather). `focused`: lists poll while a walk is
 * live and the screen is in front.
 */
export function useHomeData({ focused }: { focused: boolean }) {
  const { societyProfile } = useBookings();
  const bookingsQuery = useBookingList({ poll: focused });
  const packsQuery = useSubscriptionList({ poll: focused });
  const pricingQuery = usePricing();

  const bookings = bookingsQuery.data ?? NO_BOOKINGS;
  const pack = packsQuery.data ? currentPack(packsQuery.data) : null;
  const context = homeContext({ bookings, pack, profile: societyProfile });

  const nearbyQuery = useNearbyWalkers(context.pickup, context.temperament);
  const weatherQuery = useWeather(context.pickup);

  return {
    bookingsQuery,
    packsQuery,
    pricingQuery,
    nearbyQuery,
    bookings,
    pack,
    context,
    /** Hidden on 503 (or any failure): never a stale or made-up temperature. */
    weather: weatherQuery.data && !weatherQuery.isError ? weatherQuery.data : null,
    weatherOff: isWeatherOff(weatherQuery.error),
    refetchAll: () =>
      Promise.all([
        bookingsQuery.refetch(),
        packsQuery.refetch(),
        pricingQuery.refetch(),
        context.pickup ? nearbyQuery.refetch() : null,
        context.pickup ? weatherQuery.refetch() : null,
      ]),
  };
}
