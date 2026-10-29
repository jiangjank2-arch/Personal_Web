import type { CollectionName } from './validate.ts';
import type { RepoContext } from './github.ts';
import { getFile, listMarkdownFiles, putFile } from './github.ts';
import { parseMarkdownFile } from './frontmatter.ts';
import { HttpError } from './respond.ts';

export interface ContentDoc {
  slug: string;
  path: string;
  data: Record<string, unknown>;
  body: string;
}

export function collectionDirectory(collection: CollectionName): string {
  return `src/content/${collection}`;
}

export function assertCollection(value: string | undefined): CollectionName {
  if (value === 'projects' || value === 'blog') return value;
  throw new HttpError(400, '内容类型只能是 projects 或 blog。');
}

export async function loadCollection(repo: RepoContext, collection: CollectionName): Promise<ContentDoc[]> {
  const paths = await listMarkdownFiles(repo, collectionDirectory(collection));
  const files = await Promise.all(paths.map((path) => getFile(repo, path)));
  return files
    .map((file) => {
      const { data, body } = parseMarkdownFile(file.content);
      return { slug: typeof data.slug === 'string' ? data.slug : '', path: file.path, data, body };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug, 'en'));
}

export async function findDocBySlug(
  repo: RepoContext,
  collection: CollectionName,
  slug: string,
): Promise<ContentDoc & { sha: string }> {
  const paths = await listMarkdownFiles(repo, collectionDirectory(collection));
  for (const path of paths) {
    const file = await getFile(repo, path);
    const { data, body } = parseMarkdownFile(file.content);
    if (data.slug === slug) return { slug, path, data, body, sha: file.sha };
  }
  throw new HttpError(404, `没有找到内容：${slug}`);
}

export async function readJsonConfig<T>(repo: RepoContext, path: string): Promise<T> {
  const file = await getFile(repo, path);
  try {
    return JSON.parse(file.content) as T;
  } catch {
    throw new HttpError(502, `${path} 不是有效的 JSON。`);
  }
}

export async function writeJsonConfig(
  repo: RepoContext,
  options: { path: string; value: unknown; message: string },
): Promise<void> {
  const existing = await getFile(repo, options.path).catch((error) => {
    if (error instanceof HttpError && error.status === 404) return undefined;
    throw error;
  });
  const content = JSON.stringify(options.value, null, 2) + '\n';
  await putFile(repo, { path: options.path, content, message: options.message, sha: existing?.sha });
}
