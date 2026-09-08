import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createWytPassAuth } from '@wytpass/nextjs';

export default async function DashboardPage() {
  const auth = createWytPassAuth({
    clientId: process.env['WYTPASS_CLIENT_ID'] || 'demo_client_id',
    redirectUri: process.env['WYTPASS_REDIRECT_URI'] || 'http://localhost:3000/api/auth/wytpass/callback',
    allowHttp: true
  });

  const session = await auth.getSession();

  if (!session) {
    redirect('/api/auth/wytpass/login');
  }

  return (
    <main>
      <div className="badge">🔒 Protected Route</div>
      <h1>Protected Dashboard</h1>
      <p className="desc">
        This server component rendered securely because a verified WytPass session cookie was present.
      </p>

      <div className="card">
        <h3>User Information</h3>
        <p><strong>Name:</strong> {session.user.name}</p>
        <p><strong>Email:</strong> {session.user.email}</p>
        <p><strong>User ID:</strong> {session.user.id}</p>

        <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>Decrypted Server Session Payload</h4>
        <pre className="json-box">
          {JSON.stringify(
            {
              user: session.user,
              expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
              accessTokenPreview: `${session.accessToken.slice(0, 12)}...[REDACTED]`
            },
            null,
            2
          )}
        </pre>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <Link href="/" className="btn-secondary">
          ← Back Home
        </Link>
        <a href="/api/auth/wytpass/logout" className="btn-secondary" style={{ color: '#f87171' }}>
          Sign Out
        </a>
      </div>
    </main>
  );
}
