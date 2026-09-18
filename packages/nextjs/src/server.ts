import {
  ConfigurationError,
  DEFAULT_ISSUER,
  InvalidStateError,
  OAuthError,
  WytPassClient,
  type GetAuthorizationUrlOptions,
  type WytPassConfig
} from '@wytpass/core';
import { parseCookieHeader, serializeCookie, serializeDeleteCookie } from './cookies.js';
import type { WytPassAuthInstance, WytPassNextConfig, WytPassSession } from './types.js';

const DEFAULT_SESSION_COOKIE = 'wytpass_session';
const DEFAULT_STATE_COOKIE = 'wytpass_oauth_state';
const DEFAULT_VERIFIER_COOKIE = 'wytpass_pkce_verifier';

/**
 * Resolves the application callback URL automatically from the incoming request or configuration.
 */
export function resolveRedirectUri(request?: Request, configuredUri?: string): string {
  if (configuredUri) return configuredUri;
  if (typeof process !== 'undefined' && process.env['WYTPASS_REDIRECT_URI']) {
    return process.env['WYTPASS_REDIRECT_URI'];
  }
  if (request) {
    try {
      const host =
        request.headers.get('x-forwarded-host') ||
        request.headers.get('host') ||
        new URL(request.url).host;

      let proto =
        request.headers.get('x-forwarded-proto') ||
        request.headers.get('x-forwarded-protocol');

      if (!proto) {
        proto = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
      }

      return `${proto}://${host}/api/auth/wytpass/callback`;
    } catch {
      // Fallback below
    }
  }
  if (typeof process !== 'undefined' && process.env['VERCEL_URL']) {
    return `https://${process.env['VERCEL_URL']}/api/auth/wytpass/callback`;
  }
  return 'http://localhost:3000/api/auth/wytpass/callback';
}

/**
 * Creates a WytPass authentication instance configured for Next.js App Router and Server Components.
 */
export function createWytPassAuth(userConfig: WytPassNextConfig = {}): WytPassAuthInstance {
  const clientId =
    userConfig.clientId ||
    (typeof process !== 'undefined'
      ? process.env['WYTPASS_CLIENT_ID'] ||
        process.env['NEXT_PUBLIC_WYTPASS_CLIENT_ID'] ||
        process.env['VITE_WYTPASS_CLIENT_ID']
      : undefined);
  const clientSecret =
    userConfig.clientSecret ||
    (typeof process !== 'undefined' ? process.env['WYTPASS_CLIENT_SECRET'] : undefined);
  const redirectUri =
    userConfig.redirectUri ||
    (typeof process !== 'undefined' ? process.env['WYTPASS_REDIRECT_URI'] : undefined);
  const issuer =
    userConfig.issuer ||
    (typeof process !== 'undefined' ? process.env['WYTPASS_ISSUER'] : undefined) ||
    DEFAULT_ISSUER;
  const scope =
    userConfig.scope ||
    (typeof process !== 'undefined' ? process.env['WYTPASS_SCOPE'] : undefined);

  if (!clientId) {
    throw new ConfigurationError(
      'WYTPASS_CLIENT_ID is required. Set it in your .env or pass clientId to createWytPassAuth({ clientId: "..." }).'
    );
  }

  const clientConfig: WytPassConfig = {
    clientId,
    clientSecret,
    redirectUri,
    issuer,
    authorizationEndpoint: userConfig.authorizationEndpoint,
    tokenEndpoint: userConfig.tokenEndpoint,
    userInfoEndpoint: userConfig.userInfoEndpoint,
    jwksEndpoint: userConfig.jwksEndpoint,
    discoveryEndpoint: userConfig.discoveryEndpoint,
    scope,
    allowHttp: userConfig.allowHttp,
    fetch: userConfig.fetch
  };

  const client = new WytPassClient(clientConfig);

  const sessionCookieName = userConfig.sessionCookieName || DEFAULT_SESSION_COOKIE;
  const stateCookieName = userConfig.stateCookieName || DEFAULT_STATE_COOKIE;
  const verifierCookieName = userConfig.verifierCookieName || DEFAULT_VERIFIER_COOKIE;

  const isSecure = userConfig.cookieOptions?.secure ?? !userConfig.allowHttp;

  const authInstance: WytPassAuthInstance = {
    client,
    config: clientConfig,

    async login(
      requestOrOptions?: Request | GetAuthorizationUrlOptions,
      maybeOptions?: GetAuthorizationUrlOptions
    ): Promise<Response> {
      let request: Request | undefined;
      let options: GetAuthorizationUrlOptions = {};

      if (
        requestOrOptions &&
        'headers' in requestOrOptions &&
        typeof (requestOrOptions as Request).url === 'string'
      ) {
        request = requestOrOptions as Request;
        options = maybeOptions || {};
      } else if (requestOrOptions) {
        options = requestOrOptions as GetAuthorizationUrlOptions;
      }

      const effectiveRedirectUri =
        options.redirectUri || resolveRedirectUri(request, clientConfig.redirectUri);

      const auth = await client.getAuthorizationUrl({
        ...options,
        redirectUri: effectiveRedirectUri
      });

      const headers = new Headers();
      headers.set('Location', auth.url);

      // Set temporary state & verifier cookies (10 minutes TTL)
      headers.append(
        'Set-Cookie',
        serializeCookie(stateCookieName, auth.state, {
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 600
        })
      );

      headers.append(
        'Set-Cookie',
        serializeCookie(verifierCookieName, auth.codeVerifier, {
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: 600
        })
      );

      return new Response(null, {
        status: 302,
        headers
      });
    },

    async handleCallback(request: Request, redirectOnSuccess = '/'): Promise<Response> {
      const url = new URL(request.url);
      const searchParams = url.searchParams;

      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');

      if (errorParam) {
        throw new OAuthError(errorParam, errorDesc || undefined);
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (!code) {
        throw new OAuthError('invalid_request', 'Missing code in OAuth callback.');
      }
      if (!state) {
        throw new OAuthError('invalid_request', 'Missing state in OAuth callback.');
      }

      const cookies = parseCookieHeader(request.headers.get('cookie'));
      const expectedState = cookies[stateCookieName];
      const codeVerifier = cookies[verifierCookieName];

      if (!expectedState || !codeVerifier) {
        throw new InvalidStateError('Missing state/PKCE verification cookies in callback request.');
      }

      // Validate anti-CSRF state
      client.validateState(state, expectedState);

      const effectiveRedirectUri = resolveRedirectUri(request, clientConfig.redirectUri);

      // Exchange authorization code
      const tokens = await client.exchangeCode({
        code,
        codeVerifier,
        redirectUri: effectiveRedirectUri
      });

      // Retrieve UserInfo
      const user = await client.getUserInfo(tokens.access_token);

      const sessionData: WytPassSession = {
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000
      };

      const sessionJson = JSON.stringify(sessionData);
      const encodedSession = Buffer.from(sessionJson, 'utf-8').toString('base64');

      const headers = new Headers();
      headers.set('Location', redirectOnSuccess);

      // Set session cookie (30 days or configured options)
      headers.append(
        'Set-Cookie',
        serializeCookie(sessionCookieName, encodedSession, {
          path: '/',
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          maxAge: userConfig.cookieOptions?.maxAge ?? 30 * 24 * 60 * 60,
          ...userConfig.cookieOptions
        })
      );

      // Delete temporary state & verifier cookies
      headers.append('Set-Cookie', serializeDeleteCookie(stateCookieName, { path: '/' }));
      headers.append('Set-Cookie', serializeDeleteCookie(verifierCookieName, { path: '/' }));

      return new Response(null, {
        status: 302,
        headers
      });
    },

    async getSession(request?: Request): Promise<WytPassSession | null> {
      let cookieHeader: string | null | undefined = null;

      if (request) {
        cookieHeader = request.headers.get('cookie');
      } else {
        // Support Next.js Server Components / RSC next/headers if available
        try {
          const { cookies } = await import('next/headers');
          const cookieStore = await cookies();
          const sessionCookie = cookieStore.get(sessionCookieName);
          if (sessionCookie) {
            cookieHeader = `${sessionCookieName}=${sessionCookie.value}`;
          }
        } catch {
          // next/headers not available in current environment
        }
      }

      if (!cookieHeader) return null;

      const parsedCookies = parseCookieHeader(cookieHeader);
      const sessionString = parsedCookies[sessionCookieName];
      if (!sessionString) return null;

      try {
        const json = Buffer.from(sessionString, 'base64').toString('utf-8');
        const session = JSON.parse(json) as WytPassSession;

        if (!session.user || !session.accessToken) {
          return null;
        }

        return session;
      } catch {
        return null;
      }
    },

    async requireAuth(
      request?: Request,
      redirectTo = '/api/auth/wytpass/login'
    ): Promise<WytPassSession> {
      const session = await authInstance.getSession(request);
      if (!session) {
        throw new Error(`Authentication required. Redirecting to ${redirectTo}`);
      }
      return session;
    },

    async logout(redirectTo = '/'): Promise<Response> {
      const headers = new Headers();
      headers.set('Location', redirectTo);
      headers.append('Set-Cookie', serializeDeleteCookie(sessionCookieName, { path: '/' }));

      return new Response(null, {
        status: 302,
        headers
      });
    }
  };

  return authInstance;
}