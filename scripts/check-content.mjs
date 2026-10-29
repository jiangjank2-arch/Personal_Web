import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import matter from 'gray-matter';

const root = fileURLToPath(new URL('../', import.meta.url));
export function validateContent() {
  const skills = JSON.parse(readFileSync(resolve(root, 'src/data/skills.json'), 'utf8'));
  const skillIds = new Set(skills.map((skill) => skill.id));
  const errors = [];
  if (skillIds.size !== skills.length) errors.push('src/data/skills.json: 技能 id 重复');
  let count = 0;
  for (const collection of ['projects', 'blog']) {
    const directory = resolve(root, 'src/content', collection);
    const slugs = new Map();
    for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const path = resolve(entry.parentPath, entry.name);
      let data;
      try { data = matter(readFileSync(path, 'utf8')).data; }
      catch (error) { errors.push(path + ': ' + error.message); continue; }
      count++;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug || '') || ['page', 'index', '404'].includes(data.slug)) {
        errors.push(path + ': slug 无效或占用保留词');
      }
      if (slugs.has(data.slug)) errors.push(path + ': slug 重复，与 ' + slugs.get(data.slug) + ' 冲突');
      slugs.set(data.slug, path);
      for (const id of data.skillIds || []) {
        if (!skillIds.has(id)) errors.push(path + ': skillIds 引用了不存在的技能 ' + id);
      }
      if (data.cover) {
        if (!data.coverAlt?.trim()) errors.push(path + ': 封面缺少 coverAlt');
        if (!existsSync(resolve(dirname(path), data.cover))) errors.push(path + ': 找不到本地封面 ' + data.cover);
      }
    }
  }
  if (errors.length) throw new Error('内容校验失败：\n' + errors.join('\n'));
  console.log('内容关联校验通过（' + count + ' 篇内容）');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) validateContent();

