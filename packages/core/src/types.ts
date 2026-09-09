/**
 * TypeScript type definitions for @wytpass/core
 */

export interface WytPassLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface WytPassStorage {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface WytPassConfig {
  /**
   * OAuth 2.0 Client ID issued by WytPass.
   */
  clientId: string;

  /**
   * OAuth 2.0 Client Secret (Server-side environments ONLY).
   * NEVER pass this in browser applications!
   */
  clientSecret?: string;

  /**
   * Application Callback / Redirect URI registered in WytPass console (Optional in dynamic server environments).
   */
  redirectUri?: string;

  /**
   * OIDC Issuer URL (Defaults to https://api.wytnet.com).
   */
  issuer?: string;

  /**
   * Authorization endpoint URL (Defaults to https://wytnet.com/oauth/authorize).
   */
  authorizationEndpoint?: string;

  /**
   * Token endpoint URL (Defaults to https://api.wytnet.com/oauth/token).
   */
  tokenEndpoint?: string;

  /**
   * UserInfo endpoint URL (Defaults to https://api.wytnet.com/oauth/userinfo).
   */
  userInfoEndpoint?: string;

  /**
   * JWKS endpoint URL (Defaults to https://api.wytnet.com/.well-known/jwks.json).
   */
  jwksEndpoint?: string;

  /**
   * OIDC Discovery endpoint URL (Defaults to https://api.wytnet.com/.well-known/openid-configuration).
   */
  discoveryEndpoint?: string;

  /**
   * OAuth Scopes requested (Defaults to "openid profile email").
   */
  scope?: string;

  /**
   * Pluggable storage adapter for caching state, PKCE verifiers, or session tokens.
   */
  storage?: WytPassStorage;

  /**
   * Custom logger implementation.
   */
  logger?: WytPassLogger;

  /**
   * HTTP request timeout in milliseconds (Default: 15000ms).
   */
  timeoutMs?: number;

  /**
   * Allow unencrypted HTTP endpoints for local development (Default: false).
   */
  allowHttp?: boolean;

  /**
   * Custom fetch implementation (optional, falls back to globalThis.fetch).
   */
  fetch?: typeof globalThis.fetch;
}

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export interface AuthorizationUrlResult {
  /**
   * The complete authorization URL to redirect the user to.
   */
  url: string;

  /**
   * Cryptographically secure state string generated for this request.
   */
  state: string;

  /**
   * PKCE code verifier generated for this request (store safely until callback).
   */
  codeVerifier: string;

  /**
   * S256 code challenge sent in the authorization request.
   */
  codeChallenge: string;
}

export interface GetAuthorizationUrlOptions {
  /**
   * Custom state value (if not provided, a cryptographically secure state will be generated).
   */
  state?: string;

  /**
   * Override scope for this authorization request.
   */
  scope?: string;

  /**
   * Override redirectUri for this authorization request.
   */
  redirectUri?: string;

  /**
   * Custom PKCE code_verifier (if not provided, one will be generated automatically).
   */
  codeVerifier?: string;

  /**
   * Prompt parameter (e.g. 'login', 'consent', 'none').
   */
  prompt?: string;

  /**
   * Login hint parameter (e.g. user email address).
   */
  loginHint?: string;

  /**
   * Nonce value for OIDC ID Token replay protection.
   */
  nonce?: string;

  /**
   * Additional custom query parameters.
   */
  extraParams?: Record<string, string>;
}

export interface ExchangeCodeOptions {
  /**
   * Authorization code received from WytPass redirect callback.
   */
  code: string;

  /**
   * PKCE code_verifier corresponding to the code_challenge used in the authorization request.
   */
  codeVerifier?: string;

  /**
   * Redirect URI that was used in the original authorization request.
   */
  redirectUri?: string;

  /**
   * Override Client ID.
   */
  clientId?: string;

  /**
   * Override Client Secret (Server-side ONLY).
   */
  clientSecret?: string;
}

export interface RefreshTokenOptions {
  /**
   * Refresh token received from a previous token exchange.
   */
  refreshToken: string;

  /**
   * Optional scope override.
   */
  scope?: string;

  /**
   * Override Client ID.
   */
  clientId?: string;

  /**
   * Override Client Secret (Server-side ONLY).
   */
  clientSecret?: string;
}

export interface WytPassTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  [key: string]: unknown;
}

export interface WytPassUser {
  id: string;
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  profilePicture?: string;
  subscriptions?: Array<unknown> | Record<string, unknown> | unknown;
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WytPassDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  response_types_supported?: string[];
  subject_types_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  claims_supported?: string[];
  code_challenge_methods_supported?: string[];
  [key: string]: unknown;
}

export interface JWK {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
}

export interface JWKS {
  keys: JWK[];
}

export interface IDTokenPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

export interface IDTokenValidationOptions {
  idToken: string;
  clientId: string;
  issuer?: string;
  nonce?: string;
  maxAge?: number;
}
