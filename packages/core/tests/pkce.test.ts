import { describe, expect, it } from 'vitest';
import {
  bufferToBase64Url,
  generateCodeChallenge,
  generateCodeVerifier,
  generatePKCE
} from '../src/pkce.js';

describe('PKCE Module (RFC 7636)', () => {
  it('should generate a code_verifier within valid RFC 7636 length (43-128 chars)', () => {
    const verifierDefault = generateCodeVerifier();
    expect(verifierDefault.length).toBe(64);
    expect(verifierDefault).toMatch(/^[A-Za-z0-9\-._~]+$/);

    const verifierMin = generateCodeVerifier(43);
    expect(verifierMin.length).toBe(43);
    expect(verifierMin).toMatch(/^[A-Za-z0-9\-._~]+$/);

    const verifierMax = generateCodeVerifier(128);
    expect(verifierMax.length).toBe(128);
    expect(verifierMax).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('should reject invalid code_verifier lengths', () => {
    expect(() => generateCodeVerifier(42)).toThrow(/between 43 and 128/);
    expect(() => generateCodeVerifier(129)).toThrow(/between 43 and 128/);
  });

  it('should generate valid S256 code_challenge without padding', async () => {
    const verifier = 'E9Melhoa2OwvFrGMTJguCH5DTlZKuidHoW3GuVO2AK0';
    const challenge = await generateCodeChallenge(verifier);

    // Verify format (no +, no /, no =)
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
    expect(challenge.length).toBeGreaterThan(40);
  });

  it('should generate a complete PKCE pair with S256 method', async () => {
    const pkce = await generatePKCE(64);

    expect(pkce.codeChallengeMethod).toBe('S256');
    expect(pkce.codeVerifier).toBeDefined();
    expect(pkce.codeVerifier.length).toBe(64);
    expect(pkce.codeChallenge).toBeDefined();
    expect(pkce.codeChallenge.length).toBeGreaterThan(0);
  });

  it('should convert buffer to URL-safe Base64 correctly', () => {
    const sample = new Uint8Array([251, 255, 254]); // standard base64: +//+
    const result = bufferToBase64Url(sample.buffer);
    expect(result).toBe('-__-');
  });
});
