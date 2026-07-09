import re
filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
br = br.replace('6 Lỗi (Bugs)', '7 Lỗi (Bugs)')
bug7 = """
## 7. Bug 07: Lỗi mâu thuẫn hiển thị số lượng con (State Sync UI)
- **Mức độ (Severity):** 🟡 Medium (Lỗi UI/UX gây nhầm lẫn nghiêm trọng)
- **Mô tả:** Trang Quản lý Gia đình hiển thị dữ liệu bất nhất (tiền hậu bất nhất). Phụ huynh House Mike đã tạo 3 tài khoản con, và hệ thống có render danh sách 3 bé ở khu vực dưới. TUY NHIÊN, Header bên trên lại báo "0 TÀI KHOẢN CON" và phần khung hiển thị chính lại báo "NO CHILDREN CREATED YET".
- **Bước tái hiện:**
  1. Đăng nhập Parent, vào trang Gia đình.
  2. Tạo 1 hoặc nhiều tài khoản con.
  3. Load lại trang để xem hiển thị.
- **Kết quả thực tế:** Màn hình chia làm 2 nửa mâu thuẫn (vừa báo có 3 con, vừa báo có 0 con). Kịch bản `FAM-01` thất bại.
- **Vị trí Code cần Fix:** File giao diện trang Family. Đồng bộ lại biến State chứa danh sách con. Kiểm tra logic render `if (children.length === 0)` để đảm bảo nó đang trỏ đúng vào biến chứa dữ liệu đã fetch từ API.
"""
if '## 7. Đề xuất' in br:
    br = br.replace('## 7. Đề xuất', bug7 + '\n## 8. Đề xuất')
else:
    if '---' in br:
        parts = br.split('---')
        if len(parts) >= 3:
            parts[1] = parts[1] + bug7 + '\n'
            br = '---'.join(parts)
        else:
            br = br.replace('---', bug7 + '\n---', 1)
    else:
        br += '\n' + bug7
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)

tp_path = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md'
with open(tp_path, 'r', encoding='utf-8') as f:
    tp = f.read()
tp = re.sub(
    r'\|\s*35\s*\|\s*FAM-01\s*\|.*?\|\s*\[x\]\s*\|',
    r'|  35 | FAM-01 | Parent  | Xem danh sách tài khoản con   | Đăng nhập Parent -> Vào trang Quản lý Gia đình                                    | Hiển thị danh sách các tài khoản Kid do Phụ huynh đã tạo             | [!]        |',
    tp
)
with open(tp_path, 'w', encoding='utf-8') as f:
    f.write(tp)
