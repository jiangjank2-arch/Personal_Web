import type { SiteConfig } from '@/types/site';
import raw from './site.json';

// 站点设置来源为 site.json，可通过 /admin 后台修改；siteUrl 始终以环境变量为准。
export const site: SiteConfig = {
  ...raw,
  siteUrl: import.meta.env.SITE_URL?.trim() || undefined,
};
const isCloudflarePreview = import.meta.env.CF_PAGES === '1' &&
  (!import.meta.env.PRODUCTION_BRANCH || import.meta.env.CF_PAGES_BRANCH !== import.meta.env.PRODUCTION_BRANCH);
export const indexable = Boolean(site.siteUrl) && import.meta.env.PUBLIC_INDEXABLE === 'true' && !isCloudflarePreview;
