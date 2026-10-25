/** A booking's vet & accident cover, as the API reports it. */
export interface WalkCover {
  active: boolean;
  coverInr: number;
}

/**
 * Rupees of walk cover to show, or null. Only the booking's own insurance
 * counts, and only once it is active (the backend switches it on at the
 * walker's doorstep check-in): screens never assume an amount.
 */
export function activeCoverInr(booking: { id: string; insurance?: WalkCover | null } | undefined): number | null {
  const insurance = booking?.insurance;
  return insurance?.active && insurance.coverInr > 0 ? insurance.coverInr : null;
}
