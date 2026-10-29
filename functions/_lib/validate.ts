export type CollectionName = 'projects' | 'blog';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(['page', 'index', '404']);
const SKILL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isHttpUrl(value: string, requireHttps: boolean): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (!requireHttps && url.protocol === 'http:');
  } catch {
    return false;
  }
}

export function validateProfile(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['个人资料必须是对象。'];
  const value = data as Record<string, unknown>;
  if (!isNonEmptyString(value.name)) errors.push('姓名不能为空。');
  if (!isNonEmptyString(value.role)) errors.push('职位 / 头衔不能为空。');
  if (typeof value.tagline !== 'string') errors.push('一句话介绍必须是文本。');
  if (!isNonEmptyString(value.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.push('邮箱格式不正确。');
  if (value.avatar !== undefined && value.avatar !== '' && typeof value.avatar !== 'string') {
    errors.push('头像必须是路径字符串。');
  }
  if (!Array.isArray(value.bio) || value.bio.some((item) => typeof item !== 'string')) {
    errors.push('个人简介必须是文本段落数组。');
  }
  if (!Array.isArray(value.socialLinks)) {
    errors.push('社交链接必须是数组。');
  } else {
    value.socialLinks.forEach((link, index) => {
      const item = link as Record<string, unknown>;
      if (!item || typeof item !== 'object' || !isNonEmptyString(item.label) || !isNonEmptyString(item.url)) {
        errors.push(`第 ${index + 1} 个社交链接需要 label 和 url。`);
      } else if (!isHttpUrl(item.url, false)) {
        errors.push(`第 ${index + 1} 个社交链接不是有效的 http(s) 地址。`);
      }
    });
  }
  return errors;
}

export function validateSkills(data: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(data)) return ['技能必须是数组。'];
  const ids = new Set<string>();
  data.forEach((item, index) => {
    const skill = item as Record<string, unknown>;
    if (!skill || typeof skill !== 'object') {
      errors.push(`第 ${index + 1} 项技能格式不正确。`);
      return;
    }
    if (!isNonEmptyString(skill.id) || !SKILL_ID_PATTERN.test(skill.id)) {
      errors.push(`第 ${index + 1} 项技能的 id 必须是小写字母、数字和连字符的组合。`);
    } else if (ids.has(skill.id)) {
      errors.push(`技能 id 重复：${skill.id}。`);
    } else {
      ids.add(skill.id);
    }
    if (!isNonEmptyString(skill.name)) errors.push(`第 ${index + 1} 项技能缺少名称。`);
    if (!isNonEmptyString(skill.category)) errors.push(`第 ${index + 1} 项技能缺少分类。`);
    if (typeof skill.description !== 'string') errors.push(`第 ${index + 1} 项技能缺少说明。`);
    if (typeof skill.order !== 'number' || !Number.isFinite(skill.order)) errors.push(`第 ${index + 1} 项技能的排序必须是数字。`);
  });
  return errors;
}

export function validateSite(data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['站点设置必须是对象。'];
  const value = data as Record<string, unknown>;
  if (!isNonEmptyString(value.title)) errors.push('站点标题不能为空。');
  if (!isNonEmptyString(value.description)) errors.push('站点描述不能为空。');
  if (!isNonEmptyString(value.locale)) errors.push('站点语言不能为空。');
  if (!Array.isArray(value.navigation)) {
    errors.push('导航必须是数组。');
  } else {
    value.navigation.forEach((item, index) => {
      const link = item as Record<string, unknown>;
      if (!link || typeof link !== 'object' || !isNonEmptyString(link.label) || !isNonEmptyString(link.href)) {
        errors.push(`第 ${index + 1} 项导航需要 label 和 href。`);
      } else if (!link.href.startsWith('/') && !link.href.startsWith('#') && !isHttpUrl(link.href, true)) {
        errors.push(`第 ${index + 1} 项导航链接必须是站内路径、锚点或 HTTPS 地址。`);
      }
    });
  }
  return errors;
}

export function validateContentFrontmatter(collection: CollectionName, data: unknown): string[] {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['内容头部必须是键值形式。'];
  const value = data as Record<string, unknown>;
  if (!isNonEmptyString(value.slug) || !SLUG_PATTERN.test(value.slug) || RESERVED_SLUGS.has(value.slug)) {
    errors.push('slug 必须是小写字母、数字和连字符的组合，且不能使用保留词。');
  }
  if (!isNonEmptyString(value.title)) errors.push('标题不能为空。');
  if (!isNonEmptyString(value.summary)) errors.push('摘要不能为空。');
  if (typeof value.draft !== 'boolean') errors.push('draft 必须是 true 或 false。');
  if (value.cover !== undefined) {
    if (typeof value.cover !== 'string' || !value.cover.trim()) errors.push('封面路径不正确。');
    if (!isNonEmptyString(value.coverAlt)) errors.push('提供封面时必须填写 coverAlt。');
  }
  if (collection === 'projects') {
    if (value.techStack !== undefined && !isStringArray(value.techStack)) errors.push('techStack 必须是非空文本数组。');
    if (value.skillIds !== undefined && !Array.isArray(value.skillIds)) errors.push('skillIds 必须是数组。');
    else if (Array.isArray(value.skillIds)) {
      for (const id of value.skillIds) {
        if (typeof id !== 'string' || !SKILL_ID_PATTERN.test(id)) errors.push(`skillIds 中的 ${String(id)} 格式不正确。`);
      }
    }
    if (typeof value.featured !== 'boolean') errors.push('featured 必须是 true 或 false。');
    if (typeof value.order !== 'number' || !Number.isInteger(value.order)) errors.push('order 必须是整数。');
    if (value.completedAt !== undefined && !isCalendarDate(value.completedAt)) errors.push('completedAt 必须是 YYYY-MM-DD 日期。');
  } else {
    if (!isCalendarDate(value.publishedAt)) errors.push('publishedAt 必须是 YYYY-MM-DD 日期。');
    if (value.updatedAt !== undefined) {
      if (!isCalendarDate(value.updatedAt)) errors.push('updatedAt 必须是 YYYY-MM-DD 日期。');
      else if (isCalendarDate(value.publishedAt) && value.updatedAt < value.publishedAt) errors.push('updatedAt 不能早于 publishedAt。');
    }
    if (!isNonEmptyString(value.category)) errors.push('分类不能为空。');
    if (value.tags !== undefined && !isStringArray(value.tags)) errors.push('tags 必须是非空文本数组。');
  }
  for (const key of ['demoUrl', 'repoUrl']) {
    const url = value[key];
    if (url !== undefined) {
      if (typeof url !== 'string' || !isHttpUrl(url, true)) errors.push(`${key} 必须是 HTTPS 地址。`);
    }
  }
  return errors;
}
