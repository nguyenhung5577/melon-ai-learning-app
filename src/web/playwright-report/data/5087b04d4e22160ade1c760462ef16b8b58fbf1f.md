# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Phân hệ Xác thực & Phân quyền (ML-AUTH) >> AUTH-07: Chặn Kid truy cập trái phép trang Parent
- Location: tests\e2e\auth.spec.ts:36:7

# Error details

```
Test timeout of 30000ms exceeded.
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
  3  | test.describe('Phân hệ Xác thực & Phân quyền (ML-AUTH)', () => {
  4  |   test('AUTH-01: Kid đăng nhập thành công chuyển về trang chủ', async ({ page }) => {
  5  |     await page.goto('/login');
  6  |     await page.fill('input[type="email"]', 'kidfree@melon.com');
  7  |     await page.fill('input[type="password"]', '123456');
  8  |     await page.click('button:has-text("Đăng nhập")');
  9  |     await expect(page).toHaveURL(/.*\/$/); // Phải về đúng trang chủ
  10 |   });
  11 | 
  12 |   test('AUTH-02: Parent đăng nhập chuyển về /parent', async ({ page }) => {
  13 |     await page.goto('/login');
  14 |     await page.fill('input[type="email"]', 'parent@melon.com');
  15 |     await page.fill('input[type="password"]', '123456');
  16 |     await page.click('button:has-text("Đăng nhập")');
  17 |     await expect(page).toHaveURL(/.*\/parent/);
  18 |   });
  19 | 
  20 |   test('AUTH-03: Admin đăng nhập chuyển về /admin', async ({ page }) => {
  21 |     await page.goto('/login');
  22 |     await page.fill('input[type="email"]', 'admin@melon.com');
  23 |     await page.fill('input[type="password"]', '123456');
  24 |     await page.click('button:has-text("Đăng nhập")');
  25 |     await expect(page).toHaveURL(/.*\/admin/);
  26 |   });
  27 | 
  28 |   test('AUTH-04: Chặn đăng nhập sai mật khẩu', async ({ page }) => {
  29 |     await page.goto('/login');
  30 |     await page.fill('input[type="email"]', 'kidfree@melon.com');
  31 |     await page.fill('input[type="password"]', 'wrongpassword');
  32 |     await page.click('button:has-text("Đăng nhập")');
  33 |     await expect(page.locator('text="Thông tin đăng nhập không chính xác"')).toBeVisible({ timeout: 5000 });
  34 |   });
  35 | 
  36 |   test('AUTH-07: Chặn Kid truy cập trái phép trang Parent', async ({ page }) => {
  37 |     // 1. Đăng nhập Kid
  38 |     await page.goto('/login');
> 39 |     await page.fill('input[type="email"]', 'kidfree@melon.com');
     |                ^ Error: page.fill: Test timeout of 30000ms exceeded.
  40 |     await page.fill('input[type="password"]', '123456');
  41 |     await page.click('button:has-text("Đăng nhập")');
  42 |     await expect(page).toHaveURL(/.*\/$/);
  43 |     
  44 |     // 2. Kid cố tình truy cập /parent
  45 |     await page.goto('/parent');
  46 |     
  47 |     // 3. Hệ thống phải đá văng ra
  48 |     await expect(page).not.toHaveURL(/.*\/parent/);
  49 |   });
  50 | });
  51 | 
```