import React from 'react';
import ReactDOM from 'react-dom/client';
import { WytPassProvider } from '@wytpass/react';
import { App } from './App.js';
import './index.css';

const clientId = import.meta.env['VITE_WYTPASS_CLIENT_ID'] || 'demo_client_id';
const redirectUri = window.location.origin + '/callback';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WytPassProvider
      clientId={clientId}
      redirectUri={redirectUri}
      allowHttp={true}
    >
      <App />
    </WytPassProvider>
  </React.StrictMode>
);
