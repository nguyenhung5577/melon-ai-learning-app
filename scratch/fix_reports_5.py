import re
# Fix Test Plan
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'r', encoding='utf-8') as f:
    tp = f.read()

tp = re.sub(
    r'\|\s*6\s*\|\s*AUTH-06\s*\|.*?\|\s*\[x\]\s*\|',
    r'|   6 | AUTH-06 | Parent     | Đăng nhập/Đăng ký Phụ Huynh | Mở Popup Đăng nhập -> Bấm Login with Google | Cấp quyền `Parent` (Tạo mới nếu chưa có) | [x]        |',
    tp
)
with open(r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md', 'w', encoding='utf-8') as f:
    f.write(tp)

# Fix QA Report
qa_path = r'C:\Users\Admin\.gemini\antigravity-ide\brain\58c2a9ae-2bd7-4e97-88a0-92e113ff22a9\QA_Report_To_Hoang.md'
try:
    with open(qa_path, 'r', encoding='utf-8') as f:
        qa = f.read()
    note = """
## 4. Đề xuất Cải tiến (UX & Feature)
- **Hạn chế Đăng ký Phụ huynh:** Hiện tại Phụ huynh chỉ có thể dùng tài khoản Google để đăng nhập. Nếu khách hàng không có tài khoản Google thì không có cách nào tạo tài khoản mới trên hệ thống.
- **Khuyến nghị cho Hoàng:** Cần bổ sung thêm luồng đăng ký/đăng nhập truyền thống bằng Email/Password tự do để tối ưu trải nghiệm và mở rộng tệp người dùng.
"""
    if '4. Đề xuất' not in qa:
        qa += '\n' + note
        with open(qa_path, 'w', encoding='utf-8') as f:
            f.write(qa)
except Exception as e:
    print(e)

# Add to Bug Report just in case
bug_path = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(bug_path, 'r', encoding='utf-8') as f:
    br = f.read()
note_br = """
## 4. Đề xuất Cải tiến Trải nghiệm (UX/UI)
- **Vấn đề:** Box Đăng nhập bắt buộc Phụ huynh phải xài Google Account. Sẽ rất bất tiện nếu người dùng muốn đăng ký bằng email công ty hoặc email hệ khác.
- **Đề xuất:** Thêm form điền Email/Mật khẩu để đăng ký tài khoản mới độc lập.
"""
if '4. Đề xuất' not in br:
    br += '\n' + note_br
    with open(bug_path, 'w', encoding='utf-8') as f:
        f.write(br)
