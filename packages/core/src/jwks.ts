import { DEFAULT_ISSUER, DEFAULT_JWKS_CACHE_TTL_MS, DEFAULT_JWKS_ENDPOINT } from './constants.js';
import { NetworkError, TokenValidationError, WytPassError } from './errors.js';
import type { IDTokenPayload, IDTokenValidationOptions, JWKS, WytPassConfig } from './types.js';
import { validateEndpointUrl } from './authorization.js';

interface JWKSCacheEntry {
  jwks: JWKS;
  expiresAt: number;
}

let jwksCache: JWKSCacheEntry | null = null;

/**
 * Fetches and caches the JSON Web Key Set (JWKS) from the WytPass provider.
 */
export async function fetchJwks(
  config: WytPassConfig = { clientId: '', redirectUri: '' },
  forceRefresh = false
): Promise<JWKS> {
  const now = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.jwks;
  }

  const jwksUrl = validateEndpointUrl(
    config.jwksEndpoint || DEFAULT_JWKS_ENDPOINT,
    'jwksEndpoint',
    config.allowHttp
  );

  const fetchFn = config.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new NetworkError('No fetch function available.');
  }

  try {
    const response = await fetchFn(jwksUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new WytPassError(`Failed to fetch JWKS from ${jwksUrl.toString()} (HTTP ${response.status}).`);
    }

    const data = (await response.json()) as JWKS;
    if (!data.keys || !Array.isArray(data.keys)) {
      throw new WytPassError('Invalid JWKS format: expected "keys" array.');
    }

    jwksCache = {
      jwks: data,
      expiresAt: now + DEFAULT_JWKS_CACHE_TTL_MS
    };

    return data;
  } catch (err: unknown) {
    if (err instanceof WytPassError) throw err;
    throw new NetworkError(
      `Network failure while fetching JWKS: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  }
}

/**
 * Decodes a Base64URL string into UTF-8 text.
 */
export function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }

  if (typeof atob === 'function') {
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } else if (typeof (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer !== 'undefined') {
    const BufferClass = (globalThis as { Buffer: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
    return BufferClass.from(base64, 'base64').toString('utf8');
  }

  throw new WytPassError('No base64 decoder available in environment.');
}

/**
 * Safely parses the header and payload of a JSON Web Token (JWT) without cryptographic verification.
 */
export function parseJwt(jwtString: string): { header: Record<string, unknown>; payload: IDTokenPayload } {
  if (!jwtString || typeof jwtString !== 'string') {
    throw new TokenValidationError('JWT string must be a non-empty string.');
  }

  const parts = jwtString.split('.');
  if (parts.length !== 3) {
    throw new TokenValidationError(`Invalid JWT format: expected 3 dot-separated segments, got ${parts.length}.`);
  }

  const headerPart = parts[0];
  const payloadPart = parts[1];

  if (!headerPart || !payloadPart) {
    throw new TokenValidationError('Invalid JWT format: missing header or payload segment.');
  }

  try {
    const headerJson = base64UrlDecode(headerPart);
    const payloadJson = base64UrlDecode(payloadPart);

    const header = JSON.parse(headerJson) as Record<string, unknown>;
    const payload = JSON.parse(payloadJson) as IDTokenPayload;

    return { header, payload };
  } catch (err) {
    throw new TokenValidationError(`Failed to parse JWT segments: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Validates the claims of an OIDC ID Token according to the OpenID Connect Core 1.0 specification.
 */
export function validateIdTokenClaims(
  payload: IDTokenPayload,
  options: IDTokenValidationOptions
): boolean {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const clockSkewToleranceInSeconds = 60; // 1 minute leeway for clock skew

  // 1. Expiration check
  if (!payload.exp || typeof payload.exp !== 'number') {
    throw new TokenValidationError('ID Token missing "exp" (expiration) claim.');
  }
  if (payload.exp + clockSkewToleranceInSeconds < nowInSeconds) {
    throw new TokenValidationError(`ID Token has expired at ${new Date(payload.exp * 1000).toISOString()}.`);
  }

  // 2. Issued at check
  if (payload.iat && typeof payload.iat === 'number') {
    if (payload.iat - clockSkewToleranceInSeconds > nowInSeconds) {
      throw new TokenValidationError('ID Token "iat" (issued at) claim is in the future.');
    }
  }

  // 3. Issuer check
  const expectedIssuer = (options.issuer || DEFAULT_ISSUER).replace(/\/+$/, '');
  const actualIssuer = (payload.iss || '').replace(/\/+$/, '');
  if (actualIssuer !== expectedIssuer) {
    throw new TokenValidationError(`ID Token issuer mismatch: expected "${expectedIssuer}", got "${actualIssuer}".`);
  }

  // 4. Audience check
  const aud = payload.aud;
  if (!aud) {
    throw new TokenValidationError('ID Token missing "aud" (audience) claim.');
  }

  const isAudienceValid = Array.isArray(aud)
    ? aud.includes(options.clientId)
    : aud === options.clientId;

  if (!isAudienceValid) {
    throw new TokenValidationError(`ID Token audience mismatch: expected "${options.clientId}", got "${String(aud)}".`);
  }

  // 5. Nonce check (if provided in authorization request)
  if (options.nonce && payload.nonce !== options.nonce) {
    throw new TokenValidationError('ID Token nonce mismatch. Possible replay attack detected.');
  }

  // 6. Max age check
  if (options.maxAge && payload.iat) {
    const tokenAge = nowInSeconds - payload.iat;
    if (tokenAge > options.maxAge) {
      throw new TokenValidationError(`ID Token age (${tokenAge}s) exceeds maxAge (${options.maxAge}s).`);
    }
  }

  return true;
}

/**
 * Clears the in-memory JWKS cache.
 */
export function clearJwksCache(): void {
  jwksCache = null;
}
