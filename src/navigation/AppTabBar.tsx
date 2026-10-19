import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { BottomNavigation } from '../components/BottomNavigation';
import { NATIVE_DRIVER } from '../mascot/MascotMachine';
import { TABS, activeTabFor, routeForPath } from './navigation';
import { useAppNavigation } from './useAppNavigation';

/**
 * The one common bottom navigation bar. Rendered once in the root layout,
 * above the stack, on every route whose group has `tabBar: true` — so it
 * stays put while screens slide underneath it.
 */
export function AppTabBar() {
  const pathname = usePathname();
  const { section } = useGlobalSearchParams<{ section?: string }>();
  const { goToTab } = useAppNavigation();

  const route = routeForPath(pathname);
  const active = route?.tabBar ? activeTabFor(route.key, section) : undefined;
  if (!active) return null;

  return (
    <SlideIn>
      <BottomNavigation tabs={TABS} current={active.key} onChange={goToTab} />
    </SlideIn>
  );
}

/** Rises into place when the bar first appears (e.g. after logging in). */
function SlideIn({ children }: { children: React.ReactNode }) {
  const [offset] = useState(() => new Animated.Value(140));

  useEffect(() => {
    Animated.spring(offset, {
      toValue: 0,
      damping: 16,
      stiffness: 160,
      mass: 1,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [offset]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.layer, { transform: [{ translateY: offset }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    // Above the mascot stage (50) so Barnaby never covers the tabs.
    zIndex: 60,
  },
});
