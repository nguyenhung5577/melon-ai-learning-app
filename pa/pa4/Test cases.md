# KẾ HOẠCH KIỂM THỬ (TEST PLAN) - MELON AI LEARNING APP

**Mục tiêu:** Tài liệu này liệt kê Exhaustive Test Cases (Kiểm thử Toàn diện) cho toàn bộ hệ thống Melon AI. Mỗi test case được tách biệt rõ ràng, chỉ định đích danh vai trò và kết quả cụ thể, không mô tả chung chung.

---

## 1. Thông tin Test nhanh

| Vai trò  | URL trang chủ            | URL Dashboard         | Tài khoản mẫu (Giả định) |
| -------- | ------------------------ | --------------------- | ------------------------ |
| Kid Free | `http://localhost:3000/` | `/study`, `/practice` | ``      |
| Kid Pro  | `http://localhost:3000/` | `/study`, `/practice` | ``       |
| Parent   | `http://localhost:3000/` | `/parent`             | ``       |
| Admin    | `http://localhost:3000/` | `/admin`              | ``        |

Quy ước: `[ ]`: Chưa test | `[x]`: Đạt | `[!]`: Lỗi | `[-]`: chưa code tính năng

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
|  21 | PERS-01 | Kid     | Hiển thị Đề Luyện Cân Bằng (Mặc định) | Truy cập `/practice` khi mới tạo tài khoản, chưa có lịch sử làm bài | Load khối `PersonalizedExercisePanel`, hiển thị mục tiêu: "Luyện cân bằng" do chưa có data điểm yếu. | [-]        |
|  22 | PERS-02 | Kid     | AI phân tích điểm yếu                 | Cố tình làm sai liên tục 5 câu hỏi Toán Hình học (Geometry)         | Database lưu dấu `concepts: ['geometry']` bị sai nhiều.                                              | [-]        |
|  23 | PERS-03 | Kid     | Tạo Đề Cá Nhân Hóa theo điểm yếu      | F5 tải lại trang `/practice` sau khi làm sai ở PERS-02              | Block đề xuất chuyển thành "Tập trung Hình học", API tự động sinh 5 câu Hình Học.                    | [-]        |
|  24 | PERS-04 | Kid     | Sửa lỗi font Mojibake (Encoding)      | Kéo data lỗi font từ DB (VD: `ÃÂÄÅÆ`) vào PersonalizedExercisePanel | Hàm `repairMojibake` kích hoạt, dịch lại tiếng Việt chuẩn không bị lỗi hiển thị.                     | [-]        |


| STT | Mã YC   | Vai trò | Tên Test Case                         | Mô tả thao tác chi tiết                                      | Kết quả mong đợi (Expected)                                                           | Trạng thái |
| --: | ------- | ------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------- |
|  25 | PRAC-01 | Kid     | Làm câu Trắc nghiệm (Multiple Choice) | Đang trong bài làm -> Click vào đáp án C -> F5 tải lại trang | Giao diện hiển thị nút C đổi màu, giữ nguyên đáp án đã chọn                           | [x]        |
|  26 | PRAC-02 | Kid     | Làm câu Điền khuyết (Short Answer)    | Tới câu điền từ -> Nhập text `125` vào ô input               | State của bài làm cập nhật giá trị `125` cho câu hỏi hiện tại                         | [x]        |
|  27 | PRAC-03 | Kid     | Nộp bài và xem kết quả                | Chọn xong hết đáp án -> Bấm Nộp bài                          | So khớp thuật toán: Đáp án đúng tô xanh, sai tô đỏ. Hiện tổng điểm (ví dụ: 8/10)      | [x]        |
|  28 | PRAC-04 | Kid     | Kích hoạt AI Tutor (RAG) cho câu sai  | Nộp bài xong -> Bấm "Hỏi Gia sư AI" ở một câu tô đỏ          | UI hiện Loading, Backend (RAG Service) trả lời giải thích step-by-step vào khung chat | [x]        |
|  29 | PRAC-05 | Kid     | Tính năng TTS (Text-to-Speech)        | Bấm icon Loa bên cạnh lời giải thích của AI                  | Trình duyệt phát ra âm thanh tiếng Việt đọc lại lời giải                              | [!]        |

### 2.5. Use Case 5: Gamification & System Administration


| STT | Mã YC   | Vai trò | Tên Test Case                     | Mô tả thao tác chi tiết                                                      | Kết quả mong đợi (Expected)                                                    | Trạng thái |
| --: | ------- | ------- | --------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------- |
|  30 | GAMI-01 | Kid     | Nhận EXP sau khi hoàn thành bài   | Nộp bài kiểm tra đạt 100 điểm                                                | Bảng hiển thị thông báo "Bạn nhận được 100 EXP", DB Gamification cộng dồn điểm | []        |
|  31 | GAMI-02 | Kid     | Chặn gian lận điểm (Spam nộp bài) | Dùng phần mềm gửi POST Request nộp bài liên tục 10 lần cho cùng 1 ID Bài tập | Hệ thống chỉ cộng EXP 1 lần duy nhất, các lần sau từ chối cộng thêm            | []        |
|  32 | GAMI-03 | Kid     | Thuật toán Lên cấp (Level Up)     | Kid đang ở mép Level 1 (99/100 EXP), nộp bài được 10 EXP                     | UI bùng nổ hiệu ứng Lên Cấp, hiển thị Level 2 (9/200 EXP)                      | []        |
|  33 | GAMI-04 | Kid     | Bảng xếp hạng (Leaderboard)       | Truy cập `/leaderboard`                                                      | Hiển thị danh sách Top Users sắp xếp giảm dần theo tổng EXP                    | []        |
|  34 | GAMI-05 | Kid     | Nhận Huy hiệu (Badges)            | Đạt mốc hoàn thành 5 bài học đầu tiên (Nếu có logic badge)                   | Unlock Huy hiệu "Chăm chỉ", hiển thị sáng lên trong Profile                    | []        |


| STT | Mã YC  | Vai trò | Tên Test Case                 | Mô tả thao tác chi tiết                                                           | Kết quả mong đợi (Expected)                                          | Trạng thái |
| --: | ------ | ------- | ----------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- |
|  35 | FAM-01 | Parent  | Xem danh sách tài khoản con   | Đăng nhập Parent -> Vào trang Quản lý Gia đình                                    | Hiển thị danh sách các tài khoản Kid do Phụ huynh đã tạo             | [!]        |
|  36 | FAM-02 | Parent  | Cập nhật thông tin con        | Bấm nút Chỉnh sửa (Edit) trên thẻ của một Kid -> Đổi Tên/Mật khẩu -> Lưu          | Thông tin của Kid được cập nhật thành công trên giao diện và DB      | [-]        |
|  37 | FAM-03 | Parent  | Xem biểu đồ tiến độ của con   | Bấm vào thẻ của đứa con -> Chuyển sang Tab Báo cáo/Tiến độ                        | Hiển thị biểu đồ số bài đã làm, điểm trung bình, thời gian học       | [-]        |



| STT | Mã YC  | Vai trò | Tên Test Case               | Mô tả thao tác chi tiết                                       | Kết quả mong đợi (Expected)                                                     | Trạng thái |
| --: | ------ | ------- | --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------- |
|  38 | ADM-01 | Admin   | Hiển thị Dashboard Quản trị | Truy cập `/admin`                                             | Load đầy đủ thông số: Tổng User, Tỷ lệ Free/Pro, Doanh thu ước tính             | [x]        |
|  39 | ADM-02 | Admin   | Tìm kiếm người dùng         | Truy cập `/admin/users` -> Gõ "kidpro@melon.com" vào ô search | Bảng table lọc ra đúng dòng chứa email đó                                       | [-]        |
|  40 | ADM-03 | Admin   | Khóa tài khoản (Lock/Ban)   | Bấm nút Khóa tài khoản của Kid A                              | Cột trạng thái đổi thành "Locked". Kid A F5 trình duyệt sẽ bị đăng xuất         | [-]        |
|  41 | ADM-04 | Admin   | Xóa tài khoản               | Bấm nút Xóa vĩnh viễn (Delete) tài khoản Kid B                | Tài khoản bốc hơi khỏi DB (Hoặc đổi cờ isDeleted = true)                        | [x]        |
|  42 | ADM-05 | Admin   | Cấp quyền Pro thủ công      | Bấm Edit User -> Chỉnh cột Subscription thành Pro -> Save     | User nhận ngay quyền Pro mà không cần thanh toán Stripe                         | [x]        |
|  43 | ADM-06 | Admin   | Quản lý Ngân hàng Câu hỏi   | Mở trang Question Bank -> Bấm nút Upload PDF Thô              | Admin up PDF -> Gọi API Background Parse -> Bơm hàng loạt câu hỏi vào Kho chung | [x]        |



### 2.9. Phân hệ Bài giảng & Học tập (ML-STUDY)

| STT | Mã YC   | Vai trò | Tên Test Case                 | Mô tả thao tác chi tiết                                       | Kết quả mong đợi (Expected)                                                                      | Trạng thái |
| --: | ------- | ------- | ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |
|  44 | STUD-01 | Kid     | Xem Slide Lý thuyết Bài giảng | Mở `/lessons/[id]` -> Đọc nội dung text/video -> Bấm Tiếp tục | Trình duyệt chuyển mượt mà sang Slide tiếp theo                                                  | [-]        |
|  45 | STUD-02 | Kid     | Trả lời Slide Quiz Giữa giờ   | Tới Slide Quiz -> Chọn một đáp án sai                         | Nút Tiếp tục bị mờ, UI báo lỗi màu đỏ, bắt buộc làm lại                                          | [-]        |
|  46 | STUD-03 | Kid     | Hoàn thành Bài giảng          | Bấm nút Hoàn thành ở Slide cuối cùng                          | Hệ thống ghi nhận Tiến độ (`logActivityEvent`), cộng XP, tự động quay về trang Tổng quan Bài học | [-]        |


| STT | Mã YC  | Vai trò | Tên Test Case                                  | Mô tả thao tác chi tiết                                     | Kết quả mong đợi (Expected)                                                              | Trạng thái |
| --: | ------ | ------- | ---------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
|  47 | RAG-01 | Admin   | Upload tài liệu nạp Vector (Ingestion)         | Gọi POST `/api/v1/rag/ingest` kèm file Sách Toán 10.pdf     | Dữ liệu được đẩy sang Backend FastAPI, băm nhỏ và lưu trữ thành dạng Vector Embeddings   | []        |
|  48 | RAG-02 | Admin   | Sinh đề trắc nghiệm tự động từ Sách (RAG Quiz) | Gọi POST `/api/v1/rag/quiz` với chủ đề "Phương trình bậc 2" | AI lôi kiến thức từ VectorDB để sinh ra đề trắc nghiệm sát với Sách giáo khoa vừa upload | []        |


| STT | Mã YC   | Vai trò | Tên Test Case       | Mô tả thao tác chi tiết                  | Kết quả mong đợi (Expected)                                                                | Trạng thái |
| --: | ------- | ------- | ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | ---------- |
|  49 | PROF-01 | Kid/Parent | Xem thông tin hồ sơ | Mở `/profile`                            | Load thông tin cơ bản: Tên hiển thị, Mã UID, Lớp, Avatar (Kid) hoặc Email (Parent) | [x]        |
|  50 | PROF-02 | Kid/Parent | Cập nhật thông tin  | Đổi tên thành "Học sinh Giỏi" -> Bấm Lưu | Cập nhật thành công vào Database, Tên mới xuất hiện lập tức trên Thanh điều hướng (Navbar) | [x]        |




| STT | Mã YC  | Vai trò | Tên Test Case                               | Mô tả thao tác chi tiết                                                            | Kết quả mong đợi (Expected)                                                                            | Trạng thái |
| --: | ------ | ------- | ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |

|  51 | ERR-03 | Parent  | Hủy gói Subscription (Downgrade Gracefully) | Phụ huynh vào Stripe Portal hủy gia hạn, thời gian đăng ký vẫn còn 15 ngày         | Trạng thái `isPro` vẫn giữ nguyên là TRUE. Hệ thống chờ đúng 15 ngày sau mới giáng xuống `Free`        | [!]        |

---

**Tóm tắt trạng thái:**

- Tổng số Test Cases: 51 kịch bản.
- Đạt `[x]`: 26 kịch bản.
- Báo Lỗi `[!]`: 7 kịch bản.
- Chưa code tính năng `[-]`: 11 kịch bản.
- Chưa test `[ ]`: 7 kịch bản.
