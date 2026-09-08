# @wytpass/react

Official React SDK for **WytPass SSO / OAuth 2.0 / OpenID Connect**.

[![npm version](https://img.shields.io/npm/v/@wytpass/react.svg)](https://www.npmjs.com/package/@wytpass/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- ⚡ **Zero-Config OAuth PKCE**: Seamless Authorization Code flow with S256 PKCE without exposing secrets.
- 🎯 **React Hooks**: `useWytPass()`, `useAuthUser()`, and `useAccessToken()`.
- 🔄 **Automatic Callback Handler**: Drop-in `<WytPassCallback />` component.
- 🛡️ **Browser-Safe**: Automatically manages state, verifiers, and session tokens safely in browser storage.
- 🌐 **TypeScript Native**: Full intellisense for user profile fields, subscriptions, and OAuth errors.

---

## Installation

```bash
npm install @wytpass/react @wytpass/core
```

---

## Quick Start

### 1. Wrap your application with `WytPassProvider`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WytPassProvider } from '@wytpass/react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WytPassProvider
      clientId="your_wytpass_client_id"
      redirectUri="http://localhost:3000/callback"
    >
      <App />
    </WytPassProvider>
  </React.StrictMode>
);
```

### 2. Login & Profile in Components

```tsx
import { useWytPass } from '@wytpass/react';

function UserProfile() {
  const { isAuthenticated, isLoading, user, login, logout } = useWytPass();

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  if (!isAuthenticated) {
    return <button onClick={() => login()}>Sign in with WytPass</button>;
  }

  return (
    <div>
      <img src={user?.picture} alt={user?.name} width={48} height={48} />
      <h2>Welcome, {user?.name}!</h2>
      <p>Email: {user?.email}</p>
      <button onClick={() => logout()}>Sign Out</button>
    </div>
  );
}
```

### 3. Callback Page

```tsx
import { WytPassCallback } from '@wytpass/react';

export function CallbackPage() {
  return (
    <WytPassCallback
      successRedirect="/dashboard"
      errorRedirect="/login"
      onError={(err) => console.error('Login failed:', err)}
    />
  );
}
```

---

## Hook API Reference (`useWytPass()`)

| Property / Method | Type | Description |
| :--- | :--- | :--- |
| `isAuthenticated` | `boolean` | True if user has an active session |
| `isLoading` | `boolean` | True while verifying session or exchanging tokens |
| `user` | `WytPassUser \| null` | Authenticated user profile |
| `accessToken` | `string \| null` | Current active OAuth access token |
| `error` | `Error \| null` | Error object if authentication failed |
| `login(options?)` | `() => Promise<void>` | Redirects user to WytPass authorization page |
| `logout()` | `() => Promise<void>` | Clears local session and tokens |
| `refresh()` | `() => Promise<Tokens \| null>` | Refreshes access token with refresh token |
| `getAccessToken()` | `() => Promise<string \| null>` | Retrieves current access token |

---

## License

MIT © [Wytnet](https://wytnet.com)
