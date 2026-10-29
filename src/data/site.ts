import type { SiteConfig } from '@/types/site';

export const site: SiteConfig = {
  siteUrl: import.meta.env.SITE_URL?.trim() || undefined,
  title: 'Personal Web · 个人作品集',
  description: '记录学习、分享实践，展示个人介绍、技能、项目和文章。',
  locale: 'zh-CN',
  navigation: [
    { label: '首页', href: '/' },
    { label: '关于', href: '/#about' },
    { label: '项目', href: '/projects/' },
    { label: '博客', href: '/blog/' },
    { label: '联系', href: '/#contact' },
  ],
};
const isCloudflarePreview = import.meta.env.CF_PAGES === '1' &&
  (!import.meta.env.PRODUCTION_BRANCH || import.meta.env.CF_PAGES_BRANCH !== import.meta.env.PRODUCTION_BRANCH);
export const indexable = Boolean(site.siteUrl) && import.meta.env.PUBLIC_INDEXABLE === 'true' && !isCloudflarePreview;

