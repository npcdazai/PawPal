import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { mapSheet, screenGradients } from '../theme/gradients';

export type ScreenTier = 'HERO' | 'CROWN' | 'MAP_SHEET';

interface PawsomeGradientScreenProps {
  variant: ScreenTier;
  /**
   * Safe-area edges the wrapper pads (HERO and CROWN). Defaults to the top only:
   * the floating tab bar and bottom action bars handle the bottom inset.
   */
  edges?: readonly Edge[];
  /** Style for the inner, safe-area-padded container. */
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Every screen's background. Android 16 draws apps edge to edge, so the gradient
 * runs under the status and navigation bars while the content stays inside the
 * safe area. MAP_SHEET screens draw their own full-bleed map: the wrapper only
 * gives them the base colour, and MapScrim / MapSheet supply the overlays.
 */
export function PawsomeGradientScreen({ variant, edges = ['top'], style, children }: PawsomeGradientScreenProps) {
  if (variant === 'MAP_SHEET') {
    return <View style={[styles.fill, styles.base, style]}>{children}</View>;
  }
  return (
    <View style={[styles.fill, styles.base, { backgroundImage: screenGradients[variant] }]}>
      <SafeAreaView edges={edges} style={[styles.fill, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/**
 * The translucent scrim behind the status pills at the top of a map: 90 dp
 * below the status bar, fading to transparent, so the streets stay visible.
 */
export function MapScrim({ style }: { style?: StyleProp<ViewStyle> }) {
  const { top } = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={[styles.scrim, { height: top + mapSheet.scrimHeight, backgroundImage: mapSheet.scrim }, style]}
    />
  );
}

/** The rounded drawer over a map's lower half (28 dp top corners, white → ivory → peach). */
export function MapSheet({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[styles.sheet, { backgroundImage: mapSheet.sheet }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  // Shown until (and wherever) a gradient can't draw.
  base: {
    backgroundColor: colors.canvas,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: mapSheet.sheetRadius,
    borderTopRightRadius: mapSheet.sheetRadius,
    boxShadow: '0px -8px 28px rgba(24, 26, 32, 0.08)',
  },
});
