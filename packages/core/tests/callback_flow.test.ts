import { describe, expect, it, vi } from 'vitest';
import { WytPass, WytPassClient, MemoryStorage, STORAGE_KEYS, OAuthError, InvalidStateError } from '../src/index.js';

describe('OAuth PKCE Lifecycle & Callback Flow (Phase 5 & 10 Verification)', () => {
  it('should export WytPass as an alias for WytPassClient', () => {
    expect(WytPass).toBe(WytPassClient);
    const instance = new WytPass({
      clientId: 'wp_alias_test',
      redirectUri: 'https://app.com/callback'
    });
    expect(instance).toBeInstanceOf(WytPassClient);
  });

  it('should execute full PKCE flow via handleCallback() successfully', async () => {
    const storage = new MemoryStorage();

    const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();

      if (urlStr.includes('/oauth/token')) {
        const body = init?.body?.toString() || '';
        expect(body).toContain('grant_type=authorization_code');
        expect(body).toContain('code=auth_code_123');
        expect(body).toContain('client_id=wp_flow_client');
        expect(body).toContain('code_verifier=');

        return new Response(
          JSON.stringify({
            access_token: 'at_test_xyz_999',
            token_type: 'Bearer',
            expires_in: 3600,
            id_token: 'id_token_test_jwt',
            scope: 'openid profile email',
            user: {
              id: 'user_uuid_123',
              name: 'Jane Developer',
              email: 'jane@example.com',
              profilePicture: 'https://example.com/avatar.jpg'
            },
            application: {
              appId: 'wytflow',
              name: 'WytFlow App'
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/oauth/userinfo')) {
        expect(init?.headers).toEqual(
          expect.objectContaining({
            Authorization: 'Bearer at_test_xyz_999'
          })
        );

        return new Response(
          JSON.stringify({
            sub: 'user_uuid_123',
            name: 'Jane Developer',
            email: 'jane@example.com',
            email_verified: true,
            picture: 'https://example.com/avatar.jpg',
            user: {
              id: 'user_uuid_123',
              name: 'Jane Developer',
              email: 'jane@example.com',
              profilePicture: 'https://example.com/avatar.jpg'
            },
            application: {
              appId: 'wytflow',
              name: 'WytFlow App'
            },
            subscriptions: [
              {
                appId: 'wytflow',
                appName: 'WytFlow App',
                planId: 'standard_access',
                status: 'active'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not Found', { status: 404 });
    });

    const wytpass = new WytPass({
      clientId: 'wp_flow_client',
      redirectUri: 'https://app.com/callback',
      storage,
      fetch: mockFetch as unknown as typeof fetch
    });

    // 1. Initiate login authorization
    const auth = await wytpass.getAuthorizationUrl();
    expect(auth.url).toContain('response_type=code');
    expect(auth.url).toContain('code_challenge=');
    expect(auth.url).toContain('code_challenge_method=S256');
    expect(auth.url).toContain(`state=${auth.state}`);

    // Verify state & verifier stored in storage
    expect(storage.get(STORAGE_KEYS.STATE)).toBe(auth.state);
    expect(storage.get(STORAGE_KEYS.CODE_VERIFIER)).toBe(auth.codeVerifier);

    // 2. Simulate browser callback
    const callbackUrl = `https://app.com/callback?code=auth_code_123&state=${auth.state}`;
    const result = await wytpass.handleCallback(callbackUrl);

    // 3. Verify authenticated result
    expect(result.tokens.access_token).toBe('at_test_xyz_999');
    expect(result.tokens.token_type).toBe('Bearer');
    expect(result.user.id).toBe('user_uuid_123');
    expect(result.user.name).toBe('Jane Developer');
    expect(result.user.email).toBe('jane@example.com');
    expect(result.user.profilePicture).toBe('https://example.com/avatar.jpg');

    // 4. Verify temporary PKCE & state data were wiped
    expect(storage.get(STORAGE_KEYS.STATE)).toBeNull();
    expect(storage.get(STORAGE_KEYS.CODE_VERIFIER)).toBeNull();

    // 5. Verify session tokens & user are persisted
    expect(await wytpass.getAccessToken()).toBe('at_test_xyz_999');
    expect(await wytpass.isAuthenticated()).toBe(true);
    const sessionUser = await wytpass.getUser();
    expect(sessionUser?.name).toBe('Jane Developer');

    // 6. Test logout
    await wytpass.logout();
    expect(await wytpass.getAccessToken()).toBeNull();
    expect(await wytpass.getUser()).toBeNull();
    expect(await wytpass.isAuthenticated()).toBe(false);
  });

  describe('Failure & Edge Cases (Phase 10 Requirements)', () => {
    it('should reject callback with OAuth error query parameters', async () => {
      const storage = new MemoryStorage();
      storage.set(STORAGE_KEYS.STATE, 'my_state');
      storage.set(STORAGE_KEYS.CODE_VERIFIER, 'my_verifier');

      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback',
        storage
      });

      const callbackUrl = 'https://app.com/callback?error=access_denied&error_description=User+cancelled+login';

      await expect(wytpass.handleCallback(callbackUrl)).rejects.toThrow(OAuthError);
      // Cleaned up on error
      expect(storage.get(STORAGE_KEYS.STATE)).toBeNull();
      expect(storage.get(STORAGE_KEYS.CODE_VERIFIER)).toBeNull();
    });

    it('should reject callback missing authorization code', async () => {
      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback'
      });

      await expect(wytpass.handleCallback('https://app.com/callback?state=some_state')).rejects.toThrow(
        /missing required "code" parameter/i
      );
    });

    it('should reject callback missing state parameter', async () => {
      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback'
      });

      await expect(wytpass.handleCallback('https://app.com/callback?code=some_code')).rejects.toThrow(
        InvalidStateError
      );
    });

    it('should reject callback when state mismatches stored state (CSRF attack)', async () => {
      const storage = new MemoryStorage();
      storage.set(STORAGE_KEYS.STATE, 'legitimate_state_1234567890123456');

      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback',
        storage
      });

      const maliciousUrl = 'https://app.com/callback?code=evil_code&state=forged_state_1234567890123456';
      await expect(wytpass.handleCallback(maliciousUrl)).rejects.toThrow(InvalidStateError);
    });

    it('should reject callback when PKCE verifier is missing from storage', async () => {
      const storage = new MemoryStorage();
      storage.set(STORAGE_KEYS.STATE, 'valid_state');
      // Notice: STORAGE_KEYS.CODE_VERIFIER is missing

      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback',
        storage
      });

      await expect(wytpass.handleCallback('https://app.com/callback?code=code_1&state=valid_state')).rejects.toThrow(
        /PKCE code verifier is missing from storage/i
      );
    });

    it('should accurately parse FastAPI detail error "invalid_grant: code is invalid or expired"', async () => {
      const storage = new MemoryStorage();
      storage.set(STORAGE_KEYS.STATE, 'valid_state');
      storage.set(STORAGE_KEYS.CODE_VERIFIER, 'valid_verifier');

      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({ detail: 'invalid_grant: code is invalid or expired' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback',
        storage,
        fetch: mockFetch as unknown as typeof fetch
      });

      try {
        await wytpass.handleCallback('https://app.com/callback?code=expired_code&state=valid_state');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(OAuthError);
        expect(err.error).toBe('invalid_grant');
        expect(err.errorDescription).toBe('code is invalid or expired');
      }
    });

    it('should accurately parse FastAPI detail error "SSO credits have been exhausted"', async () => {
      const storage = new MemoryStorage();
      storage.set(STORAGE_KEYS.STATE, 'valid_state');
      storage.set(STORAGE_KEYS.CODE_VERIFIER, 'valid_verifier');

      const mockFetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({ detail: 'SSO credits have been exhausted' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback',
        storage,
        fetch: mockFetch as unknown as typeof fetch
      });

      try {
        await wytpass.handleCallback('https://app.com/callback?code=some_code&state=valid_state');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(OAuthError);
        expect(err.message).toContain('SSO credits have been exhausted');
      }
    });

    it('should fail cleanly on 401 UserInfo endpoint error', async () => {
      const storage = new MemoryStorage();
      storage.set(STORAGE_KEYS.STATE, 'valid_state');
      storage.set(STORAGE_KEYS.CODE_VERIFIER, 'valid_verifier');

      const mockFetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/oauth/token')) {
          // Token response without user payload
          return new Response(
            JSON.stringify({ access_token: 'expired_token', token_type: 'Bearer' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr.includes('/oauth/userinfo')) {
          return new Response(
            JSON.stringify({ detail: 'Invalid or expired access token' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not Found', { status: 404 });
      });

      const wytpass = new WytPass({
        clientId: 'wp_client',
        redirectUri: 'https://app.com/callback',
        storage,
        fetch: mockFetch as unknown as typeof fetch
      });

      await expect(wytpass.handleCallback('https://app.com/callback?code=some_code&state=valid_state')).rejects.toThrow(
        /invalid_token/i
      );
    });
  });
});
