import { test, expect } from '@playwright/test';

test('鼠标光效跟随、悬停及点击不遮挡交互', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() } });
  });
  await page.goto('/');
  const overlay = page.locator('[data-pointer-effects]');
  await page.mouse.move(700, 320);
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('[data-pointer-position]')).toHaveCSS('transform', /700, 320/);
  await page.getByRole('link', { name: '探索我的项目' }).hover();
  await expect(overlay).toHaveClass(/is-hovering/);
  await page.getByRole('link', { name: '探索我的项目' }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await page.goto('/#contact');
  await page.getByRole('button', { name: '复制邮箱' }).click();
  await expect(page.getByRole('status')).toHaveText('邮箱已复制。');
  expect(errors).toEqual([]);
});

test('阅读与减少动态效果模式自动降级', async ({ page }) => {
  await page.goto('/blog/getting-started/');
  await page.locator('.prose p').first().hover();
  const overlay = page.locator('[data-pointer-effects]');
  await expect(overlay).toHaveClass(/is-reading/);
  await expect(page.locator('.pointer-star')).toHaveCSS('opacity', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(overlay).toBeHidden();
  await page.mouse.move(400, 200);
  await expect(overlay).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(overlay).toHaveAttribute('data-enabled', 'true');
  await page.mouse.move(100, 150);
  await expect(overlay).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(overlay).toBeHidden();
});

test('触屏不启用鼠标装饰层', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/');
  await page.touchscreen.tap(200, 300);
  await expect(page.locator('[data-pointer-effects]')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await context.close();
});

