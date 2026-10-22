import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { NATIVE_DRIVER } from '../theme/motion';
import { Icon } from '../components/Icon';
import { useMascotStatus } from '../mascot/MascotProvider';
import { useAppNavigation } from '../navigation/useAppNavigation';
import { ROUTES } from '../navigation/navigation';
import { WALKERS } from '../data/careTeam';
import { useBookings } from './BookingsProvider';
import { walkReturnsAt } from './liveWalk';

/** The "walker is back" buzz (respects the haptics preference). */
export function arrivalBuzz(enabled: boolean) {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

/**
 * App-wide alert for when the dog walker arrives back at the start. On the
 * Live Walk screen its own sheet handles it; anywhere else this banner slides
 * in from the top and opens the walk to confirm the drop-off.
 */
export function WalkArrivalBanner() {
  const pathname = usePathname();
  const { bookings } = useBookings();
  const { go } = useAppNavigation();
  const { hapticsEnabled } = useMascotStatus();

  const walk = bookings.find((booking) => booking.status === 'inProgress');
  const walkId = walk?.id ?? null;
  const returnsAt = walk ? walkReturnsAt(walk) : null;
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    if (!walkId || returnsAt === null) return undefined;
    const timer = setTimeout(() => setArrivedId(walkId), Math.max(0, returnsAt - Date.now()));
    return () => clearTimeout(timer);
  }, [walkId, returnsAt]);

  const arrived = walkId !== null && arrivedId === walkId;
  // Seen on the Live Walk screen (its sheet announced it): don't repeat it elsewhere.
  if (arrived && pathname === ROUTES.liveWalk.path && dismissedId !== walkId) setDismissedId(walkId);
  const visible = arrived && dismissedId !== walkId && pathname !== ROUTES.liveWalk.path;

  useEffect(() => {
    if (visible) arrivalBuzz(hapticsEnabled);
  }, [visible, hapticsEnabled]);

  if (!visible || !walk) return null;
  const firstName = WALKERS[walk.walkerId].name.split(' ')[0];

  return (
    <ArrivalCard
      title={`${firstName} is back with Barnaby! 🏠`}
      detail="Walk complete · tap to confirm the drop-off"
      onOpen={() => {
        setDismissedId(walk.id);
        go('openLiveWalk');
      }}
      onDismiss={() => setDismissedId(walk.id)}
    />
  );
}

function ArrivalCard({
  title,
  detail,
  onOpen,
  onDismiss,
}: {
  title: string;
  detail: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      damping: 15,
      stiffness: 170,
      mass: 1,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }],
        },
      ]}
    >
      {/* Open and Dismiss are sibling buttons, so each is reachable on its own. */}
      <View role="alert" style={styles.card}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          aria-label={`${title} ${detail}`}
          style={({ pressed }) => [styles.open, pressed && styles.pressed]}
        >
          <View style={styles.icon}>
            <Text style={styles.iconGlyph}>🏠</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.detail}>{detail}</Text>
          </View>
        </Pressable>
        <Pressable onPress={onDismiss} accessibilityRole="button" aria-label="Dismiss" hitSlop={10} style={styles.close}>
          <Icon name="close" size={18} color={colors.slate} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 80,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.successTint,
    ...shadows.float,
  },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successTint,
  },
  iconGlyph: {
    fontSize: 22,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.subhead,
    fontSize: 15,
  },
  detail: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.successInk,
  },
  close: {
    padding: 4,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
