import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BrowserStorage,
  MemoryStorage,
  STORAGE_KEYS,
  WytPassClient,
  type GetAuthorizationUrlOptions,
  type WytPassError,
  type WytPassStorage,
  type WytPassTokenResponse,
  type WytPassUser
} from '@wytpass/core';
import { WytPassContext } from './context.js';
import type { WytPassContextValue, WytPassProviderProps } from './types.js';

export const WytPassProvider: React.FC<WytPassProviderProps> = ({
  clientId,
  redirectUri,
  environment,
  portalUrl,
  apiUrl,
  appId,
  issuer,
  authorizationEndpoint,
  tokenEndpoint,
  userInfoEndpoint,
  jwksEndpoint,
  discoveryEndpoint,
  scope,
  allowHttp,
  storageType = 'sessionStorage',
  autoHandleCallback = true,
  children
}) => {
  const resolvedClientId =
    clientId ||
    (typeof process !== 'undefined' && process.env
      ? process.env['VITE_WYTPASS_CLIENT_ID'] ||
        process.env['NEXT_PUBLIC_WYTPASS_CLIENT_ID'] ||
        process.env['REACT_APP_WYTPASS_CLIENT_ID'] ||
        process.env['WYTPASS_CLIENT_ID']
      : undefined) ||
    '';

  const storage = useMemo<WytPassStorage>(() => {
    if (storageType === 'memory') {
      return new MemoryStorage();
    }
    return new BrowserStorage(storageType);
  }, [storageType]);

  const client = useMemo(() => {
    return new WytPassClient({
      clientId: resolvedClientId,
      redirectUri,
      environment,
      portalUrl,
      apiUrl,
      appId,
      issuer,
      authorizationEndpoint,
      tokenEndpoint,
      userInfoEndpoint,
      jwksEndpoint,
      discoveryEndpoint,
      scope,
      allowHttp,
      storage
    });
  }, [
    resolvedClientId,
    redirectUri,
    environment,
    portalUrl,
    apiUrl,
    appId,
    issuer,
    authorizationEndpoint,
    tokenEndpoint,
    userInfoEndpoint,
    jwksEndpoint,
    discoveryEndpoint,
    scope,
    allowHttp,
    storage
  ]);

  const [user, setUser] = useState<WytPassUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<WytPassError | Error | null>(null);

  // Restore existing session or automatically handle incoming OAuth redirect on mount
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        // Automatically handle OAuth redirect if returning to app
        if (
          autoHandleCallback &&
          typeof window !== 'undefined' &&
          window.location &&
          window.location.search.includes('code=') &&
          window.location.search.includes('state=') &&
          !window.location.pathname.includes('/callback')
        ) {
          const result = await client.handleCallback();
          if (isMounted) {
            setAccessToken(result.tokens.access_token);
            setUser(result.user);
          }
          // Remove OAuth parameters from browser URL
          window.history.replaceState({}, document.title, window.location.pathname);

          if (result.returnTo && result.returnTo !== window.location.href) {
            window.location.assign(result.returnTo);
          }
          return;
        }

        const storedToken = await Promise.resolve(storage.get(STORAGE_KEYS.ACCESS_TOKEN));
        const storedUser = await Promise.resolve(storage.get(STORAGE_KEYS.USER));

        if (isMounted) {
          if (storedToken) {
            setAccessToken(storedToken);
          }
          if (storedUser) {
            try {
              setUser(JSON.parse(storedUser) as WytPassUser);
            } catch {
              // Ignore parse error
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();
    return () => {
      isMounted = false;
    };
  }, [client, storage, autoHandleCallback]);

  const login = useCallback(
    async (options?: GetAuthorizationUrlOptions) => {
      setError(null);
      setIsLoading(true);
      try {
        const auth = await client.getAuthorizationUrl(options);
        if (typeof window !== 'undefined') {
          window.location.assign(auth.url);
        }
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setIsLoading(false);
        throw errorObj;
      }
    },
    [client]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.resolve(storage.remove(STORAGE_KEYS.ACCESS_TOKEN));
      await Promise.resolve(storage.remove(STORAGE_KEYS.REFRESH_TOKEN));
      await Promise.resolve(storage.remove(STORAGE_KEYS.ID_TOKEN));
      await Promise.resolve(storage.remove(STORAGE_KEYS.USER));
      setUser(null);
      setAccessToken(null);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [storage]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (accessToken) return accessToken;
    const token = await Promise.resolve(storage.get(STORAGE_KEYS.ACCESS_TOKEN));
    if (token) setAccessToken(token);
    return token;
  }, [accessToken, storage]);

  const refresh = useCallback(async (): Promise<WytPassTokenResponse | null> => {
    const refreshToken = await Promise.resolve(storage.get(STORAGE_KEYS.REFRESH_TOKEN));
    if (!refreshToken) return null;

    setIsLoading(true);
    try {
      const tokens = await client.refreshAccessToken({ refreshToken });
      if (tokens.access_token) {
        await Promise.resolve(storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token));
        setAccessToken(tokens.access_token);
      }
      if (tokens.refresh_token) {
        await Promise.resolve(storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token));
      }
      return tokens;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [client, storage]);

  const setAuthState = useCallback(
    ({ user: newUser, tokens }: { user?: WytPassUser | null; tokens?: WytPassTokenResponse | null }) => {
      if (tokens) {
        if (tokens.access_token) {
          storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
          setAccessToken(tokens.access_token);
        }
        if (tokens.refresh_token) {
          storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
        }
        if (tokens.id_token) {
          storage.set(STORAGE_KEYS.ID_TOKEN, tokens.id_token);
        }
      }
      if (newUser) {
        storage.set(STORAGE_KEYS.USER, JSON.stringify(newUser));
        setUser(newUser);
      }
    },
    [storage]
  );

  const contextValue = useMemo<WytPassContextValue>(
    () => ({
      isAuthenticated: !!user || !!accessToken,
      isLoading,
      user,
      accessToken,
      error,
      login,
      logout,
      getAccessToken,
      refresh,
      client,
      setAuthState
    }),
    [isLoading, user, accessToken, error, login, logout, getAccessToken, refresh, client, setAuthState]
  );

  return <WytPassContext.Provider value={contextValue}>{children}</WytPassContext.Provider>;
};
