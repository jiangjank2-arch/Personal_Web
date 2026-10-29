import type { FunctionContext } from '../../_lib/env.ts';
import { requireEnv } from '../../_lib/env.ts';
import { createSessionCookie, safeEqual } from '../../_lib/auth.ts';
import { apiError, handleApiError, readJsonBody } from '../../_lib/respond.ts';

export const onRequestPost = async ({ request, env }: FunctionContext): Promise<Response> => {
  try {
    const { password } = await readJsonBody<{ password?: string }>(request);
    if (!password) return apiError(400, '请输入密码。');
    const { ADMIN_PASSWORD } = requireEnv(env);
    if (!(await safeEqual(password, ADMIN_PASSWORD))) return apiError(401, '密码不正确。');
    const cookie = await createSessionCookie(request, env);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
};
