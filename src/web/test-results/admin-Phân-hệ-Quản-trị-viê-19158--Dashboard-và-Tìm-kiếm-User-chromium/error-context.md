# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> Phân hệ Quản trị viên (ML-ADM) >> ADM-01 & ADM-02: Truy cập Dashboard và Tìm kiếm User
- Location: tests\e2e\admin.spec.ts:12:7

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
  3  | test.describe('Phân hệ Quản trị viên (ML-ADM)', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Auto Login trước mỗi test case của Admin
  6  |     await page.goto('/login');
> 7  |     await page.fill('input[type="email"]', 'admin@melon.com');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  8  |     await page.fill('input[type="password"]', '123456');
  9  |     await page.click('button:has-text("Đăng nhập")');
  10 |   });
  11 | 
  12 |   test('ADM-01 & ADM-02: Truy cập Dashboard và Tìm kiếm User', async ({ page }) => {
  13 |     await expect(page).toHaveURL(/.*\/admin/);
  14 |     
  15 |     // Điều hướng tới trang Quản lý User
  16 |     await page.goto('/admin/users');
  17 |     
  18 |     // Gõ text vào ô Search
  19 |     await page.fill('input[placeholder*="tìm"]', 'kidpro@melon.com');
  20 |     
  21 |     // Assert: Kỳ vọng tìm thấy email trong bảng (Sẽ FAIL nếu DB lỗi)
  22 |     await expect(page.locator('body')).toContainText('kidpro@melon.com');
  23 |   });
  24 | });
  25 | 
```