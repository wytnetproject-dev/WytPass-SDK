import {
  DEFAULT_AUTHORIZATION_ENDPOINT,
  DEFAULT_CODE_CHALLENGE_METHOD,
  DEFAULT_RESPONSE_TYPE,
  DEFAULT_SCOPE,
  ENVIRONMENTS
} from './constants.js';
import { fetchApplicationInfo } from './discovery.js';
import { ConfigurationError } from './errors.js';
import { generatePKCE } from './pkce.js';
import { generateState } from './state.js';
import type { AuthorizationUrlResult, GetAuthorizationUrlOptions, WytPassConfig } from './types.js';

/**
 * Validates that an endpoint URL conforms to security standards (HTTPS required, or localhost HTTP if permitted).
 */
export function validateEndpointUrl(url: string, endpointName: string, allowHttp = false): URL {
  try {
    const parsed = new URL(url);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';

    if (parsed.protocol !== 'https:' && !(allowHttp && isLocalhost)) {
      throw new ConfigurationError(
        `Insecure endpoint URL for ${endpointName}: "${url}". Production endpoints must use HTTPS. Local HTTP is only allowed for localhost with allowHttp: true.`
      );
    }
    return parsed;
  } catch (err) {
    if (err instanceof ConfigurationError) throw err;
    throw new ConfigurationError(`Invalid ${endpointName} URL: "${url}".`);
  }
}

/**
 * Automatically resolves the redirect URI from caller options, config,
 * application registered URIs from WhitePass API, browser origin, or server environment.
 */
export async function resolveRedirectUri(
  config: WytPassConfig,
  options?: GetAuthorizationUrlOptions
): Promise<string> {
  // 1. Explicit override in options
  if (options?.redirectUri) {
    return options.redirectUri;
  }
  // 2. Explicit config provided by client
  if (config.redirectUri) {
    return config.redirectUri;
  }

  // 3. Browser environment automatic resolution
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    const pathname = window.location.pathname;

    // If current path already looks like a callback route, use it
    if (pathname.includes('/callback')) {
      return `${origin}${pathname}`;
    }

    // Attempt to query WhitePass application-info for this client ID
    try {
      const appInfo = await fetchApplicationInfo(config);
      if (appInfo?.redirect_uris && appInfo.redirect_uris.length > 0) {
        // Find registered redirect URI that matches current window origin
        const exactOriginMatch = appInfo.redirect_uris.find(uri => {
          try {
            return new URL(uri).origin === origin;
          } catch {
            return false;
          }
        });
        if (exactOriginMatch) {
          return exactOriginMatch;
        }

        // If in local development, match any localhost / 127.0.0.1 URI
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          const localMatch = appInfo.redirect_uris.find(uri =>
            uri.includes('localhost') || uri.includes('127.0.0.1')
          );
          if (localMatch) {
            return localMatch;
          }
        }

        // Return the first registered redirect URI
        if (appInfo.redirect_uris[0]) {
          return appInfo.redirect_uris[0];
        }
      }
    } catch {
      // Fall through to standard default
    }

    // Standard browser fallback
    return `${origin}/callback`;
  }

  // 4. Server environment check (Node.js / Next.js / Vercel)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env['WYTPASS_REDIRECT_URI']) {
      return process.env['WYTPASS_REDIRECT_URI'];
    }
    if (process.env['VERCEL_URL']) {
      return `https://${process.env['VERCEL_URL']}/api/auth/wytpass/callback`;
    }
  }

  // 5. Default fallback
  return 'http://localhost:3000/callback';
}

/**
 * Builds the complete OAuth 2.0 / OIDC Authorization URL with PKCE (RFC 7636) and state protection.
 */
export async function buildAuthorizationUrl(
  config: WytPassConfig,
  options: GetAuthorizationUrlOptions = {}
): Promise<AuthorizationUrlResult> {
  if (!config.clientId) {
    throw new ConfigurationError('clientId is required in WytPassConfig.');
  }

  const redirectUri = await resolveRedirectUri(config, options);

  const envConfig = config.environment ? ENVIRONMENTS[config.environment] : undefined;
  const allowHttp = config.allowHttp ?? envConfig?.allowHttp ?? false;

  const baseEndpoint =
    config.authorizationEndpoint ||
    (config.portalUrl ? `${config.portalUrl.replace(/\/+$/, '')}/oauth/authorize` : undefined) ||
    envConfig?.authorizationEndpoint ||
    DEFAULT_AUTHORIZATION_ENDPOINT;

  const authUrl = validateEndpointUrl(baseEndpoint, 'authorizationEndpoint', allowHttp);

  // Generate or use provided state
  const state = options.state || generateState();

  // Generate or use provided PKCE pair
  let codeVerifier = options.codeVerifier;
  let codeChallenge = '';

  if (codeVerifier) {
    const pkce = await import('./pkce.js');
    codeChallenge = await pkce.generateCodeChallenge(codeVerifier);
  } else {
    const pkce = await generatePKCE();
    codeVerifier = pkce.codeVerifier;
    codeChallenge = pkce.codeChallenge;
  }

  const scope = options.scope || config.scope || DEFAULT_SCOPE;

  const searchParams = authUrl.searchParams;
  searchParams.set('response_type', DEFAULT_RESPONSE_TYPE);
  searchParams.set('client_id', config.clientId);
  searchParams.set('redirect_uri', redirectUri);
  searchParams.set('scope', scope);
  searchParams.set('state', state);
  searchParams.set('code_challenge', codeChallenge);
  searchParams.set('code_challenge_method', DEFAULT_CODE_CHALLENGE_METHOD);

  const appId = options.appId || config.appId;
  if (appId) {
    searchParams.set('appId', appId);
  }

  if (options.prompt) {
    searchParams.set('prompt', options.prompt);
  }
  if (options.loginHint) {
    searchParams.set('login_hint', options.loginHint);
  }
  if (options.nonce) {
    searchParams.set('nonce', options.nonce);
  }

  if (options.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value);
      }
    }
  }

  return {
    url: authUrl.toString(),
    state,
    codeVerifier,
    codeChallenge,
    redirectUri
  };
}
