import { buildAuthorizationUrl } from './authorization.js';
import { STORAGE_KEYS } from './constants.js';
import { fetchDiscoveryDocument } from './discovery.js';
import { ConfigurationError, InvalidStateError, OAuthError, WytPassError } from './errors.js';
import { fetchJwks, parseJwt, validateIdTokenClaims } from './jwks.js';
import { NullLogger } from './logger.js';
import { generatePKCE } from './pkce.js';
import { generateState, validateState } from './state.js';
import { BrowserStorage, MemoryStorage } from './storage.js';
import { exchangeAuthorizationCode, refreshAccessToken } from './token.js';
import type {
  AuthorizationUrlResult,
  ExchangeCodeOptions,
  GetAuthorizationUrlOptions,
  IDTokenPayload,
  IDTokenValidationOptions,
  JWKS,
  PKCEPair,
  RefreshTokenOptions,
  WytPassCallbackResult,
  WytPassConfig,
  WytPassDiscoveryDocument,
  WytPassLogger,
  WytPassStorage,
  WytPassTokenResponse,
  WytPassUser
} from './types.js';
import { fetchUserInfo } from './userinfo.js';

export class WytPassClient {
  private readonly config: WytPassConfig;
  private readonly storage: WytPassStorage;
  private readonly logger: WytPassLogger;

  constructor(config: WytPassConfig) {
    if (!config || typeof config !== 'object') {
      throw new ConfigurationError('WytPassConfig object is required to initialize WytPassClient.');
    }
    if (!config.clientId || typeof config.clientId !== 'string') {
      throw new ConfigurationError('clientId is required in WytPassConfig.');
    }
    if (config.redirectUri !== undefined && typeof config.redirectUri !== 'string') {
      throw new ConfigurationError('redirectUri must be a string if provided in WytPassConfig.');
    }

    this.config = { ...config };
    this.storage = config.storage || (typeof window !== 'undefined' ? new BrowserStorage('sessionStorage') : new MemoryStorage());
    this.logger = config.logger || new NullLogger();

    this.logger.debug('WytPassClient initialized successfully for client_id:', this.config.clientId);
  }

  /**
   * Initiates the OAuth 2.0 PKCE login redirect to the WytPass identity provider.
   * Caches the generated state and code_verifier before redirecting.
   */
  public async login(options: GetAuthorizationUrlOptions = {}): Promise<void> {
    if (typeof window !== 'undefined' && window.location && !window.location.pathname.includes('/callback')) {
      await Promise.resolve(this.storage.set(STORAGE_KEYS.RETURN_TO, window.location.href));
    }
    const auth = await this.getAuthorizationUrl(options);
    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(auth.url);
      return;
    }
    throw new WytPassError(
      'login() requires a browser environment with window.location. For server environments, use getAuthorizationUrl() and redirect the HTTP response.'
    );
  }

  /**
   * Handles the OAuth callback by parsing the URL, validating CSRF state,
   * exchanging the authorization code for tokens, and retrieving the user profile.
   */
  public async handleCallback(callbackUrl?: string): Promise<WytPassCallbackResult> {
    let searchParams: URLSearchParams;

    if (callbackUrl) {
      try {
        const parsed = new URL(callbackUrl, 'http://localhost');
        searchParams = parsed.searchParams;
      } catch {
        searchParams = new URLSearchParams(callbackUrl.startsWith('?') ? callbackUrl.slice(1) : callbackUrl);
      }
    } else if (typeof window !== 'undefined' && window.location) {
      searchParams = new URLSearchParams(window.location.search);
    } else {
      throw new ConfigurationError('handleCallback() requires a callbackUrl string or a browser environment.');
    }

    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const errorUri = searchParams.get('error_uri');

    if (errorParam) {
      // Clean up temporary transaction data on error
      await Promise.resolve(this.storage.remove(STORAGE_KEYS.STATE));
      await Promise.resolve(this.storage.remove(STORAGE_KEYS.CODE_VERIFIER));
      await Promise.resolve(this.storage.remove(STORAGE_KEYS.REDIRECT_URI));
      await Promise.resolve(this.storage.remove(STORAGE_KEYS.RETURN_TO));
      throw new OAuthError(errorParam, errorDescription || undefined, errorUri || undefined);
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      throw new OAuthError('invalid_request', 'Callback URL is missing required "code" parameter.');
    }

    if (!state) {
      throw new InvalidStateError('Callback URL is missing required "state" parameter.');
    }

    // 1. Validate state
    await this.validateState(state);

    // 2. Retrieve code_verifier from storage
    const codeVerifier = (await Promise.resolve(this.storage.get(STORAGE_KEYS.CODE_VERIFIER))) ?? undefined;
    if (!codeVerifier) {
      throw new OAuthError('invalid_grant', 'PKCE code verifier is missing from storage.');
    }

    // 3. Exchange authorization code for tokens
    const tokens = await this.exchangeCode({ code, codeVerifier });

    // 4. Retrieve user profile
    let user: WytPassUser;
    try {
      user = await this.getUserInfo(tokens.access_token);
    } catch (err) {
      if (tokens.user) {
        user = {
          id: tokens.user.id,
          sub: tokens.user.id,
          name: tokens.user.name,
          email: tokens.user.email,
          picture: tokens.user.profilePicture,
          profilePicture: tokens.user.profilePicture,
          raw: tokens.user as Record<string, unknown>
        };
      } else {
        throw err;
      }
    }

    // 5. Store active session data in storage
    if (tokens.access_token) {
      await Promise.resolve(this.storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token));
    }
    if (tokens.refresh_token) {
      await Promise.resolve(this.storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token));
    }
    if (tokens.id_token) {
      await Promise.resolve(this.storage.set(STORAGE_KEYS.ID_TOKEN, tokens.id_token));
    }
    await Promise.resolve(this.storage.set(STORAGE_KEYS.USER, JSON.stringify(user)));

    // Retrieve pre-login return URL if present
    const returnTo = (await Promise.resolve(this.storage.get(STORAGE_KEYS.RETURN_TO))) ?? undefined;
    if (returnTo) {
      await Promise.resolve(this.storage.remove(STORAGE_KEYS.RETURN_TO));
    }

    return { tokens, user, returnTo };
  }

  /**
   * Retrieves the currently active access token from storage, if present.
   */
  public async getAccessToken(): Promise<string | null> {
    return (await Promise.resolve(this.storage.get(STORAGE_KEYS.ACCESS_TOKEN))) ?? null;
  }

  /**
   * Retrieves the currently authenticated user profile from storage, if present.
   */
  public async getUser(): Promise<WytPassUser | null> {
    const rawUser = await Promise.resolve(this.storage.get(STORAGE_KEYS.USER));
    if (!rawUser) return null;
    try {
      return JSON.parse(rawUser) as WytPassUser;
    } catch {
      return null;
    }
  }

  /**
   * Returns whether the client currently holds an active access token in storage.
   */
  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  /**
   * Clears all session tokens, user profile data, and temporary PKCE state from storage.
   */
  public async logout(): Promise<void> {
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.ACCESS_TOKEN));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.REFRESH_TOKEN));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.ID_TOKEN));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.USER));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.STATE));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.CODE_VERIFIER));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.REDIRECT_URI));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.RETURN_TO));
  }

  /**
   * Generates a complete OAuth 2.0 / OIDC Authorization URL with PKCE and state protection.
   * Also caches the generated state, code_verifier, and resolved redirect_uri in storage.
   */
  public async getAuthorizationUrl(options: GetAuthorizationUrlOptions = {}): Promise<AuthorizationUrlResult> {
    this.logger.debug('Generating authorization URL...');
    const result = await buildAuthorizationUrl(this.config, options);

    // Save temporary state, verifier, and resolved redirect URI in storage for later callback validation
    await Promise.resolve(this.storage.set(STORAGE_KEYS.STATE, result.state));
    await Promise.resolve(this.storage.set(STORAGE_KEYS.CODE_VERIFIER, result.codeVerifier));
    await Promise.resolve(this.storage.set(STORAGE_KEYS.REDIRECT_URI, result.redirectUri));

    this.logger.debug('Authorization URL generated with state:', result.state);
    return result;
  }

  /**
   * Validates the returned OAuth state parameter against the stored state or provided expected state.
   */
  public async validateState(receivedState: string, expectedState?: string): Promise<boolean> {
    let targetExpectedState = expectedState;
    if (!targetExpectedState) {
      targetExpectedState = (await Promise.resolve(this.storage.get(STORAGE_KEYS.STATE))) ?? undefined;
    }
    return validateState(receivedState, targetExpectedState);
  }

  /**
   * Exchanges an authorization code for access tokens, refresh tokens, and ID tokens using PKCE.
   * If codeVerifier or redirectUri is omitted, it will be retrieved from the configured storage adapter.
   */
  public async exchangeCode(options: ExchangeCodeOptions): Promise<WytPassTokenResponse> {
    let codeVerifier = options.codeVerifier;
    if (!codeVerifier) {
      codeVerifier = (await Promise.resolve(this.storage.get(STORAGE_KEYS.CODE_VERIFIER))) ?? undefined;
    }

    let redirectUri = options.redirectUri;
    if (!redirectUri) {
      redirectUri = (await Promise.resolve(this.storage.get(STORAGE_KEYS.REDIRECT_URI))) ?? undefined;
    }

    this.logger.debug('Exchanging authorization code...');
    const tokens = await exchangeAuthorizationCode(this.config, {
      ...options,
      codeVerifier,
      redirectUri
    });

    // Cleanup one-time PKCE verifier, redirect URI, and state from storage
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.CODE_VERIFIER));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.STATE));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.REDIRECT_URI));

    this.logger.info('Authorization code exchanged successfully.');
    return tokens;
  }

  /**
   * Retrieves user information from the /oauth/userinfo endpoint and returns a normalized WytPassUser.
   */
  public async getUserInfo(accessToken: string): Promise<WytPassUser> {
    this.logger.debug('Fetching UserInfo...');
    const user = await fetchUserInfo(this.config, accessToken);
    this.logger.info('UserInfo retrieved for user ID:', user.id);
    return user;
  }

  /**
   * Refreshes an access token using a valid refresh token.
   */
  public async refreshAccessToken(options: RefreshTokenOptions): Promise<WytPassTokenResponse> {
    this.logger.debug('Refreshing access token...');
    const tokens = await refreshAccessToken(this.config, options);
    this.logger.info('Access token refreshed successfully.');
    return tokens;
  }

  /**
   * Fetches the OpenID Connect discovery document (.well-known/openid-configuration).
   */
  public async getDiscoveryDocument(forceRefresh = false): Promise<WytPassDiscoveryDocument> {
    return fetchDiscoveryDocument(this.config, forceRefresh);
  }

  /**
   * Fetches the JSON Web Key Set (JWKS) from the provider.
   */
  public async getJwks(forceRefresh = false): Promise<JWKS> {
    return fetchJwks(this.config, forceRefresh);
  }

  /**
   * Generates a standalone PKCE pair (code_verifier and S256 code_challenge).
   */
  public async generatePKCE(length = 64): Promise<PKCEPair> {
    return generatePKCE(length);
  }

  /**
   * Generates a standalone cryptographically secure OAuth state string.
   */
  public generateState(byteLength = 32): string {
    return generateState(byteLength);
  }

  /**
   * Parses and validates an OpenID Connect ID Token's claims.
   */
  public verifyIdToken(idToken: string, options?: Partial<IDTokenValidationOptions>): { header: Record<string, unknown>; payload: IDTokenPayload } {
    const { header, payload } = parseJwt(idToken);
    validateIdTokenClaims(payload, {
      idToken,
      clientId: options?.clientId || this.config.clientId,
      issuer: options?.issuer || this.config.issuer,
      nonce: options?.nonce,
      maxAge: options?.maxAge
    });
    return { header, payload };
  }

  /**
   * Returns a copy of the client configuration (without sensitive secrets if logging/displaying).
   */
  public getConfig(): Readonly<Omit<WytPassConfig, 'clientSecret'>> {
    const { clientSecret: _secret, ...safeConfig } = this.config;
    return Object.freeze(safeConfig);
  }

  /**
   * Access the configured storage adapter.
   */
  public getStorage(): WytPassStorage {
    return this.storage;
  }
}

/**
 * Convenient alias for WytPassClient.
 */
export { WytPassClient as WytPass };
export default WytPassClient;
