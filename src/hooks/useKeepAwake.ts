import { useEffect, useRef } from 'react';

/**
 * Activates the Screen Wake Lock API when `enabled` is true.
 * Automatically releases the lock when enabled becomes false or component unmounts.
 * Falls back gracefully on unsupported browsers.
 */
export function useKeepAwake(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    if (!('wakeLock' in navigator)) return; // not supported

    let cancelled = false;

    navigator.wakeLock.request('screen').then((lock) => {
      if (cancelled) {
        lock.release().catch(() => {});
        return;
      }
      wakeLockRef.current = lock;

      // Re-acquire after visibility change (e.g. tab switch)
      const onVisibility = () => {
        if (document.visibilityState === 'visible' && enabled && !wakeLockRef.current) {
          navigator.wakeLock.request('screen').then((l) => {
            wakeLockRef.current = l;
          }).catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
        document.removeEventListener('visibilitychange', onVisibility);
      });
    }).catch(() => {});

    return () => {
      cancelled = true;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [enabled]);
}
