import { test, expect } from '@playwright/test';

test.describe('Phân hệ Xác thực & Phân quyền (ML-AUTH)', () => {
  test('AUTH-01: Kid đăng nhập thành công chuyển về trang chủ', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'kidfree@melon.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page).toHaveURL(/.*\/$/); // Phải về đúng trang chủ
  });

  test('AUTH-02: Parent đăng nhập chuyển về /parent', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'parent@melon.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page).toHaveURL(/.*\/parent/);
  });

  test('AUTH-03: Admin đăng nhập chuyển về /admin', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@melon.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page).toHaveURL(/.*\/admin/);
  });

  test('AUTH-04: Chặn đăng nhập sai mật khẩu', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'kidfree@melon.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page.locator('text="Thông tin đăng nhập không chính xác"')).toBeVisible({ timeout: 5000 });
  });

  test('AUTH-07: Chặn Kid truy cập trái phép trang Parent', async ({ page }) => {
    // 1. Đăng nhập Kid
    await page.goto('/login');
    await page.fill('input[type="email"]', 'kidfree@melon.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Đăng nhập")');
    await expect(page).toHaveURL(/.*\/$/);
    
    // 2. Kid cố tình truy cập /parent
    await page.goto('/parent');
    
    // 3. Hệ thống phải đá văng ra
    await expect(page).not.toHaveURL(/.*\/parent/);
  });
});
