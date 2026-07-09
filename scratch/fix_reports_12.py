import re
filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
br = br.replace('7 Lỗi (Bugs)', '8 Lỗi (Bugs)')
bug8 = """
## 8. Bug 08: Lỗi sai Tiêu đề trang Profile của Phụ huynh (UX-02)
- **Mức độ (Severity):** 🟢 Low (Lỗi hiển thị Text/Hardcode)
- **Mô tả:** Khi Phụ huynh truy cập vào trang Hồ sơ của chính mình (`/profile`), hệ thống lại hiển thị tiêu đề là **"HỒ SƠ CỦA CON"** kèm dòng mô tả *"Chỉnh cách con hiển thị trong Melon"*. Lỗi này do Frontend Developer đã Code cứng (Hardcode) dòng chữ này cho mọi đối tượng thay vì thay đổi theo Vai trò.
- **Bước tái hiện:**
  1. Đăng nhập bằng tài khoản Parent.
  2. Truy cập trang Hồ sơ `/profile`.
- **Kết quả thực tế:** Tiêu đề bị sai lệch, gây buồn cười và thiếu chuyên nghiệp.
- **Vị trí Code cần Fix:** File giao diện Profile. Thêm logic `if (role === 'parent')` thì render chữ "HỒ SƠ PHỤ HUYNH".
"""
if '## 8. Đề xuất Cải tiến' in br:
    br = br.replace('## 8. Đề xuất Cải tiến', bug8 + '\n## 9. Đề xuất Cải tiến')
else:
    br += '\n' + bug8
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)
