# @wytpass/nextjs

Official Next.js SDK for **WytPass SSO / OAuth 2.0 / OpenID Connect**.

[![npm version](https://img.shields.io/npm/v/@wytpass/nextjs.svg)](https://www.npmjs.com/package/@wytpass/nextjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- ⚡ **Next.js App Router Native**: Server Components, Route Handlers, and Server Actions support.
- 🛡️ **HttpOnly Secure Cookies**: Automatically manages PKCE verifiers, anti-CSRF state, and session tokens.
- 🔄 **One-Line Route Handlers**: Pre-built handlers for login, callback, and logout.
- 🔌 **NextAuth / Auth.js Provider**: Drop-in `WytPassNextAuthProvider` helper for existing NextAuth stacks.
- 🔒 **Zero Client Leaks**: Keeps `WYTPASS_CLIENT_SECRET` completely isolated to the server.

---

## Installation

```bash
npm install @wytpass/nextjs @wytpass/core
```

---

## Quick Start (Next.js App Router)

### 1. Configure Environment Variables (`.env.local`)

```env
WYTPASS_CLIENT_ID=your_client_id_here
WYTPASS_CLIENT_SECRET=your_client_secret_here
WYTPASS_REDIRECT_URI=http://localhost:3000/api/auth/wytpass/callback
WYTPASS_ISSUER=https://api.wytnet.com
```

### 2. Create Auth Route Handlers

**`app/api/auth/wytpass/login/route.ts`**:
```typescript
import { handleWytPassLogin } from '@wytpass/nextjs';

export const GET = handleWytPassLogin();
```

**`app/api/auth/wytpass/callback/route.ts`**:
```typescript
import { handleWytPassCallback } from '@wytpass/nextjs';

export const GET = handleWytPassCallback(undefined, '/dashboard');
```

**`app/api/auth/wytpass/logout/route.ts`**:
```typescript
import { handleWytPassLogout } from '@wytpass/nextjs';

export const GET = handleWytPassLogout();
```

### 3. Protect Server Components & Access Session

**`app/dashboard/page.tsx`**:
```tsx
import { createWytPassAuth } from '@wytpass/nextjs';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const auth = createWytPassAuth();
  const session = await auth.getSession();

  if (!session) {
    redirect('/api/auth/wytpass/login');
  }

  return (
    <main>
      <h1>Welcome, {session.user.name}</h1>
      <p>Email: {session.user.email}</p>
      <a href="/api/auth/wytpass/logout">Sign Out</a>
    </main>
  );
}
```

---

## NextAuth.js / Auth.js Integration

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { WytPassNextAuthProvider } from '@wytpass/nextjs';

const handler = NextAuth({
  providers: [
    WytPassNextAuthProvider({
      clientId: process.env.WYTPASS_CLIENT_ID!,
      clientSecret: process.env.WYTPASS_CLIENT_SECRET!
    })
  ]
});

export { handler as GET, handler as POST };
```

---

## API Reference

### `createWytPassAuth(config?)`
- `login(options?)`: Returns HTTP 302 redirect response with PKCE & state cookies.
- `handleCallback(request, redirectOnSuccess?)`: Processes OAuth callback, validates state, sets session cookie, redirects.
- `getSession(request?)`: Reads session cookie from request or Next.js `next/headers`.
- `requireAuth(request?, redirectTo?)`: Guarantees active session or redirects.
- `logout(redirectTo?)`: Clears session cookie and redirects.

---

## License

MIT © [Wytnet](https://wytnet.com)
