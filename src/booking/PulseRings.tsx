import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { NATIVE_DRIVER } from '../mascot/MascotMachine';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface PulseRingsProps {
  /** Ring diameter at rest. */
  size: number;
  colors: readonly string[];
  /** How far each ring grows before fading out. */
  scaleTo?: number;
  periodMs?: number;
}

/** Concentric rings that expand and fade on a loop (map pin pulse, radar). */
export function PulseRings({ size, colors, scaleTo = 1.9, periodMs = 2100 }: PulseRingsProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }]}>
      {colors.map((color, index) => (
        <Ring
          key={`${color}-${index}`}
          size={size}
          color={color}
          scaleTo={scaleTo}
          periodMs={periodMs}
          delay={(periodMs / colors.length) * index}
        />
      ))}
    </View>
  );
}

function Ring({
  size,
  color,
  scaleTo,
  periodMs,
  delay,
}: {
  size: number;
  color: string;
  scaleTo: number;
  periodMs: number;
  delay: number;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: periodMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        })
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, periodMs, progress]);

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          backgroundColor: `${color}22`,
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
});
