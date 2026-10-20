import React, { useEffect, useMemo } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { TAB_ROUTES } from '../../navigation/navigation';
import { tabTransition } from '../../navigation/tabTransition';
import { useFocusedRouteReader } from '../../navigation/useAppNavigation';
import { colors } from '../../theme/colors';

/** Mount the other tabs once Home has settled, so even the first switch is instant. */
const PRELOAD_DELAY_MS = 1200;

/**
 * Home and Profile live in one tab navigator: both stay mounted, so switching
 * is a quick shift instead of a full stack push. The common tab bar is drawn
 * once by the root layout (AppTabBar), so this navigator renders none.
 */
export default function TabsLayout() {
  const router = useRouter();
  const focusedRoute = useFocusedRouteReader();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = focusedRoute()?.name;
      // Only while a tab is showing: from a pushed task screen this would preload a second tab navigator.
      if (!TAB_ROUTES.some((route) => route.name === current)) return;
      for (const route of TAB_ROUTES) {
        if (route.name !== current) router.prefetch(route.path);
      }
    }, PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focusedRoute, router]);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      sceneStyle: { backgroundColor: colors.canvas },
      ...tabTransition(reduceMotion),
    }),
    [reduceMotion]
  );

  return (
    <Tabs backBehavior="firstRoute" tabBar={() => null} screenOptions={screenOptions}>
      {TAB_ROUTES.map((route) => (
        <Tabs.Screen key={route.key} name={route.name} options={{ title: route.title }} />
      ))}
    </Tabs>
  );
}
