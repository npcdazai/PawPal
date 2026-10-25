/** Barnaby's mandatory behavioural & handling profile, which gates what can be booked. */

export type Temperament = 'friendly' | 'pulls' | 'reactive';

export const TEMPERAMENTS: readonly { key: Temperament; emoji: string; label: string; detail: string }[] = [
  {
    key: 'friendly',
    emoji: '🟢',
    label: 'Friendly / Low-Pull',
    detail: 'Unlocks every plan, including SOS Express',
  },
  {
    key: 'pulls',
    emoji: '🟡',
    label: 'Pulls Hard on Leash',
    detail: 'A heavy-duty certified walker is assigned',
  },
  {
    key: 'reactive',
    emoji: '🔴',
    label: 'Reactive to Stray / Street Dogs',
    detail: 'Needs a Meet & Greet or a repeat walker before Express',
  },
];

export type GearKey = 'harness' | 'doubleClip' | 'otpHandover';

export const GEAR: readonly { key: GearKey; emoji: string; label: string }[] = [
  { key: 'harness', emoji: '🦺', label: 'Chest Harness Only' },
  { key: 'doubleClip', emoji: '🦮', label: 'Double-Clip Leash' },
  { key: 'otpHandover', emoji: '🚪', label: 'Doorstep OTP Handover' },
];

/** Doorstep OTP handover is on by default: it starts the GPS timer and the insurance. */
export const DEFAULT_GEAR: readonly GearKey[] = ['harness', 'otpHandover'];

export const temperamentLabel = (key: Temperament) => TEMPERAMENTS.find((item) => item.key === key)?.label ?? '';

export type DogSize = 'small' | 'medium' | 'large' | 'giant';

export interface DogIdentity {
  name: string;
  breed: string;
  size: DogSize;
}

/**
 * The dog the app is built around (Barnaby, the corgi on every screen). The
 * app has no pet form yet, so a first booking carries him; once the API has a
 * booking or a pack, its dog is used instead (see dogForBooking).
 */
export const APP_DOG: DogIdentity = { name: 'Barnaby', breed: 'Corgi', size: 'medium' };

const SIZES: readonly DogSize[] = ['small', 'medium', 'large', 'giant'];

/** The dog from the latest booking or pack on the server, else the app's own. */
export function dogForBooking(known: { name: string; breed: string; size: string } | null | undefined): DogIdentity {
  if (!known?.name.trim() || !known.breed.trim()) return APP_DOG;
  return {
    name: known.name.trim(),
    breed: known.breed.trim(),
    size: SIZES.includes(known.size as DogSize) ? (known.size as DogSize) : 'medium',
  };
}
