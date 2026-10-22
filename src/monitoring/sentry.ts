import * as Sentry from '@sentry/react-native';
import { APP_VARIANT } from '../config/appInfo';

/**
 * Crash reporting, on only when EXPO_PUBLIC_SENTRY_DSN is set (baked into the
 * bundle at build time). Without a DSN every Sentry call below is a no-op.
 */
export function initMonitoring() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, environment: APP_VARIANT });
}

export { Sentry };
