import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as NetworkModule from 'expo-network';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { isApiError } from './errors';

const MAX_RETRIES = 2;

/**
 * Retry what might work next time (no answer, a 429 or a 5xx), never what the
 * server refused (4xx) or a bug in the app.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && isApiError(error) && error.retryable;
}

/** The app's one QueryClient (APP_INTEGRATION §3): server state lives here, not in React context. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      // Screens mounting together share one fetch instead of each refetching.
      staleTime: 15_000,
    },
  },
});

/**
 * On a phone, "focused" means the app is in the foreground and "online"
 * follows the network: queries refetch when the app comes back, and pause
 * offline. Web keeps React Query's own window events. expo-network is used
 * only when this build includes it.
 */
export function connectQueryManagers() {
  if (Platform.OS === 'web') return;

  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (status) => setFocused(status === 'active'));
    return () => subscription.remove();
  });

  if (!requireOptionalNativeModule('ExpoNetwork')) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only once the native module is known to exist
  const Network = require('expo-network') as typeof NetworkModule;
  onlineManager.setEventListener((setOnline) => {
    // Missing info counts as online, so a quirky report can't pause every query.
    const update = (state: NetworkModule.NetworkState) => setOnline(state.isConnected !== false);
    Network.getNetworkStateAsync()
      .then(update)
      .catch(() => undefined);
    const subscription = Network.addNetworkStateListener(update);
    return () => subscription.remove();
  });
}
