import { test, expect } from '@playwright/test';

async function gotoLoginAndHydrate(page: any) {
  await page.goto('/login');
  // Wait for Next.js hydration to complete so React event listeners are fully attached
  await page.waitForTimeout(2000);
}

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER EXCEPTION:', err.message, err.stack));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  });
  test('should display login page successfully', async ({ page }) => {
    await gotoLoginAndHydrate(page);
    
    // Check header
    const loginHeader = page.locator('h2', { hasText: '邮箱登录' });
    await expect(loginHeader).toBeVisible();

    // Check email & password fields
    const emailInput = page.locator('input[placeholder="请输入邮箱"]');
    const passwordInput = page.locator('input[placeholder="请输入密码"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await gotoLoginAndHydrate(page);

    // Fill in credentials (seeded using our db:seed script)
    await page.locator('input[placeholder="请输入邮箱"]').fill('vipuser@example.com');
    await page.locator('input[placeholder="请输入密码"]').fill('password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify redirection to home page
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should toggle to register mode and display register fields', async ({ page }) => {
    await gotoLoginAndHydrate(page);

    // Click register mode switch
    await page.click('text=没有账号？去注册');

    // Header changes to register
    const registerHeader = page.locator('h2', { hasText: '注册账号' });
    await expect(registerHeader).toBeVisible();

    // Check username field is visible in register mode
    const usernameInput = page.locator('input[placeholder="请输入用户名（至少3个字符）"]');
    await expect(usernameInput).toBeVisible();
  });
});
