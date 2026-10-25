import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, shadows } from '../theme/colors';
import { gradients } from '../theme/gradients';
import { fonts } from '../theme/typography';
import { NATIVE_DRIVER } from '../theme/motion';
import { useResponsive } from '../theme/responsive';
import { useReducedMotion } from '../hooks/useReducedMotion';

type CodeSize = 'md' | 'lg';

interface CodeDigitsProps {
  /** Digits so far; cells past its length show empty. */
  value: string;
  length: number;
  /** The cell showing the caret (-1: none). */
  activeIndex?: number;
  invalid?: boolean;
  /** 'lg': a code to read out (doorstep handover), not one being typed. */
  size?: CodeSize;
  /**
   * Makes the row one accessible element with this label (a code to read out).
   * Without it the row is hidden from screen readers: an input reads the code.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** A row of one-character boxes; filled boxes get the soft blue code gradient. */
export function CodeDigits({
  value,
  length,
  activeIndex = -1,
  invalid = false,
  size = 'md',
  accessibilityLabel,
  style,
}: CodeDigitsProps) {
  const { compact } = useResponsive();
  const large = size === 'lg';
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityLabel, accessibilityRole: 'text' as const }
    : { 'aria-hidden': true };

  return (
    <View {...a11y} style={[styles.row, compact && styles.rowCompact, style]}>
      {Array.from({ length }, (_, index) => {
        const digit = value[index] ?? '';
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={[
              styles.cell,
              large && styles.cellLarge,
              digit !== '' && styles.cellFilled,
              active && styles.cellActive,
              invalid && styles.cellInvalid,
            ]}
          >
            {digit !== '' ? (
              <Text style={[styles.digit, large && styles.digitLarge]} maxFontSizeMultiplier={1.2}>
                {digit}
              </Text>
            ) : active ? (
              <Caret />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

interface CodeBoxesProps {
  value: string;
  /** Called with digits only, at most `length` of them. */
  onChangeText: (digits: string) => void;
  length: number;
  /** Read by screen readers, e.g. "6-digit code". */
  accessibilityLabel: string;
  editable?: boolean;
  invalid?: boolean;
  onSubmitEditing?: () => void;
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
  style?: StyleProp<ViewStyle>;
}

/**
 * One-time code entry drawn as boxes. A single real TextInput lies over the
 * row with transparent text, so taps, paste, SMS autofill and OTP keyboards
 * work exactly as with a plain field; the boxes only mirror its value.
 */
export function CodeBoxes({
  value,
  onChangeText,
  length,
  accessibilityLabel,
  editable = true,
  invalid = false,
  onSubmitEditing,
  onFocus,
  onBlur,
  style,
}: CodeBoxesProps) {
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, '').slice(0, length);
  const activeIndex = focused && editable ? Math.min(digits.length, length - 1) : -1;

  return (
    <View style={[styles.field, style]}>
      <CodeDigits value={digits} length={length} activeIndex={activeIndex} invalid={invalid} />
      <TextInput
        value={digits}
        onChangeText={(text) => onChangeText(nextCode(text, digits, length))}
        accessibilityLabel={accessibilityLabel}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        returnKeyType="go"
        onSubmitEditing={onSubmitEditing}
        editable={editable}
        caretHidden
        selectionColor="transparent"
        underlineColorAndroid="transparent"
        style={styles.input}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
    </View>
  );
}

/**
 * Digits only, at most `length`. Spaces and dashes from a pasted "123 456"
 * drop out; a paste or autofill over a full code replaces it, while one more
 * typed digit is ignored.
 */
export function nextCode(text: string, previous: string, length: number): string {
  const cleaned = text.replace(/\D/g, '');
  if (cleaned.length <= length) return cleaned;
  return cleaned.length - previous.length > 1 ? cleaned.slice(-length) : previous;
}

/** The blinking caret in the box that takes the next digit (steady with Reduce Motion). */
function Caret() {
  const reduced = useReducedMotion();
  const [blink] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) {
      blink.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0,
          duration: 380,
          delay: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 380,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink, reduced]);

  return <Animated.View style={[styles.caret, { opacity: blink }]} />;
}

const styles = StyleSheet.create({
  field: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  rowCompact: {
    gap: 6,
  },
  cell: {
    flex: 1,
    maxWidth: 52,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
  },
  cellLarge: {
    maxWidth: 60,
    height: 64,
    borderRadius: 18,
  },
  cellFilled: {
    borderColor: 'rgba(41, 98, 255, 0.14)',
    backgroundColor: colors.primaryTint,
    backgroundImage: gradients.otpFilled,
  },
  cellActive: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
    ...shadows.focusRing,
  },
  cellInvalid: {
    borderColor: colors.coral,
  },
  digit: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  digitLarge: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.primary,
  },
  caret: {
    width: 2,
    height: 24,
    borderRadius: 1,
    backgroundColor: colors.primary,
  },
  // Covers the row so a tap on any box focuses it; its own text and caret stay invisible.
  input: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 16,
    textAlign: 'center',
    borderWidth: 0,
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
});
