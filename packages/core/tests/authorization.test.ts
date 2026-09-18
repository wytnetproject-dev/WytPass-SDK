import { describe, expect, it } from 'vitest';
import { buildAuthorizationUrl, validateEndpointUrl } from '../src/authorization.js';
import { ConfigurationError } from '../src/errors.js';
import { DEFAULT_AUTHORIZATION_ENDPOINT, DEFAULT_CODE_CHALLENGE_METHOD, DEFAULT_RESPONSE_TYPE, DEFAULT_SCOPE } from '../src/constants.js';

describe('Authorization URL Builder', () => {
  const validConfig = {
    clientId: 'wp_test_client_123',
    redirectUri: 'https://myapp.com/auth/callback'
  };

  it('should generate a complete, valid OAuth 2.0 authorization URL with PKCE and state', async () => {
    const result = await buildAuthorizationUrl(validConfig);

    expect(result.url).toBeDefined();
    expect(result.state).toBeDefined();
    expect(result.codeVerifier).toBeDefined();
    expect(result.codeChallenge).toBeDefined();

    const parsedUrl = new URL(result.url);
    expect(parsedUrl.origin + parsedUrl.pathname).toBe(DEFAULT_AUTHORIZATION_ENDPOINT);
    expect(parsedUrl.searchParams.get('response_type')).toBe(DEFAULT_RESPONSE_TYPE);
    expect(parsedUrl.searchParams.get('client_id')).toBe('wp_test_client_123');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://myapp.com/auth/callback');
    expect(parsedUrl.searchParams.get('scope')).toBe(DEFAULT_SCOPE);
    expect(parsedUrl.searchParams.get('state')).toBe(result.state);
    expect(parsedUrl.searchParams.get('code_challenge')).toBe(result.codeChallenge);
    expect(parsedUrl.searchParams.get('code_challenge_method')).toBe(DEFAULT_CODE_CHALLENGE_METHOD);
  });

  it('should support custom scope, prompt, login_hint, and extraParams', async () => {
    const result = await buildAuthorizationUrl(validConfig, {
      scope: 'openid profile email offline_access',
      prompt: 'consent',
      loginHint: 'user@example.com',
      extraParams: { custom_track: 'xyz' }
    });

    const parsedUrl = new URL(result.url);
    expect(parsedUrl.searchParams.get('scope')).toBe('openid profile email offline_access');
    expect(parsedUrl.searchParams.get('prompt')).toBe('consent');
    expect(parsedUrl.searchParams.get('login_hint')).toBe('user@example.com');
    expect(parsedUrl.searchParams.get('custom_track')).toBe('xyz');
  });

  it('should throw ConfigurationError if clientId is missing', async () => {
    // @ts-expect-error test missing clientId
    await expect(buildAuthorizationUrl({ redirectUri: 'https://myapp.com/callback' }))
      .rejects.toThrow(ConfigurationError);
  });

  it('should automatically resolve redirectUri when omitted in zero-config mode', async () => {
    const result = await buildAuthorizationUrl({ clientId: 'wp_123' });
    expect(result.url).toBeDefined();
    expect(result.redirectUri).toBeDefined();
    const parsedUrl = new URL(result.url);
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe(result.redirectUri);
  });

  it('should reject insecure HTTP endpoint in production', () => {
    expect(() => validateEndpointUrl('http://insecure-domain.com/oauth/authorize', 'auth', false))
      .toThrow(ConfigurationError);
  });

  it('should allow HTTP on localhost when allowHttp is enabled', () => {
    const url = validateEndpointUrl('http://localhost:8000/oauth/authorize', 'auth', true);
    expect(url.protocol).toBe('http:');
    expect(url.hostname).toBe('localhost');
  });
});
