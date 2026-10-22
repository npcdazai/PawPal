import Constants from 'expo-constants';

export type AppVariant = 'development' | 'preview' | 'production';

/** The app version from app.config.ts (which reads it from package.json). */
export const APP_VERSION: string | null = Constants.expoConfig?.version ?? null;

/** The build variant app.config.ts was evaluated with (APP_VARIANT). */
export const APP_VARIANT: AppVariant =
  (Constants.expoConfig?.extra?.appVariant as AppVariant | undefined) ?? 'production';

/** "PawPal App" → "PawPal App v1.0.0". */
export const withVersion = (name: string) => (APP_VERSION ? `${name} v${APP_VERSION}` : name);
