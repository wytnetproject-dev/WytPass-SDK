import React from 'react';
import { WytPassCallback } from '@wytpass/react';

export const CallbackPage: React.FC = () => {
  return (
    <div className="app-container">
      <WytPassCallback
        successRedirect="/"
        errorRedirect="/"
        loadingComponent={
          <div>
            <h1>Authenticating...</h1>
            <p className="subtitle">Exchanging PKCE authorization code with WytPass SSO.</p>
          </div>
        }
        errorComponent={(err) => (
          <div>
            <div className="alert-error">
              <strong>Authentication Error:</strong> {err.message}
            </div>
            <a href="/" className="btn-secondary">Back to Login</a>
          </div>
        )}
      />
    </div>
  );
};
