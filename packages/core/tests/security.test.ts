import { describe, expect, it, vi } from 'vitest';
import { OAuthError, TokenExchangeError, WytPassError } from '../src/errors.js';
import { ConsoleLogger } from '../src/logger.js';
import { parseJwt, validateIdTokenClaims } from '../src/jwks.js';

describe('Security & Data Sanitization', () => {
  it('should redact client_secret, codes, and tokens from error messages', () => {
    const rawMsg = 'Failed request with client_secret=super_secret_999 and access_token=tok_abc123';
    const err = new WytPassError(rawMsg);

    expect(err.message).not.toContain('super_secret_999');
    expect(err.message).not.toContain('tok_abc123');
    expect(err.message).toContain('client_secret=[REDACTED]');
    expect(err.message).toContain('access_token=[REDACTED]');
  });

  it('should sanitize nested token responses in TokenExchangeError', () => {
    const rawPayload = {
      access_token: 'secret_token_123',
      refresh_token: 'secret_refresh_456',
      error: 'invalid_grant',
      safe_field: 'safe_info'
    };

    const err = new TokenExchangeError('Token failed', 400, rawPayload);
    const body = err.responseBody as Record<string, unknown>;

    expect(body['access_token']).toBe('[REDACTED]');
    expect(body['refresh_token']).toBe('[REDACTED]');
    expect(body['safe_field']).toBe('safe_info');
  });

  it('should sanitize sensitive values in ConsoleLogger', () => {
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = new ConsoleLogger();

    logger.debug('Exchanging code', {
      client_secret: 'confidential_secret',
      code_verifier: 'secret_verifier_abc'
    });

    expect(consoleDebugSpy).toHaveBeenCalled();
    const loggedArg = consoleDebugSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(loggedArg['client_secret']).toBe('[REDACTED]');
    expect(loggedArg['code_verifier']).toBe('[REDACTED]');

    consoleDebugSpy.mockRestore();
  });

  it('should validate ID Token expiration and reject expired tokens', () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiredPayload = {
      iss: 'https://api.wytnet.com',
      sub: 'usr_123',
      aud: 'my_client_id',
      exp: nowInSeconds - 3600, // expired 1 hour ago
      iat: nowInSeconds - 7200
    };

    expect(() =>
      validateIdTokenClaims(expiredPayload, {
        idToken: 'mock.token.jwt',
        clientId: 'my_client_id',
        issuer: 'https://api.wytnet.com'
      })
    ).toThrow(/expired/);
  });

  it('should reject ID token with issuer mismatch', () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://attacker.com',
      sub: 'usr_123',
      aud: 'my_client_id',
      exp: nowInSeconds + 3600,
      iat: nowInSeconds
    };

    expect(() =>
      validateIdTokenClaims(payload, {
        idToken: 'mock.token.jwt',
        clientId: 'my_client_id',
        issuer: 'https://api.wytnet.com'
      })
    ).toThrow(/issuer mismatch/);
  });

  it('should reject ID token with audience mismatch', () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://api.wytnet.com',
      sub: 'usr_123',
      aud: 'different_client_id',
      exp: nowInSeconds + 3600,
      iat: nowInSeconds
    };

    expect(() =>
      validateIdTokenClaims(payload, {
        idToken: 'mock.token.jwt',
        clientId: 'my_client_id',
        issuer: 'https://api.wytnet.com'
      })
    ).toThrow(/audience mismatch/);
  });
});
