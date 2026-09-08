import { handleWytPassLogout } from '@wytpass/nextjs';

export const GET = handleWytPassLogout(
  {
    allowHttp: process.env.NODE_ENV !== 'production'
  },
  '/'
);
