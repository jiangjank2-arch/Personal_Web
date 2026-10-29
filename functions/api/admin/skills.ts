import type { FunctionContext } from '../../_lib/env.ts';
import { requireAdmin, requireJsonWrite } from '../../_lib/auth.ts';
import { repoContext } from '../../_lib/github.ts';
import { loadCollection, writeJsonConfig } from '../../_lib/content-repo.ts';
import { apiError, handleApiError, readJsonBody } from '../../_lib/respond.ts';
import { validateSkills } from '../../_lib/validate.ts';

export const onRequestPut = async ({ request, env }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    requireJsonWrite(request);
    const body = await readJsonBody<unknown>(request);
    const errors = validateSkills(body);
    if (errors.length) return apiError(400, errors.join(' '));

    // 保证项目里引用的 skillIds 不会指向被删除的技能，否则构建会失败。
    const ids = new Set((body as { id: string }[]).map((skill) => skill.id));
    const repo = repoContext(env);
    const projects = await loadCollection(repo, 'projects');
    const dangling: string[] = [];
    for (const project of projects) {
      const skillIds = project.data.skillIds;
      if (!Array.isArray(skillIds)) continue;
      for (const id of skillIds) {
        if (typeof id === 'string' && !ids.has(id)) dangling.push(`${project.slug} → ${id}`);
      }
    }
    if (dangling.length) {
      return apiError(400, `以下项目引用了被删除的技能，请先修改项目：${dangling.join('、')}。`);
    }

    await writeJsonConfig(repo, { path: 'src/data/skills.json', value: body, message: '[admin] 更新技能列表' });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
};
