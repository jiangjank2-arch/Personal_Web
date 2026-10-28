import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import matter from 'gray-matter';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(resolve(root, 'src/data/github.json'), 'utf8'));
const username = config.username;
if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username)) throw new Error('GitHub 用户名格式无效');
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Personal-Web-Public-Importer' };
const importedAt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const marker = '<!-- managed-by: personal-web-github-import -->';
const clean = (value) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const decode = (value) => clean(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)));
const markdown = (value) => [...clean(value)].map((char) => ['*', '_', '{', '}', '[', ']', '<', '>', '!', '#', '|', String.fromCharCode(92, 96)[0], String.fromCharCode(96)].includes(char) ? String.fromCharCode(92) + char : char).join('');

async function request(url, accept = headers.Accept) {
  const response = await fetch(url, { headers: { ...headers, Accept: accept }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error('读取 ' + new URL(url).host + ' 失败：HTTP ' + response.status);
  return response;
}

async function fromApi() {
  const repositories = [];
  for (let page = 1; page <= 100; page++) {
    const response = await request('https://api.github.com/users/' + username + '/repos?type=owner&per_page=100&sort=pushed&direction=desc&page=' + page);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('GitHub 仓库列表格式异常');
    for (const repo of batch) {
      if (repo.private || repo.owner?.login?.toLowerCase() !== username.toLowerCase()) continue;
      repositories.push({ name: repo.name, description: repo.description || '', language: repo.language || '', fork: Boolean(repo.fork), archived: Boolean(repo.archived), repoUrl: repo.html_url });
    }
    if (batch.length < 100) return repositories;
  }
  throw new Error('仓库页数超出安全上限，未保存任何结果');
}

async function fromPublicPages() {
  const repositories = [];
  const seen = new Set();
  for (let page = 1; page <= 100; page++) {
    const html = await (await request('https://github.com/' + username + '?tab=repositories&page=' + page, 'text/html')).text();
    const items = [...html.matchAll(/<li\b[^>]*itemprop="owns"[\s\S]*?<\/li>/g)];
    if (!items.length) throw new Error('GitHub 公开页面未识别到仓库，保留原有内容。请稍后重试。');
    for (const [item] of items) {
      const href = item.match(/<a[^>]*href="([^"?]+)"[^>]*itemprop="name codeRepository"/);
      if (!href) throw new Error('GitHub 页面结构发生变化，未导入');
      const repoUrl = new URL(href[1], 'https://github.com');
      const parts = repoUrl.pathname.split('/').filter(Boolean);
      if (repoUrl.hostname !== 'github.com' || parts.length !== 2 || parts[0].toLowerCase() !== username.toLowerCase()) throw new Error('仓库归属校验失败');
      const name = decodeURIComponent(parts[1]);
      if (seen.has(name)) continue;
      seen.add(name);
      const description = item.match(/<p[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
      const language = item.match(/<span[^>]*itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\/span>/)?.[1] || '';
      repositories.push({ name, description: decode(description), language: decode(language), fork: /Forked from/i.test(item), archived: /<span[^>]*class="[^"]*Label[^"]*"[^>]*>\s*(?:Public archive|Archived|Archive)\s*<\/span>/i.test(item), repoUrl: repoUrl.href });
    }
    const hasNext = /<a\b[^>]*(?:rel="next"|class="[^"]*next_page)[^>]*>/i.test(html);
    if (!hasNext) return repositories;
  }
  throw new Error('仓库页数超出安全上限，未保存任何结果');
}

let repositories;
let source = 'github-rest-api';
try { repositories = await fromApi(); }
catch (error) {
  console.warn(error.message + '；尝试读取公开仓库页面。');
  source = 'github-public-pages';
  repositories = await fromPublicPages();
}
if (!repositories.length) throw new Error('账号暂无公开仓库，保留已有内容，不执行覆盖');
const directory = resolve(root, 'src/content/projects/github');
await mkdir(directory, { recursive: true });
const planned = [];
const slugs = new Set();
for (const repo of repositories) {
  const settings = config.projects?.[repo.name] || {};
  const hash = createHash('sha256').update(username + '/' + repo.name).digest('hex').slice(0, 8);
  const base = repo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repository';
  const slug = settings.slug || 'github-' + base + '-' + hash;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) throw new Error('导入配置 slug 无效或重复：' + slug);
  slugs.add(slug);
  const url = new URL(repo.repoUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') throw new Error('仓库链接无效');
  const file = resolve(directory, slug + '.md');
  try {
    if (!(await readFile(file, 'utf8')).includes(marker)) throw new Error('拒绝覆盖手动维护文件：' + file);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const data = {
    slug, title: settings.title || repo.name,
    summary: settings.summary || repo.description || '公开 GitHub 仓库，详细信息请查看源码。',
    techStack: settings.techStack || (repo.language ? [repo.language] : []),
    skillIds: [], featured: settings.featured ?? !repo.fork,
    order: settings.order ?? -10, draft: false, repoUrl: url.href,
    github: { repository: username + '/' + repo.name, fork: repo.fork, archived: repo.archived, importedAt },
  };
  const body = [marker, '', '> 资料来自公开 GitHub 仓库及其说明。此页为本地内容快照，最新信息以源码仓库为准。', '', '## 项目简介', '', markdown(data.summary), '', '## 仓库信息', '', '- 仓库：' + markdown(username + '/' + repo.name), '- 类型：' + (repo.fork ? 'Fork 仓库；不将原项目成果表述为个人原创' : '账号下的公开仓库；个人职责以补充说明为准'), '- 状态：' + (repo.archived ? '已归档' : '公开可访问'), '- 资料读取日期：' + importedAt];
  if (settings.notes?.length) body.push('', '## 功能与说明', '', ...settings.notes.map((note) => '- ' + markdown(note)));
  if (settings.reference) {
    const reference = new URL(settings.reference);
    if (reference.protocol !== 'https:' || reference.hostname !== 'github.com') throw new Error('说明来源链接无效');
    body.push('', '## 资料来源', '', '[查看项目 README](' + reference.href + ')');
  }
  body.push('', '## 查看源码', '', '[在 GitHub 打开仓库](' + url.href + ')', '');
  planned.push({ file, text: matter.stringify(body.join('\n'), data) });
}
for (const { file, text } of planned) {
  await writeFile(file + '.tmp', text, 'utf8');
  await rename(file + '.tmp', file);
}
const snapshot = { username, importedAt, source, repositories };
await writeFile(resolve(root, 'src/data/github-repositories.json.tmp'), JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
await rename(resolve(root, 'src/data/github-repositories.json.tmp'), resolve(root, 'src/data/github-repositories.json'));
console.log('已导入 ' + repositories.length + ' 个公开仓库（Fork ' + repositories.filter((repo) => repo.fork).length + ' 个），来源：' + source);
console.log('导入为静态内容，浏览器与构建不依赖 GitHub 网络。原有手写内容不会覆盖，旧仓库内容不会自动删除。');

