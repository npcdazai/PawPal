import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '../theme/colors';
import { NATIVE_DRIVER } from '../theme/motion';

interface ProgressBarProps {
  /** 0–1 */
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({
  progress,
  color = colors.primary,
  trackColor = colors.track,
  height = 8,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const [value] = useState(() => new Animated.Value(clamped));

  // The fill is full width, scaled from its left edge: a transform runs on the
  // native driver and never triggers layout.
  useEffect(() => {
    Animated.timing(value, {
      toValue: clamped,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [clamped, value]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, backgroundColor: trackColor }, style]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color, transform: [{ scaleX: value }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
    borderRadius: radii.full,
    transformOrigin: 'left',
  },
});
