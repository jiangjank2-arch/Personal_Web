// 后台管理界面逻辑：登录、数据加载、各模块表单与保存提交。

interface Skill {
  id: string;
  name: string;
  category: string;
  description: string;
  order: number;
}

interface SocialLink {
  label: string;
  url: string;
}

interface Profile {
  name: string;
  role: string;
  tagline: string;
  avatar?: string;
  bio: string[];
  email: string;
  socialLinks: SocialLink[];
}

interface NavItem {
  label: string;
  href: string;
}

interface SiteSettings {
  title: string;
  description: string;
  locale: string;
  navigation: NavItem[];
}

interface ContentItem {
  slug: string;
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

interface AdminState {
  repo: { owner: string; name: string; branch: string };
  profile: Profile;
  skills: Skill[];
  site: SiteSettings;
  projects: ContentItem[];
  blog: ContentItem[];
}

type CollectionName = 'projects' | 'blog';

class UnauthorizedError extends Error {}

function $(selector: string, root: ParentNode = document): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`缺少界面元素：${selector}`);
  return element;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function api<T>(path: string, options: { method?: string; json?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['X-Admin-Request'] = '1';
  }
  const response = await fetch(path, {
    method,
    headers,
    body: options.json === undefined ? undefined : JSON.stringify(options.json),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(data.error || `请求失败（${response.status}）。`);
  return data;
}

// ---------- 全局状态与通用界面 ----------

let state: AdminState | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function showToast(message: string, isError = false): void {
  const toast = $('[data-toast]');
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 5200);
}

function showLogin(): void {
  $('[data-app-view]').hidden = true;
  $('[data-login-view]').hidden = false;
}

function showApp(): void {
  $('[data-login-view]').hidden = true;
  $('[data-app-view]').hidden = false;
}

const VIEW_TITLES: Record<string, string> = {
  dashboard: '仪表盘',
  profile: '个人信息',
  skills: '技能管理',
  projects: '项目管理',
  blog: '博客管理',
  site: '站点设置',
};

function showView(name: string): void {
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((section) => {
    section.hidden = section.dataset.view !== name;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((button) => {
    button.setAttribute('aria-current', String(button.dataset.nav === name));
  });
  $('[data-view-title]').textContent = VIEW_TITLES[name] ?? '管理后台';
}

async function reloadState(): Promise<void> {
  state = await api<AdminState>('/api/admin/state/');
  const repo = state.repo;
  $('[data-repo-hint]').textContent = `仓库：${repo.owner}/${repo.name} · ${repo.branch}`;
  renderDashboard();
  fillProfileForm();
  renderSkillsTable();
  renderContentTable('projects');
  renderContentTable('blog');
  fillSiteForm();
}

// ---------- 登录 ----------

$('[data-login-form]').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const password = new FormData(form).get('password');
  const errorNode = $('[data-login-error]');
  errorNode.textContent = '';
  try {
    await api('/api/admin/login/', { method: 'POST', json: { password: String(password ?? '') } });
    form.reset();
    await reloadState();
    showApp();
    showView('dashboard');
  } catch (error) {
    errorNode.textContent = error instanceof UnauthorizedError ? '密码不正确。' : errorMessage(error);
  }
});

$('[data-logout]').addEventListener('click', async () => {
  await api('/api/admin/logout/', { method: 'POST', json: {} }).catch(() => undefined);
  state = null;
  showLogin();
});

document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.nav ?? 'dashboard'));
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '发生未知错误。';
}

/** 统一处理保存操作：成功提示重新构建，401 回到登录页。 */
async function runSave(action: () => Promise<unknown>, successMessage: string): Promise<void> {
  try {
    await action();
    await reloadState();
    if (successMessage) showToast(successMessage);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      showLogin();
      showToast('登录已失效，请重新登录。', true);
      return;
    }
    showToast(errorMessage(error), true);
  }
}

// ---------- 仪表盘 ----------

function renderDashboard(): void {
  if (!state) return;
  const draftProjects = state.projects.filter((item) => item.frontmatter.draft).length;
  const draftPosts = state.blog.filter((item) => item.frontmatter.draft).length;
  const stats: [string, string | number][] = [
    ['项目总数', state.projects.length],
    ['草稿项目', draftProjects],
    ['文章总数', state.blog.length],
    ['草稿文章', draftPosts],
    ['技能数量', state.skills.length],
  ];
  $('[data-stats]').innerHTML = stats
    .map(([label, value]) => `<div class="admin-stat"><strong>${value}</strong><span>${label}</span></div>`)
    .join('');
}

// ---------- 个人信息 ----------

function renderSocialLinks(links: SocialLink[]): void {
  const container = $('[data-social-links]');
  container.innerHTML = '';
  links.forEach((link, index) => {
    const row = document.createElement('div');
    row.className = 'admin-repeat-row';
    row.innerHTML = `
      <input class="admin-input" data-social-label placeholder="名称，如 GitHub" value="${esc(link.label)}" />
      <input class="admin-input" data-social-url placeholder="https://…" value="${esc(link.url)}" />
      <button class="admin-button admin-button-danger admin-button-sm" type="button" data-social-remove="${index}">删除</button>`;
    container.appendChild(row);
  });
  container.querySelectorAll<HTMLButtonElement>('[data-social-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = collectSocialLinks();
      next.splice(Number(button.dataset.socialRemove), 1);
      renderSocialLinks(next);
    });
  });
}

function collectSocialLinks(): SocialLink[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-social-links] .admin-repeat-row')).map((row) => ({
    label: ($('[data-social-label]', row) as HTMLInputElement).value.trim(),
    url: ($('[data-social-url]', row) as HTMLInputElement).value.trim(),
  })).filter((link) => link.label || link.url);
}

let currentAvatar = '';

function fillProfileForm(): void {
  if (!state) return;
  const { profile } = state;
  ($('[data-profile="name"]') as HTMLInputElement).value = profile.name;
  ($('[data-profile="role"]') as HTMLInputElement).value = profile.role;
  ($('[data-profile="tagline"]') as HTMLTextAreaElement).value = profile.tagline;
  ($('[data-profile="email"]') as HTMLInputElement).value = profile.email;
  ($('[data-profile="bio"]') as HTMLTextAreaElement).value = profile.bio.join('\n');
  currentAvatar = profile.avatar ?? '';
  updateAvatarPreview();
  renderSocialLinks(profile.socialLinks);
}

function updateAvatarPreview(): void {
  const preview = $('[data-avatar-preview]') as HTMLInputElement;
  preview.hidden = !currentAvatar;
  if (currentAvatar) preview.src = currentAvatar;
}

function collectProfile(): Profile {
  return {
    name: ($('[data-profile="name"]') as HTMLInputElement).value.trim(),
    role: ($('[data-profile="role"]') as HTMLInputElement).value.trim(),
    tagline: ($('[data-profile="tagline"]') as HTMLTextAreaElement).value,
    avatar: currentAvatar || undefined,
    bio: ($('[data-profile="bio"]') as HTMLTextAreaElement).value.split('\n').map((line) => line.trim()).filter(Boolean),
    email: ($('[data-profile="email"]') as HTMLInputElement).value.trim(),
    socialLinks: collectSocialLinks().filter((link) => link.label.trim() && link.url),
  };
}

$('[data-social-add]').addEventListener('click', () => {
  const links = collectSocialLinks();
  links.push({ label: '', url: '' });
  renderSocialLinks(links);
});

$('[data-profile-save]').addEventListener('click', () => {
  runSave(
    () => api('/api/admin/profile/', { method: 'PUT', json: collectProfile() }),
    '个人信息已保存，等待重新构建后生效。',
  );
});

$('[data-avatar-upload]').addEventListener('click', () => ($('[data-avatar-file]') as HTMLInputElement).click());
$('[data-avatar-remove]').addEventListener('click', () => {
  currentAvatar = '';
  updateAvatarPreview();
});
$('[data-avatar-file]').addEventListener('change', async (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const result = await uploadImage('avatar', file);
    currentAvatar = result.path;
    updateAvatarPreview();
    showToast('头像已上传，记得点击「保存个人信息」提交。');
  } catch (error) {
    showToast(errorMessage(error), true);
  } finally {
    (event.currentTarget as HTMLInputElement).value = '';
  }
});

async function uploadImage(space: 'avatar' | CollectionName, file: File): Promise<{ path: string }> {
  const data = await fileToBase64(file);
  return api<{ path: string }>('/api/admin/upload/', {
    method: 'POST',
    json: { space, name: file.name, data },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('读取文件失败。'));
    reader.readAsDataURL(file);
  });
}

// ---------- 技能管理 ----------

let editingSkillIndex = -1;
let skillsDraft: Skill[] = [];

function renderSkillsTable(): void {
  if (!state) return;
  skillsDraft = state.skills.map((skill) => ({ ...skill }));
  renderSkillsRows();
}

function renderSkillsRows(): void {
  const table = $('[data-skills-table]');
  const sorted = [...skillsDraft].sort((a, b) => a.order - b.order);
  const rows = sorted
    .map((skill) => {
      const index = skillsDraft.indexOf(skill);
      return `<tr>
        <td>${esc(skill.id)}</td>
        <td class="admin-cell-wrap">${esc(skill.name)}</td>
        <td>${esc(skill.category)}</td>
        <td class="admin-cell-wrap">${esc(skill.description)}</td>
        <td>${skill.order}</td>
        <td>
          <button class="admin-button admin-button-ghost admin-button-sm" type="button" data-skill-edit="${index}">编辑</button>
          <button class="admin-button admin-button-danger admin-button-sm" type="button" data-skill-delete="${index}">删除</button>
        </td>
      </tr>`;
    })
    .join('');
  table.innerHTML = `<thead><tr><th>id</th><th>名称</th><th>分类</th><th>说明</th><th>排序</th><th>操作</th></tr></thead><tbody>${rows || '<tr><td class="admin-empty">还没有技能，点击下方「新增技能」添加。</td></tr>'}</tbody>`;
  table.querySelectorAll<HTMLButtonElement>('[data-skill-edit]').forEach((button) => {
    button.addEventListener('click', () => openSkillForm(Number(button.dataset.skillEdit)));
  });
  table.querySelectorAll<HTMLButtonElement>('[data-skill-delete]').forEach((button) => {
    button.addEventListener('click', () => {
      skillsDraft.splice(Number(button.dataset.skillDelete), 1);
      renderSkillsRows();
    });
  });
}

function openSkillForm(index: number): void {
  editingSkillIndex = index;
  const card = $('[data-skill-form-card]');
  card.hidden = false;
  $('[data-skill-form-title]').textContent = index >= 0 ? '编辑技能' : '新增技能';
  const skill = index >= 0 ? skillsDraft[index] : { id: '', name: '', category: '', description: '', order: skillsDraft.length + 1 };
  ($('[data-skill="id"]') as HTMLInputElement).value = skill.id;
  ($('[data-skill="name"]') as HTMLInputElement).value = skill.name;
  ($('[data-skill="category"]') as HTMLInputElement).value = skill.category;
  ($('[data-skill="description"]') as HTMLTextAreaElement).value = skill.description;
  ($('[data-skill="order"]') as HTMLInputElement).value = String(skill.order);
  ($('[data-skill="id"]') as HTMLInputElement).focus();
}

$('[data-skill-new]').addEventListener('click', () => openSkillForm(-1));
$('[data-skill-cancel]').addEventListener('click', () => {
  $('[data-skill-form-card]').hidden = true;
  editingSkillIndex = -1;
});
$('[data-skill-apply]').addEventListener('click', () => {
  const skill: Skill = {
    id: ($('[data-skill="id"]') as HTMLInputElement).value.trim(),
    name: ($('[data-skill="name"]') as HTMLInputElement).value.trim(),
    category: ($('[data-skill="category"]') as HTMLInputElement).value.trim(),
    description: ($('[data-skill="description"]') as HTMLTextAreaElement).value.trim(),
    order: Number(($('[data-skill="order"]') as HTMLInputElement).value) || 100,
  };
  if (!skill.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.id)) {
    showToast('技能 id 必须是小写字母、数字和连字符的组合。', true);
    return;
  }
  if (!skill.name || !skill.category) {
    showToast('技能名称和分类不能为空。', true);
    return;
  }
  if (editingSkillIndex >= 0) skillsDraft[editingSkillIndex] = skill;
  else skillsDraft.push(skill);
  $('[data-skill-form-card]').hidden = true;
  editingSkillIndex = -1;
  renderSkillsRows();
});

$('[data-skills-save]').addEventListener('click', () => {
  runSave(
    () => api('/api/admin/skills/', { method: 'PUT', json: skillsDraft }),
    '技能列表已保存，等待重新构建后生效。',
  );
});

// ---------- 站点设置 ----------

function renderSiteNav(items: NavItem[]): void {
  const container = $('[data-site-nav]');
  container.innerHTML = '';
  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'admin-repeat-row';
    row.innerHTML = `
      <input class="admin-input" data-nav-label placeholder="名称，如 项目" value="${esc(item.label)}" />
      <input class="admin-input" data-nav-href placeholder="如 /projects/" value="${esc(item.href)}" />
      <button class="admin-button admin-button-danger admin-button-sm" type="button" data-nav-remove="${index}">删除</button>`;
    container.appendChild(row);
  });
  container.querySelectorAll<HTMLButtonElement>('[data-nav-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = collectSiteNav();
      next.splice(Number(button.dataset.navRemove), 1);
      renderSiteNav(next);
    });
  });
}

function collectSiteNav(): NavItem[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-site-nav] .admin-repeat-row')).map((row) => ({
    label: ($('[data-nav-label]', row) as HTMLInputElement).value.trim(),
    href: ($('[data-nav-href]', row) as HTMLInputElement).value.trim(),
  }));
}

function fillSiteForm(): void {
  if (!state) return;
  ($('[data-site="title"]') as HTMLInputElement).value = state.site.title;
  ($('[data-site="description"]') as HTMLTextAreaElement).value = state.site.description;
  ($('[data-site="locale"]') as HTMLInputElement).value = state.site.locale;
  renderSiteNav(state.site.navigation);
}

$('[data-site-nav-add]').addEventListener('click', () => {
  const items = collectSiteNav();
  items.push({ label: '', href: '' });
  renderSiteNav(items);
});

$('[data-site-save]').addEventListener('click', () => {
  const payload: SiteSettings = {
    title: ($('[data-site="title"]') as HTMLInputElement).value.trim(),
    description: ($('[data-site="description"]') as HTMLTextAreaElement).value.trim(),
    locale: ($('[data-site="locale"]') as HTMLInputElement).value.trim(),
    navigation: collectSiteNav().filter((item) => item.label && item.href),
  };
  runSave(
    () => api('/api/admin/site/', { method: 'PUT', json: payload }),
    '站点设置已保存，等待重新构建后生效。',
  );
});

// ---------- 项目与文章 ----------

let editingCollection: CollectionName = 'projects';
let editingOriginalSlug: string | null = null;

function contentTable(collection: CollectionName): HTMLElement {
  return $(`[data-${collection}-table]`);
}

function renderContentTable(collection: CollectionName): void {
  if (!state) return;
  const items = collection === 'projects' ? state.projects : state.blog;
  const table = contentTable(collection);
  if (!items.length) {
    table.innerHTML = `<tbody><tr><td class="admin-empty">还没有${collection === 'projects' ? '项目' : '文章'}。</td></tr></tbody>`;
    return;
  }
  const dateLabel = collection === 'projects' ? 'order' : '发布日期';
  const rows = items
    .map((item) => {
      const fm = item.frontmatter;
      const extra = collection === 'projects' ? String(fm.order ?? '') : String(fm.publishedAt ?? '');
      const badge = fm.draft
        ? '<span class="admin-badge admin-badge-draft">草稿</span>'
        : '<span class="admin-badge admin-badge-pub">已发布</span>';
      return `<tr>
        <td class="admin-cell-wrap">${esc(String(fm.title ?? item.slug))}</td>
        <td>${esc(item.slug)}</td>
        <td>${badge}</td>
        <td>${esc(extra)}</td>
        <td>
          <button class="admin-button admin-button-ghost admin-button-sm" type="button" data-edit-item="${esc(item.slug)}">编辑</button>
          <button class="admin-button admin-button-danger admin-button-sm" type="button" data-delete-item="${esc(item.slug)}">删除</button>
        </td>
      </tr>`;
    })
    .join('');
  table.innerHTML = `<thead><tr><th>标题</th><th>slug</th><th>状态</th><th>${dateLabel}</th><th>操作</th></tr></thead><tbody>${rows}</tbody>`;
  table.querySelectorAll<HTMLButtonElement>('[data-edit-item]').forEach((button) => {
    button.addEventListener('click', () => openContentEditor(collection, button.dataset.editItem ?? ''));
  });
  table.querySelectorAll<HTMLButtonElement>('[data-delete-item]').forEach((button) => {
    button.addEventListener('click', () => deleteContent(collection, button.dataset.deleteItem ?? ''));
  });
}

function editorRoot(collection: CollectionName): HTMLElement {
  return $(`[data-${collection === 'projects' ? 'project' : 'blog'}-editor]`);
}

function fieldRoot(collection: CollectionName): string {
  return collection === 'projects' ? 'project' : 'blog';
}

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function openContentEditor(collection: CollectionName, slug: string): void {
  editingCollection = collection;
  const root = editorRoot(collection);
  const prefix = fieldRoot(collection);
  const item = (collection === 'projects' ? state?.projects : state?.blog)?.find((entry) => entry.slug === slug);
  editingOriginalSlug = item ? item.slug : null;

  const fm = item?.frontmatter ?? {};
  const set = (key: string, value: string) => {
    const input = $(`[data-${prefix}="${key}"]`, root) as HTMLInputElement | HTMLTextAreaElement;
    input.value = value;
  };
  const setCheck = (key: string, value: boolean) => {
    ( $(`[data-${prefix}="${key}"]`, root) as HTMLInputElement).checked = value;
  };

  set('slug', String(fm.slug ?? ''));
  set('title', String(fm.title ?? ''));
  set('summary', String(fm.summary ?? ''));
  set('cover', String(fm.cover ?? ''));
  set('coverAlt', String(fm.coverAlt ?? ''));
  ($(`[data-${prefix}="body"]`, root) as HTMLTextAreaElement).value = item?.body ?? defaultBody(collection);

  if (collection === 'projects') {
    set('techStack', Array.isArray(fm.techStack) ? fm.techStack.join(', ') : '');
    set('order', String(fm.order ?? 100));
    set('completedAt', String(fm.completedAt ?? ''));
    set('demoUrl', String(fm.demoUrl ?? ''));
    set('repoUrl', String(fm.repoUrl ?? ''));
    setCheck('featured', Boolean(fm.featured));
    setCheck('draft', fm.draft !== undefined ? Boolean(fm.draft) : true);
    renderProjectSkillChecks(Array.isArray(fm.skillIds) ? fm.skillIds.map(String) : []);
  } else {
    set('publishedAt', String(fm.publishedAt ?? today()));
    set('updatedAt', String(fm.updatedAt ?? ''));
    set('category', String(fm.category ?? ''));
    set('tags', Array.isArray(fm.tags) ? fm.tags.join(', ') : '');
    setCheck('draft', fm.draft !== undefined ? Boolean(fm.draft) : true);
  }

  $(`[data-${prefix}-title]`, root).textContent = item
    ? `编辑${collection === 'projects' ? '项目' : '文章'}：${item.slug}`
    : `新建${collection === 'projects' ? '项目' : '文章'}`;
  $(`[data-${prefix}-delete]`, root).hidden = !item;
  $(`[data-${collection}-list-card]`).hidden = true;
  root.hidden = false;
  window.scrollTo({ top: 0 });
}

function defaultBody(collection: CollectionName): string {
  return collection === 'projects'
    ? '## 项目背景\n\n\n## 解决的问题\n\n\n## 个人贡献\n\n\n## 技术方案\n\n\n## 成果与后续\n'
    : '## 开始写作\n\n';
}

function renderProjectSkillChecks(selected: string[]): void {
  const container = $('[data-project-skills]');
  const skills = state?.skills ?? [];
  if (!skills.length) {
    container.innerHTML = '<span class="admin-repo-hint">尚未配置技能，请先在「技能管理」中添加。</span>';
    return;
  }
  container.innerHTML = skills
    .map(
      (skill) => `<label class="admin-check">
        <input type="checkbox" value="${esc(skill.id)}" ${selected.includes(skill.id) ? 'checked' : ''} />
        ${esc(skill.name)}（${esc(skill.id)}）
      </label>`,
    )
    .join('');
}

function closeContentEditor(collection: CollectionName): void {
  editorRoot(collection).hidden = true;
  $(`[data-${collection}-list-card]`).hidden = false;
  editingOriginalSlug = null;
}

$('[data-project-back]').addEventListener('click', () => closeContentEditor('projects'));
$('[data-blog-back]').addEventListener('click', () => closeContentEditor('blog'));
$('[data-project-new]').addEventListener('click', () => openContentEditor('projects', '__new__'));
$('[data-blog-new]').addEventListener('click', () => openContentEditor('blog', '__new__'));

function splitList(value: string): string[] {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectContent(collection: CollectionName): { frontmatter: Record<string, unknown>; body: string } {
  const root = editorRoot(collection);
  const prefix = fieldRoot(collection);
  const value = (key: string): string =>
    ($(`[data-${prefix}="${key}"]`, root) as HTMLInputElement | HTMLTextAreaElement).value.trim();
  const checked = (key: string): boolean => ($(`[data-${prefix}="${key}"]`, root) as HTMLInputElement).checked;
  const body = ($(`[data-${prefix}="body"]`, root) as HTMLTextAreaElement).value.replace(/\r\n/g, '\n');

  const cover = value('cover');
  const frontmatter: Record<string, unknown> = {
    slug: value('slug'),
    title: value('title'),
    summary: value('summary'),
    draft: checked('draft'),
  };
  if (cover) {
    frontmatter.cover = cover;
    frontmatter.coverAlt = value('coverAlt');
  }

  if (collection === 'projects') {
    const skillIds = Array.from(root.querySelectorAll<HTMLInputElement>('[data-project-skills] input:checked')).map(
      (input) => input.value,
    );
    Object.assign(frontmatter, {
      techStack: splitList(($('[data-project="techStack"]', root) as HTMLInputElement).value),
      skillIds,
      featured: checked('featured'),
      order: Number(value('order')) || 100,
    });
    if (value('completedAt')) frontmatter.completedAt = value('completedAt');
    if (value('demoUrl')) frontmatter.demoUrl = value('demoUrl');
    if (value('repoUrl')) frontmatter.repoUrl = value('repoUrl');
  } else {
    Object.assign(frontmatter, {
      publishedAt: value('publishedAt'),
      category: value('category'),
      tags: splitList(($('[data-blog="tags"]', root) as HTMLInputElement).value),
    });
    if (value('updatedAt')) frontmatter.updatedAt = value('updatedAt');
  }
  return { frontmatter, body };
}

async function saveContent(collection: CollectionName): Promise<void> {
  const { frontmatter, body } = collectContent(collection);
  if (!frontmatter.slug || !frontmatter.title || !frontmatter.summary) {
    throw new Error('slug、标题和摘要不能为空。');
  }
  const slug = String(frontmatter.slug);
  if (editingOriginalSlug && editingOriginalSlug !== slug) {
    const confirmed = window.confirm(
      `将 slug 从「${editingOriginalSlug}」改为「${slug}」会删除旧文件并创建新文件，旧链接会失效。确定继续吗？`,
    );
    if (!confirmed) return;
  }
  const label = collection === 'projects' ? '项目' : '文章';
  if (editingOriginalSlug) {
    await api(`/api/admin/content/${collection}/${encodeURIComponent(editingOriginalSlug)}/`, {
      method: 'PUT',
      json: { frontmatter, body },
    });
    showToast(`${label}已保存（${slug}），等待重新构建后生效。`);
  } else {
    await api('/api/admin/content/', { method: 'POST', json: { collection, frontmatter, body } });
    showToast(`${label}已创建（${slug}），等待重新构建后生效。`);
  }
  closeContentEditor(collection);
}

async function deleteContent(collection: CollectionName, slug: string): Promise<void> {
  const label = collection === 'projects' ? '项目' : '文章';
  if (!window.confirm(`确定删除${label}「${slug}」吗？此操作会直接从仓库中删除文件。`)) return;
  try {
    await api(`/api/admin/content/${collection}/${encodeURIComponent(slug)}/`, { method: 'DELETE', json: {} });
    closeContentEditor(collection);
    await reloadState();
    showToast(`${label}已删除，等待重新构建后生效。`);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      showLogin();
      return;
    }
    showToast(errorMessage(error), true);
  }
}

$('[data-project-save]').addEventListener('click', () => runSave(() => saveContent('projects'), ''));
$('[data-blog-save]').addEventListener('click', () => runSave(() => saveContent('blog'), ''));
$('[data-project-delete]').addEventListener('click', () => {
  if (editingOriginalSlug) void deleteContent('projects', editingOriginalSlug);
});
$('[data-blog-delete]').addEventListener('click', () => {
  if (editingOriginalSlug) void deleteContent('blog', editingOriginalSlug);
});

// 封面上传
$('[data-project-cover-upload]').addEventListener('click', () => ($('[data-project-cover-file]') as HTMLInputElement).click());
$('[data-blog-cover-upload]').addEventListener('click', () => ($('[data-blog-cover-file]') as HTMLInputElement).click());

for (const collection of ['projects', 'blog'] as const) {
  const prefix = fieldRoot(collection);
  $(`[data-${prefix}-cover-file]`).addEventListener('change', async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const result = await uploadImage(collection, file);
      ($(`[data-${prefix}="cover"]`) as HTMLInputElement).value = result.path;
      const altInput = $(`[data-${prefix}="coverAlt"]`) as HTMLInputElement;
      if (!altInput.value) altInput.placeholder = '请填写封面替代文本';
      showToast('封面已上传，保存内容后生效。');
    } catch (error) {
      showToast(errorMessage(error), true);
    } finally {
      input.value = '';
    }
  });
}

// ---------- 启动 ----------

(async () => {
  try {
    await reloadState();
    showApp();
    showView('dashboard');
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      showLogin();
      return;
    }
    showLogin();
    $('[data-login-error]').textContent = errorMessage(error);
  }
})();
