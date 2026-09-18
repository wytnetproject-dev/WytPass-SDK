import {
  DEFAULT_AUTHORIZATION_ENDPOINT,
  DEFAULT_CODE_CHALLENGE_METHOD,
  DEFAULT_RESPONSE_TYPE,
  DEFAULT_SCOPE,
  ENVIRONMENTS
} from './constants.js';
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
 * Builds the complete OAuth 2.0 / OIDC Authorization URL with PKCE (RFC 7636) and state protection.
 */
export async function buildAuthorizationUrl(
  config: WytPassConfig,
  options: GetAuthorizationUrlOptions = {}
): Promise<AuthorizationUrlResult> {
  if (!config.clientId) {
    throw new ConfigurationError('clientId is required in WytPassConfig.');
  }

  const redirectUri = options.redirectUri || config.redirectUri;
  if (!redirectUri) {
    throw new ConfigurationError('redirectUri is required to construct authorization URL.');
  }

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
    codeChallenge
  };
}
