# Personal Web

基于 Astro、TypeScript、Tailwind CSS 4 和 Markdown 的个人作品网站，包含个人介绍、技能、GitHub 公开项目、博客和联系方式，采用响应式深色星空设计。PRD、技术设计文档和 AGENTS.md 保留在根目录。

## 环境与启动

- Node.js 24 LTS（当前验证版本 24.14.0）
- pnpm 10.33.0（packageManager 已固定）

克隆仓库并在项目目录中运行：

```powershell
git clone https://github.com/jiangjank2-arch/Personal_Web.git
cd Personal_Web
pnpm install --frozen-lockfile
pnpm dev
```

打开终端输出的地址，默认是 http://127.0.0.1:4321/。端口占用时 Astro 会选择其他端口，以实际输出为准。按 Ctrl+C 停止。

```sh
pnpm check       # 类型、内容字段与关联约束检查
pnpm build       # 生成 dist/，同时检查跨内容约束
pnpm preview     # 预览生产构建
pnpm test:e2e    # 基于构建产物的浏览器冒烟测试
```

首次运行浏览器测试前执行 `pnpm exec playwright install chromium firefox webkit`，并先 `pnpm build`。测试服务器使用 4322 端口，不复用已有服务。

## 目录职责

- `src/pages/`：首页、项目列表/详情、博客列表/详情/分页、404、robots。
- `src/components/`：通用导航、星空、首页模块、项目/文章卡片。
- `src/layouts/`：全局框架与文章排版。
- `src/data/`：站点配置、个人资料、技能。
- `src/content/`：Markdown 项目和文章。
- `src/content.config.ts`：字段、日期、图片和 URL 校验。
- `src/lib/content.ts`：统一草稿过滤、排序和分页常量。
- `src/assets/`：可被 Astro 优化的图片。
- `public/`：保持公开路径的静态文件。
- `scripts/check-content.mjs`：唯一 slug、技能关联与图片检查。
- `functions/`：Cloudflare Pages Functions，为 `/admin/` 后台提供登录与内容读写 API。
- `src/pages/admin/`、`src/scripts/admin.ts`：后台管理界面。
- `tests/`：路由、交互、响应式与无 JavaScript 验证。

## 在线后台管理

网站提供 `/admin/` 后台（参考界面见 PRD 附图风格），可以修改个人信息、技能、项目、文章和站点设置。保存时通过 GitHub API 直接提交到仓库主分支，Cloudflare Pages 检测到提交后自动重新构建，通常约 1 分钟后线上生效。后台修改的是与手写完全相同的数据文件（`src/data/*.json` 与 `src/content/**/*.md`），两种方式可以混用。

### 一次性配置

1. 在 GitHub → Settings → Developer settings → Personal access tokens 创建令牌：
   - 推荐 fine-grained token，只授权 `jiangjank2-arch/Personal_Web` 仓库，权限勾选 **Contents: Read and write**；
   - 或 classic token，勾选 `repo` scope。
2. 在 Cloudflare Pages 项目 → Settings → Environment variables（Production）添加：

   | 变量 | 说明 |
   | --- | --- |
   | `ADMIN_PASSWORD` | 后台登录密码 |
   | `ADMIN_SECRET` | 一串足够长的随机字符，用于签名登录会话 |
   | `GITHUB_TOKEN` | 上一步创建的令牌 |
   | `GITHUB_OWNER` | `jiangjank2-arch` |
   | `GITHUB_REPO` | `Personal_Web` |
   | `GITHUB_BRANCH` | `main`（默认可不设） |

3. 确认 Pages 项目的部署来源连接到该 GitHub 仓库（Push 触发构建），保存变量后重新部署一次。

### 使用说明

- 打开 `https://<你的域名>/admin/`，输入 `ADMIN_PASSWORD` 登录；会话有效期 7 天。
- 页面已被 `noindex` 和 robots 规则排除，不会被搜索引擎收录。
- 所有保存都会产生一条 `[admin] ...` 提交记录；草稿默认不公开，与手写内容规则一致。
- 删除技能前需先解除项目对它的引用，否则后台会拒绝保存（避免构建失败）。
- 修改已发布内容的 slug 会删除旧文件、创建新文件，旧链接会失效，需要在 `public/_redirects` 补充 301。

### 本地调试后台 API

```sh
cp .dev.vars.example .dev.vars   # 填入真实值；.dev.vars 已被 git 忽略
pnpm build
pnpm admin:dev                  # 构建后在 http://127.0.0.1:8788 启动 wrangler 本地 Pages
```

注意：本地保存会真实提交到 GitHub 并触发线上重建，请谨慎操作。

## 更新个人资料

推荐直接在 `/admin/后台「个人信息」「技能管理」` 中修改，数据保存在 `src/data/profile.json` 与 `src/data/skills.json`；也可以手改这两个 JSON 文件。首页主标题和个人定制文案位于 `src/components/home/Hero.astro`。GitHub 入口和公开仓库已接入 `jiangjank2-arch`；仍标记为示例的资料、技能或文章请按实际情况替换。

社交链接填写真实 HTTPS 地址。上传头像或封面到 `src/assets/` 后按需要引用。没有简历或真实社交账号时保持入口隐藏。

## 添加项目

在 `src/content/projects/` 添加 Markdown：

```yaml
---
slug: my-project
title: 我的项目
summary: 项目简介。
techStack: [Astro, TypeScript]
skillIds: [astro, typescript]
featured: true
order: 10
draft: true
---
```

在 frontmatter 之后写背景、解决的问题、个人贡献、技术方案和成果。可选字段有 completedAt、demoUrl、repoUrl、cover 和 coverAlt。cover 相对于 Markdown 文件填写本地路径；提供封面时必须提供 coverAlt。skillIds 必须引用技能配置中存在的 id。

## 写文章与发布草稿

在 `src/content/blog/` 添加 Markdown：

```yaml
---
slug: first-post
title: 第一篇文章
summary: 一句话摘要。
publishedAt: '2026-10-27'
category: 开发实践
tags: [Astro]
draft: true
---
```

日期必须是加引号的有效 YYYY-MM-DD 字符串，updatedAt 不能早于 publishedAt。slug 使用小写英文、数字和短横线，同集合内唯一，不使用 page、index、404。

确认内容后设置 `draft: false`，检查并重新构建。默认所有环境均隐藏草稿；不提供公开草稿预览，也不支持定时发布。两个 draft-example.md 用于展示和验证草稿规则，可在理解规则后替换。

博客第一页是 `/blog/`，每页 9 篇；达到 10 篇时自动生成 `/blog/page/2/`。项目和博客详情均使用显式 slug。

## 开发配置与部署

本地开发无需环境变量。可复制 `.env.example` 为 `.env`：

```dotenv
SITE_URL=https://你的真实域名
PUBLIC_INDEXABLE=false
PRODUCTION_BRANCH=你的正式分支名
```

- SITE_URL 未配置时不生成 canonical 和站点地图，默认禁止索引；不会使用虚假生产域名。
- 设置真实 HTTPS 域名后重新构建，生成 sitemap-index.xml 和对应 canonical。
- 正式发布并替换示例资料后，再将 PUBLIC_INDEXABLE 设置为 true。
- Cloudflare Pages 的预览环境始终设置 PUBLIC_INDEXABLE=false；同时配置真实 PRODUCTION_BRANCH，代码会阻止其他分支被索引。
- Cloudflare Pages 构建命令为 `pnpm check && pnpm build`，产物目录为 `dist`；Node/pnpm 版本与本项目保持一致。
- 全静态部署，不需要 SSR 适配器、数据库或后端密钥。
- URL 使用结尾斜杠；已发布 slug 更改时在 public/_redirects 添加对应 301 规则。
- 本次初始化不包含外部发布和域名购买。

## 当前范围

### 鼠标星光效果

- 全站启用轻量鼠标光晕、跟随光圈、移动星屑、点击涟漪；卡片悬停略微抬起。
- 保留系统鼠标，装饰层不拦截点击。文章正文中减弱光圈并停止生成星屑。
- 触屏与系统减少动态效果模式自动关闭；鼠标离开、切换窗口或键盘导航时隐藏。
- 修改外观：`src/styles/pointer-effects.css`；修改跟随速度、星屑频率：`src/scripts/pointer-effects.ts`；挂载组件：`src/components/common/PointerEffects.astro`。
- 使用固定 14 个星屑节点，动画帧仅在位置尚未收敛时运行，无新增依赖。
- 验证：类型检查与构建通过；Chromium/WebKit 共 18 项浏览器测试通过，覆盖鼠标交互及原有功能。

### GitHub 公开项目

已接入账号 `jiangjank2-arch`。首页和联系区提供 GitHub 主页入口；项目列表展示全部 5 个公开仓库，Fork 项目明确标识来源。

- `src/data/github.json`：账号、项目中文标题、摘要、展示顺序及精选配置。
- `src/data/github-repositories.json`：从 GitHub 读取的公开仓库资料快照，不包含令牌。
- `src/content/projects/github/`：导入生成的项目 Markdown，供现有静态路由读取。
- 运行 `pnpm github:import` 刷新公开仓库，然后运行 `pnpm check && pnpm build`，线上重新部署后生效。
- 导入优先使用公开 REST API；API 限流时尝试公开仓库列表页。读取失败保留原有资料，不影响浏览器或构建。
- 本工具只读取公开仓库，不需要登录或密码，不会修改或发布 GitHub 内容。
- 导入文件含 managed-by 标记，重复导入会更新这些文件。标题、摘要和功能说明请修改 github.json 中对应配置；深度案例可另建手写 Markdown。
- 原手写项目保留；未在本次仓库列表出现的旧导入页不自动删除，需要手动审核、设置 draft 或删除。
- 原 personal-web.md 初始化示例已设为草稿，文件保留。
- 本次接入验证：类型检查和构建通过；Chromium、WebKit 共 12 项测试通过，包含 GitHub 入口、5 个项目、Fork 来源、详情源码链接及移动布局。



已提供基础路由、页面框架、轻量深色星空、内容校验、响应式导航与联系交互、在线内容后台。后续工作主要是替换真实个人资料、补充实际项目与文章，并继续打磨视觉。搜索、评论、访客登录和数据库不在范围内；`/admin/` 管理后台见「在线后台管理」章节。

## 仓库文件说明

仓库包含网站源码、公开静态资源、内容数据、依赖清单与锁文件、必要配置、测试、导入脚本和项目文档。

`node_modules/`、`dist/`、`.astro/`、浏览器测试报告、日志、缓存、编辑器本地配置和真实环境变量不会提交。`.env.example` 仅提供配置项示例。克隆后使用锁文件安装依赖，并在本地重新构建。

## 初始化验证记录

- `pnpm install --frozen-lockfile` 通过，依赖锁文件可复现。
- `pnpm check` 通过：0 errors、0 warnings、0 hints；4 篇内容的关联检查通过。
- `pnpm build` 通过：生成首页、项目列表/详情、博客列表/详情、404 和 robots；草稿详情未生成。
- 开发服务的首页、项目和博客列表及详情、robots 均返回 HTTP 200。
- Chromium 与 WebKit 共 10 项冒烟测试通过，覆盖路由与草稿隔离、菜单键盘操作、邮箱复制及降级、多端布局、减少动效、无 JavaScript 浏览。
- tabbit 实际查看桌面与手机页面；320、390、768、1200、1440px 检查未发现页面横向溢出。
- Firefox 测试浏览器已安装，但本机启动时报 `browserType.launch: spawn UNKNOWN`，未能运行页面断言；不是已通过项目。可在其他可用环境执行 `pnpm test:e2e --project=firefox`。
- 本机仅运行已验证浏览器可使用 `pnpm test:e2e --project=chromium --project=webkit`。完整命令仍保留三种浏览器，便于后续跨浏览器验证。
- 尚未进行真实手机测试、节流性能测量或真实域名上线后的 SEO 验证。

