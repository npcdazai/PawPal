import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { NATIVE_DRIVER } from '../theme/motion';
import { Icon } from './Icon';

export interface ActionSheetOption {
  icon: string;
  label: string;
  detail?: string;
  tone?: 'primary' | 'coral';
  onPress: () => void;
}

interface ActionSheetProps {
  title: string;
  subtitle?: string;
  options: readonly ActionSheetOption[];
  cancelLabel?: string;
  onClose: () => void;
}

/** Bottom sheet of actions over a dimmed backdrop (SOS, confirmations). */
export function ActionSheet({ title, subtitle, options, cancelLabel = 'Cancel', onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [enter]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.backdrop, { opacity: enter }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} aria-label="Close" />
      </Animated.View>
      <Animated.View
        role="dialog"
        aria-label={title}
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }],
          },
        ]}
      >
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.options}>
          {options.map((option) => {
            const coral = option.tone === 'coral';
            return (
              <Pressable
                key={option.label}
                onPress={option.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <View style={[styles.optionIcon, { backgroundColor: coral ? colors.coralTint : colors.primaryTint }]}>
                  <Icon name={option.icon} size={20} color={coral ? colors.coral : colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.optionLabel, coral && { color: colors.coralInk }]}>{option.label}</Text>
                  {option.detail ? <Text style={styles.subtitle}>{option.detail}</Text> : null}
                </View>
                <Icon name="chevron-right" size={22} color={colors.placeholder} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(24, 26, 32, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 6,
    paddingTop: 10,
    paddingHorizontal: 18,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.float,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
    backgroundColor: colors.inputBorder,
  },
  title: {
    ...typography.headline,
  },
  subtitle: {
    ...typography.bodySm,
  },
  options: {
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...typography.label,
    fontSize: 15,
  },
  cancel: {
    height: 50,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.track,
  },
  cancelText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
  pressed: {
    opacity: 0.8,
  },
});
