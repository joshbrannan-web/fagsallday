import { useState, useEffect, useCallback, useRef } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNativeApp } from '@/lib/native';
import { createKeepAwakeController, type KeepAwakeController } from '@/lib/keepAwakeController';

interface WakeLockResult {
  isActive: boolean;
  isSupported: boolean;
}

export const useWakeLock = (enabled: boolean = false): WakeLockResult => {
  // Inside the iOS app the browser's wake lock isn't reliable, so use the native plugin.
  // The choice can't change while the app runs, so calling one hook or the other is stable.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return isNativeApp() ? useNativeKeepAwake(enabled) : useWebWakeLock(enabled);
};

/**
 * iPhone app: keep the screen on while `enabled`, and always let it go when the round
 * screen closes, the app goes to the background, or nobody has touched it for 30 minutes.
 * (iOS itself also ignores this setting whenever the app isn't on screen.)
 */
function useNativeKeepAwake(enabled: boolean): WakeLockResult {
  const [isActive, setIsActive] = useState(false);
  const controllerRef = useRef<KeepAwakeController | null>(null);

  useEffect(() => {
    const controller = createKeepAwakeController(KeepAwake, setIsActive);
    controllerRef.current = controller;
    controller.setVisible(document.visibilityState === 'visible');
    const onVisibility = () => controller.setVisible(document.visibilityState === 'visible');
    const onActivity = () => controller.activity();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      controller.dispose(); // leaving the round screen always releases
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setEnabled(enabled);
  }, [enabled]);

  return { isActive, isSupported: true };
}

/** Website: unchanged behaviour using the browser's wake lock. */
function useWebWakeLock(enabled: boolean): WakeLockResult {
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
}
