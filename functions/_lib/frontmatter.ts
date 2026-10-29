import { dump, load } from 'js-yaml';
import { HttpError } from './respond.ts';

export interface MarkdownDocument {
  data: Record<string, unknown>;
  body: string;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseMarkdownFile(text: string): MarkdownDocument {
  const match = FRONT_MATTER.exec(text);
  if (!match) throw new HttpError(400, '文件缺少 frontmatter（--- 包围的头部）。');
  let data: unknown;
  try {
    data = load(match[1]);
  } catch (error) {
    throw new HttpError(400, `frontmatter 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new HttpError(400, 'frontmatter 必须是键值形式。');
  }
  return { data: data as Record<string, unknown>, body: text.slice(match[0].length) };
}

export function stringifyMarkdownFile(data: Record<string, unknown>, body: string): string {
  const header = dump(data, {
    lineWidth: -1,
    noRefs: true,
    forceQuotes: true,
  });
  return `---\n${header}---\n${body.startsWith('\n') ? body : `\n${body}`}`;
}
