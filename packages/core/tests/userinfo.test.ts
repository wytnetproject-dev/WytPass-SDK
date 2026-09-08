import { describe, expect, it, vi } from 'vitest';
import { fetchUserInfo, normalizeUserInfo } from '../src/userinfo.js';
import { OAuthError, UserInfoError } from '../src/errors.js';

describe('UserInfo Module', () => {
  const config = {
    clientId: 'wp_client_123',
    redirectUri: 'https://myapp.com/callback'
  };

  it('should normalize top-level user profile', () => {
    const raw = {
      id: 'usr_123',
      name: 'John Doe',
      email: 'john@example.com',
      picture: 'https://cdn.example.com/avatar.jpg',
      subscriptions: [{ plan: 'pro', active: true }]
    };

    const user = normalizeUserInfo(raw);
    expect(user.id).toBe('usr_123');
    expect(user.sub).toBe('usr_123');
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.picture).toBe('https://cdn.example.com/avatar.jpg');
    expect(user.profilePicture).toBe('https://cdn.example.com/avatar.jpg');
    expect(user.subscriptions).toEqual([{ plan: 'pro', active: true }]);
    expect(user.raw).toBe(raw);
  });

  it('should normalize user profile nested under "user" key', () => {
    const raw = {
      user: {
        user_id: 'usr_nested_999',
        username: 'janedoe',
        email: 'jane@example.com',
        avatar: 'https://cdn.example.com/jane.png',
        subscription: { tier: 'enterprise' }
      }
    };

    const user = normalizeUserInfo(raw);
    expect(user.id).toBe('usr_nested_999');
    expect(user.name).toBe('janedoe');
    expect(user.email).toBe('jane@example.com');
    expect(user.picture).toBe('https://cdn.example.com/jane.png');
    expect(user.profilePicture).toBe('https://cdn.example.com/jane.png');
    expect(user.subscriptions).toEqual({ tier: 'enterprise' });
  });

  it('should fetch UserInfo with Bearer token header', async () => {
    let capturedHeader = '';
    const mockFetch = vi.fn(async (_url: string, init: RequestInit) => {
      capturedHeader = (init.headers as Record<string, string>)['Authorization'];
      return new Response(
        JSON.stringify({
          sub: 'usr_555',
          name: 'Alex Smith',
          email: 'alex@wytnet.com'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const user = await fetchUserInfo(
      { ...config, fetch: mockFetch as unknown as typeof globalThis.fetch },
      'access_token_123'
    );

    expect(capturedHeader).toBe('Bearer access_token_123');
    expect(user.id).toBe('usr_555');
    expect(user.name).toBe('Alex Smith');
    expect(user.email).toBe('alex@wytnet.com');
  });

  it('should throw OAuthError invalid_token on 401 response', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 401 });
    });

    await expect(
      fetchUserInfo(
        { ...config, fetch: mockFetch as unknown as typeof globalThis.fetch },
        'expired_token'
      )
    ).rejects.toThrow(OAuthError);
  });

  it('should throw UserInfoError if accessToken is empty', async () => {
    await expect(fetchUserInfo(config, '')).rejects.toThrow(UserInfoError);
  });
});
