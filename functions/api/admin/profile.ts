import type { FunctionContext } from '../../_lib/env.ts';
import { requireAdmin, requireJsonWrite } from '../../_lib/auth.ts';
import { repoContext } from '../../_lib/github.ts';
import { writeJsonConfig } from '../../_lib/content-repo.ts';
import { apiError, handleApiError, readJsonBody } from '../../_lib/respond.ts';
import { validateProfile } from '../../_lib/validate.ts';

export const onRequestPut = async ({ request, env }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    requireJsonWrite(request);
    const body = await readJsonBody<unknown>(request);
    const errors = validateProfile(body);
    if (errors.length) return apiError(400, errors.join(' '));
    await writeJsonConfig(repoContext(env), {
      path: 'src/data/profile.json',
      value: body,
      message: '[admin] 更新个人信息',
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
