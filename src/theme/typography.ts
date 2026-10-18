import { TextStyle } from 'react-native';

export const typography: Record<string, TextStyle> = {
  displayLg: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
  },
  headlineXl: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.48,
  },
  headlineXlMobile: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.26,
  },
  headlineLg: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.24,
  },
  headlineMd: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
  },
  headlineSm: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
  },
  bodyLg: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  labelLg: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.14,
  },
  labelMd: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.24,
  },
  labelSm: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.44,
  },
};
