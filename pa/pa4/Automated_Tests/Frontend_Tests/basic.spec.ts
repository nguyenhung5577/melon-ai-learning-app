import { test, expect } from '@playwright/test';

test.describe('Melon AI E2E System Tests', () => {

  test('Homepage tải thành công và hiển thị các tính năng', async ({ page }) => {
    await page.goto('/');
    
    // Kiểm tra UI có hiển thị đúng các khối tính năng
    await expect(page.locator('text="Học thông minh"').first()).toBeVisible();
    await expect(page.locator('text="Vui hơn"').first()).toBeVisible();
    await expect(page.locator('text="Gia sư AI"')).toBeVisible();
    await expect(page.locator('text="Bài học thông minh"')).toBeVisible();
    
    // Nút Bắt đầu miễn phí mở modal Auth
    await page.click('button:has-text("Bắt đầu miễn phí")');
    await expect(page.locator('text="Tài khoản Melon"')).toBeVisible();
  });

});
