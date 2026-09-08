import type { CookieOptions } from './types.js';

/**
 * Parses a Cookie header string into a key-value record.
 */
export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  const pairs = header.split(';');

  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(val);
    }
  }

  return cookies;
}

/**
 * Serializes a cookie name, value, and options into a Set-Cookie header value.
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path || '/'}`);

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.sameSite) {
    const sameSiteLower = options.sameSite.toLowerCase();
    const formatted = sameSiteLower.charAt(0).toUpperCase() + sameSiteLower.slice(1);
    parts.push(`SameSite=${formatted}`);
  } else {
    parts.push('SameSite=Lax');
  }

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/**
 * Helper to build an expired cookie string to delete a cookie.
 */
export function serializeDeleteCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, '', {
    ...options,
    maxAge: 0
  });
}
