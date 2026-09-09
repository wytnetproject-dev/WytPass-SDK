import React from 'react';
import Link from 'next/link';
import { createWytPassAuth } from '@wytpass/nextjs';

export default async function HomePage() {
  const auth = createWytPassAuth({
    clientId: process.env['WYTPASS_CLIENT_ID'] || 'demo_client_id',
    clientSecret: process.env['WYTPASS_CLIENT_SECRET'],
    allowHttp: process.env.NODE_ENV !== 'production'
  });

  const session = await auth.getSession();

  return (
    <main>
      <div className="badge">Next.js App Router Integration</div>
      <h1>WytPass Next.js Demo</h1>
      <p className="desc">
        Server-side session management, route handlers, and OAuth 2.0 PKCE authentication with <code>@wytpass/nextjs</code>.
      </p>

      {session ? (
        <div className="card">
          <div className="user-row">
            {session.user.picture ? (
              <img src={session.user.picture} alt={session.user.name || 'User'} className="avatar" />
            ) : null}
            <div>
              <h3>{session.user.name || 'Logged In User'}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{session.user.email}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <Link href="/dashboard" className="btn-primary">
              Go to Protected Dashboard
            </Link>
            <a href="/api/auth/wytpass/logout" className="btn-secondary" style={{ color: '#f87171' }}>
              Sign Out
            </a>
          </div>
        </div>
      ) : (
        <div>
          <a href="/api/auth/wytpass/login" className="btn-primary">
            <span>Sign in with WytPass</span>
            <span>?</span>
          </a>
        </div>
      )}
    </main>
  );
}