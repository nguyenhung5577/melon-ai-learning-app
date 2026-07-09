# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: practice_flow.spec.ts >> Phân hệ Luyện tập & Cá nhân hóa >> PERS-01: Hiển thị Đề Luyện Cân Bằng cho user mới
- Location: tests\e2e\practice_flow.spec.ts:12:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "404" [level=1] [ref=e4]
    - heading "This page could not be found." [level=2] [ref=e6]
  - region "Notifications alt+T"
  - generic [ref=e7]:
    - img [ref=e9]
    - button "Open Tanstack query devtools" [ref=e57] [cursor=pointer]:
      - img [ref=e58]
  - button "Open Next.js Dev Tools" [ref=e111] [cursor=pointer]:
    - img [ref=e112]
  - alert [ref=e115]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Phân hệ Luyện tập & Cá nhân hóa', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Tự động login Kid Pro
  6  |     await page.goto('/login');
> 7  |     await page.fill('input[type="email"]', 'kidpro@melon.com');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  8  |     await page.fill('input[type="password"]', '123456');
  9  |     await page.click('button:has-text("Đăng nhập")');
  10 |   });
  11 | 
  12 |   test('PERS-01: Hiển thị Đề Luyện Cân Bằng cho user mới', async ({ page }) => {
  13 |     await page.goto('/practice');
  14 |     await expect(page.locator('text="Luyện cân bằng"')).toBeVisible();
  15 |   });
  16 | 
  17 |   test('PRAC-01 & PRAC-03: Chọn đáp án trắc nghiệm và Nộp bài', async ({ page }) => {
  18 |     // Đánh chặn (Intercept) API để giả lập AI trả về 1 câu hỏi Toán
  19 |     await page.route('**/api/v1/exercise/generate', route => {
  20 |       route.fulfill({
  21 |         status: 200,
  22 |         contentType: 'application/json',
  23 |         body: JSON.stringify({ 
  24 |           id: 'ex-123', 
  25 |           questions: [{ 
  26 |             id: 'q1', stem: '1+1=?', type: 'multiple_choice', 
  27 |             choices: [{key: 'A', text: '1'}, {key: 'B', text: '2'}], 
  28 |             answer: 'B' 
  29 |           }]
  30 |         })
  31 |       });
  32 |     });
  33 | 
  34 |     await page.goto('/practice');
  35 |     await page.click('button:has-text("Luyện cân bằng")'); // Bắt đầu làm bài
  36 |     
  37 |     // Đợi câu hỏi render và Bấm đáp án B
  38 |     await page.click('button:has-text("B.")');
  39 |     
  40 |     // Bấm Nộp bài
  41 |     await page.click('button:has-text("Nộp bài")');
  42 |     
  43 |     // Kỳ vọng hệ thống chấm điểm và báo "Hoàn thành"
  44 |     await expect(page.locator('text="Hoàn thành"')).toBeVisible();
  45 |   });
  46 | });
  47 | 
```