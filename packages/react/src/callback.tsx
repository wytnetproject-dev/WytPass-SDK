import React, { useEffect, useRef, useState } from 'react';
import { OAuthError } from '@wytpass/core';
import { useWytPass } from './hooks.js';
import type { WytPassCallbackProps } from './types.js';

export const WytPassCallback: React.FC<WytPassCallbackProps> = ({
  onSuccess,
  onError,
  successRedirect,
  errorRedirect,
  loadingComponent,
  errorComponent
}) => {
  const { client, setAuthState } = useWytPass();
  const [error, setError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(true);
  const processedRef = useRef<boolean>(false);

  useEffect(() => {
    // Avoid double execution in React 18 StrictMode
    if (processedRef.current) return;
    processedRef.current = true;

    async function handleCallback() {
      if (typeof window === 'undefined') return;

      try {
        const searchParams = new URLSearchParams(window.location.search);
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (errorParam) {
          throw new OAuthError(errorParam, errorDescription || undefined);
        }

        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
          throw new Error('Callback URL is missing required "code" parameter.');
        }

        if (!state) {
          throw new Error('Callback URL is missing required "state" parameter.');
        }

        // 1. Validate state
        await client.validateState(state);

        // 2. Exchange authorization code for tokens
        const tokens = await client.exchangeCode({ code });

        // 3. Retrieve user profile
        const user = await client.getUserInfo(tokens.access_token);

        // 4. Update React auth state
        setAuthState({ user, tokens });

        setIsProcessing(false);

        // 5. Invoke custom callback or redirect
        if (onSuccess) {
          onSuccess(user, tokens);
        }

        if (successRedirect) {
          window.location.assign(successRedirect);
        }
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setIsProcessing(false);

        if (onError) {
          onError(errorObj);
        }

        if (errorRedirect) {
          window.location.assign(errorRedirect);
        }
      }
    }

    handleCallback();
  }, [client, setAuthState, onSuccess, onError, successRedirect, errorRedirect]);

  if (error) {
    if (errorComponent) {
      return <>{errorComponent(error)}</>;
    }
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', color: '#dc2626' }}>
        <h3>Authentication Failed</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  if (isProcessing) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', color: '#4b5563' }}>
        <p>Completing WytPass authentication, please wait...</p>
      </div>
    );
  }

  return null;
};
