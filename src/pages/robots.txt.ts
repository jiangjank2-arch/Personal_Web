import type { APIRoute } from 'astro';
import { site, indexable } from '@/data/site';
export const GET: APIRoute = () => new Response(
  indexable && site.siteUrl
    ? `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${new URL('/sitemap-index.xml', site.siteUrl).href}\n`
    : 'User-agent: *\nDisallow: /\n',
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
