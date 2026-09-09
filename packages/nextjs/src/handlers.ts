import { createWytPassAuth } from './server.js';
import type { WytPassNextConfig } from './types.js';

/**
 * Route handler for initiating login: app/api/auth/wytpass/login/route.ts
 * Example:
 * ```ts
 * export const GET = handleWytPassLogin();
 * ```
 */
export function handleWytPassLogin(config?: WytPassNextConfig) {
  const auth = createWytPassAuth(config);
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const prompt = url.searchParams.get('prompt') || undefined;
    const loginHint = url.searchParams.get('login_hint') || undefined;
    const scope = url.searchParams.get('scope') || undefined;

    return auth.login(request, { prompt, loginHint, scope });
  };
}

/**
 * Route handler for receiving callback: app/api/auth/wytpass/callback/route.ts
 * Example:
 * ```ts
 * export const GET = handleWytPassCallback();
 * ```
 */
export function handleWytPassCallback(config?: WytPassNextConfig, redirectOnSuccess = '/') {
  const auth = createWytPassAuth(config);
  return async function GET(request: Request): Promise<Response> {
    return auth.handleCallback(request, redirectOnSuccess);
  };
}

/**
 * Route handler for logging out: app/api/auth/wytpass/logout/route.ts
 * Example:
 * ```ts
 * export const GET = handleWytPassLogout();
 * ```
 */
export function handleWytPassLogout(config?: WytPassNextConfig, redirectTo = '/') {
  const auth = createWytPassAuth(config);
  return async function GET(): Promise<Response> {
    return auth.logout(redirectTo);
  };
}