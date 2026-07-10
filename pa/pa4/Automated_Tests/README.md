# Melon AI Learning App - Automated Tests 🧪

Thư mục này tổng hợp toàn bộ các kịch bản kiểm thử tự động (Automated Scripts) đã được thiết kế và tinh chỉnh dành riêng cho dự án **Melon AI Learning App**, bao phủ cả hai phía Frontend (giao diện) và Backend (API). Các kiểm thử này đảm bảo các tính năng cốt lõi hoạt động đúng nghiệp vụ và giúp phát hiện lỗi sớm trong quá trình phát triển (CI/CD).

---

## 1. Kiểm thử Frontend (E2E Tests với Playwright)
Nằm trong thư mục `Frontend_Tests/`, sử dụng framework **Playwright** để mô phỏng lại toàn bộ hành vi của người dùng thực tế (Click, gõ phím, điều hướng) trên trình duyệt Chromium.

### `basic.spec.ts`
- **Mục đích**: Kiểm tra tính nguyên vẹn của trang chủ và khả năng truy cập các tính năng cốt lõi mà không bị gãy giao diện.
- **Chi tiết kịch bản**:
  - Truy cập URL gốc `/`.
  - Kiểm tra xem các tiêu đề quan trọng như *"Học thông minh", "Vui hơn"* có hiển thị đúng hay không.
  - Tìm và nhấn nút *"Bắt đầu miễn phí"* để mở Modal đăng nhập.
  - Đảm bảo Modal được mở thành công với tiêu đề *"Tài khoản Melon"*.

### `auth.spec.ts`
- **Mục đích**: Kiểm thử chuyên sâu phân hệ Xác thực (ML-AUTH), đảm bảo luồng đăng nhập của Học sinh diễn ra chính xác và an toàn.
- **Chi tiết kịch bản**:
  - **AUTH-01 (Thành công)**: Nhập thông tin tài khoản hợp lệ. Bắt lấy Request API gửi lên máy chủ (`/api/auth/child/login`) để xác minh Frontend đã đóng gói đúng Payload JSON (`loginId` và `passwordOrPin`). Sau đó giả lập kết quả trả về để không ảnh hưởng đến Firebase thật.
  - **AUTH-04 (Thất bại)**: Nhập sai mật khẩu. Giả lập Backend trả về lỗi 401. Kiểm tra xem giao diện có hiển thị đúng dòng thông báo lỗi chữ đỏ *"Login ID hoặc PIN không đúng."* cho người dùng hay không.

### `practice_flow.spec.ts`
- **Mục đích**: Kiểm thử phân hệ Luyện tập & Cá nhân hóa (ML-PERS & ML-PRAC), đảm bảo tính năng sinh đề bằng AI và tương tác làm bài không bị lỗi.
- **Chi tiết kịch bản**:
  - **PERS-01**: Truy cập thẳng vào trang `/practice` (trang này cho phép khách truy cập để dùng thử tính năng) và xác minh tiêu đề *"Luyện đề Toán"* hiển thị thành công.
  - **PRAC-01 & PRAC-03**: Giả lập dữ liệu trả về từ API Backend `/api/v1/exercise/generate` (Mocking Data) một câu hỏi trắc nghiệm `1+1=?`. Đảm bảo luồng làm bài và nộp bài chạy thông suốt đến khi URL chuyển sang `/practice`.

---

## 2. Kiểm thử Backend (Unit Tests với Pytest)
Nằm trong thư mục `Backend_Tests/`, sử dụng framework **Pytest** và `pytest-asyncio` (hoặc `anyio`) để kiểm tra logic xử lý nội bộ của các API và Services. Các bài test tập trung vào việc cô lập các hàm (Mocking) để đảm bảo từng Service chạy đúng chức năng của nó.

### `test_llm_service.py`
- **Mục đích**: Kiểm tra Service giao tiếp với mô hình AI (`llm_service.py`).
- **Chi tiết kịch bản**:
  - Mock module OpenAI (`AsyncOpenAI` client) và OpenRouter để hệ thống không thực sự mất tiền gọi API ra ngoài mạng.
  - Gọi hàm sinh câu hỏi (`_call_chat_completion` / `generate_text`) và kiểm tra xem Service có trả về đúng định dạng JSON phản hồi từ Mock Data hay không.
  - Đảm bảo việc lựa chọn LLM Provider (OpenRouter vs OpenAI) hoạt động đúng như được cấu hình.

### `test_problem_parser.py`
- **Mục đích**: Kiểm tra thuật toán bóc tách dữ liệu từ file ảnh/pdf (`problem_parser_service.py`).
- **Chi tiết kịch bản**:
  - Sử dụng module `unittest.mock` để giả lập các thư viện hệ thống như `fitz` (PyMuPDF) nhằm tránh lỗi văng DLL trên môi trường Windows.
  - Cung cấp một Base64 hình ảnh giả vào hàm `parse_problem_sources`.
  - Giả lập `_parse_with_openai_` trả về chuỗi JSON bóc tách bài toán và kiểm tra xem Service có phân giải thành mảng Python hợp lệ không.
  - Đảm bảo nếu AI trả về lỗi (như JSON hỏng hoặc `ValueError`), Service biết cách bắt lỗi và xử lý ngoại lệ thay vì sụp hệ thống.

### `test_main.py`
- **Mục đích**: Kiểm thử Integration các Endpoint của FastAPI.
- **Chi tiết kịch bản**:
  - Sử dụng `TestClient` của FastAPI để bắn HTTP Request trực tiếp vào các Endpoint nội bộ.
  - Cụ thể ở đây đang kiểm tra Endpoint Text-to-Speech (TTS) `/api/tts/generate`: gửi Request thiếu Payload `text` để kiểm tra khả năng Validation (Bắt lỗi 422 Unprocessable Entity) của Pydantic có hoạt động đúng hay không.

---

## Cách chạy các kiểm thử này

### Đối với Frontend (Playwright)
```bash
# Di chuyển vào thư mục Frontend
cd src/web

# Chạy toàn bộ các test ngầm (Headless)
npx playwright test tests/e2e/

# Chạy có giao diện để quan sát
npx playwright test tests/e2e/ --ui
```

### Đối với Backend (Pytest)
```bash
# Di chuyển vào thư mục Backend
cd src/melon-ai-backend

# Kích hoạt môi trường ảo (nếu có)
.venv\Scripts\activate

# Chạy toàn bộ bài test
python -m pytest tests/ -v
```
