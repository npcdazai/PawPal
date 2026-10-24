import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { devLog } from '../monitoring/devLog';

const log = devLog('app');

/** The API's port when it runs on the developer's computer (`npm run dev`). */
const DEV_API_PORT = 4000;

export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

export interface ApiUrlInputs {
  /** EXPO_PUBLIC_API_URL, baked in at build time. */
  envUrl: string | undefined;
  /** __DEV__: only development builds may fall back to the computer running Metro. */
  isDev: boolean;
  platform: string;
  /** Constants.expoConfig.hostUri, e.g. "192.168.1.5:8081". */
  hostUri: string | undefined;
}

/** "192.168.1.5:8081/--/x" → "192.168.1.5" (null for anything unusable). */
function hostOf(hostUri: string | undefined): string | null {
  const host = hostUri
    ?.replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
    .split('/')[0]
    .replace(/:\d+$/, '');
  return host || null;
}

/**
 * The API base URL (no trailing slash). EXPO_PUBLIC_API_URL when set, and it's
 * required in release builds, over HTTPS (Android release builds block plain
 * HTTP). Development falls back to the API on the computer serving the bundle:
 * localhost on web, the Metro host on a device.
 */
export function resolveApiUrl({ envUrl, isDev, platform, hostUri }: ApiUrlInputs): string {
  const configured = envUrl?.trim().replace(/\/+$/, '');
  if (configured) {
    if (!/^https?:\/\/[^/\s]+/i.test(configured)) {
      throw new ApiConfigError(`EXPO_PUBLIC_API_URL "${configured}" isn't an http(s) URL.`);
    }
    if (!isDev && !configured.toLowerCase().startsWith('https://')) {
      throw new ApiConfigError('EXPO_PUBLIC_API_URL must use HTTPS in release builds.');
    }
    return configured;
  }
  if (!isDev) {
    throw new ApiConfigError('EXPO_PUBLIC_API_URL is not set. Release builds need the API address.');
  }
  const host = platform === 'web' ? 'localhost' : (hostOf(hostUri) ?? 'localhost');
  return `http://${host}:${DEV_API_PORT}`;
}

/** How resolveApiUrl picked the address, for the startup log line. */
export function apiUrlSource({ envUrl, platform, hostUri }: ApiUrlInputs): string {
  if (envUrl?.trim()) return 'EXPO_PUBLIC_API_URL';
  if (platform === 'web') return 'web build: localhost';
  const host = hostOf(hostUri);
  return host ? `the Metro host (${host})` : 'no Metro host known: localhost';
}

let cached: string | null = null;

/** This build's API base URL. Throws ApiConfigError when the build is misconfigured. */
export function apiBaseUrl(): string {
  if (cached === null) {
    const inputs: ApiUrlInputs = {
      envUrl: process.env.EXPO_PUBLIC_API_URL,
      isDev: __DEV__,
      platform: Platform.OS,
      hostUri: Constants.expoConfig?.hostUri,
    };
    try {
      cached = resolveApiUrl(inputs);
    } catch (error) {
      log.error('No usable API address', { error });
      throw error;
    }
    log.info(`API ${cached}`, { from: apiUrlSource(inputs), platform: inputs.platform });
  }
  return cached;
}
