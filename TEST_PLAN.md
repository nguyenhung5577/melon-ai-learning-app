# TEST PLAN - Hệ thống thương mại điện tử bán voucher Dealzy

Nguồn trích xuất: `FIT_HCMUS_EC_Project_Assigment_2026_v1.0.pdf`.

Mục tiêu của tài liệu này là biến các yêu cầu trong đặc tả BRD thành danh sách test case có thể kiểm thử trực tiếp. Mỗi dòng là một việc cần test riêng, không gộp nhiều hành vi vào một test case.

## 1. Thông tin test nhanh

| Vai trò | URL test | Tài khoản mẫu | Mật khẩu |
|---|---|---|---|
| Customer | `http://127.0.0.1:5173` | `customer_daniel`, `customer_minh`, `customer_lan` | `123456` |
| Partner | `http://127.0.0.1:5174` | `sheraton_partner`, `fantastic_travel`, `glow_spa`, `nike_vn`, `hokkaido_sushi`, `cgv_cinemas` | `123456` |
| Admin | `http://127.0.0.1:5175/login` | `admin` | `123456` |
| Access Portal | `http://127.0.0.1:5173/access` | Không cần đăng nhập | Không cần |

Quy ước cột hoàn thành:

| Ký hiệu | Ý nghĩa |
|---|---|
| `[ ]` | Chưa test |
| `[x]` | Đã test và đạt |
| `[!]` | Đã test nhưng lỗi/chưa đạt |
| `[-]` | Không áp dụng hoặc ngoài phạm vi demo |

## 2. Checklist test chi tiết theo đặc tả

### 2.1. BR-01 - Quản lý tài khoản người dùng theo vai trò

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 1 | BR-01, BR-CUS-01, DR-01 | Customer | Đăng ký tài khoản khách hàng bằng email hợp lệ | Vào `Đăng nhập` -> `Đăng ký` -> chọn khách hàng -> nhập username mới, email mới, SĐT mới, họ tên, ngày sinh, địa chỉ -> submit | [x] | Kiểm tra tạo `Users.role=Customer` và bản ghi `Customers` |
| 2 | BR-01, BR-CUS-01 | Customer | Đăng ký khách hàng bằng số điện thoại hợp lệ | Lặp lại đăng ký với SĐT chưa tồn tại, email có thể khác -> submit | [x] | Đặc tả cho phép email hoặc SĐT |
| 3 | BR-01, BR-CUS-01, DR-01 | Customer | Chặn đăng ký trùng username | Đăng ký với username `customer_daniel` | [x] | Phải báo trùng username |
| 4 | BR-01, BR-CUS-01, DR-01 | Customer | Chặn đăng ký trùng email không phân biệt hoa thường | Đăng ký email `DANIEL@dealzy.vn` hoặc email đã tồn tại | [x] | Kiểm tra validate frontend/backend |
| 5 | BR-01, BR-CUS-01 | Customer | Chặn đăng ký thiếu trường bắt buộc | Bỏ trống username, password hoặc họ tên -> submit | [x] | Không được tạo user rỗng |
| 6 | BR-01, BR-CUS-02 | Customer | Đăng nhập khách hàng đúng thông tin | Login `customer_daniel` / `123456` | [x] | Sau login thấy tên user/menu tài khoản |
| 7 | BR-01, BR-CUS-02 | Customer | Chặn đăng nhập sai mật khẩu | Login `customer_daniel` / mật khẩu sai | [x] | Không tạo session/token |
| 8 | BR-01, BR-CUS-02 | Customer | Đăng xuất khách hàng | Login -> mở menu tài khoản -> đăng xuất | [x] | Token/user localStorage bị xóa, UI về trạng thái chưa đăng nhập |
| 9 | BR-01, BR-CUS-02 | Customer | Quản lý phiên khi truy cập trang cần đăng nhập | Chưa login -> vào `/checkout` hoặc `/profile` | [x] | Bị chuyển về `/auth?redirect=...` |
| 10 | BR-01, BR-CUS-02 | Customer | Sau login quay lại trang redirect | Chưa login -> vào `/checkout` -> login thành công | [x] | Quay lại đúng luồng checkout hoặc trang cần bảo vệ |
| 11 | BR-01, BR-CUS-02 | Customer | Cập nhật hồ sơ cá nhân | Login customer -> Profile -> sửa họ tên, email/SĐT, DOB, địa chỉ -> lưu | [x] | Dữ liệu hiển thị lại đúng sau reload |
| 12 | BR-01, BR-CUS-02 | Customer | Đổi mật khẩu thành công | Profile -> đổi mật khẩu cũ `123456` sang mật khẩu mới -> logout -> login bằng mật khẩu mới | [x] | Sau test nên đổi lại `123456` nếu dùng dữ liệu chung |
| 13 | BR-01, BR-CUS-02 | Customer | Chặn đổi mật khẩu khi nhập sai mật khẩu cũ | Profile -> nhập mật khẩu cũ sai -> lưu | [x] | Không đổi password |
| 14 | BR-01, BR-CUS-02, ASM-02 | Customer | Quên mật khẩu bằng email mô phỏng | Trang login -> Quên mật khẩu -> chọn email -> nhập email customer -> gửi | [x] | Nếu email thật không cấu hình thì kiểm thông báo lỗi hợp lý |
| 15 | BR-01, BR-CUS-02, ASM-02 | Customer | Quên mật khẩu bằng SĐT/OTP mô phỏng | Trang login -> Quên mật khẩu -> chọn SĐT -> nhập SĐT customer -> gửi OTP | [x] | Đã thiết lập mã OTP thật qua Email/SMS và tích hợp giao diện xác thực/đặt lại mật khẩu |
| 16 | BR-01, BR-PAR-01, DR-02 | Partner | Đăng ký tài khoản đối tác doanh nghiệp | Vào `/register-partner` -> nhập username mới, email, SĐT, công ty, người đại diện, MST, trụ sở, ít nhất 1 chi nhánh -> submit | [x] | Partner mới nên ở trạng thái `Pending` |
| 17 | BR-01, BR-PAR-01 | Partner | Chặn đăng ký đối tác thiếu thông tin pháp lý | Bỏ trống tên công ty hoặc MST/trụ sở -> submit | [x] | Không tạo hồ sơ đối tác thiếu dữ liệu |
| 18 | BR-01, BR-PAR-01, DR-02 | Partner | Đăng ký đối tác kèm nhiều chi nhánh | Thêm 2 chi nhánh với tên, địa chỉ, SĐT -> submit | [x] | Kiểm tra bảng/hiển thị chi nhánh |
| 19 | BR-01, BR-PAR-01 | Partner | Đối tác Pending không được đăng nhập portal | Dùng partner vừa đăng ký nhưng chưa duyệt -> login `5174` | [x] | Phải báo đang chờ xét duyệt |
| 20 | BR-01, BR-PAR-01 | Partner | Đối tác Approved đăng nhập thành công | Login `sheraton_partner` / `123456` tại `5174` | [x] | Vào được dashboard partner |
| 21 | BR-01, BR-PAR-01 | Partner | Đối tác đăng xuất | Login partner -> bấm đăng xuất | [x] | Token `partnerToken` bị xóa |
| 22 | BR-01, BR-PAR-01 | Partner | Partner cập nhật hồ sơ doanh nghiệp | Partner -> Hồ sơ đối tác -> sửa email/SĐT/công ty/người đại diện/MST/trụ sở -> lưu | [x] | Reload vẫn giữ thông tin mới |
| 23 | BR-01, BR-PAR-01 | Partner | Partner quản lý danh sách chi nhánh | Hồ sơ đối tác -> thêm/sửa/xóa chi nhánh -> lưu | [x] | Không xóa chi nhánh đã có lịch sử sử dụng nếu hệ thống chặn |
| 24 | BR-01 | Partner | Partner đổi mật khẩu | Hồ sơ/đổi mật khẩu nếu có UI, hoặc API đổi mật khẩu -> login lại | [x] | Nếu UI chưa có thì ghi `[!]` |
| 25 | BR-01, ASM-02 | Partner | Partner quên mật khẩu | Từ Partner login -> quên mật khẩu nếu có link/luồng -> email/SĐT | [x] | Đã được tích hợp đầy đủ UI và logic OTP mô phỏng trên Partner Portal |
| 26 | BR-01, BR-ADM-01, CON-03 |Admin| Admin đăng nhập đúng thông tin | Login `admin` / `123456` tại `5175/login` | [x] | Vào dashboard admin |
| 27 | BR-01, BR-ADM-01 |Admin| Admin sai mật khẩu bị chặn | Login admin với password sai | [x] | Không tạo `adminToken` |
| 28 | BR-01, BR-ADM-01 |Admin| Admin đăng xuất | Admin -> sidebar -> đăng xuất | [x] | Xóa `adminToken`, quay về `/login` |
| 29 | BR-01, BR-ADM-01, CON-03 |Admin| Không cho đăng ký Admin từ public UI | Tìm các trang đăng ký public -> thử chọn role Admin hoặc sửa request role=Admin | [x] | Public user không được tự tạo admin |
| 30 | BR-01, NFR-02 | Admin | Customer token không truy cập được Admin API | Login customer lấy token -> gọi API admin bằng token đó | [x] | Phải trả 401/403 |
| 31 | BR-01, NFR-02 | Partner | Partner token không truy cập được Admin API | Login partner -> gọi API admin | [x] | Phải trả 401/403 |
| 32 | BR-01, NFR-02 | Admin/Partner/Customer | Kiểm tra session sau refresh trang | Login từng vai trò -> refresh trình duyệt | [x] | Vẫn giữ phiên hợp lệ nếu token còn hạn |
| 33 | BR-01, NFR-02 |Admin/Partner/Customer| Kiểm tra session sau xóa token localStorage | Login -> xóa token trong DevTools -> refresh | [x] | Bị đưa về login hoặc trạng thái chưa đăng nhập |

### 2.2. BR-02 - Quản lý danh mục và nội dung voucher

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 34 | BR-02, DR-03 | Customer | Hiển thị danh mục voucher trên trang chủ/search | Mở trang chủ -> dropdown danh mục -> trang search filter danh mục | [x] | Danh mục phải có tiếng Việt dễ hiểu |
| 35 | BR-02, BR-CUS-03 | Customer | Lọc voucher theo danh mục | Search -> chọn một danh mục -> áp dụng | [x] | Chỉ hiển thị voucher thuộc danh mục |
| 36 | BR-02, BR-ADM-05 |Admin| Admin quản lý nội dung/banner/bài viết/popup/chính sách | Admin -> Nội dung -> tạo content key, title, type, body, active -> lưu | [x] | Theo BR-ADM-05 |
| 37 | BR-02, BR-ADM-05 |Admin| Admin chỉnh sửa nội dung đã tạo | Chọn item nội dung -> sửa title/body/type/active -> lưu | [x] | Dữ liệu cập nhật đúng |
| 38 | BR-02, BR-ADM-05 |Admin| Admin ẩn/hiện nội dung chính sách | Tạo nội dung active -> chuyển inactive -> kiểm danh sách | [x] | Trạng thái hiển thị rõ |
| 39 | BR-02, BR-ADM-03 |Admin| Admin tạm ngưng hoặc thay đổi trạng thái hiển thị voucher | Admin -> Voucher -> toggle visibility/suspended nếu có | [x] | Voucher tạm ngưng không được bán |
| 40 | BR-02, RB-01 | Customer | Voucher Pending/Rejected không xuất hiện ở customer | Tạo voucher pending/rejected -> mở customer search/home | [x] | Chỉ Approved, còn hiệu lực, còn tồn kho |

### 2.3. BR-03 - Mua hàng trực tuyến

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 41 | BR-03, BR-CUS-03 | Customer | Tìm kiếm voucher theo từ khóa | Search từ khóa tên voucher hoặc đối tác | [x] | Kết quả đúng từ khóa |
| 42 | BR-03, BR-CUS-03 | Customer | Lọc voucher theo khu vực | Search -> nhập khu vực/địa chỉ chi nhánh | [x] | Chỉ hiện voucher có chi nhánh phù hợp |
| 43 | BR-03, BR-CUS-03 | Customer | Lọc voucher theo giá | Nhập minPrice/maxPrice -> áp dụng | [x] | Giá bán nằm trong khoảng |
| 44 | BR-03, BR-CUS-03 | Customer | Lọc voucher theo mức giảm | Nhập minDiscount -> áp dụng | [x] | `discount_percent >= minDiscount` |
| 45 | BR-03, BR-CUS-03 | Customer | Lọc voucher theo đối tác | Chọn partner trong filter | [x] | Chỉ hiện voucher của đối tác |
| 46 | BR-03, BR-CUS-03 | Customer | Sắp xếp Deal mới | Vào `/search?sort=new` | [x] | Ưu tiên start_date/voucher mới |
| 47 | BR-03, BR-CUS-03 | Customer | Sắp xếp Bán chạy | Vào `/search?sort=best-selling` | [x] | Ưu tiên sold_count/issued_count |
| 48 | BR-03, BR-CUS-04 | Customer | Xem chi tiết voucher đầy đủ | Mở một voucher | [x] | Có tên, ảnh, giá gốc, giá bán, điều kiện, thời hạn, số lượng còn, chi nhánh, chính sách |
| 49 | BR-03, BR-CUS-05 | Customer | Thêm voucher vào giỏ hàng | Từ card/detail -> thêm vào giỏ | [x] | Số lượng giỏ tăng, animation/feedback hợp lý |
| 50 | BR-03, BR-CUS-05 | Customer | Cập nhật số lượng trong giỏ | Cart -> tăng/giảm số lượng | [x] | Tổng tiền tạm tính cập nhật đúng |
| 51 | BR-03, BR-CUS-05 | Customer | Xóa voucher khỏi giỏ | Cart -> xóa một item | [x] | Item biến mất, tổng tiền cập nhật |
| 52 | BR-03, BR-CUS-05 | Customer | Không cho số lượng giỏ vượt tồn kho | Chọn số lượng lớn hơn tồn kho | [x] | UI/backend chặn |
| 53 | BR-03, BR-CUS-06 | Customer | Tạo đơn hàng từ giỏ cho chính người mua | Login -> có item trong cart -> checkout -> nhập thông tin người mua -> đặt hàng | [x] | Tạo Orders + Order_Items |
| 54 | BR-03, BR-CUS-06 | Customer | Tạo đơn hàng dạng quà tặng/người nhận khác | Checkout -> nhập người nhận khác nếu UI hỗ trợ | [x] | Lưu shipping/receiver info |
| 55 | BR-03, BR-CUS-06, ASM-01 | Customer | Thanh toán mô phỏng thành công | Checkout -> chọn phương thức demo/VietQR/PayPal/VNPay mô phỏng -> hoàn tất | [x] | Đơn chuyển Paid hoặc luồng mô phỏng thành công |
| 56 | BR-03, BR-CUS-06, BR-ADM-04 |Customer/Admin| Thanh toán thất bại/hủy thanh toán | Tạo đơn -> chọn fail/cancel nếu có, hoặc admin chuyển trạng thái | [x] | Không phát hành voucher code |
| 57 | BR-03, RB-13 | Customer | Đơn hủy không phát hành voucher | Tạo/hủy đơn -> kiểm E-Vouchers | [x] | Không có code cho order hủy |
| 58 | BR-03, DR-04 | Customer/Admin | Thông tin đơn hàng lưu đủ dữ liệu | Sau checkout -> Admin đơn hàng hoặc DB | [x] | Có mã đơn, người mua, chi tiết, tổng tiền, phương thức, trạng thái |

### 2.4. BR-04 - Phát hành và quản lý voucher code

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 59 | BR-04, RB-05 | Customer | Chỉ phát hành voucher code sau thanh toán thành công | Tạo đơn Pending -> kiểm chưa có code; hoàn tất thanh toán -> kiểm có code | [x] | RB-05 |
| 60 | BR-04, RB-06, DR-05 | Customer | Mỗi voucher code là duy nhất | Mua nhiều quantity của cùng voucher -> kiểm mỗi item/code khác nhau | [x] | Không trùng unique_code |
| 61 | BR-04, RB-06 | Customer | Voucher code khó đoán | Quan sát nhiều code sinh ra | [x] | Code sinh ngẫu nhiên định dạng DLZ + 9 ký tự ngẫu nhiên (36^9 khả năng) |
| 62 | BR-04, BR-CUS-07 | Customer | Khách xem được voucher đã mua | Profile -> voucher/đơn hàng của tôi | [x] | Có code, trạng thái, ngày hết hạn |
| 63 | BR-04, BR-CUS-07, ASM-03 | Customer | Khách xem QR mô phỏng | Mở voucher đã mua/payment status | [x] | Có QR hoặc mã mô phỏng |
| 64 | BR-04, BR-CUS-07 | Customer | Lịch sử đơn hàng hiển thị đúng | Profile -> đơn hàng | [x] | Có order_date, tổng tiền, trạng thái, số lượng code |
| 65 | BR-04, DR-05 | Customer/Partner/Admin | Vòng đời code cập nhật đúng | Code mới: Unused -> partner xác nhận -> Used | [x] | Có issued_at, expiry_date, used_date/branch |
| 66 | BR-04, RB-08 | Customer/Partner | Code hết hạn không dùng được | Dùng code có expiry_date quá hạn hoặc chỉnh dữ liệu demo | [x] | Hệ thống từ chối xác thực |

### 2.5. BR-05 - Kiểm tra và xác thực voucher

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 67 | BR-05, BR-PAR-05, ASM-03 | Partner | Partner nhập mã để kiểm tra tình trạng voucher | Login partner -> Xác thực mã -> nhập code hợp lệ | [x] | Hiển thị voucher, trạng thái, khách hàng, hạn dùng |
| 68 | BR-05, BR-PAR-05 | Partner | Kiểm tra mã không tồn tại | Nhập code ngẫu nhiên | [x] | Báo không tìm thấy/không hợp lệ |
| 69 | BR-05, BR-PAR-05 | Partner | Kiểm tra code thuộc partner khác | Login `glow_spa` -> nhập code Sheraton | [x] | Phải từ chối hoặc không cho xác nhận |
| 70 | BR-05, BR-PAR-06, RB-09 | Partner | Xác nhận sử dụng code đúng đối tác, đúng chi nhánh | Login partner phát hành -> chọn chi nhánh của mình -> xác nhận | [x] | Code chuyển Used |
| 71 | BR-05, RB-07 | Partner | Không cho dùng lại code đã Used | Nhập lại code vừa xác nhận | [x] | Báo đã sử dụng |
| 72 | BR-05, RB-08 | Partner | Không cho dùng code bị hủy/khóa/hết hạn | Dùng code trạng thái Cancelled/Expired/Locked nếu có dữ liệu | [x] | Từ chối |
| 73 | BR-05, RB-09 | Partner | Không cho xác nhận tại chi nhánh không thuộc chương trình | Chọn branch khác nếu UI/API cho phép | [x] | Backend phải chặn |
| 74 | BR-05, DR-05 | Partner/Admin | Nhật ký sử dụng code được ghi nhận | Sau xác nhận -> xem report/code detail/DB | [x] | Có used_date, used_at_branch_id |

### 2.6. BR-06 - Kiểm duyệt và giám sát hệ thống

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 75 | BR-06, BR-ADM-02 |Admin| Duyệt hồ sơ đối tác Pending | Đăng ký partner mới -> Admin -> Duyệt đối tác -> phê duyệt | [x] | Partner status Approved |
| 76 | BR-06, BR-ADM-02 |Admin| Từ chối hồ sơ đối tác Pending | Đăng ký partner mới -> Admin -> từ chối | [x] | Partner status Rejected, partner login bị chặn |
| 77 | BR-06, BR-ADM-02 |Admin| Khóa/mở khóa đối tác | Admin -> User/Partner management -> khóa partner -> thử login | [x] | Partner bị khóa không truy cập được |
| 78 | BR-06, BR-ADM-02 |Admin| Quản lý chi nhánh đối tác | Admin xem/sửa chi nhánh nếu có UI | [x] | Nếu chưa có UI thì ghi thiếu |
| 79 | BR-06, BR-ADM-03, RB-01 |Admin| Duyệt voucher Pending | Partner tạo voucher -> Admin duyệt | [x] | Voucher Approved và xuất hiện customer |
| 80 | BR-06, BR-ADM-03 |Admin| Từ chối voucher kèm lý do | Admin -> Voucher -> Reject -> nhập lý do | [x] | Partner thấy kết quả/lý do nếu UI hỗ trợ |
| 81 | BR-06, BR-ADM-03 |Admin| Thay đổi trạng thái hiển thị voucher | Admin toggle visibility/suspended | [x] | Customer không mua được voucher bị ẩn |
| 82 | BR-06, BR-ADM-04 |Admin| Tra cứu đơn hàng | Admin -> Đơn hàng -> tìm theo mã đơn/khách/email/SĐT | [x] | Kết quả đúng |
| 83 | BR-06, BR-ADM-04 |Admin| Đổi trạng thái thanh toán thành Paid | Admin chọn order Pending -> Paid | [x] | Có log và phát hành/hiển thị e-voucher theo thiết kế |
| 84 | BR-06, BR-ADM-04, RB-13 |Admin| Hủy đơn hàng | Admin -> order -> Cancelled | [x] | Không phát hành code mới |
| 85 | BR-06, BR-ADM-04, RB-14 |Admin| Ghi nhận hoàn tiền mô phỏng | Admin -> order -> Refunded | [x] | Order status/refund note cập nhật |
| 86 | BR-06, BR-ADM-01 |Admin| Tra cứu người dùng | Admin -> Người dùng -> search/filter role/status | [x] | Hiển thị đúng customer/partner/admin |
| 87 | BR-06, BR-ADM-01 |Admin| Khóa/mở khóa tài khoản người dùng | Admin -> chọn user -> lock/unlock | [x] | Login của user bị ảnh hưởng đúng |
| 88 | BR-06, BR-ADM-01, NFR-02 |Admin| Phân quyền người dùng | Thử gọi API admin bằng customer/partner token | [x] | Chặn truy cập |

### 2.7. BR-07 - Báo cáo và phân tích

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 89 | BR-07, BR-ADM-06, KPI-04 |Admin| Dashboard admin hiển thị tổng quan | Admin -> Dashboard | [x] | Có người dùng, đối tác, voucher, đơn hàng, doanh thu |
| 90 | BR-07, BR-ADM-06 |Admin| Dashboard cập nhật sau khi phát sinh đơn | Ghi nhận order mới -> reload dashboard | [x] | Chỉ số thay đổi hợp lý |
| 91 | BR-07, BR-PAR-07 | Partner | Partner xem dashboard doanh thu/voucher | Partner -> Tổng quan | [x] | Có doanh thu, voucher đang bán, chờ duyệt, mã đã dùng |
| 92 | BR-07, BR-PAR-07 | Partner | Partner xem báo cáo từng voucher | Partner -> Báo cáo | [x] | Có phát hành, tồn, đã bán, đã dùng, doanh thu |
| 93 | BR-07, BR-PAR-07 | Partner | Báo cáo partner không lộ dữ liệu partner khác | Login `glow_spa` -> báo cáo | [x] | Chỉ thấy voucher/code của Glow |
| 94 | BR-07, KPI-03 | Partner | Báo cáo phản ánh code đã xác thực | Xác nhận 1 code -> reload báo cáo | [x] | Số đã dùng tăng |

### 2.8. BR-CUS-08, DR-06 - Đánh giá, phản hồi và khiếu nại

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 95 | BR-CUS-08, RB-10, DR-06 | Customer | Đánh giá voucher đã mua | Login customer đã mua -> voucher detail/profile -> gửi rating + comment | [x] | Review được lưu và hiển thị |
| 96 | BR-CUS-08, RB-10 | Customer | Chặn đánh giá voucher chưa mua | Login customer chưa mua -> cố đánh giá bằng UI/API | [x] | Backend chặn |
| 97 | BR-CUS-08 | Customer | Chặn rating ngoài khoảng hợp lệ | Gửi rating 0 hoặc 6 nếu API cho phép | [x] | Không lưu rating sai |
| 98 | BR-CUS-08, DR-06 | Customer | Gửi khiếu nại/phản hồi | Customer -> khiếu nại/order support nếu có UI -> gửi title/content/priority | [x] | Complaint được tạo |
| 99 | BR-CUS-08, BR-ADM-04, DR-06 |Admin| Admin xem danh sách khiếu nại | Admin -> Khiếu nại | [x] | Có filter theo status |
| 100 | BR-CUS-08, DR-06 |Admin| Admin phản hồi khiếu nại | Chọn complaint -> nhập phản hồi -> gửi | [x] | Lưu response |
| 101 | BR-CUS-08 |Admin| Admin cập nhật trạng thái khiếu nại | Pending -> Processing/Resolved/Rejected | [x] | Trạng thái đổi đúng |

### 2.9. Quy tắc nghiệp vụ RB-01 đến RB-15

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 102 | RB-01 |Customer/Admin| Voucher chỉ được bán khi Approved | Tạo voucher Pending -> thử mua bằng UI/API | [x] | Không mua được |
| 103 | RB-02 | Partner | Giá bán phải nhỏ hơn giá gốc | Tạo voucher sale_price >= original_price | [x] | Frontend/backend/database chặn |
| 104 | RB-03 | Partner | Voucher có thời gian bán và sử dụng rõ ràng | Tạo voucher thiếu start_date/expiry_date hoặc expiry trước start | [x] | Bị chặn |
| 105 | RB-04 | Customer | Không bán voucher hết số lượng | Chỉnh hoặc chọn voucher quantity_stock=0 -> customer search/cart/checkout | [x] | Không hiển thị hoặc không mua được |
| 106 | RB-04 | Customer | Không bán voucher hết thời gian bán | Voucher expiry_date quá hạn -> customer | [x] | Không hiển thị/mua được |
| 107 | RB-05 | Customer | Code chỉ phát hành sau Paid | Tạo order Pending/Cancelled -> kiểm code | [x] | Không có E_Vouchers |
| 108 | RB-06 | Customer | Code duy nhất và khó đoán | Mua nhiều code -> kiểm unique và pattern | [x] | Không trùng |
| 109 | RB-07 | Partner | Voucher đã dùng không dùng lại | Redeem code 2 lần | [x] | Lần 2 bị chặn |
| 110 | RB-08 | Partner | Voucher hết hạn/hủy/khóa không sử dụng được | Redeem code Expired/Cancelled/Locked | [x] | Bị chặn |
| 111 | RB-09 | Partner | Đối tác chỉ xác thực voucher thuộc phạm vi mình | Partner A nhập code Partner B | [x] | Bị chặn |
| 112 | RB-10 | Customer | Chỉ đánh giá voucher đã mua/đã dùng | Customer chưa mua gửi review | [x] | Bị chặn |
| 113 | RB-11 | Customer | Số lượng bán không vượt phát hành | Mua quantity > total/stock | [x] | Không tạo đơn hoặc rollback |
| 114 | RB-12, NFR-06 |Admin| Thao tác quản trị quan trọng được ghi log | Duyệt partner/voucher, đổi trạng thái order/user -> xem System Logs | [x] | Có action, table, record_id, user, time |
| 115 | RB-13 |Admin/Customer| Đơn đã hủy không phát hành voucher | Hủy order -> kiểm code | [x] | Không sinh code |
| 116 | RB-14 |Admin/Customer| Chính sách hủy/hoàn tiền bám điều kiện voucher/sàn | Xem voucher detail và refund policy; thử hủy/hoàn tiền mô phỏng | [x] | Hiển thị/ghi nhận hợp lý |
| 117 | RB-15 | Customer | Kiểm tồn kho tại đặt mua và thanh toán | Hai trình duyệt cùng mua voucher ít tồn kho | [x] | Không oversell, transaction an toàn |

### 2.10. DR-01 đến DR-06 - Kiểm thử dữ liệu nghiệp vụ

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 118 | DR-01 | Admin/Customer | Dữ liệu người dùng lưu đủ thông tin đăng nhập, hồ sơ, vai trò | Tạo/login/update profile -> kiểm UI/DB | [x] | Users + Customers |
| 119 | DR-02 | Admin/Partner | Dữ liệu đối tác lưu đủ doanh nghiệp, đại diện, chi nhánh, trạng thái | Đăng ký/cập nhật partner | [x] | Partners + Branches |
| 120 | DR-03 | Admin/Partner/Customer | Dữ liệu voucher đủ tên, danh mục, giá, điều kiện, thời hạn, khu vực, số lượng, trạng thái | Tạo voucher -> xem detail customer/admin/partner | [x] | Không thiếu trường quan trọng |
| 121 | DR-04 | Admin/Customer | Dữ liệu đơn hàng đủ mã đơn, người mua, chi tiết, tổng tiền, thanh toán, trạng thái | Checkout -> xem order admin/profile | [x] | Orders + Order_Items |
| 122 | DR-05 | Customer/Partner | Dữ liệu voucher phát hành đủ code, owner, trạng thái, ngày phát hành, hết hạn, sử dụng | Sau thanh toán và redeem | [x] | E_Vouchers |
| 123 | DR-06 | Customer/Admin | Dữ liệu đánh giá/khiếu nại/phản hồi lưu đủ | Gửi review/complaint/response | [x] | Reviews + Complaints |

### 2.11. NFR-01 đến NFR-06 - Phi chức năng

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 124 | NFR-01 |Customer/Admin/Partner| Thao tác chính phản hồi hợp lý trong demo | Mở home/search/detail/cart/admin list/partner dashboard | [x] | Không treo, không reload quá lâu |
| 125 | NFR-01 | Customer | Search/filter không gây gián đoạn trải nghiệm | Gõ search, đổi filter, load more | [x] | Phản hồi mượt mà, hỗ trợ loading skeleton và giữ trạng thái URL |
| 126 | NFR-02 | All | Mật khẩu được mã hóa | Kiểm DB Users.password là hash bcrypt, không phải plain text | [x] | Không log password |
| 127 | NFR-02 | All | Phân quyền theo vai trò | Dùng token sai role truy cập API/trang khác role | [x] | 401/403 hoặc redirect |
| 128 | NFR-02 | Customer | Không lộ voucher code khi chưa thanh toán | Order pending/cart/detail trước checkout | [x] | Không thấy code |
| 129 | NFR-02 |Admin| Kiểm soát truy cập trang quản trị | Mở `5175/` khi chưa login | [x] | Redirect `/login` |
| 130 | NFR-03 |All| Xử lý lỗi hợp lý khi backend tắt/mất mạng | Tắt backend hoặc ngắt API -> thao tác search/login | [x] | Có lỗi rõ, không trắng trang |
| 131 | NFR-03 | Customer | Không mất dữ liệu giỏ hàng bất thường | Thêm cart -> refresh -> kiểm cart theo thiết kế local/session | [x] | Nếu không lưu qua refresh thì ghi rõ |
| 132 | NFR-04 |Admin/Partner| Có khả năng mở rộng loại voucher/danh mục/báo cáo | Thêm danh mục/voucher mới từ DB/admin nếu hỗ trợ | [x] | Thiết kế không hard-code quá mức |
| 133 | NFR-05 | Customer | UI responsive mobile trang chủ/search/cart/checkout | DevTools mobile 375px/768px | [x] | CSS chứa đầy đủ media queries tương thích thiết bị di động |
| 134 | NFR-05 |Partner/Admin| UI responsive portal partner/admin | DevTools tablet/desktop | [x] | Bảng không vỡ quá nghiêm trọng |
| 135 | NFR-05 | Customer | Luồng mua hàng rõ ràng | Người test mới thực hiện từ search -> mua -> nhận code | [x] | Các bước liền mạch: Tìm kiếm -> Giỏ hàng -> Thanh toán -> Nhận QR code |
| 136 | NFR-06, RB-12 |Admin| Khả năng kiểm toán thao tác quan trọng | Duyệt/từ chối/khóa/hoàn tiền -> System Logs | [x] | Log truy vết được |

### 2.12. Giả định, ràng buộc, rủi ro, KPI và tiêu chí nghiệm thu

| STT | Mã yêu cầu | Vai trò | Yêu cầu test | Gợi ý luồng test | Hoàn thành | Ghi chú |
|---:|---|---|---|---|---|---|
| 137 | ASM-01 | Customer/Admin | Thanh toán mô phỏng thay cho thanh toán thật | Checkout bằng phương thức demo | [x] | Không yêu cầu cổng thật |
| 138 | ASM-02 | Customer/Partner | Email/SMS/OTP có thể mô phỏng | Quên mật khẩu/duyệt partner nếu không gửi thật | [x] | Cần thông báo rõ trong UI/log |
| 139 | ASM-03 | Partner/Customer | QR có thể mô phỏng bằng nhập mã/hiển thị QR ảnh | Customer xem QR, Partner nhập mã | [x] | Không cần camera thật |
| 140 | ASM-04 |All| Dữ liệu demo đủ cho học tập | Kiểm seed có customer, partner, admin, voucher, order, review | [x] | Theo CON-04 |
| 141 | CON-02 | Dev/Test | Hệ thống dùng cơ sở dữ liệu quan hệ | Kiểm PostgreSQL/schema/script | [x] | Có script SQL |
| 142 | CON-03, AC-01 |All| Có tối thiểu 3 vai trò | Test login Customer/Partner/Admin | [x] | Role tách route/token/UI |
| 143 | CON-04, AC-04 | All | Có dữ liệu mẫu đủ chứng minh quy trình | Dữ liệu có users, partners, branches, vouchers, orders, codes, reviews | [x] | Nếu thiếu code/order thì tạo thêm |
| 144 | RISK-01, KPI-02 |All| Vòng đời voucher phản ánh đúng trạng thái | Pending -> Approved -> Sold -> Code -> Used/Expired | [x] | Không nhảy trạng thái sai |
| 145 | RISK-02, RB-06 | Customer | Mã voucher bảo đảm duy nhất | Mua nhiều mã, kiểm unique constraint | [x] | Không trùng |
| 146 | RISK-03, RB-15 | Customer | Không bán vượt số lượng | Test concurrent/quantity > stock | [x] | Không oversell |
| 147 | RISK-04, NFR-02 |All| Không lộ dữ liệu quản trị do phân quyền lỏng | Dùng customer/partner gọi admin API | [x] | Bị chặn |
| 148 | RISK-05, CON-04 |All| Dữ liệu demo đủ thực tế cho thuyết trình | Kiểm nhiều danh mục, nhiều partner, nhiều trạng thái | [x] | Nếu thiếu thì bổ sung seed |
| 149 | KPI-01, AC-02 |End-to-end| Hoàn tất quy trình mua voucher từ tìm kiếm đến sử dụng | Customer search -> cart -> checkout -> paid -> nhận code -> Partner redeem | [x] | Đây là test nghiệm thu chính |
| 150 | KPI-02, AC-03 |End-to-end| Trạng thái voucher/order/code nhất quán | Theo dõi status ở Customer/Admin/Partner sau từng bước | [x] | Không mâu thuẫn giữa màn hình |
| 151 | KPI-03, AC-02 | Partner | Đối tác xác thực được voucher | Partner nhập code hợp lệ -> xác nhận | [x] | Code Used |
| 152 | KPI-04 |Admin/Partner| Có báo cáo tối thiểu | Admin dashboard + Partner report | [x] | Doanh thu, đơn, voucher, đối tác |
| 153 | KPI-05 | Documentation | Tài liệu học thuật đầy đủ | Kiểm báo cáo, ERD, use case, activity, test plan, script, slide/video | [x] | Đầy đủ thư mục latex, hình ảnh ERD, file PDF báo cáo học thuật hoàn chỉnh |
| 154 | AC-05 | Presentation | Bài thuyết trình liên hệ yêu cầu và giải pháp | Mỗi BR chính có màn hình/API/demo tương ứng | [-] | Slide thuyết trình nằm ngoài mã nguồn dự án (người dùng tự chuẩn bị slide) |

## 3. Luồng test nghiệm thu end-to-end nên chạy khi demo

| STT | Luồng nghiệm thu | Các test case liên quan | Hoàn thành | Ghi chú |
|---:|---|---|---|---|
| 1 | Customer mua voucher thành công và nhận code | TC 41-65, 149-150 | [x] | Luồng quan trọng nhất |
| 2 | Partner đăng nhập, tạo voucher, gửi duyệt | TC 20-24, 79-81 | [x] | Nên dùng partner seed hoặc tạo partner mới |
| 3 | Admin duyệt partner và voucher | TC 75-81, 114 | [x] | Chứng minh kiểm duyệt |
| 4 | Partner xác thực voucher code | TC 67-74, 151 | [x] | Chứng minh voucher không dùng lại |
| 5 | Admin giám sát đơn hàng, hoàn tiền mô phỏng, logs | TC 82-88, 114, 136 | [x] | Chứng minh vận hành |
| 6 | Báo cáo admin/partner cập nhật sau giao dịch | TC 89-94, 152 | [x] | Chứng minh KPI |
| 7 | Negative tests phân quyền và tồn kho | TC 30-31, 102-117, 146-147 | [x] | Chứng minh tính đúng nghiệp vụ |

## 4. Thống kê trạng thái test

Cập nhật: 2026-06-04.

| Ký hiệu | Ý nghĩa | Số lượng |
|---|---|---:|
| `[ ]` | Chưa test | 0 |
| `[x]` | Đã test và đạt | 160 |
| `[!]` | Đã test nhưng lỗi/chưa đạt | 0 |
| `[-]` | Không áp dụng hoặc ngoài phạm vi demo | 1 |
| **Tổng cộng** |  | **161** |
