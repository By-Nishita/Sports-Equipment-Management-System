import { useEffect, useRef } from 'react';

// Runs `fn` once right away, then again every `ms` milliseconds.
// - It always calls the LATEST version of fn, so fn can use fresh state.
// - It skips a round while the browser tab is hidden (no pointless requests).
// - enabled = false stops it (used by the Scan page: only poll while a request is waiting).
export default function usePolling(fn, ms, enabled = true) {
  const latest = useRef(fn);

  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    latest.current();
    const id = setInterval(() => {
      if (!document.hidden) latest.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}