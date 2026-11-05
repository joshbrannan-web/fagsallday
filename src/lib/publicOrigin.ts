/** The live web site. Used for links whenever the app isn't running on a web address. */
export const PRODUCTION_ORIGIN = 'https://fagsallday.com';

/**
 * Addresses an app wrapper gives the page. They can't be opened from an email and
 * outside services (Google, Supabase sign-in) won't accept them:
 * iOS (Capacitor) uses capacitor://localhost; Android (Capacitor) uses https://localhost.
 */
const APP_WRAPPER_ORIGINS = ['capacitor://localhost', 'https://localhost', 'http://localhost'];

/**
 * The address to use for anything that leaves the app: links in emails, return
 * addresses sent to outside services, links other people open.
 *
 * On the web site this is the current address (so someone on www.fagsallday.com or a
 * Lovable preview comes back to the address where they're signed in). Inside the iOS or
 * Android app, or anywhere that isn't a normal web address, it's the production site.
 * Local development (http://localhost:<port>) keeps its own address.
 */
export function publicOrigin(origin: string | undefined = currentOrigin()): string {
  if (!origin || APP_WRAPPER_ORIGINS.includes(origin)) return PRODUCTION_ORIGIN;
  return /^https?:\/\/[^/]+$/.test(origin) ? origin : PRODUCTION_ORIGIN;
}

function currentOrigin(): string | undefined {
  try {
    return window.location.origin;
  } catch {
    return undefined;
  }
}
