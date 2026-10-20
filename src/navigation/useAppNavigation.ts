import { useCallback } from 'react';
import { useGlobalSearchParams, usePathname, useRouter, type Href } from 'expo-router';
import { useMascotActions } from '../mascot/MascotProvider';
import {
  NAVIGATION,
  ROUTES,
  TABS,
  routeForPath,
  type FlowKey,
  type NavAction,
  type RouteKey,
  type TabKey,
} from './navigation';

/**
 * Executes the NAVIGATION config. Every move goes through Barnaby
 * (STATE_EXIT plays first), and the direction follows the stack action.
 */
export function useAppNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { section } = useGlobalSearchParams<{ section?: string }>();
  const { navigate } = useMascotActions();

  const run = useCallback(
    (action: NavAction, to: RouteKey, params?: Record<string, string>) => {
      const { path } = ROUTES[to];
      const href: Href = params ? { pathname: path, params } : path;
      const backwards = action === 'back' || action === 'dismissTo';

      navigate(() => {
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
        }
      }, backwards ? 'back' : 'forward');
    },
    [navigate, router]
  );

  /** Follow a named flow from NAVIGATION.flows, optionally with route params. */
  const go = useCallback(
    (flow: FlowKey, params?: Record<string, string>) => {
      const { to, action } = NAVIGATION.flows[flow];
      run(action, to, params);
    },
    [run]
  );

  /** Common tab bar: switch section in place, or move to the tab's screen. */
  const goToTab = useCallback(
    (key: TabKey) => {
      const tab = TABS.find((candidate) => candidate.key === key);
      if (!tab) return;
      const params = 'section' in tab ? { section: tab.section } : undefined;
      const current = routeForPath(pathname);

      if (current?.key === tab.route) {
        if (params && params.section !== section) router.setParams(params);
        return;
      }
      run(ROUTES[tab.route].stack === 'root' ? 'dismissTo' : 'push', tab.route, params);
    },
    [pathname, router, run, section]
  );

  return { go, goToTab };
}
