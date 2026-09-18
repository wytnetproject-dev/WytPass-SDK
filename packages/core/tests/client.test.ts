import { describe, expect, it, vi } from 'vitest';
import { WytPassClient } from '../src/client.js';
import { ConfigurationError, InvalidStateError } from '../src/errors.js';
import { STORAGE_KEYS } from '../src/constants.js';

describe('WytPassClient High-Level API', () => {
  const validConfig = {
    clientId: 'wp_client_123',
    redirectUri: 'https://myapp.com/callback'
  };

  it('should initialize successfully and provide non-sensitive config copy', () => {
    const client = new WytPassClient({
      ...validConfig,
      clientSecret: 'secret_to_hide'
    });

    const safeConfig = client.getConfig();
    expect(safeConfig.clientId).toBe('wp_client_123');
    expect(safeConfig.redirectUri).toBe('https://myapp.com/callback');
    // @ts-expect-error clientSecret should not exist on safeConfig
    expect(safeConfig.clientSecret).toBeUndefined();
  });

  it('should initialize with clientId alone and automatically resolve redirectUri in zero-config mode', async () => {
    const client = new WytPassClient({ clientId: 'wp_123' });
    expect(client.getConfig().clientId).toBe('wp_123');

    // Should succeed without error in zero-config mode
    const auth = await client.getAuthorizationUrl();
    expect(auth.url).toContain('https://wytnet.com/oauth/authorize');
    expect(auth.redirectUri).toBeDefined();

    // Should also support explicit redirectUri override
    const authOverride = await client.getAuthorizationUrl({ redirectUri: 'https://myapp.com/callback' });
    expect(authOverride.url).toContain('redirect_uri=https%3A%2F%2Fmyapp.com%2Fcallback');
  });

  it('should throw ConfigurationError if missing required clientId', () => {
    // @ts-expect-error missing clientId
    expect(() => new WytPassClient({ redirectUri: 'https://myapp.com' })).toThrow(ConfigurationError);
  });

  it('should generate authorization URL and cache state and verifier in storage', async () => {
    const client = new WytPassClient(validConfig);
    const auth = await client.getAuthorizationUrl();

    expect(auth.url).toContain('https://wytnet.com/oauth/authorize');
    expect(auth.state).toBeDefined();
    expect(auth.codeVerifier).toBeDefined();

    const storage = client.getStorage();
    expect(await storage.get(STORAGE_KEYS.STATE)).toBe(auth.state);
    expect(await storage.get(STORAGE_KEYS.CODE_VERIFIER)).toBe(auth.codeVerifier);
  });

  it('should validate state against stored state', async () => {
    const client = new WytPassClient(validConfig);
    const auth = await client.getAuthorizationUrl();

    const isValid = await client.validateState(auth.state);
    expect(isValid).toBe(true);

    await expect(client.validateState('tampered_state')).rejects.toThrow(InvalidStateError);
  });

  it('should exchange code and automatically clean up temporary state and verifier', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: 'access_123',
          token_type: 'Bearer',
          expires_in: 3600
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new WytPassClient({
      ...validConfig,
      fetch: mockFetch as unknown as typeof globalThis.fetch
    });

    await client.getAuthorizationUrl();
    const tokens = await client.exchangeCode({ code: 'auth_code_xyz' });

    expect(tokens.access_token).toBe('access_123');

    // Verify storage cleanup
    const storage = client.getStorage();
    expect(await storage.get(STORAGE_KEYS.CODE_VERIFIER)).toBeNull();
    expect(await storage.get(STORAGE_KEYS.STATE)).toBeNull();
  });
});