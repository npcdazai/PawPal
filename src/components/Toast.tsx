import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from './Icon';

interface ToastProps {
  visible: boolean;
  message: string;
  iconName?: string;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  iconName = 'pets',
}) => {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(-12));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -12,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.content}>
        {iconName ? <Icon name={iconName} size={18} color={colors.tertiaryFixedDim} /> : null}
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inverseSurface,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.full,
    ...shadows.toast,
  },
  text: {
    ...typography.labelMd,
    color: colors.inverseOnSurface,
    fontWeight: '600',
  },
});
