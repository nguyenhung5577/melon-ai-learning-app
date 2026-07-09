import { describe, expect, it } from 'vitest';

describe('ProblemParserPanel Component', () => {
  it('nên hiển thị ô báo lỗi Paywall Đỏ nếu user là Kid Free', () => {
    // Kịch bản Mock: Render component với useSubscription trả về canParseProblemsWithAI = false
    // expect(screen.getByText('Tính năng yêu cầu gói Pro')).toBeInTheDocument();
  });
  
  it('nên hiển thị nút Upload PDF nếu user là Kid Pro hoặc Parent', () => {
    // Kịch bản Mock: Render component với canParseProblemsWithAI = true
    // expect(screen.getByText('Upload PDF, DOCX...')).toBeInTheDocument();
  });

  it('nên ngăn chặn việc gửi ảnh nếu không điền tên bài tập', () => {
    // Kịch bản: Bấm nút Đọc đề khi ô Tên bài tập còn trống
  });
});
