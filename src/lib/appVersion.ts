import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { isNativeApp } from '@/lib/native';

/**
 * The version shown in the app, read from the installed iOS app itself (Xcode's Version
 * and Build), so it always matches what was submitted to Apple. On the website there is
 * no app build, so it just says "Web".
 */
export async function getAppVersionLabel(
  native: boolean = isNativeApp(),
  getInfo: () => Promise<{ version: string; build: string }> = () => App.getInfo(),
): Promise<string> {
  if (!native) return 'Web';
  try {
    const { version, build } = await getInfo();
    if (!version) return '';
    return build && build !== version ? `v${version} (${build})` : `v${version}`;
  } catch {
    return ''; // show nothing rather than a wrong number
  }
}

export function useAppVersionLabel(): string {
  const [label, setLabel] = useState(() => (isNativeApp() ? '' : 'Web'));
  useEffect(() => {
    let cancelled = false;
    void getAppVersionLabel().then(l => { if (!cancelled) setLabel(l); });
    return () => { cancelled = true; };
  }, []);
  return label;
}
