import re
filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
note = "- **[QUAN TRỌNG] Thiếu chức năng Tìm kiếm (Search) ở Admin:** Trang Quản trị hiện tại chưa có thanh tìm kiếm (Thất bại kịch bản `ADM-02`). Khi danh sách User dài ra, Admin sẽ không thể quản lý và thao tác được. Yêu cầu Dev phải ưu tiên code thêm ô Search by Email/Tên trước khi bàn giao.\n"
br = re.sub(r'(## \d+\. Đề xuất.*?\n)', r'\1' + note, br)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)

qa_path = r'C:\Users\Admin\.gemini\antigravity-ide\brain\58c2a9ae-2bd7-4e97-88a0-92e113ff22a9\QA_Report_To_Hoang.md'
try:
    with open(qa_path, 'r', encoding='utf-8') as f:
        qa = f.read()
    qa = re.sub(r'(## \d+\. Đề xuất.*?\n)', r'\1' + note, qa)
    with open(qa_path, 'w', encoding='utf-8') as f:
        f.write(qa)
except Exception:
    pass
