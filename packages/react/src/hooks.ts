import { useContext } from 'react';
import { WytPassContext } from './context.js';
import type { WytPassContextValue } from './types.js';

/**
 * Main hook for accessing WytPass authentication state and methods.
 */
export function useWytPass(): WytPassContextValue {
  const context = useContext(WytPassContext);
  if (!context) {
    throw new Error(
      'useWytPass must be used within a <WytPassProvider>. Wrap your application root with <WytPassProvider clientId="...">.'
    );
  }
  return context;
}

/**
 * Convenient hook to access the current authenticated user profile.
 */
export function useAuthUser() {
  const { user, isAuthenticated, isLoading, error } = useWytPass();
  return { user, isAuthenticated, isLoading, error };
}

/**
 * Convenient hook to access and manage access tokens.
 */
export function useAccessToken() {
  const { accessToken, getAccessToken, refresh, isLoading } = useWytPass();
  return { accessToken, getAccessToken, refresh, isLoading };
}
