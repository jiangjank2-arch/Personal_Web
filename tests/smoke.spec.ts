import { test, expect } from '@playwright/test';

test('公开页面、详情与草稿隔离', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: '探索我的项目' }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await page.getByRole('link', { name: /MouseBatteryTray/ }).click();
  await expect(page.getByRole('heading', { name: '项目简介', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '查看源码' })).toHaveAttribute('href', 'https://github.com/jiangjank2-arch/MouseBatteryTray');
  await page.goto('/blog/getting-started/');
  await expect(page.getByRole('heading', { name: '写下你的第一篇文章' })).toBeVisible();
  for (const path of ['/blog/draft-note/', '/projects/draft-project/', '/missing-page/']) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('这片星空，还没有坐标');
  }
  expect(errors).toEqual([]);
});

test('GitHub 入口、全部公开项目和 Fork 来源', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '访问我的 GitHub 主页' })).toHaveAttribute('href', 'https://github.com/jiangjank2-arch');
  await expect(page.locator('#projects .project-card')).toHaveCount(3);
  await page.goto('/projects/');
  await expect(page.locator('.project-card')).toHaveCount(5);
  await expect(page.getByRole('link', { name: '在 GitHub 查看最新仓库' })).toHaveAttribute('href', 'https://github.com/jiangjank2-arch?tab=repositories');
  const fork = page.locator('.project-card').filter({ hasText: 'blackirlsama' });
  await expect(fork).toContainText('GITHUB / FORK');
  await fork.getByRole('link').click();
  await expect(page.getByRole('link', { name: '查看源码' })).toHaveAttribute('href', 'https://github.com/jiangjank2-arch/blackirlsama');
  await expect(page.locator('.prose')).toContainText('不将原项目成果表述为个人原创');
});

test('移动菜单、键盘和邮箱复制降级', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
  });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /菜单/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '联系', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: '复制邮箱' }).click();
  await expect(page.getByRole('status')).toContainText('手动复制');
});

test('邮箱复制成功反馈', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() } });
  });
  await page.goto('/#contact');
  await page.getByRole('button', { name: '复制邮箱' }).click();
  await expect(page.getByRole('status')).toHaveText('邮箱已复制。');
});

test('多端无横向溢出，减少动态效果生效', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('.star').first()).toHaveCSS('animation-name', 'none');
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/blog/getting-started/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('关闭 JavaScript 仍能浏览核心内容和导航', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/');
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '博客', exact: true }).click();
  await page.getByRole('link', { name: /从这里开始/ }).click();
  await expect(page.locator('.prose')).toContainText('Hello, Personal Web!');
  await context.close();
});

