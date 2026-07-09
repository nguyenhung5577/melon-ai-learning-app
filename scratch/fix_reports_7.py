import re
filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
br = br.replace('4 Lỗi (Bugs)', '5 Lỗi (Bugs)')
bug5 = """
## 5. Bug 05: Thiếu chặn dung lượng File Upload (ERR-04)
- **Mức độ (Severity):** 🟡 Medium (Nguy cơ tốn bộ nhớ / Tốn phí cước AI)
- **Mô tả:** Người dùng có thể Upload file PDF nặng 22MB (vượt quá giới hạn 20MB) mà không bị cảnh báo hay chặn lại. Nếu người dùng spam file lớn, AI Backend có thể bị sập do đầy RAM (OOM) hoặc làm tốn rất nhiều cước phí gọi API (Token LLM).
- **Bước tái hiện:**
  1. Đăng nhập tài khoản Kid Pro.
  2. Bấm Upload và chọn file PDF > 20MB.
- **Kết quả thực tế:** File vẫn tải lên thành công. Kịch bản `PARSE-01` thất bại.
- **Vị trí Code cần Fix:** Thêm logic kiểm tra `if (file.size > 20 * 1024 * 1024)` ở Frontend để chặn ngay từ trình duyệt, và kiểm tra `Content-Length` ở Middleware Backend.
"""
if '## 5. Đề xuất' in br:
    br = br.replace('## 5. Đề xuất', bug5 + '\n## 6. Đề xuất')
else:
    if '---' in br:
        parts = br.split('---')
        if len(parts) >= 3:
            parts[1] = parts[1] + bug5 + '\n'
            br = '---'.join(parts)
        else:
            br = br.replace('---', bug5 + '\n---', 1)
    else:
        br += '\n' + bug5
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)
