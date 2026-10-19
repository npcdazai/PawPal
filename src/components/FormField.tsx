import React, { useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radii, shadows } from '../theme/colors';
import { fonts, typography } from '../theme/typography';
import { Icon } from './Icon';

interface FormFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label: string;
  icon: string;
  /** Right side of the label row ("PawID Ready", "Forgot Password?"). */
  accessory?: ReactNode;
  /** Inside the input, on the right (show/hide toggle). */
  trailing?: ReactNode;
  /** Shows a completion tick when defined. */
  complete?: boolean;
}

export function FormField({
  label,
  icon,
  accessory,
  trailing,
  complete,
  onFocus,
  onBlur,
  ...input
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {accessory}
      </View>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <Icon name={icon} size={20} color={focused ? colors.primary : colors.placeholder} />
        <TextInput
          {...input}
          accessibilityLabel={label}
          style={styles.input}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />
        {trailing}
        {complete !== undefined ? (
          <Icon
            name={complete ? 'check-circle' : 'radio-button-unchecked'}
            size={20}
            color={complete ? colors.success : colors.inputBorder}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  label: {
    ...typography.label,
  },
  box: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
  },
  boxFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
    ...shadows.focusRing,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    // The box draws its own focus ring; suppress the browser's on web.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
});
