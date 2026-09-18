/**
 * Default configuration constants for the WytPass SSO / OAuth2 / OIDC provider.
 */

export const DEFAULT_PORTAL_URL = 'https://wytnet.com';
export const DEFAULT_API_URL = 'https://api.wytnet.com';
export const DEFAULT_ISSUER = 'https://api.wytnet.com';
export const DEFAULT_AUTHORIZATION_ENDPOINT = 'https://wytnet.com/oauth/authorize';
export const DEFAULT_TOKEN_ENDPOINT = 'https://api.wytnet.com/oauth/token';
export const DEFAULT_USERINFO_ENDPOINT = 'https://api.wytnet.com/oauth/userinfo';
export const DEFAULT_DISCOVERY_ENDPOINT = 'https://api.wytnet.com/.well-known/openid-configuration';
export const DEFAULT_JWKS_ENDPOINT = 'https://api.wytnet.com/.well-known/jwks.json';
export const DEFAULT_APPLICATION_INFO_ENDPOINT = 'https://api.wytnet.com/oauth/application-info';

/**
 * Canonical WytPass environments adhering to the Strict Environment Separation (Rule of Isolation).
 */
export const ENVIRONMENTS = {
  production: {
    portalUrl: 'https://wytnet.com',
    apiUrl: 'https://api.wytnet.com',
    authorizationEndpoint: 'https://wytnet.com/oauth/authorize',
    tokenEndpoint: 'https://api.wytnet.com/oauth/token',
    userInfoEndpoint: 'https://api.wytnet.com/oauth/userinfo',
    discoveryEndpoint: 'https://api.wytnet.com/.well-known/openid-configuration',
    jwksEndpoint: 'https://api.wytnet.com/.well-known/jwks.json',
    issuer: 'https://api.wytnet.com',
    allowHttp: false
  },
  local: {
    portalUrl: 'http://localhost:5173',
    apiUrl: 'http://localhost:8000',
    authorizationEndpoint: 'http://localhost:5173/oauth/authorize',
    tokenEndpoint: 'http://localhost:8000/oauth/token',
    userInfoEndpoint: 'http://localhost:8000/oauth/userinfo',
    discoveryEndpoint: 'http://localhost:8000/.well-known/openid-configuration',
    jwksEndpoint: 'http://localhost:8000/.well-known/jwks.json',
    issuer: 'http://localhost:8000',
    allowHttp: true
  }
} as const;

export type WytPassEnvironmentName = keyof typeof ENVIRONMENTS;

export const DEFAULT_SCOPE = 'openid profile email';
export const DEFAULT_RESPONSE_TYPE = 'code';
export const DEFAULT_CODE_CHALLENGE_METHOD = 'S256';
export const DEFAULT_GRANT_TYPE_AUTHORIZATION_CODE = 'authorization_code';
export const DEFAULT_GRANT_TYPE_REFRESH_TOKEN = 'refresh_token';

export const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
export const DEFAULT_DISCOVERY_CACHE_TTL_MS = 3600000; // 1 hour
export const DEFAULT_JWKS_CACHE_TTL_MS = 3600000; // 1 hour

export const STORAGE_KEYS = {
  STATE: 'wytpass_oauth_state',
  CODE_VERIFIER: 'wytpass_pkce_verifier',
  REDIRECT_URI: 'wytpass_redirect_uri',
  RETURN_TO: 'wytpass_return_to',
  ACCESS_TOKEN: 'wytpass_access_token',
  REFRESH_TOKEN: 'wytpass_refresh_token',
  ID_TOKEN: 'wytpass_id_token',
  USER: 'wytpass_user'
} as const;
