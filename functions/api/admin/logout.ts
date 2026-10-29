import type { FunctionContext } from '../../_lib/env.ts';
import { expiredSessionCookie } from '../../_lib/auth.ts';

export const onRequestPost = async ({ request }: FunctionContext): Promise<Response> => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': expiredSessionCookie(request),
      'Cache-Control': 'no-store',
    },
  });
};
