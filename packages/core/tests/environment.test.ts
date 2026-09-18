import { describe, expect, it } from 'vitest';
import { WytPassClient, ENVIRONMENTS } from '../src/index.js';
import { ConfigurationError } from '../src/errors.js';

describe('Environment & Endpoint Resolution', () => {
  it('should default to production environment endpoints', async () => {
    const client = new WytPassClient({
      clientId: 'wp_prod_client',
      redirectUri: 'https://myapp.com/callback'
    });

    const auth = await client.getAuthorizationUrl();
    const parsed = new URL(auth.url);

    expect(parsed.origin).toBe('https://wytnet.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('wp_prod_client');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('should configure local development environment correctly', async () => {
    const client = new WytPassClient({
      clientId: 'wp_local_client',
      redirectUri: 'http://localhost:3000/callback',
      environment: 'local'
    });

    const auth = await client.getAuthorizationUrl();
    const parsed = new URL(auth.url);

    expect(parsed.origin).toBe('http://localhost:5173');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('wp_local_client');
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:3000/callback');
  });

  it('should support custom portalUrl and apiUrl', async () => {
    const client = new WytPassClient({
      clientId: 'wp_custom_client',
      redirectUri: 'https://staging.myapp.com/callback',
      portalUrl: 'https://staging-portal.wytnet.com',
      apiUrl: 'https://staging-api.wytnet.com'
    });

    const auth = await client.getAuthorizationUrl();
    const parsed = new URL(auth.url);

    expect(parsed.origin).toBe('https://staging-portal.wytnet.com');
    expect(parsed.pathname).toBe('/oauth/authorize');
  });

  it('should propagate optional appId parameter to authorization URL', async () => {
    const clientWithConfigAppId = new WytPassClient({
      clientId: 'wp_client_1',
      redirectUri: 'https://myapp.com/callback',
      appId: 'wytflow'
    });

    const auth1 = await clientWithConfigAppId.getAuthorizationUrl();
    expect(new URL(auth1.url).searchParams.get('appId')).toBe('wytflow');

    // Override at call-site
    const auth2 = await clientWithConfigAppId.getAuthorizationUrl({ appId: 'wytpulse' });
    expect(new URL(auth2.url).searchParams.get('appId')).toBe('wytpulse');
  });

  it('should reject insecure HTTP endpoints for production hosts', async () => {
    const client = new WytPassClient({
      clientId: 'wp_insecure',
      redirectUri: 'https://myapp.com/callback',
      authorizationEndpoint: 'http://insecure-domain.com/oauth/authorize'
    });

    await expect(client.getAuthorizationUrl()).rejects.toThrow(ConfigurationError);
  });
});
