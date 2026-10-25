import { apiRequest } from './client';
import { parseSubscriptionReply, parseSubscriptions } from './parse';
import type { Subscription } from './types';

/** Monthly packs (DASHBOARD_API.md §4). Each change answers with the pack as it is now. */

const packPath = (id: string) => `/subscriptions/${encodeURIComponent(id)}`;

/** Own packs, newest first. */
export async function listSubscriptions(): Promise<Subscription[]> {
  return parseSubscriptions(await apiRequest<unknown>('/subscriptions'));
}

/**
 * Skips one day's walk ("YYYY-MM-DD", India time; default the next walk). A
 * booked walk is cancelled and credited back. 409 `cannot_skip` for a past
 * date, a started walk or an inactive pack.
 */
export async function skipSubscriptionWalk(id: string, date?: string): Promise<Subscription> {
  return parseSubscriptionReply(
    await apiRequest<unknown>(`${packPath(id)}/skip`, { method: 'POST', body: date ? { date } : {} })
  );
}

/**
 * Moves the daily time to another batch slot (minutes after midnight, India
 * time). Applies from the next walk without a walker. 400 `invalid_slot`.
 */
export async function changeSubscriptionSlot(id: string, slotMinute: number): Promise<Subscription> {
  return parseSubscriptionReply(await apiRequest<unknown>(packPath(id), { method: 'PATCH', body: { slotMinute } }));
}

/** Stops future walks; walks already created stay (cancel those one by one). */
export async function cancelSubscription(id: string): Promise<Subscription> {
  return parseSubscriptionReply(await apiRequest<unknown>(`${packPath(id)}/cancel`, { method: 'POST' }));
}
