/**
 * Single source of truth for PawPal's navigation, as one nested
 * JSON-compatible object (plain strings, booleans, objects and arrays only):
 *
 *  - groups  → every route, grouped by whether the common tab bar is shown
 *  - flows   → every named jump between screens and how the stack changes
 *  - tabBar  → the shared bottom navigation bar used by every app screen
 *
 * Screens never hardcode paths: they call `useAppNavigation().go(flow)` or
 * `goToTab(tab)`, and the layouts build the Stack, the Tabs and the tab bar from here.
 */

/** How a flow changes the stack. */
export type NavAction =
  | 'push' //      add the screen on top
  | 'replace' //   swap the current screen
  | 'back' //      pop back (falls back to replace when there is no history)
  | 'reset' //     make the screen the only one in the stack
  | 'dismissTo' // pop back to an existing screen
  | 'stackOnRoot' // pop to the root screen, then push (e.g. Dashboard → tracking)
  | 'tab'; //       switch tabs in place (tab screens stay mounted)

interface RouteConfig {
  /** File name under src/app (inside the group's layout folder, if it has one). */
  name: string;
  path: string;
  title: string;
  gestureEnabled?: boolean;
}

/**
 * Who may open a group's routes (the root layout's route guard):
 *  - signedOut → before sign-in only
 *  - nameStep  → signed in, while the account has no name yet
 *  - signedIn  → signed in with a name
 */
export type RouteAccess = 'signedOut' | 'nameStep' | 'signedIn';

interface GroupConfig {
  access: RouteAccess;
  /** Show the common bottom navigation bar on every route in this group. */
  tabBar: boolean;
  /**
   * Folder under src/app whose navigator hosts these routes. '(tabs)' keeps
   * every screen in the group mounted, so switching between them is instant.
   * Omitted: the routes are pushed on the root stack.
   */
  layout?: string;
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
      access: 'signedOut',
      tabBar: false,
      routes: {
        splash: { name: 'index', path: '/', title: 'Welcome' },
        login: { name: 'login', path: '/login', title: 'Sign in' },
      },
    },
    // A new account's first stop: phone sign-in creates it without a name.
    setup: {
      access: 'nameStep',
      tabBar: false,
      routes: {
        yourName: { name: 'your-name', path: '/your-name', title: 'Your name', gestureEnabled: false },
      },
    },
    // The tab screens: one tab navigator on the root stack, in tab-bar order.
    app: {
      access: 'signedIn',
      tabBar: true,
      layout: '(tabs)',
      routes: {
        dashboard: { name: 'dashboard', path: '/dashboard', title: 'Home' },
        profile: { name: 'profile', path: '/profile', title: 'Profile' },
      },
    },
    // Full-screen task flows with their own bottom action bar.
    tasks: {
      access: 'signedIn',
      tabBar: false,
      routes: {
        societySetup: { name: 'book-walk', path: '/book-walk', title: 'Society & Behavioral Profile' },
        walkPlan: { name: 'walk-plan', path: '/walk-plan', title: 'Slot Stacking & Plan' },
        walkerEnRoute: { name: 'walk-tracking', path: '/walk-tracking', title: 'Walker Match & OTP' },
        liveWalk: { name: 'live-walk', path: '/live-walk', title: 'Live Society Walk' },
      },
    },
  },

  // Signing in, naming a new account and signing out need no flow: the root
  // layout's route guard moves to the screens the new state allows.
  flows: {
    begin: { to: 'login', action: 'replace' }, //            Splash "Tap to Begin"
    closeProfile: { to: 'dashboard', action: 'tab' }, //     Profile back arrow
    bookWalk: { to: 'societySetup', action: 'push' }, //     "Book a Dog Walker" / Log Walk / Rebook
    closeBooking: { to: 'dashboard', action: 'back' }, //    Society profile back arrow
    chooseWalkPlan: { to: 'walkPlan', action: 'push' }, //   "Choose Walk Plan & Slot"
    backToSociety: { to: 'societySetup', action: 'back' }, // Walk plan back arrow
    trackWalker: { to: 'walkerEnRoute', action: 'stackOnRoot' }, // Paid → "Confirm Slot & View Walker" / "Track walker"
    startLiveWalk: { to: 'liveWalk', action: 'replace' }, //  "Verify OTP & Start GPS Walk"
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
  access: RouteAccess;
  tabBar: boolean;
  layout?: string;
}

/** Every route, flattened, in declaration order. */
export const ROUTE_LIST: readonly RouteEntry[] = (Object.keys(NAVIGATION.groups) as GroupKey[]).flatMap(
  (group) => {
    const config: GroupConfig = NAVIGATION.groups[group];
    return Object.entries(config.routes).map(([key, route]) => ({
      ...route,
      key: key as RouteKey,
      group,
      access: config.access,
      tabBar: config.tabBar,
      layout: config.layout,
    }));
  }
);

export const ROUTES = Object.fromEntries(ROUTE_LIST.map((route) => [route.key, route])) as Record<
  RouteKey,
  RouteEntry
>;

/** Screens hosted by the '(tabs)' navigator, in tab order. */
export const TAB_ROUTES = ROUTE_LIST.filter((route) => route.layout === '(tabs)');

type StackScreen = Pick<RouteEntry, 'name' | 'title' | 'gestureEnabled' | 'access'>;

/**
 * Screens of the root stack: each route without a layout, plus one screen per
 * layout folder (the tab navigator is the app's base, so it can't be swiped away).
 */
export const STACK_SCREENS: readonly StackScreen[] = ROUTE_LIST.flatMap((route, index): StackScreen[] => {
  if (!route.layout) return [route];
  const first = ROUTE_LIST.findIndex((other) => other.layout === route.layout) === index;
  return first ? [{ name: route.layout, title: route.title, gestureEnabled: false, access: route.access }] : [];
});

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
