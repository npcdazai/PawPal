import { colors } from '../theme/colors';

export type WalkerId = 'marcus' | 'elena' | 'david' | 'sarahm' | 'alex';

export interface Walker {
  id: WalkerId;
  name: string;
  shortName: string;
  initials: string;
  role: string;
  rating: number;
  walksWithBarnaby: number;
  /** All walks on PawPal (shown on the tracking screen). */
  totalWalks: number;
  /** Walker's phone, for the call buttons. */
  phone: string;
  badges: readonly string[];
  tint: string;
  ink: string;
  topMatch?: boolean;
}

/** Barnaby's walkers and sitters, shared by Profile and the booking flow. */
export const WALKERS: Record<WalkerId, Walker> = {
  marcus: {
    id: 'marcus',
    name: 'Marcus Taylor',
    shortName: 'Marcus T.',
    initials: 'MT',
    role: 'Walk Star',
    rating: 4.9,
    walksWithBarnaby: 18,
    totalWalks: 412,
    phone: '+15550101818',
    badges: ['Background Cleared', 'Pet CPR Certified'],
    tint: colors.primaryTint,
    ink: colors.primary,
    topMatch: true,
  },
  elena: {
    id: 'elena',
    name: 'Elena R.',
    shortName: 'Elena R.',
    initials: 'ER',
    role: 'Overnight Sitter',
    rating: 5.0,
    walksWithBarnaby: 8,
    totalWalks: 236,
    phone: '+15550102727',
    badges: ['Background Cleared', 'Key Holder'],
    tint: colors.coralTint,
    ink: colors.coralInk,
  },
  david: {
    id: 'david',
    name: 'David K.',
    shortName: 'David K.',
    initials: 'DK',
    role: 'Trail Walker',
    rating: 4.8,
    walksWithBarnaby: 3,
    totalWalks: 97,
    phone: '+15550103636',
    badges: ['Background Cleared'],
    tint: colors.amberTint,
    ink: colors.amberInk,
  },
  sarahm: {
    id: 'sarahm',
    name: 'Sarah M.',
    shortName: 'Sarah M.',
    initials: 'SM',
    role: 'Weekend Walker',
    rating: 4.9,
    walksWithBarnaby: 0,
    totalWalks: 154,
    phone: '+15550104545',
    badges: ['Background Cleared', 'Pet CPR Certified'],
    tint: colors.successTint,
    ink: colors.successInk,
  },
  // Default instant-dispatch match when no favourite walker is requested.
  alex: {
    id: 'alex',
    name: 'Alex Rivera',
    shortName: 'Alex R.',
    initials: 'AR',
    role: 'Instant Walker',
    rating: 4.9,
    walksWithBarnaby: 0,
    totalWalks: 128,
    phone: '+15550124477',
    badges: ['Background Cleared', 'Pet CPR Certified'],
    tint: colors.primaryTint,
    ink: colors.primaryPressed,
  },
};

export const WALKER_IDS = Object.keys(WALKERS) as WalkerId[];

export const isWalkerId = (value: unknown): value is WalkerId =>
  typeof value === 'string' && value in WALKERS;
