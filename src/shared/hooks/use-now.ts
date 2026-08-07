/**
 * A ticking clock, in unix seconds.
 *
 * Elapsed time is the one figure on screen that changes without the server saying
 * anything, so it cannot come from a query. `active` lets a caller stop the timer
 * when nothing is running rather than re-rendering the chrome once a second
 * forever.
 */

import { useEffect, useState } from "react";

export function useNow(active = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
