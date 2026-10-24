import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { apiBaseUrl } from '../api/config';
import { useMe } from '../api/queries';
import { connectQueryManagers, queryClient } from '../api/queryClient';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { BookingsProvider } from '../booking/BookingsProvider';
import { WalkArrivalBanner } from '../booking/WalkArrivalBanner';
import { ErrorScreen } from '../components/ErrorScreen';
import { MascotProvider } from '../mascot/MascotProvider';
import { initMonitoring, Sentry } from '../monitoring/sentry';
import { AppTabBar } from '../navigation/AppTabBar';
import { ROUTES, STACK_SCREENS, type RouteAccess } from '../navigation/navigation';
import { usePushNotifications } from '../notifications/push';
import { colors } from '../theme/colors';

initMonitoring();
connectQueryManagers();

/** Render errors anywhere below get the recovery screen (and go to Sentry when enabled). */
export const ErrorBoundary = Sentry.wrapExpoRouterErrorBoundary(ErrorScreen);

/**
 * The navigation stack (horizontal slides between screens), built from the
 * NAVIGATION config; Home and Profile sit in one '(tabs)' screen of it.
 * Barnaby lives inside each screen's <MascotDockSlot />, and MascotProvider
 * sends his actions to the focused screen's slot. The common tab bar sits on
 * top and stays put while screens slide.
 */
function RootLayout() {
  // A release build without EXPO_PUBLIC_API_URL stops here, on the error screen (and in Sentry).
  apiBaseUrl();

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // A font that fails to load shouldn't block the app: carry on with system fonts.
  useEffect(() => {
    if (fontError) Sentry.captureException(fontError);
  }, [fontError]);

  if (!fontsLoaded && !fontError) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MascotProvider>
          <BookingsProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </BookingsProvider>
        </MascotProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const screensFor = (access: RouteAccess) =>
  STACK_SCREENS.filter((screen) => screen.access === access).map((screen) => (
    <Stack.Screen
      key={screen.name}
      name={screen.name}
      options={{ title: screen.title, gestureEnabled: screen.gestureEnabled ?? true }}
    />
  ));

/**
 * The route guard: signed-out people only reach the splash and sign-in, a new
 * account names itself first, and everything else needs a session. When the
 * state changes, the stack drops the screens that are no longer allowed and
 * each group names where to go instead. Expo Router's default (the anchor)
 * would be the splash screen, or the '(tabs)' group itself, which has no index
 * route: both end on "Unmatched Route".
 */
function RootNavigator() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  // Unknown (still loading, or offline) counts as named, so nobody is held at the name step.
  const { data: me } = useMe(signedIn);
  const needsName = signedIn && me?.user.name.trim() === '';
  const home = needsName ? ROUTES.yourName.path : ROUTES.dashboard.path;
  const signedOutHome = ROUTES.login.path;

  usePushNotifications(signedIn);

  if (status === 'restoring') return <Loading />;

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Protected guard={!signedIn} redirectTo={home}>
          {screensFor('signedOut')}
        </Stack.Protected>
        <Stack.Protected guard={needsName} redirectTo={signedIn ? home : signedOutHome}>
          {screensFor('nameStep')}
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !needsName} redirectTo={signedIn ? home : signedOutHome}>
          {screensFor('signedIn')}
        </Stack.Protected>
      </Stack>
      <AppTabBar />
      <WalkArrivalBanner />
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading PawPal" />
    </View>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
});
