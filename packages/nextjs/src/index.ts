/**
 * @wytpass/nextjs
 * Next.js App Router and Pages Router authentication SDK for WytPass SSO.
 */

export * from './types.js';
export * from './cookies.js';
export * from './server.js';
export * from './handlers.js';
export * from './nextauth.js';

// Re-export core types for developer convenience
export type {
  WytPassUser,
  WytPassTokenResponse,
  WytPassConfig,
  WytPassError,
  AuthorizationUrlResult
} from '@wytpass/core';
