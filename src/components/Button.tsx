import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { typography } from '../theme/typography';
import { Icon } from './Icon';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  trailingIcon?: string | null;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Full-width Primary Blue pill CTA (56px). */
export function PrimaryButton({
  label,
  onPress,
  trailingIcon = 'arrow-forward',
  disabled = false,
  style,
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.primaryPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.primaryLabel}>{label}</Text>
      {trailingIcon ? <Icon name={trailingIcon} size={20} color={colors.onPrimary} /> : null}
    </Pressable>
  );
}

type SecondaryTone = 'blue' | 'peach';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  tone?: SecondaryTone;
  style?: StyleProp<ViewStyle>;
}

/** Soft tinted pill used for SSO and secondary actions. */
export function SecondaryButton({ label, onPress, tone = 'blue', style }: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.secondary,
        tone === 'blue' ? styles.secondaryBlue : styles.secondaryPeach,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.secondaryLabel,
          { color: tone === 'blue' ? colors.primary : colors.coralInk },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
    transform: [{ scale: 0.98 }],
  },
  primaryLabel: {
    ...typography.button,
  },
  disabled: {
    opacity: 0.5,
  },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBlue: {
    backgroundColor: colors.primaryTint,
  },
  secondaryPeach: {
    backgroundColor: colors.stage,
  },
  secondaryLabel: {
    ...typography.label,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
