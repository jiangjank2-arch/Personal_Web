import type { FunctionContext } from '../../../_lib/env.ts';
import { requireAdmin, requireJsonWrite } from '../../../_lib/auth.ts';
import { repoContext, putFile } from '../../../_lib/github.ts';
import { assertCollection, collectionDirectory, loadCollection } from '../../../_lib/content-repo.ts';
import { stringifyMarkdownFile } from '../../../_lib/frontmatter.ts';
import { apiError, handleApiError, readJsonBody } from '../../../_lib/respond.ts';
import { validateContentFrontmatter } from '../../../_lib/validate.ts';

interface CreateRequest {
  collection?: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
}

export const onRequestPost = async ({ request, env }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    requireJsonWrite(request);
    const payload = await readJsonBody<CreateRequest>(request);
    const collection = assertCollection(payload.collection);
    if (!payload.frontmatter || typeof payload.body !== 'string') {
      return apiError(400, '缺少内容数据。');
    }
    const errors = validateContentFrontmatter(collection, payload.frontmatter);
    if (errors.length) return apiError(400, errors.join(' '));

    const repo = repoContext(env);
    const slug = String(payload.frontmatter.slug);
    const existing = await loadCollection(repo, collection);
    if (existing.some((doc) => doc.slug === slug)) return apiError(400, `slug 已存在：${slug}`);

    const path = `${collectionDirectory(collection)}/${slug}.md`;
    const content = stringifyMarkdownFile(payload.frontmatter, payload.body);
    await putFile(repo, { path, content, message: `[admin] 新建${collection === 'blog' ? '文章' : '项目'} ${slug}` });
    return new Response(JSON.stringify({ ok: true, slug, path }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
};
