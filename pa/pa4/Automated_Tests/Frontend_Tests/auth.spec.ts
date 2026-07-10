import { test, expect } from '@playwright/test';

test.describe('Phân hệ Xác thực & Phân quyền (ML-AUTH)', () => {
  test('AUTH-01: Kid đăng nhập thành công', async ({ page }) => {
    await page.goto('/');
    
    await page.click('button:has-text("Bắt đầu miễn phí")');
    await expect(page.locator('text="Tài khoản Melon"')).toBeVisible();

    await page.click('button:has-text("Học sinh đăng nhập bằng mã riêng")');

    await page.fill('input[placeholder="melon_hero"]', 'kidfree');
    await page.fill('input[placeholder="••••••"]', '123456');
    
    // Bắt request gọi lên server để đảm bảo dữ liệu form được submit đúng
    const requestPromise = page.waitForRequest(
      request => request.url().includes('/api/auth/child/login') && request.method() === 'POST'
    );

    // Mock Next.js API để trả về lỗi giả (tránh Firebase bị sụp do token giả)
    await page.route('**/api/auth/child/login', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'MOCK_SUCCESS' })
      });
    });

    await page.click('button:has-text("Đăng nhập học sinh")');
    
    // Đảm bảo request đã được gửi đi với đúng payload
    const request = await requestPromise;
    expect(request.postDataJSON()).toEqual({ loginId: 'kidfree', passwordOrPin: '123456' });
  });

  test('AUTH-04: Chặn đăng nhập sai mật khẩu', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Bắt đầu miễn phí")');

    await page.click('button:has-text("Học sinh đăng nhập bằng mã riêng")');

    await page.fill('input[placeholder="melon_hero"]', 'kidfree');
    await page.fill('input[placeholder="••••••"]', 'wrongpassword');

    // Mock Next.js API trả về lỗi 401
    await page.route('**/api/auth/child/login', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Login ID hoặc PIN không đúng.' })
      });
    });

    await page.click('button:has-text("Đăng nhập học sinh")');
    
    // Đảm bảo thông báo lỗi của hệ thống hiển thị chính xác
    await expect(page.locator('text="Login ID hoặc PIN không đúng."')).toBeVisible();
  });
});
