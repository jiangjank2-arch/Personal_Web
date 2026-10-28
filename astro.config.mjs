import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const env = { ...loadEnv(process.env.NODE_ENV || 'development', process.cwd(), ''), ...process.env };
const site = env.SITE_URL?.trim() || undefined;
if (site && new URL(site).protocol !== 'https:') {
  throw new Error('SITE_URL 必须是正式站点的 HTTPS 地址。');
}
if (env.PUBLIC_INDEXABLE === 'true' && !site) {
  throw new Error('允许索引前必须设置真实 SITE_URL。');
}

export default defineConfig({
  output: 'static',
  site,
  trailingSlash: 'always',
  integrations: [
    {
      name: 'validate-content',
      hooks: {
        'astro:build:start': async () => {
          const { validateContent } = await import('./scripts/check-content.mjs');
          validateContent();
        },
      },
    },
    ...(site ? [sitemap({ filter: (url) => !url.endsWith('/404/') && !url.endsWith('/404.html') })] : []),
  ],
  vite: { plugins: [tailwindcss()] },
  markdown: { shikiConfig: { theme: 'github-dark' } },
});

