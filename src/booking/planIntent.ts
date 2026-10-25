import { EXPRESS_MINUTES, type ExpressMinutes } from '../api/types';
import type { WalkTier } from './walkPlans';

/**
 * The plan a home-screen card picked ("Book Instant Walk Now" with 45 minutes,
 * "Start a monthly plan"), handed to the plan screen. It rides along in the
 * walk-plan route's params when the app can go straight there, and is held here
 * for the trip through the society profile screen, which only forwards a walker.
 * Plain module state: nothing renders from it, so it never re-renders the app.
 */
export interface PlanIntent {
  tier: WalkTier;
  /** Express only. */
  minutes?: ExpressMinutes;
}

let pending: PlanIntent | null = null;

/** Set right before navigating into the booking flow. */
export function setPlanIntent(intent: PlanIntent | null) {
  pending = intent;
}

/** What the plan screen should start on, without consuming it. */
export const peekPlanIntent = (): PlanIntent | null => pending;

/** The plan screen took it, or the person went back home: don't carry it into a later booking. */
export function clearPlanIntent() {
  pending = null;
}

const TIERS: readonly WalkTier[] = ['subscription', 'trial', 'express'];

/** Route params → a plan intent; null when they don't name a tier. */
export function planIntentFromParams(params: { tier?: string | string[]; minutes?: string | string[] }): PlanIntent | null {
  const tier = typeof params.tier === 'string' ? (params.tier as WalkTier) : null;
  if (!tier || !TIERS.includes(tier)) return null;
  if (tier !== 'express') return { tier };
  const minutes = Number(typeof params.minutes === 'string' ? params.minutes : NaN);
  return { tier, minutes: (EXPRESS_MINUTES as readonly number[]).includes(minutes) ? (minutes as ExpressMinutes) : 30 };
}

/** A plan intent → walk-plan route params. */
export function planIntentParams(intent: PlanIntent): Record<string, string> {
  return intent.minutes ? { tier: intent.tier, minutes: String(intent.minutes) } : { tier: intent.tier };
}
