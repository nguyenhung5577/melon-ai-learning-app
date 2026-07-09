import { test, expect } from '@playwright/test';

test.describe('Phân hệ Quản trị viên (ML-ADM)', () => {
  test.beforeEach(async ({ page }) => {
    // Auto Login trước mỗi test case của Admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@melon.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Đăng nhập")');
  });

  test('ADM-01 & ADM-02: Truy cập Dashboard và Tìm kiếm User', async ({ page }) => {
    await expect(page).toHaveURL(/.*\/admin/);
    
    // Điều hướng tới trang Quản lý User
    await page.goto('/admin/users');
    
    // Gõ text vào ô Search
    await page.fill('input[placeholder*="tìm"]', 'kidpro@melon.com');
    
    // Assert: Kỳ vọng tìm thấy email trong bảng (Sẽ FAIL nếu DB lỗi)
    await expect(page.locator('body')).toContainText('kidpro@melon.com');
  });
});
