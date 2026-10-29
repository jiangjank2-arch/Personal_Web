import type { Skill } from '../types/site.ts';
import raw from './skills.json';

// 技能来源为 skills.json，可通过 /admin 后台修改。
export const skills: Skill[] = raw;
