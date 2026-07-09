filepath = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(filepath, 'r', encoding='utf-8') as f:
    br = f.read()
note = "\n\n**4.** **Thiếu chức năng Đổi Mật khẩu/ID cho Kid:** Hiện tại không có bất kỳ nút nào để thay đổi Mật khẩu hoặc ID (Tên đăng nhập) cho tài khoản học sinh. Yêu cầu bổ sung quyền Đổi mật khẩu/ID cho con từ trang Quản lý Gia đình của Phụ huynh (hoặc từ màn hình Admin) để hỗ trợ khôi phục khi Kid quên mật khẩu."
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
