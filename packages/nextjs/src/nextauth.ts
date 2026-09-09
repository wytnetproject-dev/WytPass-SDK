import {
  DEFAULT_AUTHORIZATION_ENDPOINT,
  DEFAULT_ISSUER,
  DEFAULT_JWKS_ENDPOINT,
  DEFAULT_SCOPE,
  DEFAULT_TOKEN_ENDPOINT,
  DEFAULT_USERINFO_ENDPOINT,
  normalizeUserInfo
} from '@wytpass/core';
import type { WytPassNextAuthOptions } from './types.js';

/**
 * NextAuth.js / Auth.js custom OAuth provider configuration for WytPass SSO.
 *
 * Example usage in `pages/api/auth/[...nextauth].ts` or `app/api/auth/[...nextauth]/route.ts`:
 * ```ts
 * import NextAuth from "next-auth";
 * import { WytPassNextAuthProvider } from "@wytpass/nextjs";
 *
 * export default NextAuth({
 *   providers: [
 *     WytPassNextAuthProvider({
 *       clientId: process.env.WYTPASS_CLIENT_ID!,
 *       clientSecret: process.env.WYTPASS_CLIENT_SECRET!,
 *     })
 *   ]
 * });
 * ```
 */
export function WytPassNextAuthProvider(options: WytPassNextAuthOptions = {}) {
  const issuer = options.issuer || process.env['WYTPASS_ISSUER'] || DEFAULT_ISSUER;
  const authorizationUrl = options.authorizationUrl || DEFAULT_AUTHORIZATION_ENDPOINT;
  const tokenUrl = options.tokenUrl || DEFAULT_TOKEN_ENDPOINT;
  const userInfoUrl = options.userInfoUrl || DEFAULT_USERINFO_ENDPOINT;
  const jwksUrl = options.jwksUrl || DEFAULT_JWKS_ENDPOINT;

  return {
    id: 'wytpass',
    name: 'WytPass',
    type: 'oauth' as const,
    version: '2.0',
    issuer,
    clientId: options.clientId || process.env['WYTPASS_CLIENT_ID'],
    clientSecret: options.clientSecret || process.env['WYTPASS_CLIENT_SECRET'],
    authorization: {
      url: authorizationUrl,
      params: {
        scope: options.scope || process.env['WYTPASS_SCOPE'] || DEFAULT_SCOPE
      }
    },
    token: tokenUrl,
    userinfo: userInfoUrl,
    jwks_endpoint: jwksUrl,
    client: {
      token_endpoint_auth_method: 'client_secret_post'
    },
    checks: ['pkce', 'state'] as ('pkce' | 'state')[],
    idToken: false,
    profile(profile: Record<string, any>) {
      const user = normalizeUserInfo(profile);
      return {
        id: String(user.id || user.sub || ''),
        name: user.name ?? user.id,
        email: user.email ?? null,
        image: user.picture ?? user.profilePicture ?? null,
        subscriptions: user.subscriptions
      };
    },
    style: {
      logo: 'https://wytnet.com/logo.svg',
      logoDark: 'https://wytnet.com/logo-dark.svg',
      bg: '#0f172a',
      text: '#ffffff',
      bgDark: '#0f172a',
      textDark: '#ffffff'
    }
  };
}
