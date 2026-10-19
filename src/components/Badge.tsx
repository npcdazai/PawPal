import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '../theme/colors';
import { fonts } from '../theme/typography';

export type BadgeTone = 'primary' | 'success' | 'coral' | 'amber' | 'white';

const TONES: Record<BadgeTone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: colors.primaryTint, fg: colors.primary, dot: colors.primary },
  success: { bg: colors.successTint, fg: colors.successInk, dot: colors.success },
  coral: { bg: colors.coralTint, fg: colors.coralInk, dot: colors.coral },
  amber: { bg: colors.amberTint, fg: colors.amberInk, dot: colors.amber },
  white: { bg: colors.card, fg: colors.ink, dot: colors.success },
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Leading status dot ("● Ready"). */
  dot?: boolean;
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'primary', dot = false, uppercase = false, style }: BadgeProps) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: palette.dot }]} /> : null}
      <Text
        style={[
          styles.label,
          { color: palette.fg },
          uppercase && styles.uppercase,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 14,
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
