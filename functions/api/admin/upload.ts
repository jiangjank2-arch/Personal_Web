import type { FunctionContext } from '../../_lib/env.ts';
import { requireAdmin, requireJsonWrite } from '../../_lib/auth.ts';
import { repoContext, putFile } from '../../_lib/github.ts';
import { apiError, handleApiError, readJsonBody } from '../../_lib/respond.ts';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg']);
const MAX_BYTES = 2 * 1024 * 1024;

interface UploadRequest {
  space?: string;
  name?: string;
  data?: string;
}

function safeFileName(name: string): string | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!match) return undefined;
  const extension = match[1].toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return undefined;
  const base = name
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) return undefined;
  return `${base}-${Date.now().toString(36)}.${extension}`;
}

export const onRequestPost = async ({ request, env }: FunctionContext): Promise<Response> => {
  try {
    const auth = await requireAdmin(request, env);
    if (auth !== true) return auth;
    requireJsonWrite(request);
    const body = await readJsonBody<UploadRequest>(request);
    if (!body.space || !body.name || !body.data) return apiError(400, '缺少上传参数。');
    const fileName = safeFileName(body.name);
    if (!fileName) return apiError(400, '文件名或类型不受支持，允许 jpg / png / gif / webp / avif / svg。');
    let bytes: Uint8Array;
    try {
      const binary = atob(body.data.replace(/\s/g, ''));
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      return apiError(400, '上传内容不是有效的 base64 数据。');
    }
    if (bytes.byteLength > MAX_BYTES) return apiError(400, '图片超过 2MB 限制。');

    let path: string;
    let publicPath: string;
    if (body.space === 'avatar') {
      path = `public/uploads/${fileName}`;
      publicPath = `/uploads/${fileName}`;
    } else if (body.space === 'projects' || body.space === 'blog') {
      path = `src/content/${body.space}/images/${fileName}`;
      publicPath = `./images/${fileName}`;
    } else {
      return apiError(400, '未知的上传位置。');
    }

    await putFile(repoContext(env), {
      path,
      content: bytes,
      message: `[admin] 上传图片 ${fileName}`,
    });
    return new Response(JSON.stringify({ ok: true, path: publicPath }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error);
  }
};
