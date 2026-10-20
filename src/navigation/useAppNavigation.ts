import { useCallback } from 'react';
import { useNavigationContainerRef, useRouter, type Href } from 'expo-router';
import { useMascotActions } from '../mascot/MascotProvider';
import {
  NAVIGATION,
  ROUTES,
  TABS,
  TAB_ROUTES,
  type FlowKey,
  type NavAction,
  type RouteKey,
  type TabKey,
} from './navigation';

/** Position in the tab bar's order, or -1 for screens outside the tabs. */
const tabOrder = (routeName: string | undefined) =>
  TAB_ROUTES.findIndex((route) => route.name === routeName);

interface FocusedRoute {
  name: string;
  params?: Record<string, unknown>;
}

/**
 * Reads the focused screen on demand. Subscribing instead (usePathname) would
 * re-render every screen that navigates on every route change.
 */
export function useFocusedRouteReader() {
  const navigationRef = useNavigationContainerRef();
  return useCallback(
    (): FocusedRoute | undefined =>
      navigationRef.isReady() ? (navigationRef.getCurrentRoute() as FocusedRoute | undefined) : undefined,
    [navigationRef]
  );
}

/**
 * Executes the NAVIGATION config. Every move goes through Barnaby (STATE_EXIT
 * plays over the transition), and his direction follows the stack action or
 * the tab order.
 */
export function useAppNavigation() {
  const router = useRouter();
  const currentRoute = useFocusedRouteReader();
  const { navigate } = useMascotActions();

  const run = useCallback(
    (action: NavAction, to: RouteKey, params?: Record<string, string>) => {
      const { path, name } = ROUTES[to];
      const href: Href = params ? { pathname: path, params } : path;
      const backwards =
        action === 'tab'
          ? tabOrder(name) < tabOrder(currentRoute()?.name)
          : action === 'back' || action === 'dismissTo';

      navigate(
        () => {
          switch (action) {
            case 'push':
              router.push(href);
              break;
            case 'replace':
              router.replace(href);
              break;
            case 'dismissTo':
              router.dismissTo(href);
              break;
            case 'back':
              if (router.canGoBack()) router.back();
              else router.replace(href);
              break;
            case 'reset':
              // Queued together, so the router applies them as one transition.
              if (router.canDismiss()) router.dismissAll();
              router.replace(href);
              break;
            case 'stackOnRoot':
              if (router.canDismiss()) router.dismissAll();
              router.push(href);
              break;
            case 'tab':
              router.navigate(href);
              break;
          }
        },
        backwards ? 'back' : 'forward',
        { inPlace: action === 'tab' }
      );
    },
    [currentRoute, navigate, router]
  );

  /** Follow a named flow from NAVIGATION.flows, optionally with route params. */
  const go = useCallback(
    (flow: FlowKey, params?: Record<string, string>) => {
      const { to, action } = NAVIGATION.flows[flow];
      run(action, to, params);
    },
    [run]
  );

  /** Common tab bar: switch section in place, or switch to the tab's screen. */
  const goToTab = useCallback(
    (key: TabKey) => {
      const tab = TABS.find((candidate) => candidate.key === key);
      if (!tab) return;
      const params = 'section' in tab ? { section: tab.section } : undefined;
      const current = currentRoute();

      if (current?.name === ROUTES[tab.route].name) {
        if (params && params.section !== current.params?.section) router.setParams(params);
        return;
      }
      run('tab', tab.route, params);
    },
    [currentRoute, router, run]
  );

  return { go, goToTab };
}
