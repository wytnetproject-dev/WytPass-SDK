# @wytpass/core

Framework-agnostic, cryptographically secure TypeScript SDK for **WytPass SSO / OAuth 2.0 / OpenID Connect**.

[![npm version](https://img.shields.io/npm/v/@wytpass/core.svg)](https://www.npmjs.com/package/@wytpass/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## Features

- 🔐 **PKCE by Default**: Standards-compliant RFC 7636 Proof Key for Code Exchange (S256).
- 🛡️ **Anti-CSRF State Protection**: Constant-time cryptographic state generation and validation.
- ⚡ **Zero Framework Dependencies**: Pure TypeScript/ESM/CJS compatible with Node.js 18+, browsers, Deno, and Cloudflare Workers.
- 🌐 **OIDC Discovery & JWKS**: Automatic discovery caching and ID Token validation.
- 🗄️ **Pluggable Storage**: Built-in Memory, Browser WebStorage, and custom storage adapters.
- 🔒 **Sanitized Logging & Errors**: Automatic redaction of secrets, codes, and tokens.
- 💻 **Local & Production Ready**: Seamless switching between HTTPS production and local HTTP development.

---

## Installation

```bash
npm install @wytpass/core
```

Or using yarn / pnpm / bun:

```bash
pnpm add @wytpass/core
```

---

## Quick Start

```typescript
import { WytPassClient } from '@wytpass/core';

// 1. Initialize client (Zero configuration: clientId is the only required value!)
const wytpass = new WytPassClient({
  clientId: process.env.WYTPASS_CLIENT_ID!
});

// 2. Generate authorization URL (redirects user to WytPass)
const { url, state, codeVerifier } = await wytpass.getAuthorizationUrl();
// Redirect user to `url` and keep `codeVerifier` and `state` saved

// 3. Exchange code at callback
const tokens = await wytpass.exchangeCode({
  code: callbackCode,
  codeVerifier: savedCodeVerifier
});

// 4. Retrieve normalized user profile
const user = await wytpass.getUserInfo(tokens.access_token);
console.log('Logged in user:', user.name, user.email);
```

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `clientId` | `string` | *(Required)* | **The only required value.** Your WytPass OAuth Client ID. |
| `redirectUri` | `string` | *(Auto-resolved)* | Application redirect callback URL. Auto-discovered if omitted. |
| `clientSecret` | `string` | `undefined` | Client Secret (Server-side ONLY) |
| `issuer` | `string` | `https://api.wytnet.com` | WytPass OIDC Issuer |
| `authorizationEndpoint` | `string` | `https://wytnet.com/oauth/authorize` | Authorization URL |
| `tokenEndpoint` | `string` | `https://api.wytnet.com/oauth/token` | Token URL |
| `userInfoEndpoint` | `string` | `https://api.wytnet.com/oauth/userinfo` | UserInfo URL |
| `jwksEndpoint` | `string` | `https://api.wytnet.com/.well-known/jwks.json` | JWKS URL |
| `scope` | `string` | `openid profile email` | Requested OAuth scopes |
| `allowHttp` | `boolean` | `false` | Allow HTTP for localhost testing |
| `timeoutMs` | `number` | `15000` | HTTP Request timeout in ms |
| `storage` | `WytPassStorage` | `MemoryStorage` | Custom state/verifier storage |
| `logger` | `WytPassLogger` | `NullLogger` | Safe logging adapter |

---

## Security Best Practices

1. **Never pass `clientSecret` in browser code**: PKCE provides full security for public clients without a secret.
2. **Always validate `state`**: Use `wytpass.validateState(returnedState)` on callbacks to prevent CSRF attacks.
3. **Use HTTPS**: In production environments, all endpoints must use HTTPS.
4. **Token Storage**: Store access tokens in secure httpOnly cookies or memory; avoid exposing tokens in unencrypted persistent storage.

---

## License

MIT © [Wytnet](https://wytnet.com)
