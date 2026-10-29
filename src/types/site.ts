export interface SiteConfig {
  siteUrl?: string;
  title: string;
  description: string;
  locale: string;
  navigation: { label: string; href: string }[];
}
export interface Profile {
  name: string;
  role: string;
  tagline: string;
  bio: string[];
  email: string;
  socialLinks: { label: string; url: string }[];
  avatar?: ImageMetadata;
}
export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  order: number;
}

