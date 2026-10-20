/**
 * Single source of truth for PawPal's navigation, as one nested
 * JSON-compatible object (plain strings, booleans, objects and arrays only):
 *
 *  - groups  → every route, grouped by whether the common tab bar is shown
 *  - flows   → every named jump between screens and how the stack changes
 *  - tabBar  → the shared bottom navigation bar used by every app screen
 *
 * Screens never hardcode paths: they call `useAppNavigation().go(flow)` or
 * `goToTab(tab)`, and the root layout builds the Stack and the tab bar from here.
 */

/** How a flow changes the stack. */
export type NavAction =
  | 'push' //      add the screen on top
  | 'replace' //   swap the current screen
  | 'back' //      pop back (falls back to replace when there is no history)
  | 'reset' //     make the screen the only one in the stack
  | 'dismissTo' // pop back to an existing screen
  | 'stackOnRoot'; // pop to the root screen, then push (e.g. Dashboard → tracking)

interface RouteConfig {
  /** File name under src/app. */
  name: string;
  path: string;
  title: string;
  /** For tab targets: 'root' screens are popped back to, 'push' screens are pushed. */
  stack?: 'root' | 'push';
  gestureEnabled?: boolean;
}

interface GroupConfig {
  /** Show the common bottom navigation bar on every route in this group. */
  tabBar: boolean;
  routes: Record<string, RouteConfig>;
}

interface FlowConfig {
  to: string;
  action: NavAction;
}

interface TabConfig {
  key: string;
  label: string;
  icon: string;
  route: string;
  /** Section param for tabs that scroll within a screen. */
  section?: string;
}

interface NavigationConfig {
  groups: Record<string, GroupConfig>;
  flows: Record<string, FlowConfig>;
  tabBar: { tabs: readonly TabConfig[] };
}

export const NAVIGATION = {
  groups: {
    onboarding: {
      tabBar: false,
      routes: {
        splash: { name: 'index', path: '/', title: 'Welcome' },
        login: { name: 'login', path: '/login', title: 'Log in' },
        register: { name: 'register', path: '/register', title: 'Create account' },
      },
    },
    app: {
      tabBar: true,
      routes: {
        dashboard: {
          name: 'dashboard',
          path: '/dashboard',
          title: 'Home',
          stack: 'root',
          gestureEnabled: false,
        },
        profile: { name: 'profile', path: '/profile', title: 'Profile', stack: 'push' },
      },
    },
    // Full-screen task flows with their own bottom action bar.
    tasks: {
      tabBar: false,
      routes: {
        walkConfig: { name: 'book-walk', path: '/book-walk', title: 'Book a Walk', stack: 'push' },
        pickupLocation: {
          name: 'pickup-location',
          path: '/pickup-location',
          title: 'Pickup Location',
          stack: 'push',
        },
        walkerEnRoute: {
          name: 'walk-tracking',
          path: '/walk-tracking',
          title: 'Live Walker Tracking',
          stack: 'push',
        },
        liveWalk: { name: 'live-walk', path: '/live-walk', title: 'Live Walk', stack: 'push' },
      },
    },
  },

  flows: {
    begin: { to: 'login', action: 'replace' }, //            Splash "Tap to Begin"
    register: { to: 'register', action: 'push' }, //         Login "Register now"
    signIn: { to: 'login', action: 'back' }, //              Register "Sign in"
    authenticated: { to: 'dashboard', action: 'reset' }, //  Log in / Create Account
    closeProfile: { to: 'dashboard', action: 'back' }, //    Profile back arrow
    signOut: { to: 'login', action: 'reset' }, //            Profile "Log out"
    bookWalk: { to: 'walkConfig', action: 'push' }, //       "Book a Dog Walker" / Log Walk / Rebook
    closeBooking: { to: 'dashboard', action: 'back' }, //    Book a Walk back arrow
    choosePickup: { to: 'pickupLocation', action: 'push' }, // "Select Pickup Location"
    backToWalkSetup: { to: 'walkConfig', action: 'back' }, // Pickup back arrow
    walkBooked: { to: 'dashboard', action: 'dismissTo' }, //  Scheduled walk matched → Done
    trackWalker: { to: 'walkerEnRoute', action: 'stackOnRoot' }, // Instant match → Done / "Track walker"
    startLiveWalk: { to: 'liveWalk', action: 'replace' }, //  "Verify OTP & Start Walk"
    openLiveWalk: { to: 'liveWalk', action: 'stackOnRoot' }, // Dashboard "Live walk"
    exitTracking: { to: 'dashboard', action: 'dismissTo' }, // Tracking back / cancel / walk done
  },

  tabBar: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'home', route: 'dashboard', section: 'home' },
      {
        key: 'activities',
        label: 'Activities',
        icon: 'directions-run',
        route: 'dashboard',
        section: 'activities',
      },
      { key: 'health', label: 'Health', icon: 'monitor-heart', route: 'dashboard', section: 'health' },
      { key: 'profile', label: 'Profile', icon: 'person-outline', route: 'profile' },
    ],
  },
} as const satisfies NavigationConfig;

// ─── Derived, typed views of the config ──────────────────────────────────────

type Groups = typeof NAVIGATION.groups;
type GroupKey = keyof Groups;

export type RouteKey = { [G in GroupKey]: keyof Groups[G]['routes'] }[GroupKey];
export type FlowKey = keyof typeof NAVIGATION.flows;
export type Tab = (typeof NAVIGATION.tabBar.tabs)[number];
export type TabKey = Tab['key'];
export type DashboardSection = NonNullable<Extract<Tab, { route: 'dashboard' }>['section']>;

export interface RouteEntry extends RouteConfig {
  key: RouteKey;
  group: GroupKey;
  tabBar: boolean;
}

/** Every route, flattened, in declaration order. */
export const ROUTE_LIST: readonly RouteEntry[] = (Object.keys(NAVIGATION.groups) as GroupKey[]).flatMap(
  (group) => {
    const config: GroupConfig = NAVIGATION.groups[group];
    return Object.entries(config.routes).map(([key, route]) => ({
      ...route,
      key: key as RouteKey,
      group,
      tabBar: config.tabBar,
    }));
  }
);

export const ROUTES = Object.fromEntries(ROUTE_LIST.map((route) => [route.key, route])) as Record<
  RouteKey,
  RouteEntry
>;

export const TABS: readonly Tab[] = NAVIGATION.tabBar.tabs;

export const DASHBOARD_SECTIONS = TABS.flatMap((tab) =>
  tab.route === 'dashboard' ? [tab.section] : []
) as readonly DashboardSection[];

export function routeForPath(pathname: string): RouteEntry | undefined {
  return ROUTE_LIST.find((route) => route.path === pathname);
}

/** The highlighted tab: the route's first tab unless a section param picks another. */
export function activeTabFor(route: RouteKey, section?: string): Tab | undefined {
  const candidates = TABS.filter((tab) => tab.route === route);
  return candidates.find((tab) => 'section' in tab && tab.section === section) ?? candidates[0];
}
