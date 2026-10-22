import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { NATIVE_DRIVER } from '../theme/motion';

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

  // Opacity and transform only, so the native driver runs it off the JS thread.
  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [progress, value]);

  const translateX = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }),
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
      <View style={styles.track}>
        {/* The "on" colour fades in over the grey track. */}
        <Animated.View style={[styles.trackOn, { opacity: progress }]} />
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </View>
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
    backgroundColor: colors.track,
  },
  trackOn: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.card,
    ...shadows.soft,
  },
});
