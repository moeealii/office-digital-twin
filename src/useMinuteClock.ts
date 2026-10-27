import { useEffect, useState } from 'react';

/** Re-render once a minute (prayer countdown). */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => {
      window.clearInterval(t);
    };
  }, []);
  return now;
}
