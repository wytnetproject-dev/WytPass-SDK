import { describe, expect, it } from 'vitest';
import { generateState, validateState } from '../src/state.js';
import { InvalidStateError } from '../src/errors.js';

describe('OAuth State Protection Module', () => {
  it('should generate cryptographically random, unique states', () => {
    const state1 = generateState();
    const state2 = generateState();

    expect(state1).toBeDefined();
    expect(state2).toBeDefined();
    expect(state1).not.toBe(state2);
    expect(state1.length).toBeGreaterThan(20);
  });

  it('should validate matching states successfully', () => {
    const state = generateState();
    expect(validateState(state, state)).toBe(true);
  });

  it('should throw InvalidStateError on mismatched state', () => {
    const originalState = generateState();
    const attackerState = generateState();

    expect(() => validateState(attackerState, originalState)).toThrow(InvalidStateError);
  });

  it('should throw InvalidStateError when received state is missing or empty', () => {
    const originalState = generateState();

    expect(() => validateState('', originalState)).toThrow(InvalidStateError);
    expect(() => validateState(null, originalState)).toThrow(InvalidStateError);
    expect(() => validateState(undefined, originalState)).toThrow(InvalidStateError);
  });

  it('should throw InvalidStateError when expected state is missing or empty', () => {
    const receivedState = generateState();

    expect(() => validateState(receivedState, '')).toThrow(InvalidStateError);
    expect(() => validateState(receivedState, null)).toThrow(InvalidStateError);
    expect(() => validateState(receivedState, undefined)).toThrow(InvalidStateError);
  });

  it('should throw InvalidStateError on state length mismatch', () => {
    const state = generateState();
    expect(() => validateState(state + 'extra', state)).toThrow(InvalidStateError);
  });
});
