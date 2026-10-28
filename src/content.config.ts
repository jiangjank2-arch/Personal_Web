import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { isCalendarDate } from './lib/dates';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !['page', 'index', '404'].includes(value), 'slug 不能使用路由保留词');
const date = z.string().refine(isCalendarDate, '日期必须是有效的 YYYY-MM-DD 字符串');
const httpsUrl = z.url().refine((value) => new URL(value).protocol === 'https:', '链接必须使用 HTTPS');
const common = {
  slug,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  draft: z.boolean().default(true),
  coverAlt: z.string().trim().min(1).optional(),
};
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: ({ image }) => z.object({
    ...common,
    cover: image().optional(),
    techStack: z.array(z.string().min(1)).default([]),
    skillIds: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    order: z.number().int().default(100),
    completedAt: date.optional(),
    demoUrl: httpsUrl.optional(),
    repoUrl: httpsUrl.optional(),
    github: z.object({
      repository: z.string().min(1),
      fork: z.boolean(),
      archived: z.boolean(),
      importedAt: date,
    }).optional(),
  }).refine((data) => !data.cover || Boolean(data.coverAlt), { message: '封面必须提供 coverAlt', path: ['coverAlt'] }),
});
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: ({ image }) => z.object({
    ...common,
    cover: image().optional(),
    publishedAt: date,
    updatedAt: date.optional(),
    category: z.string().trim().min(1),
    tags: z.array(z.string().min(1)).default([]),
  }).refine((data) => !data.cover || Boolean(data.coverAlt), { message: '封面必须提供 coverAlt', path: ['coverAlt'] })
    .refine((data) => !data.updatedAt || data.updatedAt >= data.publishedAt, { message: '更新日期不能早于发布日期', path: ['updatedAt'] }),
});
export const collections = { projects, blog };

