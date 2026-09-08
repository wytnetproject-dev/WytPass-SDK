/**
 * @wytpass/nextjs
 * Next.js App Router and Pages Router authentication SDK for WytPass SSO.
 */

export * from './types';
export * from './cookies';
export * from './server';
export * from './handlers';
export * from './nextauth';

// Re-export core types for developer convenience
export type {
  WytPassUser,
  WytPassTokenResponse,
  WytPassConfig,
  WytPassError,
  AuthorizationUrlResult
} from '@wytpass/core';
