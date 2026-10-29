import { ConfigError } from './env.ts';

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...init.headers },
    ...init,
  });
}

export function apiError(status: number, message: string): Response {
  return json({ error: message }, { status });
}

/** 把已知错误转成 JSON 响应；未知错误只返回通用提示，避免泄漏细节。 */
export function handleApiError(error: unknown): Response {
  if (error instanceof ConfigError) return apiError(500, error.message);
  if (error instanceof HttpError) return apiError(error.status, error.message);
  const message = error instanceof Error ? error.message : String(error);
  return apiError(500, '服务器内部错误：' + message);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, '请求体不是有效的 JSON。');
  }
}
