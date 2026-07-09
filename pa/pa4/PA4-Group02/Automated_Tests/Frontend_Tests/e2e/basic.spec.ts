import { test, expect } from '@playwright/test';

test.describe('Melon AI E2E System Tests', () => {

  test('Homepage tải thành công và có nút Đăng nhập', async ({ page }) => {
    // Áp dụng Record & Playback (Slide 35)
    await page.goto('http://localhost:3000/');
    
    // Kiểm tra UI có hiển thị đúng
    await expect(page.locator('text=Đăng nhập')).toBeVisible();
    
    // Giả lập thao tác click
    await page.click('text=Đăng nhập');
    
    // Màn hình AuthModal phải hiện lên
    await expect(page.locator('text=Đăng nhập bằng Email').first()).toBeVisible();
  });

});
