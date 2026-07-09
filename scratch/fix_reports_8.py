import re
filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
br = br.replace('5 Lỗi (Bugs)', '6 Lỗi (Bugs)')
bug6 = """
## 6. Bug 06: Mất tính năng Đọc Gợi ý TTS (UX-01)
- **Mức độ (Severity):** 🟢 Low (Lỗi tính năng phụ trợ / Trải nghiệm người dùng)
- **Mô tả:** Phần "Gợi ý" giải bài của AI bị thiếu nút Loa (Text-to-Speech) để phát âm thanh. Giao diện thực tế chỉ có nút "Gợi ý" và "Nháp". Đối với người dùng là Trẻ em (Kid), việc phải tự đọc các dòng text dài rất bất tiện.
- **Bước tái hiện:**
  1. Đăng nhập tài khoản Kid.
  2. Vào làm bài Luyện tập, bấm xem Gợi ý của AI.
- **Kết quả thực tế:** Không có nút Loa (TTS) để nghe đọc. Kịch bản `PRAC-05` thất bại.
- **Vị trí Code cần Fix:** File `PersonalizedExercisePanel.tsx` - Cần code thêm UI Component nút Speaker và nối API với Backend hệ thống TTS (đã được Dev xây dựng sẵn nhưng quên gắn vào UI).
"""
if '## 6. Đề xuất' in br:
    br = br.replace('## 6. Đề xuất', bug6 + '\n## 7. Đề xuất')
else:
    if '---' in br:
        parts = br.split('---')
        if len(parts) >= 3:
            parts[1] = parts[1] + bug6 + '\n'
            br = '---'.join(parts)
        else:
            br = br.replace('---', bug6 + '\n---', 1)
    else:
        br += '\n' + bug6
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)

tp_path = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md'
with open(tp_path, 'r', encoding='utf-8') as f:
    tp = f.read()
tp = re.sub(
    r'\|\s*29\s*\|\s*PRAC-05\s*\|.*?\|\s*\[x\]\s*\|',
    r'|  29 | PRAC-05 | Kid     | Tính năng TTS (Text-to-Speech)        | Bấm icon Loa bên cạnh lời giải thích của AI                  | Trình duyệt phát ra âm thanh tiếng Việt đọc lại lời giải                              | [!]        |',
    tp
)
with open(tp_path, 'w', encoding='utf-8') as f:
    f.write(tp)
