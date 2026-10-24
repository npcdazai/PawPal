import type { ExpoConfig } from 'expo/config';
import { withSentry } from '@sentry/react-native/expo';
import packageJson from './package.json';

/**
 * PawPal app config. Build-time inputs (all optional locally):
 *
 *  - APP_VARIANT          development | preview | production (default). Set by
 *                         each eas.json profile; non-production variants get
 *                         their own identifier and name so all three install
 *                         side by side.
 *  - APP_BUNDLE_ID        iOS bundle identifier and Android package.
 *  - EXPO_PUBLIC_EAS_PROJECT_ID  EAS project id; enables EAS Update.
 *  - SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN  source map uploads.
 *  - EXPO_PUBLIC_SENTRY_DSN      crash reporting (read by the app at runtime).
 *  - EXPO_PUBLIC_API_URL         the PawPal API (read at runtime; required in
 *                                preview/production builds, HTTPS).
 *  - GOOGLE_SERVICES_JSON / GOOGLE_SERVICE_INFO_PLIST  paths to the Firebase
 *                                project's google-services.json (Android) and
 *                                GoogleService-Info.plist (iOS), e.g. EAS file
 *                                variables. Android push (FCM) needs the first.
 */

const VARIANTS = ['development', 'preview', 'production'] as const;
type AppVariant = (typeof VARIANTS)[number];

const appVariant = (process.env.APP_VARIANT || 'production') as AppVariant;
if (!VARIANTS.includes(appVariant)) {
  throw new Error(`APP_VARIANT must be one of ${VARIANTS.join(', ')} (got "${process.env.APP_VARIANT}").`);
}

// Placeholder: the store identifier isn't decided yet. Set APP_BUNDLE_ID (for
// example as an EAS environment variable) before the first store build; it
// can't be changed once the app is published.
const BASE_BUNDLE_ID = process.env.APP_BUNDLE_ID || 'com.example.pawpal';
// Valid as both an Android package and an iOS bundle identifier.
if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(BASE_BUNDLE_ID)) {
  throw new Error(`APP_BUNDLE_ID "${BASE_BUNDLE_ID}" is not a valid reverse-domain identifier.`);
}

const VARIANT_SUFFIX: Record<AppVariant, { id: string; name: string }> = {
  development: { id: '.dev', name: ' (Dev)' },
  preview: { id: '.preview', name: ' (Preview)' },
  production: { id: '', name: '' },
};

const bundleId = `${BASE_BUNDLE_ID}${VARIANT_SUFFIX[appVariant].id}`;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
const googleServiceInfoPlist = process.env.GOOGLE_SERVICE_INFO_PLIST;

const config: ExpoConfig = {
  name: `PawPal${VARIANT_SUFFIX[appVariant].name}`,
  slug: 'PawPal',
  version: packageJson.version,
  // Every store release (new `version`) gets its own update runtime.
  runtimeVersion: { policy: 'appVersion' },
  // EAS Update only once the project is linked to EAS.
  ...(easProjectId ? { updates: { url: `https://u.expo.dev/${easProjectId}` } } : null),
  scheme: 'pawpal',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    // Phone-only portrait layout.
    supportsTablet: false,
    bundleIdentifier: bundleId,
    ...(googleServiceInfoPlist ? { googleServicesFile: googleServiceInfoPlist } : null),
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: bundleId,
    ...(googleServicesJson ? { googleServicesFile: googleServicesJson } : null),
    allowBackup: false,
    // Pulled in by dependencies' manifests; PawPal uses none of them.
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'PawPal uses your location to show your pickup spot and your walker on the map.',
      },
    ],
    'expo-font',
    'expo-router',
    '@maplibre/maplibre-react-native',
    'expo-web-browser',
    'expo-image',
    // Walk updates (FCM on Android, APNs on iOS); the device token goes to the API.
    ['expo-notifications', { color: '#2962FF' }],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#FFFDF9',
      },
    ],
  ],
  extra: {
    appVariant,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : null),
  },
};

export default withSentry(config, {
  organization: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Without an auth token there's nothing to upload with: skip the upload
  // instead of failing the native build.
  disableAutoUpload: !process.env.SENTRY_AUTH_TOKEN,
});
