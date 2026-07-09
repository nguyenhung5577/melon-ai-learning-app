filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
note = "\n**3.** Thiếu tính năng Khóa/Ban tài khoản (Thất bại kịch bản `ADM-03`). Hiện tại Admin chỉ có thể Xóa vĩnh viễn (Delete) user chứ không thể khóa tạm thời. Việc này gây rủi ro mất dữ liệu học tập nếu Admin bấm nhầm hoặc chỉ muốn phạt cảnh cáo tài khoản."
br += note
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(br)
qa_path = r'C:\Users\Admin\.gemini\antigravity-ide\brain\58c2a9ae-2bd7-4e97-88a0-92e113ff22a9\QA_Report_To_Hoang.md'
try:
    with open(qa_path, 'r', encoding='utf-8') as f:
        qa = f.read()
    qa += note
    with open(qa_path, 'w', encoding='utf-8') as f:
        f.write(qa)
except Exception:
    pass
