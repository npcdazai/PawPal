import { useEffect } from 'react';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { registerDevice, unregisterDevice } from '../api/account';
import { isApiError } from '../api/errors';
import { queryKeys } from '../api/queries';
import { devLog, type LogFields } from '../monitoring/devLog';
import { Sentry } from '../monitoring/sentry';
import { notificationHref } from './notificationRoutes';

/** Console lines about push. Never the device token. */
const log = devLog('push');

/** Why a push step failed: the API's code and copy, or the error itself. */
const failure = (error: unknown): LogFields =>
  isApiError(error) ? { reason: error.code, status: error.status, message: error.message } : { error };

/** getDevicePushTokenAsync on Android without google-services.json (FCM isn't set up in this build). */
const NO_FIREBASE = /firebase|google-services|fcm/i;

/**
 * expo-notifications when this build includes it. Not on web (the API's push
 * goes to FCM/APNs device tokens), and not in dev clients built before it was
 * added: those simply get no push.
 */
const Notifications: typeof NotificationsModule | null =
  Platform.OS !== 'web' && requireOptionalNativeModule('ExpoPushTokenManager')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only once the native module is known to exist
      (require('expo-notifications') as typeof NotificationsModule)
    : null;

const ANDROID_CHANNEL_ID = 'walks';

// A push that arrives with the app open still shows: it may be about another walk than the one on screen.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The token this install registered for the signed-in account, so sign-out can remove it. */
let registeredToken: string | null = null;

/**
 * After sign-in (and on each launch, in case the token changed): ask for
 * permission, get this install's FCM / APNs token and give it to the API.
 * Best effort: no permission, no network, or a development build without
 * google-services.json just means no push.
 */
async function registerForPush(): Promise<void> {
  if (!Notifications) {
    log.info('Push skipped', { reason: Platform.OS === 'web' ? 'web build' : 'expo-notifications isn’t in this build' });
    return;
  }
  let step = 'permission';
  try {
    if (Platform.OS === 'android') {
      // Android 13+ only shows the permission prompt once a channel exists.
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Walk updates',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    const asked = !permission.granted && permission.canAskAgain;
    if (asked) permission = await Notifications.requestPermissionsAsync();
    log.info(`Push permission ${permission.granted ? 'granted' : 'not granted'}`, {
      status: permission.status,
      askedNow: asked,
    });
    if (!permission.granted) {
      log.info('Push skipped', { reason: 'notifications denied' });
      return;
    }

    step = 'device token';
    let data: unknown;
    try {
      ({ data } = await Notifications.getDevicePushTokenAsync());
    } catch (error) {
      if (error instanceof Error && NO_FIREBASE.test(error.message)) {
        log.info('Push skipped', { reason: 'no Firebase (google-services.json) in this build' });
        if (!__DEV__) Sentry.captureException(error);
        return;
      }
      throw error;
    }
    if (typeof data !== 'string' || !data) {
      log.warn('Push skipped', { reason: 'no device token' });
      return;
    }
    step = 'register device';
    await registerDevice(data, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = data;
    log.info('Device registered for push', { platform: Platform.OS });
  } catch (error) {
    log.warn(`Push setup failed at ${step}`, failure(error));
    if (!__DEV__) Sentry.captureException(error);
  }
}

/** Sign-out: stop this install getting the account's pushes (while the session still works). */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await unregisterDevice(token);
    log.info('Device unregistered from push');
  } catch (error) {
    // The server drops tokens FCM rejects; nothing more to do offline.
    log.warn('Couldn’t unregister the device from push', failure(error));
  }
}

/**
 * Push for the signed-in app: registers the device, opens the right screen
 * when a notification is tapped (including the one that launched the app),
 * and refreshes bookings as soon as a push about one arrives in the foreground.
 */
export function usePushNotifications(signedIn: boolean) {
  const queryClient = useQueryClient();
  const { push } = useRouter();

  useEffect(() => {
    if (signedIn) void registerForPush();
  }, [signedIn]);

  useEffect(() => {
    if (!Notifications || !signedIn) return undefined;
    const notifications = Notifications;

    const open = (response: NotificationsModule.NotificationResponse) => {
      const href = notificationHref(response.notification.request.content.data);
      if (href) push(href);
    };

    const launchedBy = notifications.getLastNotificationResponse();
    if (launchedBy) {
      notifications.clearLastNotificationResponse();
      open(launchedBy);
    }

    const tapped = notifications.addNotificationResponseReceivedListener(open);
    const received = notifications.addNotificationReceivedListener((notification) => {
      if (notification.request.content.data?.bookingId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      }
    });
    return () => {
      tapped.remove();
      received.remove();
    };
  }, [push, queryClient, signedIn]);
}
