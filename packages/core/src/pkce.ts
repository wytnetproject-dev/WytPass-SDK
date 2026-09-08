import type { PKCEPair } from './types.js';
import { WytPassError } from './errors.js';

const PKCE_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * Get the Web Crypto API instance safely across Node.js and Browser environments.
 */
function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new WytPassError('Web Crypto API is not available in this environment. Ensure Node.js >= 18 or a modern browser is used.');
}

/**
 * Generates a cryptographically random PKCE code_verifier (RFC 7636 Section 4.1).
 * Length must be between 43 and 128 characters.
 */
export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new WytPassError('PKCE code_verifier length must be between 43 and 128 characters.');
  }

  const cryptoInstance = getCrypto();
  const randomBytes = new Uint8Array(length);
  cryptoInstance.getRandomValues(randomBytes);

  let result = '';
  const charLength = PKCE_CHARACTERS.length;
  for (let i = 0; i < length; i++) {
    const byte = randomBytes[i];
    if (byte !== undefined) {
      result += PKCE_CHARACTERS[byte % charLength];
    }
  }

  return result;
}

/**
 * Converts an ArrayBuffer to a Base64URL encoded string without padding (RFC 7636 Section 4.2).
 */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }

  // Base64 encode
  let base64 = '';
  if (typeof btoa === 'function') {
    base64 = btoa(binary);
  } else if (typeof (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer !== 'undefined') {
    const BufferClass = (globalThis as { Buffer: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
    base64 = BufferClass.from(binary, 'binary').toString('base64');
  } else {
    throw new WytPassError('No base64 encoder available in environment.');
  }

  // Convert standard Base64 to URL-safe Base64 without padding
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates an S256 code_challenge from a code_verifier (RFC 7636 Section 4.2).
 * code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (!verifier || typeof verifier !== 'string') {
    throw new WytPassError('Valid code_verifier string is required to generate code_challenge.');
  }

  const cryptoInstance = getCrypto();
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await cryptoInstance.subtle.digest('SHA-256', data);

  return bufferToBase64Url(hash);
}

/**
 * Generates both a secure code_verifier and its corresponding S256 code_challenge.
 */
export async function generatePKCE(length = 64): Promise<PKCEPair> {
  const codeVerifier = generateCodeVerifier(length);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}
