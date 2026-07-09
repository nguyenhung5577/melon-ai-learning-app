br_path = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(br_path, 'r', encoding='utf-8') as f:
    br = f.read()

note = "\n\n**6.** **Bất đồng nhất Ngôn ngữ (Nửa Anh nửa Việt):** Giao diện hệ thống hiện tại đang bị trộn lẫn lộn giữa Tiếng Việt và Tiếng Anh (Ví dụ như trong hình chụp: *\"GIA ĐÌNH\"* nhưng lại báo *\"NO CHILDREN CREATED YET\"*, hoặc mục *\"LỚP\"* nhưng option lại là *\"Grade 4\"*, tiêu đề là tiếng Việt nhưng lại có chữ *\"CHOOSE AVATAR\"*). Yêu cầu team Dev rà soát lại toàn bộ nội dung Text trên UI, thống nhất 1 ngôn ngữ duy nhất (Việt hóa 100%) hoặc xây dựng cơ chế Đa ngôn ngữ (i18n) hoàn chỉnh."

br += note

with open(br_path, 'w', encoding='utf-8') as f:
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
