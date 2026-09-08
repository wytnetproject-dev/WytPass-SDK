import { InvalidStateError, WytPassError } from './errors.js';
import { bufferToBase64Url } from './pkce.js';

/**
 * Generates a cryptographically random OAuth state string.
 * @param byteLength Number of random bytes (default: 32).
 */
export function generateState(byteLength = 32): string {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.getRandomValues) {
    throw new WytPassError('Web Crypto API is not available to generate secure OAuth state.');
  }

  const randomBytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(randomBytes);
  return bufferToBase64Url(randomBytes.buffer);
}

/**
 * Validates the returned OAuth state parameter against the expected stored state value.
 * Performs constant-time comparison to resist timing attacks.
 * Throws InvalidStateError if state is missing or mismatched.
 */
export function validateState(
  receivedState: string | null | undefined,
  expectedState: string | null | undefined
): boolean {
  if (!receivedState || typeof receivedState !== 'string') {
    throw new InvalidStateError('OAuth callback is missing the required "state" parameter.');
  }

  if (!expectedState || typeof expectedState !== 'string') {
    throw new InvalidStateError('No expected state found in session/storage for validation.');
  }

  if (receivedState.length !== expectedState.length) {
    throw new InvalidStateError('OAuth state validation failed: state length mismatch.');
  }

  // Constant-time string comparison
  let mismatch = 0;
  for (let i = 0; i < receivedState.length; i++) {
    mismatch |= receivedState.charCodeAt(i) ^ expectedState.charCodeAt(i);
  }

  if (mismatch !== 0) {
    throw new InvalidStateError('OAuth state validation failed: state mismatch. Request may have been tampered with.');
  }

  return true;
}
