import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { BottomNavigation } from '../components/BottomNavigation';
import { NATIVE_DRIVER } from '../theme/motion';
import { useMascotStatus } from '../mascot/MascotProvider';
import { TABS, activeTabFor, routeForPath, type TabKey } from './navigation';
import { useAppNavigation } from './useAppNavigation';

/** Far enough below the screen edge to hide the bar and its shadow. */
const HIDDEN_OFFSET = 160;

/**
 * The one common bottom navigation bar. Rendered once in the root layout,
 * above the stack, on every route whose group has `tabBar: true` — so it
 * stays put while screens slide underneath it, and slides away on task
 * screens (e.g. booking) or after logging out.
 */
export function AppTabBar() {
  const pathname = usePathname();
  const { section } = useGlobalSearchParams<{ section?: string }>();
  const { goToTab } = useAppNavigation();
  const { hapticsEnabled } = useMascotStatus();

  const route = routeForPath(pathname);
  const visibleKey = route?.tabBar ? activeTabFor(route.key, section)?.key : undefined;

  // Remember the last tab so the pill stays put while the bar slides away.
  const [lastKey, setLastKey] = useState<TabKey | undefined>(visibleKey);
  if (visibleKey && visibleKey !== lastKey) setLastKey(visibleKey);

  const current = visibleKey ?? lastKey;
  if (!current) return null;

  return (
    <SlideIn visible={visibleKey !== undefined}>
      <BottomNavigation
        tabs={TABS}
        current={current}
        onChange={goToTab}
        haptics={hapticsEnabled}
      />
    </SlideIn>
  );
}

function SlideIn({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const [offset] = useState(() => new Animated.Value(HIDDEN_OFFSET));

  useEffect(() => {
    Animated.spring(offset, {
      toValue: visible ? 0 : HIDDEN_OFFSET,
      damping: 16,
      stiffness: visible ? 160 : 220,
      mass: 1,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [offset, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      aria-hidden={!visible}
      style={[styles.layer, { transform: [{ translateY: offset }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    // Above the navigation stack's screens.
    zIndex: 60,
  },
});
