# KẾ HOẠCH KIỂM THỬ (TEST PLAN) - MELON AI LEARNING APP

---

## 1. Thông tin Test nhanh

| Vai trò  | URL trang chủ            | URL Dashboard         | Tài khoản mẫu (Giả định) |
| -------- | ------------------------ | --------------------- | ------------------------ |
| Kid Free | `http://localhost:3000/` | `/study`, `/practice` | ``      |
| Kid Pro  | `http://localhost:3000/` | `/study`, `/practice` | ``       |
| Parent   | `http://localhost:3000/` | `/parent`             | ``       |
| Admin    | `http://localhost:3000/` | `/admin`              | ``        |

Quy ước: [x]: Đạt | [!]: Lỗi

---

## 2. Checklist Test Chi tiết

### 2.1. Use Case 1: Authentication & Security

| STT | Mã YC   | Vai trò    | Tên Test Case                     | Mô tả thao tác chi tiết                                            | Kết quả mong đợi (Expected)                                                                 | Trạng thái |
| --: | ------- | ---------- | --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------- |
|   1 | AUTH-01 | Kid        | Đăng nhập tài khoản Học sinh      | Mở `/login` -> Nhập email/pass của Kid -> Click Đăng nhập          | Đăng nhập thành công, URL chuyển hướng về trang chủ `http://localhost:3000/`                | [x]        |
|   2 | AUTH-02 | Parent     | Đăng nhập tài khoản Phụ huynh     | Mở `/login` -> Nhập email/pass của Parent -> Click Đăng nhập       | Đăng nhập thành công, URL chuyển hướng thẳng về `http://localhost:3000/parent`              | [x]        |
|   3 | AUTH-03 | Admin      | Đăng nhập tài khoản Quản trị viên | Mở `/login` -> Nhập email/pass của Admin -> Click Đăng nhập        | Đăng nhập thành công, URL chuyển hướng thẳng về `http://localhost:3000/admin`               | [x]        |
|   4 | AUTH-04 | All        | Chặn đăng nhập sai mật khẩu       | Mở `/login` -> Nhập email đúng, mật khẩu sai -> Click Đăng nhập    | Hiển thị thông báo màu đỏ "Login ID hoặc PIN không đúng.", không tạo session                | [x]        |
|   5 | AUTH-05 | Parent     | Parent tạo tài khoản Kid          | Phụ huynh đăng nhập -> Vào trang Quản lý -> Thêm con -> Điền thông tin  | Tài khoản Kid được tạo, tự động liên kết với Parent, ăn theo gói Free/Pro của Parent | [x]        |
|   6 | AUTH-06 | Parent     | Đăng nhập/Đăng ký Phụ Huynh | Mở Popup Đăng nhập -> Bấm Login with Google | Cấp quyền `Parent` (Tạo mới nếu chưa có) | [x]        |
|   7 | AUTH-07 | Kid        | Chặn Kid truy cập trang Parent    | Đăng nhập bằng tài khoản Kid -> Gõ URL `/parent` trên trình duyệt  | Bị đá văng về `/login`  | [x]        |
|   8 | AUTH-08 | Kid/Parent | Chặn User thường truy cập Admin   | Đăng nhập Kid hoặc Parent -> Gõ URL `/admin`                       | Chặn truy cập, hệ thống đá văng về trang chủ hoặc `/login`                                  | [!]        |
|   9 | AUTH-09 | All        | Đăng xuất khỏi hệ thống           | Đăng nhập thành công -> Bấm Avatar -> Chọn Đăng xuất               | Trình duyệt xóa Firebase Token, UI chuyển về trạng thái Guest, tự động redirect về `/login` | [x]        |

### 2.2. Use Case 2: Application Features & Payments


| STT | Mã YC   | Vai trò  | Tên Test Case                            | Mô tả thao tác chi tiết                                                                    | Kết quả mong đợi (Expected)                                                  | Trạng thái |
| --: | ------- | -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------- |
|  10 | SUBS-01 | Kid Free | Chặn Kid Free dùng tính năng Tách Đề AI  | Đăng nhập Kid Free -> Mở `/practice` -> Xem khu vực Upload                                 | Hiển thị ô màu đỏ "Tính năng yêu cầu gói Pro", nút Upload bị Disable         | [x]        |
|  11 | SUBS-02 | Kid Free | Chặn API tạo bài tập cho Kid Free        | Dùng token Kid Free gửi POST request thẳng lên `/api/v1/exercise/generate`                 | Backend trả về HTTP Status 403 (Forbidden), không sinh bài tập               | [x]        |
|  12 | SUBS-03 | Parent   | Hiển thị Bảng giá (Pricing)              | Phụ huynh truy cập URL `/pricing`                                                          | Hiển thị bảng so sánh Gói Free và Gói Pro (1 tháng / 12 tháng)               | [x]        |
|  13 | SUBS-04 | Parent   | Thanh toán gói Pro thành công qua Stripe | Bấm Nâng cấp gói Pro 1 tháng -> Chuyển sang URL Stripe Checkout -> Nhập thẻ test `4242...` | Thanh toán thành công, Stripe gọi Webhook cập nhật DB: `isPro = true`        | [!]        |
|  14 | SUBS-05 | Parent   | Stripe Portal quản lý Billing            | Bấm nút "Quản lý thanh toán" trong Profile                                                 | Chuyển hướng thành công sang giao diện Stripe Customer Portal để hủy/sửa thẻ | [!]        |
|  15 | SUBS-06 | Kid Pro  | Mở khóa Tách Đề AI cho Kid Pro           | Đăng nhập Kid Pro -> Mở `/practice`                                                        | Nút Upload sáng lên, cho phép bấm vào để chọn file PDF/Docx                  | [x]        |

### 2.3. Use Case 3: Knowledge Base & Parsing


| STT | Mã YC    | Vai trò | Tên Test Case                     | Mô tả thao tác chi tiết                                                         | Kết quả mong đợi (Expected)                                                             | Trạng thái |
| --: | -------- | ------- | --------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- |
|  16 | PARSE-01 | Kid Pro | Cảnh báo File vượt quá dung lượng | Bấm Upload -> Chọn file PDF > 20MB                                              | Hiển thị popup lỗi "File vượt quá giới hạn dung lượng", không gọi API backend           | [!]        |
|  17 | PARSE-02 | Kid Pro | Parse PDF Text thuần              | Upload file PDF có chữ có thể bôi đen -> Bấm "Đọc đề"                           | Gọi API `/parse` thành công, Backend bóc tách chính xác mảng `questions` dưới dạng JSON | [x]        |
|  18 | PARSE-03 | Kid Pro | Kích hoạt OCR cho PDF ảnh chụp    | Upload file PDF scan mờ (Không có text bôi đen được)                            | Backend kích hoạt luồng Gemini/GPT-Vision để nhận diện ký tự (OCR) và trả về JSON       | [x]        |
|  19 | PARSE-04 | Kid Pro | Phân rã Trang (Pagination)        | Upload PDF 10 trang -> Chọn Tùy chọn nâng cao -> Nhập trang "2-4" -> Bấm Đọc đề | API backend chỉ gửi ảnh trang 2, 3, 4 lên OpenRouter, bỏ qua các trang khác             | [x]        |
|  20 | PARSE-05 | Kid Pro | Cơ chế tự sửa lỗi (JSON Repair)   | (Test Backend) Gửi nội dung vỡ format JSON từ LLM vào hàm `_parse_json_object`  | Hàm bắt Exception và tự động gọi lại LLM (Prompt Repair) để trả về JSON chuẩn           | [x]        |

### 2.4. Use Case 4: Practice & Personalization


| STT | Mã YC   | Vai trò | Tên Test Case                         | Mô tả thao tác chi tiết                                             | Kết quả mong đợi (Expected)                                                                          | Trạng thái |
| --: | ------- | ------- | ------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------- |


| STT | Mã YC   | Vai trò | Tên Test Case                         | Mô tả thao tác chi tiết                                      | Kết quả mong đợi (Expected)                                                           | Trạng thái |
| --: | ------- | ------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------- |
|  21 | PRAC-01 | Kid     | Làm câu Trắc nghiệm (Multiple Choice) | Đang trong bài làm -> Click vào đáp án C -> F5 tải lại trang | Giao diện hiển thị nút C đổi màu, giữ nguyên đáp án đã chọn                           | [x]        |
|  22 | PRAC-02 | Kid     | Làm câu Điền khuyết (Short Answer)    | Tới câu điền từ -> Nhập text `125` vào ô input               | State của bài làm cập nhật giá trị `125` cho câu hỏi hiện tại                         | [x]        |
|  23 | PRAC-03 | Kid     | Nộp bài và xem kết quả                | Chọn xong hết đáp án -> Bấm Nộp bài                          | So khớp thuật toán: Đáp án đúng tô xanh, sai tô đỏ. Hiện tổng điểm (ví dụ: 8/10)      | [x]        |
|  24 | PRAC-04 | Kid     | Kích hoạt AI Tutor (RAG) cho câu sai  | Nộp bài xong -> Bấm "Hỏi Gia sư AI" ở một câu tô đỏ          | UI hiện Loading, Backend (RAG Service) trả lời giải thích step-by-step vào khung chat | [x]        |
|  25 | PRAC-05 | Kid     | Tính năng TTS (Text-to-Speech)        | Bấm icon Loa bên cạnh lời giải thích của AI                  | Trình duyệt phát ra âm thanh tiếng Việt đọc lại lời giải                              | [!]        |

### 2.5. Use Case 5: Gamification & System Administration


| STT | Mã YC   | Vai trò | Tên Test Case                     | Mô tả thao tác chi tiết                                                      | Kết quả mong đợi (Expected)                                                    | Trạng thái |
| --: | ------- | ------- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
|  26 | GAMI-01 | Kid     | Nhận EXP sau khi hoàn thành bài   | Nộp bài kiểm tra đạt 100 điểm                                                | Bảng hiển thị thông báo "Bạn nhận được 100 EXP", DB Gamification cộng dồn điểm | [x]        |
|  27 | GAMI-02 | Kid     | Chặn gian lận điểm (Spam nộp bài) | Dùng phần mềm gửi POST Request nộp bài liên tục 10 lần cho cùng 1 ID Bài tập | Hệ thống chỉ cộng EXP 1 lần duy nhất, các lần sau từ chối cộng thêm            | [x]        |
|  28 | GAMI-03 | Kid     | Thuật toán Lên cấp (Level Up)     | Kid đang ở mép Level 1 (99/100 EXP), nộp bài được 10 EXP                     | UI bùng nổ hiệu ứng Lên Cấp, hiển thị Level 2 (9/200 EXP)                      | [x]        |
|  29 | GAMI-04 | Kid     | Bảng xếp hạng (Leaderboard)       | Truy cập `/leaderboard`                                                      | Hiển thị danh sách Top Users sắp xếp giảm dần theo tổng EXP                    | [x]        |
|  30 | GAMI-05 | Kid     | Nhận Huy hiệu (Badges)            | Đạt mốc hoàn thành 5 bài học đầu tiên (Nếu có logic badge)                   | Unlock Huy hiệu "Chăm chỉ", hiển thị sáng lên trong Profile                    | [x]        |


| STT | Mã YC  | Vai trò | Tên Test Case                 | Mô tả thao tác chi tiết                                                           | Kết quả mong đợi (Expected)                                          | Trạng thái |
| --: | ------ | ------- | ----------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- |
|  31 | FAM-01 | Parent  | Xem danh sách tài khoản con   | Đăng nhập Parent -> Vào trang Quản lý Gia đình                                    | Hiển thị danh sách các tài khoản Kid do Phụ huynh đã tạo             | [!]        |



| STT | Mã YC  | Vai trò | Tên Test Case               | Mô tả thao tác chi tiết                                       | Kết quả mong đợi (Expected)                                                     | Trạng thái |
| --: | ------ | ------- | --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------- |
|  32 | ADM-01 | Admin   | Hiển thị Dashboard Quản trị | Truy cập `/admin`                                             | Load đầy đủ thông số: Tổng User, Tỷ lệ Free/Pro, Doanh thu ước tính             | [x]        |
|  33 | ADM-04 | Admin   | Xóa tài khoản               | Bấm nút Xóa vĩnh viễn (Delete) tài khoản Kid B                | Tài khoản bốc hơi khỏi DB (Hoặc đổi cờ isDeleted = true)                        | [x]        |
|  34 | ADM-05 | Admin   | Cấp quyền Pro thủ công      | Bấm Edit User -> Chỉnh cột Subscription thành Pro -> Save     | User nhận ngay quyền Pro mà không cần thanh toán Stripe                         | [x]        |
|  35 | ADM-06 | Admin   | Quản lý Ngân hàng Câu hỏi   | Mở trang Question Bank -> Bấm nút Upload PDF Thô              | Admin up PDF -> Gọi API Background Parse -> Bơm hàng loạt câu hỏi vào Kho chung | [x]        |



### 2.9. Phân hệ Bài giảng & Học tập (ML-STUDY)

| STT | Mã YC   | Vai trò | Tên Test Case                 | Mô tả thao tác chi tiết                                       | Kết quả mong đợi (Expected)                                                                      | Trạng thái |
| --: | ------- | ------- | ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |


| STT | Mã YC  | Vai trò | Tên Test Case                                  | Mô tả thao tác chi tiết                                     | Kết quả mong đợi (Expected)                                                              | Trạng thái |
| --: | ------ | ------- | ---------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
|  36 | RAG-01 | Admin   | Upload tài liệu nạp Vector (Ingestion)         | Gọi POST `/api/v1/rag/ingest` kèm file Sách Toán 10.pdf     | Dữ liệu được đẩy sang Backend FastAPI, băm nhỏ và lưu trữ thành dạng Vector Embeddings   | [x]        |
|  37 | RAG-02 | Admin   | Sinh đề trắc nghiệm tự động từ Sách (RAG Quiz) | Gọi POST `/api/v1/rag/quiz` với chủ đề "Phương trình bậc 2" | AI lôi kiến thức từ VectorDB để sinh ra đề trắc nghiệm sát với Sách giáo khoa vừa upload | [x]        |


| STT | Mã YC   | Vai trò | Tên Test Case       | Mô tả thao tác chi tiết                  | Kết quả mong đợi (Expected)                                                                | Trạng thái |
| --: | ------- | ------- | ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | ---------- |
|  38 | PROF-01 | Kid/Parent | Xem thông tin hồ sơ | Mở `/profile`                            | Load thông tin cơ bản: Tên hiển thị, Mã UID, Lớp, Avatar (Kid) hoặc Email (Parent) | [!]        |
|  39 | PROF-02 | Kid/Parent | Cập nhật thông tin  | Đổi tên thành "Học sinh Giỏi" -> Bấm Lưu | Cập nhật thành công vào Database, Tên mới xuất hiện lập tức trên Thanh điều hướng (Navbar) | [x]        |




| STT | Mã YC  | Vai trò | Tên Test Case                               | Mô tả thao tác chi tiết                                                            | Kết quả mong đợi (Expected)                                                                            | Trạng thái |
| --: | ------ | ------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |

|  40 | ERR-03 | Parent  | Hủy gói Subscription (Downgrade Gracefully) | Phụ huynh vào Stripe Portal hủy gia hạn, thời gian đăng ký vẫn còn 15 ngày         | Trạng thái `isPro` vẫn giữ nguyên là TRUE. Hệ thống chờ đúng 15 ngày sau mới giáng xuống `Free`        | [!]        |

---

**Tóm tắt trạng thái:**

- Tổng số Test Cases: 40 kịch bản.
- Đạt `[x]`: 26 kịch bản.
- Báo Lỗi `[!]`: 7 kịch bản.
