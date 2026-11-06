// Small helpers for features that work differently inside the iOS app.
// Everything here does nothing (or falls back to the existing web behaviour) on the website.

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// ── Haptics (iPhone only; the website stays silent) ────────────────────

/** The lightest "tick", like a picker wheel. Used when a score changes. */
export function hapticTick(): void {
  if (!isNativeApp()) return;
  // iOS needs the selection generator started before it can tick.
  Haptics.selectionStart()
    .then(() => Haptics.selectionChanged())
    .then(() => Haptics.selectionEnd())
    .catch(() => {});
}

/** One light tap. Used when a hole is confirmed. */
export function hapticTap(): void {
  if (!isNativeApp()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

// ── Sharing ────────────────────────────────────────────────────────────

export type ShareOutcome = 'shared' | 'cancelled';

/** True when the player closed the share sheet without sharing. Not an error. */
export function isShareCancel(error: unknown): boolean {
  const e = error as { name?: string; message?: string } | null;
  return e?.name === 'AbortError' || /cancel/i.test(e?.message ?? '');
}

/** Open the iOS share sheet with some text. Throws on real failures. */
export async function shareTextNative(title: string, text: string): Promise<ShareOutcome> {
  try {
    await Share.share({ title, text, dialogTitle: title });
    return 'shared';
  } catch (error) {
    if (isShareCancel(error)) return 'cancelled';
    throw error;
  }
}

/**
 * The one file used for sharing scorecard images. Always the same name in the app's
 * cache folder, so each share replaces the previous image: there is never more than one.
 */
export const SHARE_IMAGE_FILE = 'scorecard-share.png';

/** Save a PNG (as a data: URL) to the cache folder and open the iOS share sheet with it. */
export async function shareImageNative(dataUrl: string, title: string): Promise<ShareOutcome> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const { uri } = await Filesystem.writeFile({
    path: SHARE_IMAGE_FILE,
    data: base64,
    directory: Directory.Cache,
  });
  try {
    await Share.share({ title, files: [uri], dialogTitle: title });
    return 'shared';
  } catch (error) {
    if (isShareCancel(error)) return 'cancelled';
    throw error;
  }
}
