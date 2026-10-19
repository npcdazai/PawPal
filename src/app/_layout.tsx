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
import { MascotProvider } from '../mascot/MascotProvider';
import { MascotStage } from '../mascot/MascotStage';
import { AppTabBar } from '../navigation/AppTabBar';
import { ROUTE_LIST } from '../navigation/navigation';
import { colors } from '../theme/colors';

/**
 * Layer 0 is the navigation stack (horizontal slides between screens), built
 * from the NAVIGATION config. Layer 1 is the persistent mascot stage drawn
 * above it, so Barnaby is one living companion who walks between screens.
 * The common tab bar sits on top of both and stays put while screens slide.
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
      <StatusBar style="dark" />
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          {ROUTE_LIST.map((route) => (
            <Stack.Screen
              key={route.key}
              name={route.name}
              options={{ title: route.title, gestureEnabled: route.gestureEnabled ?? true }}
            />
          ))}
        </Stack>
        <MascotStage />
        <AppTabBar />
      </View>
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
