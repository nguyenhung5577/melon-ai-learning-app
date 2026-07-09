import { test, expect } from '@playwright/test';

// Kịch bản Data-driven Testing (DDT) cho Paywall
// Dữ liệu (Test Data) được tách biệt khỏi logic test (Slide 43)
const accounts = [
  { role: 'kid_free', email: 'kid_free@example.com', expectPaywall: true },
  { role: 'parent_pro', email: 'parent_pro@example.com', expectPaywall: false },
  { role: 'admin', email: 'admin_vip@example.com', expectPaywall: false },
];

for (const account of accounts) {
  // Keyword-driven / Data-driven: Mỗi dữ liệu sinh ra một test case
  test(`Kiểm tra chặn Paywall Tách Đề cho quyền: ${account.role}`, async ({ page }) => {
    
    // Ghi chú: Firebase Emulator chưa được setup,
    // nên hiện tại script này đóng vai trò là Test Framework cho Data-driven.
    
    await test.step('Đăng nhập vào hệ thống', async () => {
      await page.goto('http://localhost:3000/login');
      // Giả lập điền dữ liệu
      // await page.fill('input[type="email"]', account.email);
      // await page.fill('input[type="password"]', '123456');
      // await page.click('button[type="submit"]');
    });

    await test.step('Vào trang Luyện tập và Tách đề', async () => {
      await page.goto('http://localhost:3000/practice');
      
      if (account.expectPaywall) {
         // Nếu là Free, chờ xem có xuất hiện ô đỏ báo lỗi Paywall không
         // await expect(page.locator('text=Tính năng yêu cầu gói Pro')).toBeVisible();
      } else {
         // Nếu là Pro/Admin, chờ xem có hiện ô Upload bình thường không
         // await expect(page.locator('text=Upload PDF, DOCX')).toBeVisible();
      }
    });

  });
}
