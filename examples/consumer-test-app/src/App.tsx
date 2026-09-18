import React from 'react';
import { WytPassProvider, useWytPass, WytPassCallback } from '@wytpass/react';
import type { WytPassUser, WytPassTokenResponse } from '@wytpass/core';

export const UserProfile: React.FC = () => {
  const { isAuthenticated, isLoading, user, login, logout, error } = useWytPass();

  if (isLoading) {
    return <div id="loading">Loading authentication session...</div>;
  }

  if (error) {
    return <div id="error" style={{ color: 'red' }}>Error: {error.message}</div>;
  }

  if (!isAuthenticated) {
    return (
      <div id="logged-out">
        <h2>Welcome to Consumer App</h2>
        <button id="login-btn" onClick={() => login()}>
          Sign in with WytPass
        </button>
      </div>
    );
  }

  return (
    <div id="logged-in">
      <h2>Hello, {user?.name || 'User'}!</h2>
      <p id="user-email">Email: {user?.email}</p>
      <button id="logout-btn" onClick={() => logout()}>
        Sign Out
      </button>
    </div>
  );
};

export const CallbackRoute: React.FC = () => {
  const handleSuccess = (user: WytPassUser, tokens: WytPassTokenResponse) => {
    console.log('Successfully authenticated:', user.name, tokens.access_token);
  };

  const handleError = (error: Error) => {
    console.error('Authentication failed:', error.message);
  };

  return (
    <WytPassCallback
      onSuccess={handleSuccess}
      onError={handleError}
      successRedirect="/dashboard"
      errorRedirect="/login"
    />
  );
};

export const App: React.FC = () => {
  // In client applications, only the Client ID is required!
  // All WhitePass URLs, endpoints, scopes, PKCE, and redirect resolution are handled internally.
  const clientId =
    (typeof process !== 'undefined' && process.env['VITE_WYTPASS_CLIENT_ID']) ||
    'wp_d80c88e9dfc80679b21d';

  return (
    <WytPassProvider clientId={clientId}>
      <UserProfile />
    </WytPassProvider>
  );
};

export default App;
