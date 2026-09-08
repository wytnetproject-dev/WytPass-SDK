import { handleWytPassLogin } from '@wytpass/nextjs';

export const GET = handleWytPassLogin({
  allowHttp: process.env.NODE_ENV !== 'production'
});
