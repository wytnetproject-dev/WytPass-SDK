import { DEFAULT_DISCOVERY_CACHE_TTL_MS, DEFAULT_DISCOVERY_ENDPOINT, DEFAULT_ISSUER } from './constants.js';
import { DiscoveryError, NetworkError } from './errors.js';
import type { WytPassConfig, WytPassDiscoveryDocument } from './types.js';
import { validateEndpointUrl } from './authorization.js';

interface CacheEntry {
  document: WytPassDiscoveryDocument;
  expiresAt: number;
}

let discoveryCache: CacheEntry | null = null;

/**
 * Fetches and caches the OpenID Connect discovery document (.well-known/openid-configuration).
 */
export async function fetchDiscoveryDocument(
  config: WytPassConfig = { clientId: '', redirectUri: '' },
  forceRefresh = false
): Promise<WytPassDiscoveryDocument> {
  const now = Date.now();
  if (!forceRefresh && discoveryCache && discoveryCache.expiresAt > now) {
    return discoveryCache.document;
  }

  let discoveryUrlString = config.discoveryEndpoint;
  if (!discoveryUrlString) {
    if (config.issuer) {
      discoveryUrlString = `${config.issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
    } else {
      discoveryUrlString = DEFAULT_DISCOVERY_ENDPOINT;
    }
  }

  const discoveryUrl = validateEndpointUrl(discoveryUrlString, 'discoveryEndpoint', config.allowHttp);
  const fetchFn = config.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new NetworkError('No fetch function available.');
  }

  try {
    const response = await fetchFn(discoveryUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new DiscoveryError(
        `Failed to fetch OIDC discovery document from ${discoveryUrl.toString()} (HTTP ${response.status}).`
      );
    }

    const data = (await response.json()) as Partial<WytPassDiscoveryDocument>;

    if (!data.issuer || !data.authorization_endpoint || !data.token_endpoint) {
      throw new DiscoveryError('Discovery document is missing required OIDC endpoints (issuer, authorization_endpoint, token_endpoint).');
    }

    const doc: WytPassDiscoveryDocument = {
      issuer: data.issuer || config.issuer || DEFAULT_ISSUER,
      authorization_endpoint: data.authorization_endpoint,
      token_endpoint: data.token_endpoint,
      userinfo_endpoint: data.userinfo_endpoint,
      jwks_uri: data.jwks_uri,
      response_types_supported: data.response_types_supported,
      subject_types_supported: data.subject_types_supported,
      id_token_signing_alg_values_supported: data.id_token_signing_alg_values_supported,
      scopes_supported: data.scopes_supported,
      token_endpoint_auth_methods_supported: data.token_endpoint_auth_methods_supported,
      claims_supported: data.claims_supported,
      code_challenge_methods_supported: data.code_challenge_methods_supported,
      ...data
    };

    discoveryCache = {
      document: doc,
      expiresAt: now + DEFAULT_DISCOVERY_CACHE_TTL_MS
    };

    return doc;
  } catch (err: unknown) {
    if (err instanceof DiscoveryError) throw err;
    throw new NetworkError(
      `Network failure while fetching discovery document: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  }
}

/**
 * Clears the in-memory discovery document cache.
 */
export function clearDiscoveryCache(): void {
  discoveryCache = null;
}
