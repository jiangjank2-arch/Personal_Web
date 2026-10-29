import type { Profile } from '@/types/site';
import raw from './profile.json';

// 资料来源为 profile.json，可通过 /admin 后台修改；头像为 public 下的可访问路径。
export const profile: Profile = raw;
