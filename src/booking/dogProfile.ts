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
