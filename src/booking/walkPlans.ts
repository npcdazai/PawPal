export type WalkTiming = 'instant' | 'scheduled';
export type WalkMinutes = 30 | 45 | 60;

export const WALK_PLANS: readonly {
  minutes: WalkMinutes;
  price: number;
  title: string;
  badge?: string;
}[] = [
  { minutes: 30, price: 15, title: 'Quick Relief' },
  { minutes: 45, price: 22, title: 'Stroll & Sniff', badge: 'Best for Corgis' },
  { minutes: 60, price: 28, title: 'Park Excursion' },
];

export const DEFAULT_MINUTES: WalkMinutes = 45;
export const INSTANT_ETA_MINUTES = 15;
/** Added to instant walks during peak demand. */
export const INSTANT_SURGE = 3;

/** Peak demand windows: 7–9 AM and 5–7 PM. */
export function isPeakHour(date: Date = new Date()) {
  const hour = date.getHours();
  return (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);
}

export function walkFare(minutes: WalkMinutes, timing: WalkTiming, now: Date = new Date()) {
  const plan = WALK_PLANS.find((option) => option.minutes === minutes) ?? WALK_PLANS[1];
  const surge = timing === 'instant' && isPeakHour(now) ? INSTANT_SURGE : 0;
  return { base: plan.price, surge, total: plan.price + surge };
}

/** Tail-wag speed for a duration: longer walks, happier Barnaby (8 → 18 fps). */
export const wagFpsFor = (minutes: WalkMinutes) => (minutes === 30 ? 8 : minutes === 45 ? 13 : 18);

export interface ScheduleSlot {
  key: string;
  label: string;
}

const SLOT_TIMES: readonly [number, number][] = [
  [8, 0],
  [12, 30],
  [17, 30],
  [19, 0],
];
/** Scheduled walks need at least this much notice. */
const MIN_NOTICE_MS = 45 * 60 * 1000;

/** The next few bookable walk slots, e.g. "Today, 5:30 PM", "Tomorrow, 8:00 AM". */
export function scheduleSlots(now: Date = new Date(), count = 4): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  for (let day = 0; day < 4 && slots.length < count; day += 1) {
    for (const [hour, minute] of SLOT_TIMES) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute);
      if (date.getTime() - now.getTime() < MIN_NOTICE_MS) continue;
      const dayLabel =
        day === 0 ? 'Today' : day === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
      const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      slots.push({ key: date.toISOString(), label: `${dayLabel}, ${time}` });
      if (slots.length >= count) break;
    }
  }
  return slots;
}

export const formatMoney = (amount: number) => `$${amount.toFixed(2)}`;
