import type {
  GetAuthorizationUrlOptions,
  WytPassClient,
  WytPassConfig,
  WytPassTokenResponse,
  WytPassUser
} from '@wytpass/core';

export interface CookieOptions {
  path?: string;
  maxAge?: number;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
}

export interface WytPassNextConfig {
  /**
   * OAuth 2.0 Client ID (Defaults to process.env.WYTPASS_CLIENT_ID).
   */
  clientId?: string;

  /**
   * OAuth 2.0 Client Secret (Defaults to process.env.WYTPASS_CLIENT_SECRET).
   */
  clientSecret?: string;

  /**
   * Callback redirect URI (Optional: Auto-derived from request host if omitted).
   */
  redirectUri?: string;

  /**
   * OIDC Issuer URL (Defaults to process.env.WYTPASS_ISSUER or https://api.wytnet.com).
   */
  issuer?: string;

  /**
   * Authorization endpoint URL.
   */
  authorizationEndpoint?: string;

  /**
   * Token endpoint URL.
   */
  tokenEndpoint?: string;

  /**
   * UserInfo endpoint URL.
   */
  userInfoEndpoint?: string;

  /**
   * JWKS endpoint URL.
   */
  jwksEndpoint?: string;

  /**
   * Discovery endpoint URL.
   */
  discoveryEndpoint?: string;

  /**
   * Requested OAuth scopes.
   */
  scope?: string;

  /**
   * Allow HTTP for localhost development.
   */
  allowHttp?: boolean;

  /**
   * Custom fetch implementation.
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Name of the session cookie. Default: 'wytpass_session'.
   */
  sessionCookieName?: string;

  /**
   * Name of the state cookie. Default: 'wytpass_oauth_state'.
   */
  stateCookieName?: string;

  /**
   * Name of the PKCE verifier cookie. Default: 'wytpass_pkce_verifier'.
   */
  verifierCookieName?: string;

  /**
   * Custom cookie options.
   */
  cookieOptions?: CookieOptions;
}

export interface WytPassSession {
  user: WytPassUser;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
}

export interface WytPassAuthInstance {
  /**
   * Initiates login and returns a Response redirecting to WytPass with PKCE/state cookies set.
   */
  login: (
    requestOrOptions?: Request | GetAuthorizationUrlOptions,
    options?: GetAuthorizationUrlOptions
  ) => Promise<Response>;

  /**
   * Handles the OAuth callback inside a Next.js App Router Route Handler.
   */
  handleCallback: (request: Request, redirectOnSuccess?: string) => Promise<Response>;

  /**
   * Reads and verifies the current session from Request cookies.
   */
  getSession: (request?: Request) => Promise<WytPassSession | null>;

  /**
   * Ensures an active session exists or returns a redirect Response to login.
   */
  requireAuth: (request?: Request, redirectTo?: string) => Promise<WytPassSession>;

  /**
   * Clears session cookies and logs the user out.
   */
  logout: (redirectTo?: string) => Promise<Response>;

  /**
   * Direct access to underlying WytPassClient instance.
   */
  client: WytPassClient;

  /**
   * Resolved client configuration.
   */
  config: WytPassConfig;
}

export interface WytPassNextAuthOptions {
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUrl?: string;
  scope?: string;
}