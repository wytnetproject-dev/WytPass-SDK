import {
  DEFAULT_GRANT_TYPE_AUTHORIZATION_CODE,
  DEFAULT_GRANT_TYPE_REFRESH_TOKEN,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_TOKEN_ENDPOINT
} from './constants.js';
import { NetworkError, OAuthError, TokenExchangeError } from './errors.js';
import type { ExchangeCodeOptions, RefreshTokenOptions, WytPassConfig, WytPassTokenResponse } from './types.js';
import { validateEndpointUrl } from './authorization.js';

/**
 * Executes a network fetch with timeout support.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  customFetch?: typeof globalThis.fetch
): Promise<Response> {
  const fetchFn = customFetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new NetworkError('No global fetch function available. Please provide a custom fetch in WytPassConfig.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError(`Request to ${url} timed out after ${timeoutMs}ms.`);
    }
    if (err instanceof NetworkError) throw err;
    throw new NetworkError(
      `Network failure during request to ${url}: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parses and handles OAuth 2.0 token response.
 */
async function handleTokenResponse(response: Response, endpointUrl: string): Promise<WytPassTokenResponse> {
  let responseData: unknown;
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = Object.fromEntries(new URLSearchParams(text));
      }
    }
  } catch (err) {
    throw new TokenExchangeError(
      `Failed to parse token endpoint response from ${endpointUrl} (HTTP ${response.status}).`,
      response.status
    );
  }

  const data = responseData as Record<string, unknown>;

  if (!response.ok) {
    const error = typeof data['error'] === 'string' ? data['error'] : 'token_exchange_failed';
    const errorDescription = typeof data['error_description'] === 'string' ? data['error_description'] : undefined;
    const errorUri = typeof data['error_uri'] === 'string' ? data['error_uri'] : undefined;

    throw new OAuthError(error, errorDescription, errorUri, response.status);
  }

  if (!data['access_token'] || typeof data['access_token'] !== 'string') {
    throw new TokenExchangeError('Token response missing required "access_token" field.', response.status, data);
  }

  return {
    access_token: data['access_token'] as string,
    token_type: (data['token_type'] as string) || 'Bearer',
    expires_in: typeof data['expires_in'] === 'number' ? data['expires_in'] : undefined,
    refresh_token: typeof data['refresh_token'] === 'string' ? data['refresh_token'] : undefined,
    id_token: typeof data['id_token'] === 'string' ? data['id_token'] : undefined,
    scope: typeof data['scope'] === 'string' ? data['scope'] : undefined,
    ...data
  };
}

/**
 * Exchanges an authorization code for access token, refresh token, and ID token via PKCE.
 */
export async function exchangeAuthorizationCode(
  config: WytPassConfig,
  options: ExchangeCodeOptions
): Promise<WytPassTokenResponse> {
  const tokenUrl = validateEndpointUrl(
    config.tokenEndpoint || DEFAULT_TOKEN_ENDPOINT,
    'tokenEndpoint',
    config.allowHttp
  );

  const clientId = options.clientId || config.clientId;
  const clientSecret = options.clientSecret || config.clientSecret;
  const redirectUri = options.redirectUri || config.redirectUri;

  const bodyParams = new URLSearchParams();
  bodyParams.set('grant_type', DEFAULT_GRANT_TYPE_AUTHORIZATION_CODE);
  bodyParams.set('code', options.code);
  bodyParams.set('client_id', clientId);

  if (redirectUri) {
    bodyParams.set('redirect_uri', redirectUri);
  }

  if (options.codeVerifier) {
    bodyParams.set('code_verifier', options.codeVerifier);
  }

  if (clientSecret) {
    bodyParams.set('client_secret', clientSecret);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json'
  };

  const timeoutMs = config.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const response = await fetchWithTimeout(
    tokenUrl.toString(),
    {
      method: 'POST',
      headers,
      body: bodyParams.toString()
    },
    timeoutMs,
    config.fetch
  );

  return handleTokenResponse(response, tokenUrl.toString());
}

/**
 * Refreshes an access token using a valid refresh token.
 */
export async function refreshAccessToken(
  config: WytPassConfig,
  options: RefreshTokenOptions
): Promise<WytPassTokenResponse> {
  const tokenUrl = validateEndpointUrl(
    config.tokenEndpoint || DEFAULT_TOKEN_ENDPOINT,
    'tokenEndpoint',
    config.allowHttp
  );

  const clientId = options.clientId || config.clientId;
  const clientSecret = options.clientSecret || config.clientSecret;

  const bodyParams = new URLSearchParams();
  bodyParams.set('grant_type', DEFAULT_GRANT_TYPE_REFRESH_TOKEN);
  bodyParams.set('refresh_token', options.refreshToken);
  bodyParams.set('client_id', clientId);

  if (options.scope) {
    bodyParams.set('scope', options.scope);
  }

  if (clientSecret) {
    bodyParams.set('client_secret', clientSecret);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json'
  };

  const timeoutMs = config.timeoutMs || DEFAULT_REQUEST_TIMEOUT_MS;
  const response = await fetchWithTimeout(
    tokenUrl.toString(),
    {
      method: 'POST',
      headers,
      body: bodyParams.toString()
    },
    timeoutMs,
    config.fetch
  );

  return handleTokenResponse(response, tokenUrl.toString());
}
