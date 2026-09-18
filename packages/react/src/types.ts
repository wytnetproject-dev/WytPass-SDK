import type React from 'react';
import type {
  GetAuthorizationUrlOptions,
  WytPassClient,
  WytPassConfig,
  WytPassError,
  WytPassTokenResponse,
  WytPassUser
} from '@wytpass/core';

export interface WytPassProviderProps {
  /**
   * OAuth 2.0 Client ID for your application (e.g. 'wp_xxxxxxxx').
   * If omitted, the provider will attempt to resolve it automatically from
   * process.env.VITE_WYTPASS_CLIENT_ID, process.env.NEXT_PUBLIC_WYTPASS_CLIENT_ID,
   * or process.env.WYTPASS_CLIENT_ID.
   */
  clientId?: string;

  /**
   * Optional application redirect/callback URI override.
   * If omitted, the SDK automatically resolves the registered callback URI.
   */
  redirectUri?: string;

  /**
   * Environment preset ('production' | 'local').
   * Default: 'production'.
   */
  environment?: 'production' | 'local';

  /**
   * Base Portal URL (where /oauth/authorize lives). Optional override.
   */
  portalUrl?: string;

  /**
   * Base API URL (where /oauth/token and /oauth/userinfo live). Optional override.
   */
  apiUrl?: string;

  /**
   * Optional marketplace application slug (appId).
   */
  appId?: string;

  /**
   * OIDC Issuer URL (Defaults to https://api.wytnet.com).
   */
  issuer?: string;

  /**
   * Authorization endpoint URL override.
   */
  authorizationEndpoint?: string;

  /**
   * Token endpoint URL override.
   */
  tokenEndpoint?: string;

  /**
   * UserInfo endpoint URL override.
   */
  userInfoEndpoint?: string;

  /**
   * JWKS endpoint URL override.
   */
  jwksEndpoint?: string;

  /**
   * OIDC Discovery endpoint URL override.
   */
  discoveryEndpoint?: string;

  /**
   * Requested OAuth scopes (Defaults to "openid profile email").
   */
  scope?: string;

  /**
   * Allow unencrypted HTTP endpoints for local development.
   */
  allowHttp?: boolean;

  /**
   * Web storage type for holding temporary PKCE verifiers & tokens.
   * Default: 'sessionStorage'.
   */
  storageType?: 'sessionStorage' | 'localStorage' | 'memory';

  /**
   * Automatically fetch user profile on successful authentication.
   * Default: true.
   */
  autoFetchUser?: boolean;

  /**
   * Automatically detect OAuth code and state in URL parameters and complete authentication.
   * Default: true.
   */
  autoHandleCallback?: boolean;

  /**
   * Children components.
   */
  children: React.ReactNode;
}

export interface WytPassContextValue {
  /**
   * Whether the user is currently authenticated with a valid session.
   */
  isAuthenticated: boolean;

  /**
   * Whether an authentication operation (init, login, callback, refresh) is loading.
   */
  isLoading: boolean;

  /**
   * The authenticated user profile, or null if unauthenticated.
   */
  user: WytPassUser | null;

  /**
   * Current active access token, or null if unauthenticated.
   */
  accessToken: string | null;

  /**
   * The latest authentication or network error, if any.
   */
  error: WytPassError | Error | null;

  /**
   * Initiates the OAuth PKCE login redirect to WytPass.
   */
  login: (options?: GetAuthorizationUrlOptions) => Promise<void>;

  /**
   * Logs out the user and clears all local session storage and tokens.
   */
  logout: () => Promise<void> | void;

  /**
   * Returns the current active access token.
   */
  getAccessToken: () => Promise<string | null>;

  /**
   * Refreshes the active session if a refresh token is present.
   */
  refresh: () => Promise<WytPassTokenResponse | null>;

  /**
   * Underlying WytPassClient instance.
   */
  client: WytPassClient;

  /**
   * Directly sets the authenticated user and token state (useful for custom callback flows).
   */
  setAuthState: (state: { user?: WytPassUser | null; tokens?: WytPassTokenResponse | null }) => void;
}

export interface WytPassCallbackProps {
  /**
   * Callback invoked upon successful authorization code exchange and UserInfo retrieval.
   */
  onSuccess?: (user: WytPassUser, tokens: WytPassTokenResponse) => void;

  /**
   * Callback invoked if the callback exchange fails.
   */
  onError?: (error: Error) => void;

  /**
   * URL or route to redirect to on success (e.g. '/dashboard').
   */
  successRedirect?: string;

  /**
   * URL or route to redirect to on error (e.g. '/login').
   */
  errorRedirect?: string;

  /**
   * Custom loading UI while exchanging tokens.
   */
  loadingComponent?: React.ReactNode;

  /**
   * Custom error render function if authentication fails.
   */
  errorComponent?: (error: Error) => React.ReactNode;
}
