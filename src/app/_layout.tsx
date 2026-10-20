import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { BookingsProvider } from '../booking/BookingsProvider';
import { WalkArrivalBanner } from '../booking/WalkArrivalBanner';
import { MascotProvider } from '../mascot/MascotProvider';
import { AppTabBar } from '../navigation/AppTabBar';
import { STACK_SCREENS } from '../navigation/navigation';
import { colors } from '../theme/colors';

/**
 * The navigation stack (horizontal slides between screens), built from the
 * NAVIGATION config; Home and Profile sit in one '(tabs)' screen of it.
 * Barnaby lives inside each screen's <MascotDockSlot />, and MascotProvider
 * sends his actions to the focused screen's slot. The common tab bar sits on
 * top and stays put while screens slide.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <MascotProvider>
      <BookingsProvider>
        <StatusBar style="dark" />
        <View style={styles.root}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            {STACK_SCREENS.map((screen) => (
              <Stack.Screen
                key={screen.name}
                name={screen.name}
                options={{ title: screen.title, gestureEnabled: screen.gestureEnabled ?? true }}
              />
            ))}
          </Stack>
          <AppTabBar />
          <WalkArrivalBanner />
        </View>
      </BookingsProvider>
    </MascotProvider>
  );
}

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
