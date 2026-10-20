import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts } from '../theme/typography';
import { NATIVE_DRIVER } from '../theme/motion';

/** Transient message state for <Toast />. */
export function useToast(durationMs = 2200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs]
  );

  return { message, show };
}

interface ToastProps {
  message: string | null;
  /** Distance from the bottom safe-area edge. */
  bottomOffset?: number;
}

export function Toast({ message, bottomOffset = 24 }: ToastProps) {
  const insets = useSafeAreaInsets();
  if (!message) return null;
  return <ToastBubble key={message} message={message} bottom={insets.bottom + bottomOffset} />;
}

function ToastBubble({ message, bottom }: { message: string; bottom: number }) {
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      damping: 16,
      stiffness: 220,
      mass: 1,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          bottom,
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.full,
    backgroundColor: colors.ink,
    zIndex: 40,
    ...shadows.float,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onPrimary,
    textAlign: 'center',
  },
});
