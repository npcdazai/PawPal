import { Platform } from 'react-native';

/**
 * The part of @react-native-firebase/auth's modular API that SMS sign-in uses
 * (getAuth → signInWithPhoneNumber → confirm(code) → getIdToken). Declared here
 * because the package is only in builds that ship Firebase.
 */
export interface FirebaseUser {
  phoneNumber: string | null;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export interface FirebaseAuth {
  currentUser: FirebaseUser | null;
}

export interface PhoneConfirmation {
  /** Resolves with the signed-in credential, or null when Android already verified the SMS by itself. */
  confirm(code: string): Promise<{ user: FirebaseUser } | null>;
}

export interface FirebaseAuthModule {
  getAuth(): FirebaseAuth;
  signInWithPhoneNumber(auth: FirebaseAuth, phoneNumber: string): Promise<PhoneConfirmation>;
  signOut(auth: FirebaseAuth): Promise<void>;
}

interface FirebaseAppModule {
  getApp(): unknown;
}

let loaded: FirebaseAuthModule | null | undefined;

/**
 * Firebase Auth when this build has it: the package installed, its native
 * module linked, and the default app configured from google-services.json /
 * GoogleService-Info.plist (getApp() throws otherwise). Null everywhere else,
 * web included, so sign-in reports it isn't configured instead of crashing.
 * React Native Firebase isn't an Expo module, so the guard is the try/catch:
 * Metro treats a require inside a try block as optional.
 */
export function firebaseAuth(): FirebaseAuthModule | null {
  if (loaded !== undefined) return loaded;
  loaded = null;
  if (Platform.OS === 'web') return loaded;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional: absent from builds without Firebase
    const app = require('@react-native-firebase/app') as FirebaseAppModule;
    app.getApp();
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional: absent from builds without Firebase
    loaded = require('@react-native-firebase/auth') as FirebaseAuthModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

/** Firebase Auth error codes people can act on, with what to tell them. */
const FIREBASE_ERROR_COPY: Record<string, string> = {
  'auth/invalid-verification-code': 'That code isn’t right. Check the SMS and try again.',
  'auth/code-expired': 'That code has expired. Send a new one.',
  'auth/session-expired': 'That code has expired. Send a new one.',
  'auth/invalid-phone-number': 'That phone number isn’t valid. Check it and try again.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/quota-exceeded': 'We can’t send more codes right now. Try again later.',
  'auth/network-request-failed': 'Couldn’t reach the SMS service. Check your connection and try again.',
};

/** User-facing copy for a Firebase Auth error; `known` is false for setup problems worth reporting. */
export function describeFirebaseError(error: unknown): { message: string; known: boolean } {
  const code = (error as { code?: unknown } | null)?.code;
  const copy = typeof code === 'string' ? FIREBASE_ERROR_COPY[code] : undefined;
  return copy
    ? { message: copy, known: true }
    : { message: 'We couldn’t verify your number. Try again.', known: false };
}
