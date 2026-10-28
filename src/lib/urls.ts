import { site } from '@/data/site';
export function canonicalUrl(pathname: string): string | undefined {
  return site.siteUrl ? new URL(pathname, site.siteUrl).href : undefined;
}

