import type { AdminEnv } from './env.ts';
import { requireEnv } from './env.ts';
import { HttpError } from './respond.ts';

const API = 'https://api.github.com';
const API_VERSION = '2022-11-28';

export interface RepoContext {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export function repoContext(env: AdminEnv): RepoContext {
  const values = requireEnv(env);
  return {
    owner: values.GITHUB_OWNER,
    repo: values.GITHUB_REPO,
    branch: values.GITHUB_BRANCH || 'main',
    token: values.GITHUB_TOKEN,
  };
}

function headers(repo: RepoContext): Record<string, string> {
  return {
    Authorization: `Bearer ${repo.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'personal-web-admin',
  };
}

async function ghFetch(repo: RepoContext, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}/repos/${repo.owner}/${repo.repo}${path}`, {
    ...init,
    headers: { ...headers(repo), ...((init.headers as Record<string, string>) ?? {}) },
  });
}

export interface RemoteFile {
  path: string;
  sha: string;
  content: string;
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function getFile(repo: RepoContext, path: string): Promise<RemoteFile> {
  const response = await ghFetch(repo, `/contents/${encodeURI(path)}?ref=${encodeURIComponent(repo.branch)}`);
  if (response.status === 404) throw new HttpError(404, `仓库中不存在文件 ${path}。`);
  if (!response.ok) throw new HttpError(502, `读取 ${path} 失败：GitHub 返回 ${response.status}。`);
  const data = (await response.json()) as { content?: string; sha?: string; type?: string };
  if (data.type !== 'file' || typeof data.content !== 'string' || !data.sha) {
    throw new HttpError(502, `${path} 不是普通文件，无法读取。`);
  }
  return { path, sha: data.sha, content: decodeBase64(data.content) };
}

export async function putFile(
  repo: RepoContext,
  options: { path: string; content: string | Uint8Array; message: string; sha?: string },
): Promise<void> {
  const response = await ghFetch(repo, `/contents/${encodeURI(options.path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: options.message,
      content: encodeBase64(options.content),
      branch: repo.branch,
      ...(options.sha ? { sha: options.sha } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(502, `写入 ${options.path} 失败：GitHub 返回 ${response.status}。${detail.slice(0, 200)}`);
  }
}

export async function deleteFile(repo: RepoContext, options: { path: string; sha: string; message: string }): Promise<void> {
  const response = await ghFetch(repo, `/contents/${encodeURI(options.path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: options.message, sha: options.sha, branch: repo.branch }),
  });
  if (!response.ok) {
    throw new HttpError(502, `删除 ${options.path} 失败：GitHub 返回 ${response.status}。`);
  }
}

/** 通过 Git Trees API 列出指定目录下的全部 .md 文件路径。 */
export async function listMarkdownFiles(repo: RepoContext, directory: string): Promise<string[]> {
  const response = await ghFetch(repo, `/git/trees/${encodeURIComponent(repo.branch)}?recursive=1`);
  if (!response.ok) throw new HttpError(502, `读取仓库文件树失败：GitHub 返回 ${response.status}。`);
  const data = (await response.json()) as { tree?: { path: string; type: string }[]; truncated?: boolean };
  if (data.truncated) throw new HttpError(502, '仓库文件树过大被截断，无法列出内容文件。');
  const prefix = `${directory}/`;
  return (data.tree ?? [])
    .filter((item) => item.type === 'blob' && item.path.startsWith(prefix) && item.path.endsWith('.md'))
    .map((item) => item.path);
}
