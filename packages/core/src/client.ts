import { buildAuthorizationUrl } from './authorization.js';
import { STORAGE_KEYS } from './constants.js';
import { fetchDiscoveryDocument } from './discovery.js';
import { ConfigurationError } from './errors.js';
import { fetchJwks, parseJwt, validateIdTokenClaims } from './jwks.js';
import { NullLogger } from './logger.js';
import { generatePKCE } from './pkce.js';
import { generateState, validateState } from './state.js';
import { MemoryStorage } from './storage.js';
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
    this.storage = config.storage || new MemoryStorage();
    this.logger = config.logger || new NullLogger();

    this.logger.debug('WytPassClient initialized successfully for client_id:', this.config.clientId);
  }

  /**
   * Generates a complete OAuth 2.0 / OIDC Authorization URL with PKCE and state protection.
   * Also caches the generated state and code_verifier in storage.
   */
  public async getAuthorizationUrl(options: GetAuthorizationUrlOptions = {}): Promise<AuthorizationUrlResult> {
    this.logger.debug('Generating authorization URL...');
    const result = await buildAuthorizationUrl(this.config, options);

    // Save temporary state and verifier in storage for later callback validation
    await Promise.resolve(this.storage.set(STORAGE_KEYS.STATE, result.state));
    await Promise.resolve(this.storage.set(STORAGE_KEYS.CODE_VERIFIER, result.codeVerifier));

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
   * If codeVerifier is omitted, it will be retrieved from the configured storage adapter.
   */
  public async exchangeCode(options: ExchangeCodeOptions): Promise<WytPassTokenResponse> {
    let codeVerifier = options.codeVerifier;
    if (!codeVerifier) {
      codeVerifier = (await Promise.resolve(this.storage.get(STORAGE_KEYS.CODE_VERIFIER))) ?? undefined;
    }

    this.logger.debug('Exchanging authorization code...');
    const tokens = await exchangeAuthorizationCode(this.config, {
      ...options,
      codeVerifier
    });

    // Cleanup one-time PKCE verifier and state from storage
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.CODE_VERIFIER));
    await Promise.resolve(this.storage.remove(STORAGE_KEYS.STATE));

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
