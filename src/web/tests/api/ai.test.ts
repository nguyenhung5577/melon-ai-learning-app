import { describe, expect, it } from 'vitest';

describe('AI Core API endpoints', () => {
  describe('POST /api/v1/exercise/generate', () => {
    it('nên từ chối nếu user không có quyền canGenerateQuestions', async () => {
      // Kịch bản test luồng Paywall ở cấp độ API
    });
    it('nên gọi backend sinh bài tập nếu payload đúng', async () => {});
  });

  describe('POST /api/v1/practice/generate-smart-set', () => {
    it('nên gọi backend RAG để tạo đề thi thông minh', async () => {});
  });
});
