import type { Profile } from '@/types/site';
import avatar from '@/assets/avatar.jpg';

// 初始化示例资料，请在正式发布前替换。
export const profile: Profile = {
  name: 'Jank',
  role: '开发者 · AI驯服者',
  tagline: '用代码探索想法，\n把灵感变成作品。',
  avatar,
  bio: [
    '一个热爱技术和创作的开发者，喜欢用代码探索想法，并将灵感转化为实际作品。',
  ],
  email: '2719829089@qq.com',
  socialLinks: [
    { label: 'GitHub', url: 'https://github.com/jiangjank2-arch' },
  ],
};

