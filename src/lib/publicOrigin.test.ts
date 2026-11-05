import { describe, expect, it } from 'vitest';
import { PRODUCTION_ORIGIN, publicOrigin } from './publicOrigin';

describe('publicOrigin', () => {
  it('keeps the current address on the web site and previews', () => {
    expect(publicOrigin('https://fagsallday.com')).toBe('https://fagsallday.com');
    expect(publicOrigin('https://www.fagsallday.com')).toBe('https://www.fagsallday.com');
    expect(publicOrigin('https://fagsallday.lovable.app')).toBe('https://fagsallday.lovable.app');
    expect(publicOrigin('https://abc123.lovableproject.com')).toBe('https://abc123.lovableproject.com');
    expect(publicOrigin('https://fix-branch.fagsallday.pages.dev')).toBe('https://fix-branch.fagsallday.pages.dev');
  });

  it('keeps local development addresses that have a port', () => {
    expect(publicOrigin('http://localhost:8080')).toBe('http://localhost:8080');
  });

  it('uses the production site inside the iOS and Android apps', () => {
    expect(publicOrigin('capacitor://localhost')).toBe(PRODUCTION_ORIGIN);
    expect(publicOrigin('https://localhost')).toBe(PRODUCTION_ORIGIN);
    expect(publicOrigin('http://localhost')).toBe(PRODUCTION_ORIGIN);
  });

  it('uses the production site for anything that is not a normal web address', () => {
    expect(publicOrigin('null')).toBe(PRODUCTION_ORIGIN); // e.g. a page opened from a file
    expect(publicOrigin('file://')).toBe(PRODUCTION_ORIGIN);
    expect(publicOrigin('')).toBe(PRODUCTION_ORIGIN);
    expect(publicOrigin(undefined)).toBe(PRODUCTION_ORIGIN);
  });
});
