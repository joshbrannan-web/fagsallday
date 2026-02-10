import { useState, useEffect, useCallback, useRef } from 'react';

interface WakeLockResult {
  isActive: boolean;
  isSupported: boolean;
}

export const useWakeLock = (enabled: boolean = false): WakeLockResult => {
  const [isActive, setIsActive] = useState(false);
  const isSupported = 'wakeLock' in navigator;
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (!isSupported || !enabled) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
      });
    } catch {
      setIsActive(false);
    }
  }, [isSupported, enabled]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => { releaseWakeLock(); };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  // Re-acquire on visibility change (user returns to app)
  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, requestWakeLock]);

  return { isActive, isSupported };
};
