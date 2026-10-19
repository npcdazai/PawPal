import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

interface CircularProgressProps {
  size?: number;
  strokeWidth?: number;
  /** 0–100 */
  percentage: number;
  color?: string;
  trackColor?: string;
}

export function CircularProgress({
  size = 72,
  strokeWidth = 8,
  percentage,
  color = colors.primary,
  trackColor = colors.primaryTint,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const [value] = useState(() => new Animated.Value(clamped));
  const [shown, setShown] = useState(clamped);

  // Tween the ring through React state: an Animated svg Circle leaks a
  // `collapsable` attribute into the DOM on web.
  useEffect(() => {
    const id = value.addListener(({ value: next }) => setShown(next));
    const tween = Animated.timing(value, {
      toValue: clamped,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    tween.start();
    return () => {
      tween.stop();
      value.removeListener(id);
    };
  }, [clamped, value]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[styles.container, { width: size, height: size }]}
    >
      {/* Rotated so progress starts at 12 o'clock. */}
      <Svg width={size} height={size} style={styles.ring}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - shown / 100)}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={styles.labelText}>{Math.round(clamped)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    transform: [{ rotate: '-90deg' }],
  },
  labelContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
    color: colors.ink,
  },
});
