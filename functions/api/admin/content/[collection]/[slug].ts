import type { FunctionContext } from '../../../../_lib/env.ts';
import { requireAdmin, requireJsonWrite } from '../../../../_lib/auth.ts';
import { repoContext, putFile, deleteFile } from '../../../../_lib/github.ts';
import { assertCollection, findDocBySlug, loadCollection } from '../../../../_lib/content-repo.ts';
import { stringifyMarkdownFile } from '../../../../_lib/frontmatter.ts';
import { apiError, handleApiError, readJsonBody } from '../../../../_lib/respond.ts';
import { validateContentFrontmatter } from '../../../../_lib/validate.ts';

export const onRequestGet = async ({ request, env, params }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    const collection = assertCollection(params.collection);
    const slug = params.slug;
    if (!slug) return apiError(400, '缺少 slug。');
    const doc = await findDocBySlug(repoContext(env), collection, slug);
    return new Response(
      JSON.stringify({ slug: doc.slug, path: doc.path, frontmatter: doc.data, body: doc.body }),
      { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return handleApiError(error);
  }
};

interface UpdateRequest {
  frontmatter?: Record<string, unknown>;
  body?: string;
}

export const onRequestPut = async ({ request, env, params }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    requireJsonWrite(request);
    const collection = assertCollection(params.collection);
    const slug = params.slug;
    if (!slug) return apiError(400, '缺少 slug。');
    const payload = await readJsonBody<UpdateRequest>(request);
    if (!payload.frontmatter || typeof payload.body !== 'string') return apiError(400, '缺少内容数据。');
    const errors = validateContentFrontmatter(collection, payload.frontmatter);
    if (errors.length) return apiError(400, errors.join(' '));

    const repo = repoContext(env);
    const doc = await findDocBySlug(repo, collection, slug);
    const newSlug = String(payload.frontmatter.slug);
    const content = stringifyMarkdownFile(payload.frontmatter, payload.body);
    const label = collection === 'blog' ? '文章' : '项目';

    if (newSlug === slug) {
      await putFile(repo, { path: doc.path, content, sha: doc.sha, message: `[admin] 更新${label} ${slug}` });
    } else {
      const siblings = await loadCollection(repo, collection);
      if (siblings.some((item) => item.slug === newSlug)) return apiError(400, `slug 已存在：${newSlug}`);
      const newPath = doc.path.replace(/[^/]+$/, `${newSlug}.md`);
      await putFile(repo, { path: newPath, content, message: `[admin] ${label}改名 ${slug} → ${newSlug}` });
      await deleteFile(repo, { path: doc.path, sha: doc.sha, message: `[admin] 删除旧文件 ${doc.path}` });
    }
    return new Response(JSON.stringify({ ok: true, slug: newSlug }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const onRequestDelete = async ({ request, env, params }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    requireJsonWrite(request);
    const collection = assertCollection(params.collection);
    const slug = params.slug;
    if (!slug) return apiError(400, '缺少 slug。');
    const repo = repoContext(env);
    const doc = await findDocBySlug(repo, collection, slug);
    const label = collection === 'blog' ? '文章' : '项目';
    await deleteFile(repo, { path: doc.path, sha: doc.sha, message: `[admin] 删除${label} ${slug}` });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
};
