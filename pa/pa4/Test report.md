
## Test Summary Report
- **Number of Use-Cases tested:** 5
- **Total Test Cases:** 40
- **Passed Test Cases:** 33
- **Failed Test Cases:** 7
- **Skipped/Unimplemented Test Cases:** 0

### Breakdown by Use-Case:
1. **Authentication & Security:** 9 tests (8 pass, 1 fail, 0 Skip/Unimplemented)
2. **Application Features & Payments:** 6 tests (4 pass, 2 fail, 0 Skip/Unimplemented)
3. **Knowledge Base & Parsing:** 5 tests (4 pass, 1 fail, 0 Skip/Unimplemented)
4. **Practice & Personalization:** 5 tests (4 pass, 1 fail, 0 Skip/Unimplemented)
5. **Gamification & System Administration:** 10 tests (9 pass, 1 fail, 0 Skip/Unimplemented)
6. **Bài giảng & Các tính năng khác:** 5 tests (3 pass, 2 fail, 0 Skip/Unimplemented)

---

# BÁO CÁO LỖI (BUG REPORT) - MELON AI

**Người kiểm thử:** Vũ
**Ngày báo cáo:** 21/06/2026
**Môi trường:** Localhost (Next.js + FastAPI)

Dưới đây là danh sách 8 lỗi (Bugs) nghiêm trọng được phát hiện trong quá trình chạy 40 kịch bản Test Automation. Yêu cầu team Dev ưu tiên fix gấp trước khi release!

---

## 1. Bug 01: Lỗ hổng Bảo mật IDOR Xem trộm điểm số (SEC-01)
- **Mức độ (Severity):** 🚨 CRITICAL (Nghiêm trọng)
- **Mô tả:** API lấy tiến độ học tập của người dùng không verify khớp mã Token. Học sinh A có thể dùng Postman đổi ID trên URL sang ID của Học sinh B để xem trộm điểm số và Exp của bạn đó.
- **Bước tái hiện:**
  1. Đăng nhập tài khoản Kid A, lấy Bearer Token.
  2. Dùng Postman gửi request `GET /api/v1/progress/kid_B_ID_123` kèm token của Kid A.
- **Kết quả thực tế:** API trả về 200 OK và phơi bày toàn bộ dữ liệu của Kid B.
- **Vị trí Code cần Fix:** File `src/web/app/api/v1/progress/[id]/route.ts` - Thêm logic đối chiếu `auth().uid === params.id` trước khi query DB.

## 2. Bug 02: Hủy Gói Pro thì bị Cắt Quyền Ngay Lập Tức (ERR-03)
- **Mức độ (Severity):** 🟡 Medium
- **Mô tả:** Phụ huynh mua gói Pro 30 ngày. Vừa dùng 5 ngày, Phụ huynh vào Stripe Portal ấn "Cancel Subscription" để tháng sau không tự động trừ tiền. Hệ thống Stripe bắn Webhook về và Backend lập tức đổi `isPro = false`, khóa luôn 25 ngày còn lại của học sinh.
- **Bước tái hiện:**
  1. Mua gói Pro -> Bấm Hủy Gia hạn trên Stripe.
  2. Quay lại App kiểm tra quyền.
- **Kết quả thực tế:** Mất quyền Pro ngay lập tức, nút Upload Đề bị khóa.
- **Vị trí Code cần Fix:** File `src/web/app/api/v1/stripe/webhook/route.ts` - Bắt Event `customer.subscription.deleted`, kiểm tra `cancel_at_period_end`. Nếu đúng thì không đổi `isPro` về False cho đến khi ngày hiện tại vượt quá `current_period_end`.


## 3. Bug 03: Bất đồng bộ Cập nhật trạng thái Tài khoản Pro sau khi thanh toán
- **Mức độ (Severity):** 🔴 High (Nghiêm trọng - Thất thoát quyền lợi Khách hàng)
- **Mô tả:** Sau khi Phụ huynh mua gói Pro thành công qua Stripe, tài khoản vẫn bị hiển thị là "Free" trên trang Quản lý của Admin và không sử dụng được tính năng VIP.
- **Bước tái hiện:**
  1. Dùng thẻ test Stripe mua thành công gói Pro.
  2. Truy cập vào Dashboard của Admin -> Xem danh sách Users.
- **Kết quả thực tế:** User đó vẫn ở trạng thái `Free` do dữ liệu Webhook chỉ lưu ở collection `subscriptions`.
- **Vị trí Code cần Fix:** File `src/web/app/api/v1/stripe/webhook/route.ts` - Bổ sung logic update `isPro: true` vào collection `users` hoặc đồng bộ trạng thái User Profile để Admin dashboard đọc được.

---
*Báo cáo được trích xuất tự động từ hệ thống Melon AI Testing Automation.*



## 4. Bug 04: Lộ Backdoor tự thăng cấp Admin (SEC-02)
- **Mức độ (Severity):** 🔴 CRITICAL (Cực kỳ nguy hiểm)
- **Mô tả:** Có một công cụ hỗ trợ Dev (Dev Helper) nằm chình ình ngay trên trang `/admin`. Bất kỳ người dùng thường nào (Học sinh/Phụ huynh) gõ URL `/admin` đều không bị chặn lại, mà còn được hệ thống "mời gọi" bấm nút **"SET MY ROLE TO ADMIN"** để tự biến mình thành Quản trị viên tối cao.
- **Bước tái hiện:**
  1. Đăng nhập bằng tài khoản Kid hoặc Parent.
  2. Gõ URL `http://localhost:3000/admin`.
  3. Bấm nút "SET MY ROLE TO ADMIN".
- **Kết quả thực tế:** User thường lập tức chiếm được toàn quyền Admin của hệ thống. Kịch bản Test `AUTH-08` thất bại hoàn toàn.
- **Vị trí Code cần Fix:** File giao diện của trang `/admin`. Cần XÓA NGAY LẬP TỨC component Dev Helper này, hoặc phải chặn quyền truy cập (Redirect) ngay từ Middleware trước khi render trang.


## 5. Bug 05: Thiếu chặn dung lượng File Upload (ERR-04)
- **Mức độ (Severity):** 🟡 Medium (Nguy cơ tốn bộ nhớ / Tốn phí cước AI)
- **Mô tả:** Người dùng có thể Upload file PDF nặng 22MB (vượt quá giới hạn 20MB) mà không bị cảnh báo hay chặn lại. Nếu người dùng spam file lớn, AI Backend có thể bị sập do đầy RAM (OOM) hoặc làm tốn rất nhiều cước phí gọi API (Token LLM).
- **Bước tái hiện:**
  1. Đăng nhập tài khoản Kid Pro.
  2. Bấm Upload và chọn file PDF > 20MB.
- **Kết quả thực tế:** File vẫn tải lên thành công. Kịch bản `PARSE-01` thất bại.
- **Vị trí Code cần Fix:** Thêm logic kiểm tra `if (file.size > 20 * 1024 * 1024)` ở Frontend để chặn ngay từ trình duyệt, và kiểm tra `Content-Length` ở Middleware Backend.


## 6. Bug 06: Mất tính năng Đọc Gợi ý TTS (UX-01)
- **Mức độ (Severity):** 🟢 Low (Lỗi tính năng phụ trợ / Trải nghiệm người dùng)
- **Mô tả:** Phần "Gợi ý" giải bài của AI bị thiếu nút Loa (Text-to-Speech) để phát âm thanh. Giao diện thực tế chỉ có nút "Gợi ý" và "Nháp". Đối với người dùng là Trẻ em (Kid), việc phải tự đọc các dòng text dài rất bất tiện.
- **Bước tái hiện:**
  1. Đăng nhập tài khoản Kid.
  2. Vào làm bài Luyện tập, bấm xem Gợi ý của AI.
- **Kết quả thực tế:** Không có nút Loa (TTS) để nghe đọc. Kịch bản `PRAC-05` thất bại.
- **Vị trí Code cần Fix:** File `PersonalizedExercisePanel.tsx` - Cần code thêm UI Component nút Speaker và nối API với Backend hệ thống TTS (đã được Dev xây dựng sẵn nhưng quên gắn vào UI).


## 7. Bug 07: Lỗi mâu thuẫn hiển thị số lượng con (State Sync UI)
- **Mức độ (Severity):** 🟡 Medium (Lỗi UI/UX gây nhầm lẫn nghiêm trọng)
- **Mô tả:** Trang Quản lý Gia đình hiển thị dữ liệu bất nhất (tiền hậu bất nhất). Phụ huynh House Mike đã tạo 3 tài khoản con, và hệ thống có render danh sách 3 bé ở khu vực dưới. TUY NHIÊN, Header bên trên lại báo "0 TÀI KHOẢN CON" và phần khung hiển thị chính lại báo "NO CHILDREN CREATED YET".
- **Bước tái hiện:**
  1. Đăng nhập Parent, vào trang Gia đình.
  2. Tạo 1 hoặc nhiều tài khoản con.
  3. Load lại trang để xem hiển thị.
- **Kết quả thực tế:** Màn hình chia làm 2 nửa mâu thuẫn (vừa báo có 3 con, vừa báo có 0 con). Kịch bản `FAM-01` thất bại.
- **Vị trí Code cần Fix:** File giao diện trang Family. Đồng bộ lại biến State chứa danh sách con. Kiểm tra logic render `if (children.length === 0)` để đảm bảo nó đang trỏ đúng vào biến chứa dữ liệu đã fetch từ API.


## 8. Bug 08: Lỗi sai Tiêu đề trang Profile của Phụ huynh (UX-02)
- **Mức độ (Severity):** 🟢 Low (Lỗi hiển thị Text/Hardcode)
- **Mô tả:** Khi Phụ huynh truy cập vào trang Hồ sơ của chính mình (`/profile`), hệ thống lại hiển thị tiêu đề là **"HỒ SƠ CỦA CON"** kèm dòng mô tả *"Chỉnh cách con hiển thị trong Melon"*. Lỗi này do Frontend Developer đã Code cứng (Hardcode) dòng chữ này cho mọi đối tượng thay vì thay đổi theo Vai trò.
- **Bước tái hiện:**
  1. Đăng nhập bằng tài khoản Parent.
  2. Truy cập trang Hồ sơ `/profile`.
- **Kết quả thực tế:** Tiêu đề bị sai lệch, gây buồn cười và thiếu chuyên nghiệp.
- **Vị trí Code cần Fix:** File giao diện Profile. Thêm logic `if (role === 'parent')` thì render chữ "HỒ SƠ PHỤ HUYNH".

## 9. Đề xuất Cải tiến Trải nghiệm (UX/UI & Features)
**1.** **[QUAN TRỌNG] Thiếu chức năng Tìm kiếm (Search) ở Admin:** Trang Quản trị hiện tại chưa có thanh tìm kiếm (Thất bại kịch bản `ADM-02`). Khi danh sách User dài ra, Admin sẽ không thể quản lý và thao tác được. Yêu cầu Dev phải ưu tiên code thêm ô Search by Email/Tên trước khi bàn giao.

**2.** **Thiếu tính năng Khóa/Ban tài khoản:** (Thất bại kịch bản `ADM-03`). Hiện tại Admin chỉ có thể Xóa vĩnh viễn (Delete) user chứ không thể khóa tạm thời. Việc này gây rủi ro mất dữ liệu học tập nếu Admin lỡ tay bấm nhầm hoặc chỉ muốn phạt cảnh cáo tài khoản.

**3.** **Hạn chế Đăng nhập:** Box Đăng nhập bắt buộc Phụ huynh phải xài Google Account. Sẽ rất bất tiện nếu người dùng muốn đăng ký bằng email công ty hoặc email cá nhân hệ khác. Cần thêm form điền Email/Mật khẩu để đăng ký tài khoản mới độc lập.

**4.** **Thiếu chức năng Đổi Mật khẩu/ID cho Kid:** Hiện tại không có bất kỳ nút nào để thay đổi Mật khẩu hoặc ID (Tên đăng nhập) cho tài khoản học sinh. Yêu cầu bổ sung quyền Đổi mật khẩu/ID cho con từ trang Quản lý Gia đình của Phụ huynh (hoặc từ màn hình Admin) để hỗ trợ khôi phục khi Kid quên mật khẩu.

**5.** **Thiếu phân hệ Bài giảng Lý thuyết (ML-STUDY):** Hiện tại hệ thống mới chỉ có luồng Làm bài tập/Luyện tập (Trắc nghiệm) mà thiếu hẳn luồng truyền đạt kiến thức (Video, Slide lý thuyết). Yêu cầu Dev bổ sung tính năng Học bài giảng để quy trình học tập được trọn vẹn (Kịch bản `STUD-01` tới `STUD-03` đang phải bỏ qua).

**6.** **Bất đồng nhất Ngôn ngữ (Nửa Anh nửa Việt):** Giao diện hệ thống hiện tại đang bị trộn lẫn lộn giữa Tiếng Việt và Tiếng Anh (Ví dụ như trong hình chụp: *"GIA ĐÌNH"* nhưng lại báo *"NO CHILDREN CREATED YET"*, hoặc mục *"LỚP"* nhưng option lại là *"Grade 4"*, tiêu đề là tiếng Việt nhưng lại có chữ *"CHOOSE AVATAR"*). Yêu cầu team Dev rà soát lại toàn bộ nội dung Text trên UI, thống nhất 1 ngôn ngữ duy nhất (Việt hóa 100%) hoặc xây dựng cơ chế Đa ngôn ngữ (i18n) hoàn chỉnh.