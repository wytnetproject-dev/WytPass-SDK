# WytPass Next.js App Router Example

Production-ready demonstration of Next.js 14+ App Router authentication with `@wytpass/nextjs`.

## Features
- Full SSR & Server Components authentication support.
- Zero client-side secret exposure.
- Route Handlers for `/api/auth/wytpass/login`, `/callback`, and `/logout`.
- Protected Server Component routes (`/dashboard`).

## Running Locally

1. Create a `.env.local` file:
   ```env
   WYTPASS_CLIENT_ID=your_client_id_here
   WYTPASS_CLIENT_SECRET=your_client_secret_here
   WYTPASS_REDIRECT_URI=http://localhost:3000/api/auth/wytpass/callback
   WYTPASS_ISSUER=https://api.wytnet.com
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
