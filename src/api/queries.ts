import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe } from './account';
import { createBooking, listBookings } from './bookings';
import { isApiError } from './errors';
import { getNearbyWalkers, getPricing, getWeather } from './home';
import { shouldRetry } from './queryClient';
import { cancelSubscription, changeSubscriptionSlot, listSubscriptions, skipSubscriptionWalk } from './subscriptions';
import type { BookingStatus, LatLng, NewBooking, Subscription, Temperament } from './types';

/** Coordinates in a query key: ~10 m cells, so a re-read point doesn't refetch. */
const cell = (value: number, digits: number) => value.toFixed(digits);

/** Every query key in one place, so mutations invalidate the right ones. */
export const queryKeys = {
  me: ['me'] as const,
  bookings: ['bookings'] as const,
  booking: (id: string) => ['bookings', id] as const,
  subscriptions: ['subscriptions'] as const,
  pricing: ['pricing'] as const,
  nearby: (at: LatLng, temperament: Temperament | undefined) =>
    ['walkers', 'nearby', cell(at.lat, 4), cell(at.lng, 4), temperament ?? 'any'] as const,
  // The server caches the weather per ~1 km cell (2 decimals).
  weather: (at: LatLng) => ['weather', cell(at.lat, 2), cell(at.lng, 2)] as const,
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

/** While a walk is on its way or under way, lists refresh this often on a focused screen. */
export const LIVE_LIST_POLL_MS = 15_000;

const liveStatus = (status: string | undefined) => status === 'assigned' || status === 'active';

/**
 * Own walks (GET /bookings), newest first. `poll` (the screen is focused):
 * refresh every 15 s while one of them is assigned or active.
 */
export function useBookingList({ poll = false }: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: listBookings,
    refetchInterval: (query) =>
      poll && query.state.data?.some((booking) => liveStatus(booking.status)) ? LIVE_LIST_POLL_MS : false,
  });
}

/** Own monthly packs (GET /subscriptions), newest first; polls like useBookingList while a pack walk is live. */
export function useSubscriptionList({ poll = false }: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: listSubscriptions,
    refetchInterval: (query) =>
      poll && query.state.data?.some((pack) => liveStatus(pack.nextWalk?.status)) ? LIVE_LIST_POLL_MS : false,
  });
}

/** Prices change at the peak-hour edges, so they're re-read every few minutes. */
export function usePricing() {
  return useQuery({
    queryKey: queryKeys.pricing,
    queryFn: () => getPricing(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/** Walkers near a pickup point; off until there is one. */
export function useNearbyWalkers(at: LatLng | null, temperament: Temperament | undefined) {
  return useQuery({
    queryKey: at ? queryKeys.nearby(at, temperament) : ['walkers', 'nearby', 'none'],
    queryFn: () => getNearbyWalkers(at!, temperament),
    enabled: at !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** 503 `weather_unavailable`: the server has no weather right now (the pill hides). */
export const isWeatherOff = (error: unknown) => isApiError(error) && error.code === 'weather_unavailable';

export function useWeather(at: LatLng | null) {
  return useQuery({
    queryKey: at ? queryKeys.weather(at) : ['weather', 'none'],
    queryFn: () => getWeather(at!),
    enabled: at !== null,
    // The server caches it for 15 minutes.
    staleTime: 15 * 60_000,
    retry: (failures, error) => !isWeatherOff(error) && shouldRetry(failures, error),
  });
}

/** After a pack changes: show the server's copy at once, then refresh the lists it touches. */
function usePackMutation<Input>(mutationFn: (input: Input) => Promise<Subscription>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (pack) => {
      queryClient.setQueryData<Subscription[]>(queryKeys.subscriptions, (list) =>
        list?.map((item) => (item.id === pack.id ? pack : item))
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}

export const useSkipWalk = () =>
  usePackMutation(({ id, date }: { id: string; date?: string }) => skipSubscriptionWalk(id, date));

export const useChangeSlot = () =>
  usePackMutation(({ id, slotMinute }: { id: string; slotMinute: number }) => changeSubscriptionSlot(id, slotMinute));

export const useCancelPack = () => usePackMutation((id: string) => cancelSubscription(id));

/** POST /bookings; the new walk (and a pack it starts) show up on the lists afterwards. */
export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewBooking) => createBooking(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions });
    },
  });
}
