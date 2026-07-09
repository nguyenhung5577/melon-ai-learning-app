tp_path = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\TEST_PLAN_MELON_AI.md'
with open(tp_path, 'r', encoding='utf-8') as f:
    tp = f.read()

study_section = """
### 2.9. Phân hệ Bài giảng & Học tập (ML-STUDY)

| STT | Mã YC   | Vai trò | Tên Test Case                 | Mô tả thao tác chi tiết                                       | Kết quả mong đợi (Expected)                                                                      | Trạng thái |
| --: | ------- | ------- | ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- |
|  45 | STUD-01 | Kid     | Xem Slide Lý thuyết Bài giảng | Mở `/lessons/[id]` -> Đọc nội dung text/video -> Bấm Tiếp tục | Trình duyệt chuyển mượt mà sang Slide tiếp theo                                                  | [-]        |
|  46 | STUD-02 | Kid     | Trả lời Slide Quiz Giữa giờ   | Tới Slide Quiz -> Chọn một đáp án sai                         | Nút Tiếp tục bị mờ, UI báo lỗi màu đỏ, bắt buộc làm lại                                          | [-]        |
|  47 | STUD-03 | Kid     | Hoàn thành Bài giảng          | Bấm nút Hoàn thành ở Slide cuối cùng                          | Hệ thống ghi nhận Tiến độ (`logActivityEvent`), cộng XP, tự động quay về trang Tổng quan Bài học | [-]        |
"""
if '### 2.10. Phân hệ Nạp Kiến thức' in tp:
    tp = tp.replace('### 2.10. Phân hệ Nạp Kiến thức', study_section + '\n### 2.10. Phân hệ Nạp Kiến thức')
    with open(tp_path, 'w', encoding='utf-8') as f:
        f.write(tp)

br_path = r'd:\HCMUS\HK2-N3\SE4AI\melon-ai-learning-app\BUG_REPORT_MELON_AI.md'
with open(br_path, 'r', encoding='utf-8') as f:
    br = f.read()

note = "\n\n**5.** **Thiếu phân hệ Bài giảng Lý thuyết (ML-STUDY):** Hiện tại hệ thống mới chỉ có luồng Làm bài tập/Luyện tập (Trắc nghiệm) mà thiếu hẳn luồng truyền đạt kiến thức (Video, Slide lý thuyết). Yêu cầu Dev bổ sung tính năng Học bài giảng để quy trình học tập được trọn vẹn (Kịch bản `STUD-01` tới `STUD-03` đang phải bỏ qua)."

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
