import { useEffect, useState } from 'react';

/**
 * The time for day words ("tomorrow", "Yesterday"), refreshed every
 * `refreshMs` so a screen left open past midnight moves on with the clock.
 */
export function useNow(refreshMs = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);
  return now;
}
