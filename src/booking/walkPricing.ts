import type { PetChoice } from '../data/careTeam';

export type WalkStyle = 'solo' | 'group';
export type DurationKey = 'stroll' | 'trek' | 'adventure';
export type WindowKey = 'morning' | 'midday' | 'afternoon' | 'evening';
export type AddOnKey = 'feeding' | 'pawWipe' | 'medication';

export const DURATIONS: readonly {
  key: DurationKey;
  minutes: number;
  title: string;
  fareLabel: string;
  detail: string;
  icon: string;
  price: Record<WalkStyle, number>;
  popular?: boolean;
}[] = [
  {
    key: 'stroll',
    minutes: 30,
    title: '30 Min Stroll',
    fareLabel: '30 Min Neighborhood Stroll',
    detail: 'Potty break, brisk pace & water refill',
    icon: 'timer',
    price: { solo: 22, group: 16 },
  },
  {
    key: 'trek',
    minutes: 45,
    title: '45 Min Trek',
    fareLabel: '45 Min Neighborhood Trek',
    detail: 'Exploration route, interactive play & treats',
    icon: 'directions-walk',
    price: { solo: 30, group: 22 },
    popular: true,
  },
  {
    key: 'adventure',
    minutes: 60,
    title: '60 Min Adventure',
    fareLabel: '60 Min Park Adventure',
    detail: 'High-energy exercise, park sprint & cooldown',
    icon: 'forest',
    price: { solo: 38, group: 28 },
  },
];

export const WINDOWS: readonly {
  key: WindowKey;
  label: string;
  range: string;
  start: string;
  icon: string;
}[] = [
  { key: 'morning', label: 'Morning', range: '8:00 – 10:00 AM', start: '8:00 AM', icon: 'wb-twilight' },
  { key: 'midday', label: 'Midday', range: '11:30 AM – 1:30 PM', start: '11:30 AM', icon: 'wb-sunny' },
  { key: 'afternoon', label: 'Afternoon', range: '3:00 – 5:00 PM', start: '3:00 PM', icon: 'wb-cloudy' },
  { key: 'evening', label: 'Evening', range: '6:00 – 8:00 PM', start: '6:00 PM', icon: 'nights-stay' },
];

export const ADD_ONS: readonly {
  key: AddOnKey;
  title: string;
  fareLabel: string;
  detail: string;
  icon: string;
  price: number;
}[] = [
  {
    key: 'feeding',
    title: 'Feeding & Fresh Filtered Water',
    fareLabel: 'Feeding & Water',
    detail: 'Refill bowl & wash food dish',
    icon: 'dinner-dining',
    price: 0,
  },
  {
    key: 'pawWipe',
    title: 'Post-walk Paw Wipe & Brush',
    fareLabel: 'Paw Wipe & Brush',
    detail: 'Organic balm & muddy paw cleanup',
    icon: 'clean-hands',
    price: 4,
  },
  {
    key: 'medication',
    title: 'Oral Medication Administration',
    fareLabel: 'Medication',
    detail: 'Given with pill pocket snack',
    icon: 'medication',
    price: 5,
  },
];

export const DEFAULT_ADD_ONS: readonly AddOnKey[] = ['feeding', 'pawWipe'];

export const TRUST_FEE = 2.5;
export const EXTRA_PET_FEE = 8;
export const RECURRING_DISCOUNT = 0.1;

export interface WalkSelection {
  pets: PetChoice;
  style: WalkStyle;
  duration: DurationKey;
  recurring: boolean;
  addOns: readonly AddOnKey[];
}

export interface FareLine {
  label: string;
  amount: number;
  info?: boolean;
}

/** Itemised fare for a walk selection; amounts in dollars. */
export function computeFare(selection: WalkSelection): { lines: FareLine[]; total: number } {
  const duration = DURATIONS.find((option) => option.key === selection.duration) ?? DURATIONS[1];
  const walkPrice = duration.price[selection.style];
  const lines: FareLine[] = [
    {
      label: selection.style === 'group' ? `${duration.fareLabel} (Group)` : duration.fareLabel,
      amount: walkPrice,
    },
  ];

  if (selection.pets === 'both') lines.push({ label: 'Second pet', amount: EXTRA_PET_FEE });

  for (const addOn of ADD_ONS) {
    if (addOn.price > 0 && selection.addOns.includes(addOn.key)) {
      lines.push({ label: addOn.fareLabel, amount: addOn.price });
    }
  }

  lines.push({ label: 'Trust & Safety / GPS Insurance', amount: TRUST_FEE, info: true });

  if (selection.recurring) {
    lines.push({
      label: 'Weekly walk plan (−10%)',
      amount: -Math.round(walkPrice * RECURRING_DISCOUNT * 100) / 100,
    });
  }

  const total = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  return { lines, total };
}

export const formatMoney = (amount: number) =>
  `${amount < 0 ? '−' : ''}$${Math.abs(amount).toFixed(2)}`;

export interface DayOption {
  /** yyyy-mm-dd */
  key: string;
  top: string;
  day: number;
  weekday: string;
  weekdayLong: string;
  month: string;
  monthLong: string;
  year: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** The next `count` days starting today, labelled for the date picker. */
export function upcomingDays(count: number, from = new Date()): DayOption[] {
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return {
      key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      top: offset === 0 ? 'Today' : offset === 1 ? 'Tmrw' : month,
      day: date.getDate(),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      weekdayLong: date.toLocaleDateString('en-US', { weekday: 'long' }),
      month,
      monthLong: date.toLocaleDateString('en-US', { month: 'long' }),
      year: date.getFullYear(),
    };
  });
}

/** "October 2026" or "October / November 2026" for the picker header. */
export function monthHeading(days: readonly DayOption[]) {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';
  return first.monthLong === last.monthLong
    ? `${first.monthLong} ${first.year}`
    : `${first.monthLong} / ${last.monthLong} ${last.year}`;
}
