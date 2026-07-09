import { test, expect } from '@playwright/test';

test.describe('Phân hệ Luyện tập & Cá nhân hóa', () => {
  test.beforeEach(async ({ page }) => {
    // Tự động login Kid Pro
    await page.goto('/login');
    await page.fill('input[type="email"]', 'kidpro@melon.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Đăng nhập")');
  });

  test('PERS-01: Hiển thị Đề Luyện Cân Bằng cho user mới', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.locator('text="Luyện cân bằng"')).toBeVisible();
  });

  test('PRAC-01 & PRAC-03: Chọn đáp án trắc nghiệm và Nộp bài', async ({ page }) => {
    // Đánh chặn (Intercept) API để giả lập AI trả về 1 câu hỏi Toán
    await page.route('**/api/v1/exercise/generate', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          id: 'ex-123', 
          questions: [{ 
            id: 'q1', stem: '1+1=?', type: 'multiple_choice', 
            choices: [{key: 'A', text: '1'}, {key: 'B', text: '2'}], 
            answer: 'B' 
          }]
        })
      });
    });

    await page.goto('/practice');
    await page.click('button:has-text("Luyện cân bằng")'); // Bắt đầu làm bài
    
    // Đợi câu hỏi render và Bấm đáp án B
    await page.click('button:has-text("B.")');
    
    // Bấm Nộp bài
    await page.click('button:has-text("Nộp bài")');
    
    // Kỳ vọng hệ thống chấm điểm và báo "Hoàn thành"
    await expect(page.locator('text="Hoàn thành"')).toBeVisible();
  });
});
