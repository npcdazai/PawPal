import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';

const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 30;
const THUMB = 24;
const TRAVEL = TRACK_WIDTH - THUMB - 6;

interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
}

/** Themed switch that looks identical on iOS, Android and web. */
export function Toggle({ value, onValueChange, accessibilityLabel }: ToggleProps) {
  const [progress] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const { trackColor, translateX } = useMemo(
    () => ({
      trackColor: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.track, colors.primary],
      }),
      translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }),
    }),
    [progress]
  );

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      role="switch"
      aria-checked={value}
      aria-label={accessibilityLabel}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radii.full,
    padding: 3,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
});
