import { useState } from 'react';
import { useWytPass } from '@wytpass/react';
import { CallbackPage } from './Callback.js';

export function App() {
  const { isAuthenticated, isLoading, user, accessToken, login, logout, refresh, error } = useWytPass();
  const [showRaw, setShowRaw] = useState(false);
  const isCallback = typeof window !== 'undefined' && window.location.pathname === '/callback';

  if (isCallback) {
    return <CallbackPage />;
  }

  return (
    <div className="app-container">
      <div className="brand-badge">⚡ WytPass SSO Integration</div>
      <h1>WytPass React Demo</h1>
      <p className="subtitle">
        Secure OAuth 2.0 / OpenID Connect authentication powered by <code>@wytpass/react</code>.
      </p>

      {error && (
        <div className="alert-error">
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {isLoading ? (
        <p style={{ color: '#94a3b8' }}>Loading session...</p>
      ) : isAuthenticated && user ? (
        <div>
          <div className="profile-card">
            <div className="profile-header">
              {user.picture || user.profilePicture ? (
                <img
                  src={user.picture || user.profilePicture}
                  alt={user.name || 'User Avatar'}
                  className="avatar"
                />
              ) : (
                <div className="avatar-placeholder">
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="user-name">{user.name || 'Anonymous User'}</div>
                <div className="user-email">{user.email || 'No email provided'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? 'Hide Raw Profile' : 'View Raw Profile'}
              </button>
              <button className="btn-secondary" onClick={() => refresh()}>
                Refresh Token
              </button>
              <button className="btn-secondary" style={{ color: '#f87171' }} onClick={() => logout()}>
                Sign Out
              </button>
            </div>

            {showRaw && (
              <pre className="raw-json">
                {JSON.stringify(
                  {
                    user,
                    tokenPreview: accessToken ? `${accessToken.slice(0, 10)}...[TRUNCATED]` : null
                  },
                  null,
                  2
                )}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <div>
          <button className="btn-primary" onClick={() => login()}>
            <span>Sign in with WytPass</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  );
}
