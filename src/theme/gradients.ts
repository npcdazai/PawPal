/**
 * Pawsome's atmospheric gradients, as React Native `backgroundImage` strings
 * (CSS-style linear/radial gradients, drawn natively; no extra library).
 *
 * Screens use one of three tiers (see PawsomeGradientScreen):
 *  - HERO      warm full-bleed sky: splash, home, permission gates, partner welcome
 *  - CROWN     a soft glow at the top fading to pure white, so inputs, code boxes
 *              and payment cards keep crisp contrast: sign-in, forms, booking,
 *              payments, KYC, earnings, profile
 *  - MAP_SHEET an unobstructed map with a scrim behind its floating pills and a
 *              rounded drawer over its lower half: pickup, walker en route, live walk
 */
export const screenGradients = {
  HERO: 'linear-gradient(180deg, #FFD89B 0%, #FFE8C8 24%, #FFF3E8 52%, #FFFDF9 100%)',
  CROWN: 'linear-gradient(180deg, #FFE2B8 0%, #FFF3E8 26%, #FFFDF9 60%, #FFFFFF 100%)',
} as const;

export const mapSheet = {
  /** Behind the status pills floating over the top of a map; the map stays visible through it. */
  scrim: 'linear-gradient(180deg, rgba(255, 243, 232, 0.92) 0%, rgba(255, 243, 232, 0) 100%)',
  scrimHeight: 90,
  /** The rounded drawer over the map's lower half. */
  sheet: 'linear-gradient(180deg, #FFFFFF 0%, #FFFDF9 65%, #FFF3E8 100%)',
  sheetRadius: 28,
} as const;

/** Card, pill and banner surfaces shared by the screens. */
export const gradients = {
  /** Translucent glass over the HERO sky (home greeting). */
  glassHeader: 'linear-gradient(135deg, rgba(255, 243, 232, 0.75) 0%, rgba(255, 228, 196, 0.88) 100%)',
  /** Barnaby's round stage on the home header. */
  mascotGlow: 'radial-gradient(circle, #FFFFFF 0%, #FFF3E8 100%)',
  /** Monthly society subscription card (blue family). */
  subscriptionCard: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFF 65%, #EEF4FF 100%)',
  /** Instant / express walk card (coral family). */
  expressCard: 'linear-gradient(145deg, #FFFFFF 0%, #FFF9F6 60%, #FFF0E8 100%)',
  primaryPill: 'linear-gradient(135deg, #2962FF 0%, #1545CC 100%)',
  coralPill: 'linear-gradient(135deg, #FF6B4A 0%, #E84825 100%)',
  coralBadge: 'linear-gradient(90deg, #FF6B4A 0%, #FF8566 100%)',
  /** Good-news strips: auto-backup walker, verified proof. */
  mintStrip: 'linear-gradient(90deg, #E8F8F0 0%, #D4F5E3 100%)',
  /** Warm info strips: society radar. */
  peachStrip: 'linear-gradient(90deg, #FFF3E8 0%, #FFE4CC 100%)',
  /** A selected chip on a warm card. */
  peachChip: 'linear-gradient(135deg, #FFF3E8 0%, #FFE0CC 100%)',
  proofCard: 'linear-gradient(180deg, #FFFFFF 0%, #FFFDF9 100%)',
  /** A filled one-time-code box. */
  otpFilled: 'linear-gradient(135deg, #E8F0FE 0%, #D8E6FF 100%)',
  /** Doorstep handover / insurance banner. */
  insuranceBanner: 'linear-gradient(135deg, #FFF3E8 0%, #FFE0CC 100%)',
  cashbackBanner: 'linear-gradient(135deg, #FFF3E8 0%, #FFE4C4 100%)',
  /** Partner weekly earnings hero. */
  earningsHero: 'linear-gradient(135deg, #FFF3E8 0%, #FFE0B8 100%)',
} as const;
