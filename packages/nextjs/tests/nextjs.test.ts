import { describe, expect, it, vi } from 'vitest';
import {
  createWytPassAuth,
  parseCookieHeader,
  serializeCookie,
  WytPassNextAuthProvider
} from '../src/index.js';
import { InvalidStateError } from '@wytpass/core';

describe('@wytpass/nextjs Server & Cookie Utilities', () => {
  const envBackup = { ...process.env };

  const testConfig = {
    clientId: 'wp_client_next_123',
    clientSecret: 'next_secret_456',
    redirectUri: 'http://localhost:3000/api/auth/wytpass/callback',
    allowHttp: true
  };

  it('should parse cookie headers properly', () => {
    const header = 'wytpass_session=abc123xyz; other_cookie=foo%20bar; blank=';
    const parsed = parseCookieHeader(header);

    expect(parsed['wytpass_session']).toBe('abc123xyz');
    expect(parsed['other_cookie']).toBe('foo bar');
    expect(parsed['blank']).toBe('');
  });

  it('should serialize cookies with security attributes', () => {
    const cookie = serializeCookie('session_id', 'val123', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 3600
    });

    expect(cookie).toContain('session_id=val123');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=3600');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
  });

  it('should initialize createWytPassAuth and handle login() redirect with PKCE cookies', async () => {
    const auth = createWytPassAuth(testConfig);
    const loginResponse = await auth.login();

    expect(loginResponse.status).toBe(302);
    const location = loginResponse.headers.get('Location');
    expect(location).toContain('https://wytnet.com/oauth/authorize');
    expect(location).toContain('client_id=wp_client_next_123');
    expect(location).toContain('code_challenge=');

    const setCookies = loginResponse.headers.get('set-cookie');
    expect(setCookies).toContain('wytpass_oauth_state=');
    expect(setCookies).toContain('wytpass_pkce_verifier=');
  });

  it('should reject handleCallback when state cookie is missing or mismatched', async () => {
    const auth = createWytPassAuth(testConfig);

    const reqMissingCookie = new Request('http://localhost:3000/api/auth/wytpass/callback?code=abc&state=xyz');
    await expect(auth.handleCallback(reqMissingCookie)).rejects.toThrow(InvalidStateError);
  });

  it('should execute handleCallback successfully when cookies and codes match', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('/oauth/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'acc_token_next',
            token_type: 'Bearer',
            expires_in: 3600
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/oauth/userinfo')) {
        return new Response(
          JSON.stringify({
            sub: 'user_next_1',
            name: 'Next User',
            email: 'next@example.com'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    const auth = createWytPassAuth({
      ...testConfig,
      // @ts-expect-error test custom fetch
      fetch: mockFetch
    });

    // Mock login first to obtain state and verifier
    const loginRes = await auth.login();
    const locUrl = new URL(loginRes.headers.get('Location')!);
    const state = locUrl.searchParams.get('state')!;

    // Extract verifier cookie from login headers
    const rawSetCookie = loginRes.headers.get('set-cookie')!;
    const verifierMatch = rawSetCookie.match(/wytpass_pkce_verifier=([^;]+)/);
    const verifier = verifierMatch ? verifierMatch[1] : '';

    const callbackReq = new Request(
      `http://localhost:3000/api/auth/wytpass/callback?code=valid_code&state=${state}`,
      {
        headers: {
          cookie: `wytpass_oauth_state=${state}; wytpass_pkce_verifier=${verifier}`
        }
      }
    );

    const callbackRes = await auth.handleCallback(callbackReq, '/custom-dashboard');
    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get('Location')).toBe('/custom-dashboard');
    expect(callbackRes.headers.get('set-cookie')).toContain('wytpass_session=');
  });

  it('should generate NextAuth provider configuration correctly', () => {
    const provider = WytPassNextAuthProvider({
      clientId: 'wp_client_nextauth',
      clientSecret: 'secret_nextauth'
    });

    expect(provider.id).toBe('wytpass');
    expect(provider.name).toBe('WytPass');
    expect(provider.type).toBe('oauth');
    expect(provider.clientId).toBe('wp_client_nextauth');
    expect(provider.authorization.url).toBe('https://wytnet.com/oauth/authorize');
    expect(provider.token).toBe('https://api.wytnet.com/oauth/token');
    expect(provider.userinfo).toBe('https://api.wytnet.com/oauth/userinfo');
    expect(provider.client.token_endpoint_auth_method).toBe('client_secret_post');
    expect(provider.idToken).toBe(true);
    expect(provider.checks).toEqual(['pkce', 'state']);

    const localProvider = WytPassNextAuthProvider({
      clientId: 'wp_local',
      issuer: 'http://localhost:8000',
      authorizationUrl: 'http://localhost:5173/oauth/authorize'
    });
    expect(localProvider.token).toBe('http://localhost:8000/oauth/token');
    expect(localProvider.userinfo).toBe('http://localhost:8000/oauth/userinfo');
    expect(localProvider.jwks_endpoint).toBe('http://localhost:8000/.well-known/jwks.json');

    const normalizedFromUserId = provider.profile({
      user_id: 'usr_provider_1',
      username: 'provider_user',
      email: 'user@provider.com'
    });
    expect(normalizedFromUserId.id).toBe('usr_provider_1');
    expect(normalizedFromUserId.name).toBe('provider_user');
    expect(normalizedFromUserId.email).toBe('user@provider.com');

    const normalizedFromSub = provider.profile({
      sub: 'sub_provider_2',
      name: 'Sub User',
      email: 'sub@provider.com',
      picture: 'https://example.com/pic.png',
      subscriptions: [{ plan: 'pro' }]
    });
    expect(normalizedFromSub.id).toBe('sub_provider_2');
    expect(normalizedFromSub.name).toBe('Sub User');
    expect(normalizedFromSub.image).toBe('https://example.com/pic.png');
    expect(normalizedFromSub.subscriptions).toEqual([{ plan: 'pro' }]);
  });
});
