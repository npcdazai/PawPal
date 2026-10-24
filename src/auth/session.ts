import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as SecureStoreModule from 'expo-secure-store';
import { devLog } from '../monitoring/devLog';
import { Sentry } from '../monitoring/sentry';

const SESSION_KEY = 'pawpal.session';

const log = devLog('auth');

/**
 * expo-secure-store when this build includes it. Web has no secure storage and
 * dev clients built before it was added lack the native module: there the
 * session lives in memory only and ends when the app restarts.
 */
const secureStore: typeof SecureStoreModule | null = requireOptionalNativeModule('ExpoSecureStore')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only once the native module is known to exist
    (require('expo-secure-store') as typeof SecureStoreModule)
  : null;

if (!secureStore && __DEV__ && Platform.OS !== 'web') {
  console.warn('expo-secure-store is missing from this build: sign-in lasts until the app restarts. Rebuild the dev client.');
}

let token: string | null = null;
const clearedListeners = new Set<() => void>();

/** The API session token, if signed in. */
export const sessionToken = () => token;

/** Reads the stored session at launch. */
export async function restoreSession(): Promise<string | null> {
  if (!secureStore) {
    log.info(token ? 'Session restored (from memory)' : 'No saved session: sign-in screen next', {
      storage: 'memory only in this build',
    });
    return token;
  }
  try {
    token = (await secureStore.getItemAsync(SESSION_KEY)) || null;
    log.info(token ? 'Session restored: signed in' : 'No saved session: sign-in screen next');
  } catch (error) {
    // Unreadable (e.g. the keystore was reset): sign in again.
    Sentry.captureException(error);
    token = null;
    log.warn('Saved session unreadable: sign in again', { error });
  }
  return token;
}

/** Keeps a new session. If storing fails it still lasts until the app restarts. */
export async function saveSession(next: string): Promise<void> {
  token = next;
  if (!secureStore) return;
  try {
    await secureStore.setItemAsync(SESSION_KEY, next);
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** Forgets the session (sign-out, or the server rejected it) and tells the listeners. */
export async function clearSession(): Promise<void> {
  token = null;
  if (secureStore) {
    try {
      await secureStore.deleteItemAsync(SESSION_KEY);
    } catch (error) {
      Sentry.captureException(error);
    }
  }
  for (const listener of clearedListeners) listener();
}

/** Called whenever the session ends, whoever ended it. */
export function onSessionCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => {
    clearedListeners.delete(listener);
  };
}
