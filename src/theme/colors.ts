/**
 * Pawsome Companion design tokens, reverse-engineered from the Figma pet care
 * design system. Surfaces are warm (ivory canvas, peach mascot stages), brand
 * actions are Primary Blue, and Coral/Amber echo Barnaby's red leash and coat.
 */
export const colors = {
  // Surfaces
  canvas: '#FFFDF9',
  stage: '#FFF3E8',
  card: '#FFFFFF',
  input: '#FAFAFA',
  inputBorder: '#EFEFEF',
  divider: '#F2EDE7',
  track: '#EEF1F6',

  // Brand
  primary: '#2962FF',
  primaryPressed: '#1F4FDB',
  primaryTint: '#E8F0FE',
  onPrimary: '#FFFFFF',

  // Accents
  coral: '#FF6B4A',
  coralInk: '#C8432A',
  coralTint: '#FFE9E3',
  amber: '#FFB340',
  amberInk: '#9A5B00',
  amberTint: '#FFF1DA',
  success: '#2ECC71',
  successInk: '#178A4C',
  successTint: '#E4F8EC',

  // Text
  ink: '#181A20',
  slate: '#757B8A',
  placeholder: '#A0A6B5',
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 28,
  full: 999,
} as const;

export const shadows = {
  card: { boxShadow: '0px 12px 32px rgba(24, 26, 32, 0.06)' },
  soft: { boxShadow: '0px 4px 12px rgba(24, 26, 32, 0.06)' },
  float: { boxShadow: '0px 16px 40px rgba(24, 26, 32, 0.12)' },
  primary: { boxShadow: '0px 8px 20px rgba(41, 98, 255, 0.25)' },
  coral: { boxShadow: '0px 6px 14px rgba(255, 107, 74, 0.30)' },
  focusRing: { boxShadow: '0px 0px 0px 4px rgba(41, 98, 255, 0.10)' },
} as const;
