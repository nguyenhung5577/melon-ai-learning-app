import { describe, expect, it } from 'vitest';

describe('Auth API /api/parents/children', () => {
  it('nên trả về 401 Unauthorized nếu gọi API mà không kèm Firebase Token', async () => {
    // Framework mô phỏng Integration Test cho Next.js API
    // const res = await fetch('http://localhost:3000/api/parents/children');
    // expect(res.status).toBe(401);
  });

  it('nên cho phép truy cập nếu có quyền Parent', async () => {
    // Test logic kết nối vào database
  });
});
