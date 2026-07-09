import re

filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()

br = br.replace('3 Lỗi (Bugs)', '4 Lỗi (Bugs)')

bug4 = """
## 4. Bug 04: Lộ Backdoor tự thăng cấp Admin (SEC-02)
- **Mức độ (Severity):** 🔴 CRITICAL (Cực kỳ nguy hiểm)
- **Mô tả:** Có một công cụ hỗ trợ Dev (Dev Helper) nằm chình ình ngay trên trang `/admin`. Bất kỳ người dùng thường nào (Học sinh/Phụ huynh) gõ URL `/admin` đều không bị chặn lại, mà còn được hệ thống "mời gọi" bấm nút **"SET MY ROLE TO ADMIN"** để tự biến mình thành Quản trị viên tối cao.
- **Bước tái hiện:**
  1. Đăng nhập bằng tài khoản Kid hoặc Parent.
  2. Gõ URL `http://localhost:3000/admin`.
  3. Bấm nút "SET MY ROLE TO ADMIN".
- **Kết quả thực tế:** User thường lập tức chiếm được toàn quyền Admin của hệ thống. Kịch bản Test `AUTH-08` thất bại hoàn toàn.
- **Vị trí Code cần Fix:** File giao diện của trang `/admin`. Cần XÓA NGAY LẬP TỨC component Dev Helper này, hoặc phải chặn quyền truy cập (Redirect) ngay từ Middleware trước khi render trang.
"""

if '## 4. Đề xuất' in br:
    br = br.replace('## 4. Đề xuất', bug4 + '\n## 5. Đề xuất')
else:
    if '---' in br:
        parts = br.split('---')
        if len(parts) >= 3:
            parts[1] = parts[1] + bug4 + '\n'
            br = '---'.join(parts)
        else:
            br = br.replace('---', bug4 + '\n---', 1)
    else:
        br += '\n' + bug4

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)

# Update QA report
qa_path = r'C:\Users\Admin\.gemini\antigravity-ide\brain\58c2a9ae-2bd7-4e97-88a0-92e113ff22a9\QA_Report_To_Hoang.md'
try:
    with open(qa_path, 'r', encoding='utf-8') as f:
        qa = f.read()
    
    if '## 4. Đề xuất' in qa:
        qa = qa.replace('## 4. Đề xuất', '## 4. Lỗi Bảo mật Nghiêm trọng mới phát hiện\n- **[CRITICAL] Backdoor cấp quyền Admin:** Trang `/admin` chứa nút "Dev Helper" cho phép bất kỳ ai cũng có thể tự biến mình thành Admin. Bắt buộc phải gỡ bỏ ngay lập tức.\n\n## 5. Đề xuất')
        with open(qa_path, 'w', encoding='utf-8') as f:
            f.write(qa)
except Exception as e:
    pass
