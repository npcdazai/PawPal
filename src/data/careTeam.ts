import { colors } from '../theme/colors';

export type WalkerId = 'marcus' | 'elena' | 'david' | 'sarahm';

export interface Walker {
  id: WalkerId;
  name: string;
  shortName: string;
  initials: string;
  role: string;
  rating: number;
  walksWithBarnaby: number;
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
    badges: ['Background Cleared', 'Pet CPR Certified'],
    tint: colors.successTint,
    ink: colors.successInk,
  },
};

export const WALKER_IDS = Object.keys(WALKERS) as WalkerId[];

export const isWalkerId = (value: unknown): value is WalkerId =>
  typeof value === 'string' && value in WALKERS;

export type PetChoice = 'barnaby' | 'luna' | 'both';

export const PET_CHOICES: readonly { key: PetChoice; label: string; names: string }[] = [
  { key: 'barnaby', label: 'Barnaby (Corgi)', names: 'Barnaby' },
  { key: 'luna', label: 'Luna', names: 'Luna' },
  { key: 'both', label: 'Both Pets', names: 'Barnaby & Luna' },
];
