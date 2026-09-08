import React from 'react';
import './globals.css';

export const metadata = {
  title: 'WytPass Next.js App Router Demo',
  description: 'Enterprise SSO OAuth2 & OpenID Connect authentication with @wytpass/nextjs'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
