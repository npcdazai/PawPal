/**
 * Society walk plans: a monthly subscription to a fixed daily slot (the core),
 * a ₹99 Meet & Greet trial, and a same-day SOS Express upsell, all served by
 * the walkers already working inside the township.
 */
export type WalkTier = 'subscription' | 'trial' | 'express';
export type WalkMinutes = 15 | 30;
export type Batch = 'morning' | 'evening';

export const SUBSCRIPTION_PER_WALK = 120;
export const SUBSCRIPTION_WALKS = 26;
export const SUBSCRIPTION_MONTHLY = SUBSCRIPTION_PER_WALK * SUBSCRIPTION_WALKS; // ₹3,120
export const TRIAL_PRICE = 99;
export const EXPRESS_PRICE = 299;
/** Morning / evening rush: the express walker has to squeeze in between stacked slots. */
export const EXPRESS_PEAK_PRICE = 349;
export const EXPRESS_ETA = { min: 60, max: 90 } as const;

/** Every walk is GPS-tracked and covered for vet & accident costs once the OTP is shared. */
export const INSURANCE_COVER = 10000;

export const TIER_MINUTES: Record<WalkTier, WalkMinutes> = {
  subscription: 30,
  trial: 15,
  express: 30,
};

export const TIER_TITLES: Record<WalkTier, string> = {
  subscription: 'Monthly Society Subscription',
  trial: 'First-Time Trial / Meet & Greet',
  express: 'SOS / Same-Day Express Walk',
};

/** Peak demand windows: 7–9 AM and 5–7 PM. */
export function isPeakHour(date: Date = new Date()) {
  const hour = date.getHours();
  return (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);
}

export interface FareLine {
  label: string;
  /** Rupees. */
  amount: number;
}

/** What the customer pays today for a plan, itemised for the UPI sheet. */
export function tierFare(tier: WalkTier, now: Date = new Date()): { total: number; lines: FareLine[] } {
  switch (tier) {
    case 'subscription':
      return {
        total: SUBSCRIPTION_MONTHLY,
        lines: [
          { label: `${SUBSCRIPTION_WALKS} society walks × ${formatMoney(SUBSCRIPTION_PER_WALK)}`, amount: SUBSCRIPTION_MONTHLY },
        ],
      };
    case 'trial':
      return { total: TRIAL_PRICE, lines: [{ label: '15-min Meet & Greet co-walk', amount: TRIAL_PRICE }] };
    case 'express': {
      const peak = isPeakHour(now);
      const lines: FareLine[] = [{ label: 'SOS Express walk (30 min)', amount: EXPRESS_PRICE }];
      if (peak) lines.push({ label: 'Peak-hour batch squeeze-in', amount: EXPRESS_PEAK_PRICE - EXPRESS_PRICE });
      return { total: peak ? EXPRESS_PEAK_PRICE : EXPRESS_PRICE, lines };
    }
  }
}

// ─── 30-minute stacked slots ─────────────────────────────────────────────────

export const SLOT_MINUTES = 30;

/** Batch windows in minutes from midnight. */
export const BATCHES: Record<
  Batch,
  { label: string; from: number; to: number; range: string; short: string; icon: string }
> = {
  morning: {
    label: 'Morning Batch',
    from: 360,
    to: 570,
    range: '6:00 AM – 9:30 AM',
    short: '6:00–9:30 AM',
    icon: 'wb-twilight',
  },
  evening: {
    label: 'Evening Batch',
    from: 1020,
    to: 1230,
    range: '5:00 PM – 8:30 PM',
    short: '5:00–8:30 PM',
    icon: 'nights-stay',
  },
};

/** Slot start times (minutes from midnight) in a batch. */
export function batchSlots(batch: Batch): number[] {
  const { from, to } = BATCHES[batch];
  const slots: number[] = [];
  for (let start = from; start + SLOT_MINUTES <= to; start += SLOT_MINUTES) slots.push(start);
  return slots;
}

/** 420 → "7:00 AM". */
export function clockLabel(minuteOfDay: number): string {
  const total = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** 420 → "7:00 – 7:30 AM" (or "11:30 AM – 12:00 PM" across noon). */
export function slotRange(startMin: number, length: number = SLOT_MINUTES): string {
  const start = clockLabel(startMin);
  const end = clockLabel(startMin + length);
  const [startTime, startHalf] = start.split(' ');
  const [, endHalf] = end.split(' ');
  return startHalf === endHalf ? `${startTime} – ${end}` : `${start} – ${end}`;
}

/** Minutes from midnight right now. */
export const minuteOfDay = (date: Date = new Date()) => date.getHours() * 60 + date.getMinutes();

/**
 * Prices are in Indian rupees (UPI only settles INR): "₹350", "₹1,250", "₹12.50".
 * Grouped Indian style (1,00,000) by hand, so it doesn't depend on Intl support.
 */
export function formatMoney(amount: number): string {
  const [whole, paise] = Math.abs(amount).toFixed(2).split('.');
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;
  return `${amount < 0 ? '-' : ''}₹${grouped}${paise === '00' ? '' : `.${paise}`}`;
}
