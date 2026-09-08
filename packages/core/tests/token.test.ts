import { describe, expect, it, vi } from 'vitest';
import { exchangeAuthorizationCode, refreshAccessToken } from '../src/token.js';
import { OAuthError, TokenExchangeError, NetworkError } from '../src/errors.js';

describe('Token Exchange Module', () => {
  const config = {
    clientId: 'wp_client_123',
    clientSecret: 'secret_456',
    redirectUri: 'https://myapp.com/callback'
  };

  it('should exchange code for tokens using application/x-www-form-urlencoded format', async () => {
    let capturedBody = '';
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      capturedHeaders = init.headers as Record<string, string>;

      return new Response(
        JSON.stringify({
          access_token: 'wp_access_abc',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'wp_refresh_xyz',
          id_token: 'wp_id_token_123',
          scope: 'openid profile email'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await exchangeAuthorizationCode(
      { ...config, fetch: mockFetch as unknown as typeof globalThis.fetch },
      { code: 'auth_code_789', codeVerifier: 'verifier_abc' }
    );

    expect(result.access_token).toBe('wp_access_abc');
    expect(result.token_type).toBe('Bearer');
    expect(result.refresh_token).toBe('wp_refresh_xyz');
    expect(capturedHeaders['Content-Type']).toBe('application/x-www-form-urlencoded');

    const params = new URLSearchParams(capturedBody);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('auth_code_789');
    expect(params.get('code_verifier')).toBe('verifier_abc');
    expect(params.get('client_id')).toBe('wp_client_123');
    expect(params.get('client_secret')).toBe('secret_456');
    expect(params.get('redirect_uri')).toBe('https://myapp.com/callback');
  });

  it('should throw OAuthError on standard OAuth error responses (e.g. invalid_grant)', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'The authorization code is invalid or has expired.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await expect(
      exchangeAuthorizationCode(
        { ...config, fetch: mockFetch as unknown as typeof globalThis.fetch },
        { code: 'bad_code' }
      )
    ).rejects.toThrow(OAuthError);
  });

  it('should throw TokenExchangeError if response is missing access_token', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ token_type: 'Bearer' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await expect(
      exchangeAuthorizationCode(
        { ...config, fetch: mockFetch as unknown as typeof globalThis.fetch },
        { code: 'code_123' }
      )
    ).rejects.toThrow(TokenExchangeError);
  });

  it('should refresh access tokens successfully', async () => {
    let capturedBody = '';
    const mockFetch = vi.fn(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      return new Response(
        JSON.stringify({
          access_token: 'new_access_token',
          token_type: 'Bearer',
          expires_in: 3600
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await refreshAccessToken(
      { ...config, fetch: mockFetch as unknown as typeof globalThis.fetch },
      { refreshToken: 'valid_refresh_token' }
    );

    expect(result.access_token).toBe('new_access_token');
    const params = new URLSearchParams(capturedBody);
    expect(params.get('grant_type')).toBe('refresh_token');
    expect(params.get('refresh_token')).toBe('valid_refresh_token');
  });

  it('should throw NetworkError on fetch failure', async () => {
    const mockFetch = vi.fn(async () => {
      throw new TypeError('Network connection refused');
    });

    await expect(
      exchangeAuthorizationCode(
        { ...config, fetch: mockFetch as unknown as typeof globalThis.fetch },
        { code: 'code_123' }
      )
    ).rejects.toThrow(NetworkError);
  });
});
