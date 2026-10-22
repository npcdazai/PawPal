import { colors } from '../theme/colors';

export type CareTeamId = 'marcus' | 'elena' | 'david' | 'sarahm' | 'alex';
/** Dedicated walkers who only work inside one gated township. */
export type SocietyWalkerId = 'rohan' | 'pratik' | 'sneha' | 'amit' | 'imran' | 'kunal' | 'priya' | 'farhan';
export type WalkerId = CareTeamId | SocietyWalkerId;

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
  /** Society walkers: walks done inside their township. */
  societyWalks?: number;
  /** Society walkers: gate-app pass number. */
  gatePass?: string;
  /** Certified to handle dogs that pull hard. */
  heavyDuty?: boolean;
}

const societyWalker = (
  id: SocietyWalkerId,
  name: string,
  rating: number,
  societyWalks: number,
  gatePass: string,
  tint: string,
  ink: string,
  heavyDuty = false
): Walker => {
  const [first, last = ''] = name.split(' ');
  return {
    id,
    name,
    shortName: last ? `${first} ${last[0]}.` : first,
    initials: `${first[0]}${last[0] ?? ''}`.toUpperCase(),
    role: 'Society Walker',
    rating,
    walksWithBarnaby: 0,
    totalWalks: societyWalks,
    // Calls go through PawPal's masked line; walkers' numbers are never shared.
    phone: '',
    badges: ['Background Cleared', 'Pet CPR Certified', 'Society Resident Walker'],
    tint,
    ink,
    societyWalks,
    gatePass,
    heavyDuty,
  };
};

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
  rohan: societyWalker('rohan', 'Rohan Deshmukh', 4.96, 310, '4092', colors.primaryTint, colors.primary, true),
  pratik: societyWalker('pratik', 'Pratik Kulkarni', 4.91, 188, '4117', colors.successTint, colors.successInk, true),
  sneha: societyWalker('sneha', 'Sneha Patil', 4.93, 264, '2217', colors.coralTint, colors.coralInk, true),
  amit: societyWalker('amit', 'Amit Joshi', 4.89, 142, '2231', colors.amberTint, colors.amberInk),
  imran: societyWalker('imran', 'Imran Shaikh', 4.95, 198, '5130', colors.primaryTint, colors.primary, true),
  kunal: societyWalker('kunal', 'Kunal Mehta', 4.9, 121, '5144', colors.successTint, colors.successInk),
  priya: societyWalker('priya', 'Priya Nair', 4.97, 342, '3381', colors.coralTint, colors.coralInk, true),
  farhan: societyWalker('farhan', 'Farhan Qureshi', 4.92, 167, '3390', colors.amberTint, colors.amberInk, true),
};

/** Barnaby's own care team (Profile, the dashboard's walker avatars). */
export const WALKER_IDS: readonly CareTeamId[] = ['marcus', 'elena', 'david', 'sarahm', 'alex'];

export const isWalkerId = (value: unknown): value is WalkerId =>
  typeof value === 'string' && value in WALKERS;
