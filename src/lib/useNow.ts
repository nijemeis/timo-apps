import { useEffect, useState } from 'react';

/** Re-renders every `ms` and returns Date.now(); aligned to the next whole tick so timers step together. */
export function useNow(ms = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    let iv: ReturnType<typeof setInterval> | null = null;
    const t = setTimeout(() => {
      setNow(Date.now());
      iv = setInterval(() => setNow(Date.now()), ms);
    }, ms - (Date.now() % ms));
    return () => { clearTimeout(t); if (iv) clearInterval(iv); };
  }, [ms, enabled]);
  return now;
}
