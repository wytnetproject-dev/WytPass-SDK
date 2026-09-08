import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WytPassProvider, useWytPass } from '../src/index.js';

function TestConsumer() {
  const { isAuthenticated, isLoading, client } = useWytPass();
  return (
    <div>
      <span data-testid="auth">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="client">{client ? 'has-client' : 'no-client'}</span>
    </div>
  );
}

describe('@wytpass/react', () => {
  it('should throw error when useWytPass is used outside of WytPassProvider', () => {
    expect(() => renderToString(<TestConsumer />)).toThrow(
      /useWytPass must be used within a <WytPassProvider>/
    );
  });

  it('should render children within WytPassProvider without throwing', () => {
    const html = renderToString(
      <WytPassProvider
        clientId="wp_test_123"
        redirectUri="http://localhost:3000/callback"
        storageType="memory"
      >
        <TestConsumer />
      </WytPassProvider>
    );

    expect(html).toContain('has-client');
  });
});
