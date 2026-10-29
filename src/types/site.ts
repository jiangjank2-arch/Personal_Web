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
  /** public 目录下的可访问路径，例如 /uploads/avatar.jpg */
  avatar?: string;
}
export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  order: number;
}

