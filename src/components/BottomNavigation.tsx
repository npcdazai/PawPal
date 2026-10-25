import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, radii } from '../theme/colors';
import { fonts } from '../theme/typography';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { NATIVE_DRIVER, type ViewHandle } from '../theme/motion';
import { Icon } from './Icon';

/** Height of the bar's tab row, above the bottom safe area. */
export const BOTTOM_NAV_HEIGHT = 64;
/** The tab row keeps at least this much room under it on phones without a gesture bar. */
const BOTTOM_NAV_PAD = 6;

/** Distance from the screen's bottom edge to the top of the bar, for a scroll view's bottom padding. */
export const bottomNavClearance = (bottomInset: number) => Math.max(bottomInset, BOTTOM_NAV_PAD) + BOTTOM_NAV_HEIGHT;

/** Frosted white: the screen's sky shows faintly through. */
const BAR_FILL = 'rgba(255, 255, 255, 0.95)';
const INDICATOR_WIDTH = 28;
/** Horizontal drag distance before a touch becomes a scrub across the tabs. */
const SCRUB_SLOP = 8;
/** Grace period so hover/press can glide between neighbouring tabs. */
const GHOST_LINGER_MS = 70;
/** Optimistic highlight is dropped if navigation never happens. */
const PENDING_TIMEOUT_MS = 1500;

const SLIDE = { damping: 18, stiffness: 240, mass: 1 };
const POP = { damping: 11, stiffness: 260, mass: 0.9 };
const PRESS = { damping: 15, stiffness: 420, mass: 0.8 };

interface BottomNavigationTab<K extends string> {
  key: K;
  label: string;
  icon: string;
}

interface BottomNavigationProps<K extends string> {
  tabs: readonly BottomNavigationTab<K>[];
  current: K;
  onChange: (tab: K) => void;
  /**
   * Tabs that become the highlighted one when tapped. Others (a tab that opens
   * a flow on top, like Book Walk) just act. Default: every tab.
   */
  selectable?: (tab: K) => boolean;
  /** Selection ticks while tapping and scrubbing. */
  haptics?: boolean;
}

const tick = () => {
  Haptics.selectionAsync().catch(() => undefined);
};

const always = () => true;

/**
 * The docked, frosted-white tab bar (icon over label; the active tab in
 * Primary Blue with a short indicator above it).
 *  - the indicator springs between tabs with a little squash-and-stretch
 *  - a soft ghost slides under whatever is hovered (web / pointer) or pressed
 *  - dragging a finger along the bar scrubs the ghost across tabs; release selects
 *  - icons pop and lift, colours crossfade, tabs stagger in on mount
 */
export function BottomNavigation<K extends string>({
  tabs,
  current,
  onChange,
  selectable = always,
  haptics = true,
}: BottomNavigationProps<K>) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<ViewHandle>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  // Highlight the tapped tab immediately, before Barnaby finishes leaving.
  const [pending, setPending] = useState<{ key: K; from: K } | null>(null);

  const shown = pending && pending.from === current ? pending.key : current;
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === shown));
  const tabWidth = trackWidth / tabs.length;

  const [anim] = useState(() => ({
    indicatorX: new Animated.Value(0),
    stretch: new Animated.Value(0),
    ghostX: new Animated.Value(0),
    ghostOpacity: new Animated.Value(0),
  }));
  const gesture = useRef({
    startX: 0,
    trackX: 0,
    scrubIndex: -1,
    ghostIndex: -1,
    lastIndex: -1,
    hideTimer: null as ReturnType<typeof setTimeout> | null,
    pendingTimer: null as ReturnType<typeof setTimeout> | null,
  });

  // Slide the indicator whenever the selection changes.
  useEffect(() => {
    if (!tabWidth) return;
    const target = activeIndex * tabWidth;
    const state = gesture.current;
    const moved = state.lastIndex !== -1 && state.lastIndex !== activeIndex;
    state.lastIndex = activeIndex;

    if (!moved) {
      anim.indicatorX.setValue(target);
      return;
    }
    if (reduceMotion) {
      Animated.timing(anim.indicatorX, { toValue: target, duration: 140, useNativeDriver: NATIVE_DRIVER }).start();
      return;
    }
    Animated.parallel([
      Animated.spring(anim.indicatorX, { toValue: target, ...SLIDE, useNativeDriver: NATIVE_DRIVER }),
      Animated.sequence([
        Animated.timing(anim.stretch, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.spring(anim.stretch, { toValue: 0, ...POP, useNativeDriver: NATIVE_DRIVER }),
      ]),
    ]).start();
  }, [activeIndex, tabWidth, reduceMotion, anim]);

  useEffect(() => {
    const state = gesture.current;
    return () => {
      if (state.hideTimer) clearTimeout(state.hideTimer);
      if (state.pendingTimer) clearTimeout(state.pendingTimer);
    };
  }, []);

  const indicatorTransform = useMemo(
    () => [
      { translateX: anim.indicatorX },
      { scaleX: anim.stretch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
    ],
    [anim]
  );

  const showGhost = (index: number) => {
    if (!tabWidth) return;
    const state = gesture.current;
    if (state.hideTimer) {
      clearTimeout(state.hideTimer);
      state.hideTimer = null;
    }
    const target = index * tabWidth;
    if (state.ghostIndex === -1 || reduceMotion) anim.ghostX.setValue(target);
    else Animated.spring(anim.ghostX, { toValue: target, ...SLIDE, useNativeDriver: NATIVE_DRIVER }).start();
    state.ghostIndex = index;
    Animated.timing(anim.ghostOpacity, {
      toValue: index === activeIndex ? 0 : 1,
      duration: 140,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  };

  const hideGhost = () => {
    const state = gesture.current;
    if (state.hideTimer) clearTimeout(state.hideTimer);
    state.hideTimer = setTimeout(() => {
      state.hideTimer = null;
      state.ghostIndex = -1;
      Animated.timing(anim.ghostOpacity, { toValue: 0, duration: 180, useNativeDriver: NATIVE_DRIVER }).start();
    }, GHOST_LINGER_MS);
  };

  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    if (haptics) tick();
    if (tab.key !== shown && selectable(tab.key)) {
      const state = gesture.current;
      setPending({ key: tab.key, from: current });
      if (state.pendingTimer) clearTimeout(state.pendingTimer);
      state.pendingTimer = setTimeout(() => setPending(null), PENDING_TIMEOUT_MS);
    }
    onChange(tab.key);
  };

  const indexAt = (event: GestureResponderEvent) => {
    const raw = Math.floor((event.nativeEvent.pageX - gesture.current.trackX) / tabWidth);
    return Math.max(0, Math.min(tabs.length - 1, raw));
  };

  return (
    <View role="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, BOTTOM_NAV_PAD) }]}>
      {/*
        Frosted glass: a real blur on iOS and web. Android would need a BlurTargetView around the
        screens (expo-blur SDK 58), so there it stays the 95% white fill.
      */}
      {Platform.OS === 'android' ? null : (
        <BlurView pointerEvents="none" intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      )}
      <View
        ref={trackRef}
        style={styles.track}
        onLayout={(event) => {
          setTrackWidth(event.nativeEvent.layout.width);
          trackRef.current?.measureInWindow((x) => {
            gesture.current.trackX = x;
          });
        }}
        // Scrub: a horizontal drag anywhere on the bar takes over from the tab buttons.
        onStartShouldSetResponderCapture={(event) => {
          gesture.current.startX = event.nativeEvent.pageX;
          return false;
        }}
        onMoveShouldSetResponderCapture={(event) =>
          tabWidth > 0 && Math.abs(event.nativeEvent.pageX - gesture.current.startX) > SCRUB_SLOP
        }
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          const index = indexAt(event);
          gesture.current.scrubIndex = index;
          showGhost(index);
        }}
        onResponderMove={(event) => {
          const index = indexAt(event);
          if (index === gesture.current.scrubIndex) return;
          gesture.current.scrubIndex = index;
          showGhost(index);
          if (haptics) tick();
        }}
        onResponderRelease={() => {
          const index = gesture.current.scrubIndex;
          gesture.current.scrubIndex = -1;
          hideGhost();
          if (index >= 0) select(index);
        }}
        onResponderTerminate={() => {
          gesture.current.scrubIndex = -1;
          hideGhost();
        }}
      >
        {tabWidth > 0 ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ghost,
                { width: tabWidth - 12, opacity: anim.ghostOpacity, transform: [{ translateX: anim.ghostX }] },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { left: (tabWidth - INDICATOR_WIDTH) / 2, transform: indicatorTransform }]}
            />
          </>
        ) : null}

        {tabs.map((tab, index) => (
          <TabButton
            key={tab.key}
            label={tab.label}
            icon={tab.icon}
            index={index}
            active={index === activeIndex}
            indicatorX={anim.indicatorX}
            tabWidth={tabWidth}
            reduceMotion={reduceMotion}
            onPress={() => select(index)}
            onPressIn={() => {
              if (index !== activeIndex) showGhost(index);
            }}
            onPressOut={hideGhost}
            onHoverIn={() => showGhost(index)}
            onHoverOut={hideGhost}
          />
        ))}
      </View>
    </View>
  );
}

interface TabButtonProps {
  label: string;
  icon: string;
  index: number;
  active: boolean;
  /** The sliding indicator's offset: icon and label colours follow it as it passes. */
  indicatorX: Animated.Value;
  tabWidth: number;
  reduceMotion: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
}

function TabButton({
  label,
  icon,
  index,
  active,
  indicatorX,
  tabWidth,
  reduceMotion,
  onPress,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
}: TabButtonProps) {
  const [focus] = useState(() => new Animated.Value(active ? 1 : 0));
  const [press] = useState(() => new Animated.Value(1));
  const [enter] = useState(() => new Animated.Value(0));

  // Underdamped spring so the newly active icon pops past full size, then settles.
  useEffect(() => {
    const toValue = active ? 1 : 0;
    if (reduceMotion) {
      focus.setValue(toValue);
      return;
    }
    Animated.spring(focus, { toValue, ...POP, useNativeDriver: NATIVE_DRIVER }).start();
  }, [active, focus, reduceMotion]);

  // Staggered entrance when the bar first appears.
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      delay: 120 + index * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter, index, reduceMotion]);

  const styleAnim = useMemo(() => {
    // Once laid out, colours track how close the indicator is to this tab.
    const coverage =
      tabWidth > 0
        ? indicatorX.interpolate({
            inputRange: [(index - 1) * tabWidth, index * tabWidth, (index + 1) * tabWidth],
            outputRange: [0, 1, 0],
            extrapolate: 'clamp',
          })
        : focus.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
    return {
      iconScale: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }),
      iconLift: focus.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5] }),
      activeOpacity: coverage,
      idleOpacity: coverage.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      enterY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
    };
  }, [focus, enter, indicatorX, tabWidth, index]);

  const springPress = (toValue: number) => {
    Animated.spring(press, { toValue, ...PRESS, useNativeDriver: NATIVE_DRIVER }).start();
  };

  return (
    <Pressable
      role="tab"
      aria-selected={active}
      aria-label={label}
      style={styles.tab}
      onPress={onPress}
      onPressIn={() => {
        if (!reduceMotion) springPress(0.88);
        onPressIn();
      }}
      onPressOut={() => {
        springPress(1);
        onPressOut();
      }}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
    >
      <Animated.View
        style={[styles.tabInner, { opacity: enter, transform: [{ translateY: styleAnim.enterY }, { scale: press }] }]}
      >
        <Animated.View
          style={[styles.iconBox, { transform: [{ translateY: styleAnim.iconLift }, { scale: styleAnim.iconScale }] }]}
        >
          <Animated.View style={{ opacity: styleAnim.idleOpacity }}>
            <Icon name={icon} size={24} color={colors.slate} />
          </Animated.View>
          <Animated.View style={[styles.layer, { opacity: styleAnim.activeOpacity }]}>
            <Icon name={icon} size={24} color={colors.primary} />
          </Animated.View>
        </Animated.View>
        <View style={styles.labelBox}>
          {/* Fixed-height bar: labels follow the font size only up to 1.3×. */}
          <Animated.Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={[styles.label, { opacity: styleAnim.idleOpacity }]}
          >
            {label}
          </Animated.Text>
          <Animated.Text
            aria-hidden
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={[styles.label, styles.labelActive, styles.layer, { opacity: styleAnim.activeOpacity }]}
          >
            {label}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    backgroundColor: BAR_FILL,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(24, 26, 32, 0.06)',
    boxShadow: '0px -10px 32px rgba(41, 98, 255, 0.08)',
  },
  track: {
    height: BOTTOM_NAV_HEIGHT,
    flexDirection: 'row',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: INDICATOR_WIDTH,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.primary,
  },
  ghost: {
    position: 'absolute',
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Full tab width, so the bold active label never truncates over the regular one.
  tabInner: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 3,
  },
  iconBox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBox: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    color: colors.slate,
    // Scrubbing with a mouse on web must not select label text.
    userSelect: 'none',
  },
  labelActive: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
});
