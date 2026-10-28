import type { Skill } from '../types/site.ts';

// 以下为技术栈示例，不代表站主的真实技能水平。
export const skills: Skill[] = [
  { id: 'typescript', name: 'TypeScript', category: '语言', description: '为数据结构和界面交互提供类型约束。', order: 1 },
  { id: 'astro', name: 'Astro', category: '前端', description: '构建内容优先的静态网站和博客。', order: 2 },
  { id: 'tailwind', name: 'Tailwind CSS', category: '样式', description: '组织响应式布局和统一的设计变量。', order: 3 },
  { id: 'git', name: 'Git', category: '工具', description: '管理代码、文章与项目内容的版本。', order: 4 },
];

