# Melon AI Learning App - Automated Tests 🧪

Thư mục này chứa toàn bộ các kịch bản kiểm thử tự động (Automated Test Scripts) cho dự án Melon AI Learning App. Các kịch bản được chia làm 2 phần độc lập: **Backend Tests** (viết bằng Pytest) và **Frontend/E2E Tests** (viết bằng Playwright).

## 1. Cấu trúc thư mục

```text
Automated_Tests/
├── Backend_Tests/        # Test unit/integration cho hệ thống AI & API (Pytest)
│   ├── test_llm_service.py
│   ├── test_main.py
│   ├── test_problem_parser.py
│   ├── test_rag_service.py
│   └── test_tts_service.py
└── Frontend_Tests/       # Test E2E, Components và API cho Next.js (Playwright)
    ├── api/              # Test các Endpoint Frontend
    ├── components/       # Test các React Components độc lập
    └── e2e/              # Kịch bản End-to-End mô phỏng người dùng thật
```

## 2. Hướng dẫn chạy Test

### A. Chạy Backend Tests (Pytest)
Yêu cầu: Đã cài đặt Python 3.10+ và các thư viện trong `requirements.txt` của backend.

1. Mở Terminal và di chuyển vào thư mục `Backend_Tests`:
   ```bash
   cd Backend_Tests
   ```
2. Kích hoạt môi trường ảo (Virtual Environment) nếu có.
3. Chạy lệnh pytest:
   ```bash
   pytest -v
   ```
   *Kết quả sẽ hiển thị trạng thái Pass/Fail của các core service AI (LLM, RAG, TTS, Parser).*

### B. Chạy Frontend & E2E Tests (Playwright)
Yêu cầu: Đã cài đặt Node.js và thư viện `@playwright/test`.

1. Đảm bảo hệ thống Backend (FastAPI) và Frontend (Next.js) đang được chạy ở Local.
2. Di chuyển vào thư mục chứa dự án Frontend (nơi có `playwright.config.ts`).
3. Chạy lệnh kiểm thử:
   ```bash
   # Chạy toàn bộ test
   npx playwright test

   # Chạy test với giao diện UI (Dành cho Demo)
   npx playwright test --ui
   ```
4. Xem báo cáo HTML (Test Report) sau khi chạy xong:
   ```bash
   npx playwright show-report
   ```

---
*Lưu ý: Các số liệu thống kê chi tiết, hình ảnh chụp màn hình lúc test thất bại và báo cáo đánh giá chất lượng được đính kèm ở các file `Test cases.md` và `Test report.md` trong thư mục mẹ.*
