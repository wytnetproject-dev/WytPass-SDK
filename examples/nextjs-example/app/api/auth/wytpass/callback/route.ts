import { handleWytPassCallback } from '@wytpass/nextjs';

export const GET = handleWytPassCallback(
  {
    allowHttp: process.env.NODE_ENV !== 'production'
  },
  '/dashboard'
);
