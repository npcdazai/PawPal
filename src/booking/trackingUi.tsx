import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from '../components/Icon';
import { NATIVE_DRIVER } from '../theme/motion';

/** Green "live" dot that softly pulses. */
export function PulsingDot({ color = colors.success, size = 10 }: { color?: string; size?: number }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          },
        ]}
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: color }]} />
    </View>
  );
}

/** Header for the live tracking screens: back, title, info. */
export function TrackingTopBar({
  title,
  onBack,
  onInfo,
}: {
  title: string;
  onBack: () => void;
  onInfo: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        aria-label="Back to dashboard"
        hitSlop={6}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Icon name="arrow-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        onPress={onInfo}
        accessibilityRole="button"
        aria-label="About live tracking"
        hitSlop={6}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Icon name="info-outline" size={22} color={colors.ink} />
      </Pressable>
    </View>
  );
}

/** Elevated white pill floating over the map (ETA / live status). */
export function MapPill({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.mapPill, style]}>{children}</View>;
}

/** Soft blue circular icon button (call, chat, photo). */
export function RoundIconButton({
  icon,
  label,
  onPress,
  tint = colors.primaryTint,
  ink = colors.primary,
  badge = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  tint?: string;
  ink?: string;
  badge?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      aria-label={label}
      hitSlop={4}
      style={({ pressed }) => [styles.round, { backgroundColor: tint }, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={ink} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    ...typography.headline,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    ...shadows.soft,
  },
  mapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    ...shadows.float,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.card,
    backgroundColor: colors.coral,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
});
