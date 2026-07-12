# Melon AI Learning App

Melon AI Learning App là nền tảng học tập có hỗ trợ AI dành cho học sinh và phụ huynh. Ứng dụng cung cấp bài học, luyện tập và trợ lý AI, đồng thời giúp theo dõi kết quả học tập. Hệ thống còn hỗ trợ phân tích đề bài và tạo động lực học tập thông qua XP, huy hiệu và bảng xếp hạng.

## Tính năng chính

- Học bài và luyện tập theo nội dung trên hệ thống.
- Tạo bộ câu hỏi luyện tập có hỗ trợ AI.
- Hỏi đáp với trợ lý AI trong quá trình học.
- Phân tích đề bài từ văn bản, PDF và hình ảnh.
- Theo dõi tiến độ, kết quả và lịch sử luyện tập.
- Tích lũy XP, huy hiệu và tham gia bảng xếp hạng.
- Liên kết tài khoản gia đình để phụ huynh theo dõi việc học của con.

## Công nghệ sử dụng

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI, Framer Motion, Recharts.
- **Backend:** FastAPI, Uvicorn, Pydantic, PyMuPDF.
- **Database:** Firebase Firestore.
- **Authentication:** Firebase Authentication, Firebase Admin SDK.
- **AI services:** OpenAI, OpenRouter, Google Gemini, ElevenLabs.
- **Storage:** Cloudinary.
- **Deployment:** Vercel, Render.

## Truy cập hệ thống

- [Website](https://melon-ai-learning-app.vercel.app/)
- [Tài liệu dự án](https://github.com/nguyenhung5577/melon-ai-learning-app/tree/main/docs)

## Hướng dẫn chạy cục bộ

1. Clone repository:

   ```bash
   git clone https://github.com/nguyenhung5577/melon-ai-learning-app.git
   cd melon-ai-learning-app
   ```

2. Cài đặt dependencies cho frontend:

   ```bash
   cd src/web
   npm install
   ```

3. Cài đặt dependencies cho backend:

   ```bash
   cd ../melon-ai-backend
   conda create -n myenv python=3.11
   conda activate myenv
   pip install -r requirements.txt
   ```

4. Cấu hình biến môi trường:

   ```bash
   cd ../web
   cp .env.example .env.local
   ```

   Điền các biến cần thiết trong `src/web/.env.local` và tạo `src/melon-ai-backend/.env` cho các dịch vụ backend. Không đưa API key, secret hoặc credential thật vào repository.

5. Chạy backend và frontend trong hai terminal:

   ```bash
   cd src/melon-ai-backend
   conda activate myenv
   uvicorn main:app --host 127.0.0.1 --port 8001 --reload
   ```

   ```bash
   cd src/web
   npm run dev
   ```

## Thành viên thực hiện

**Đồ án học phần CSC10011 – Công nghệ phần mềm cho Hệ thống Trí tuệ nhân tạo**

**Nhóm 2**

| MSSV     | Họ và tên          | Vai trò                              |
| -------- | ------------------ | ------------------------------------ |
| 23122007 | Nguyễn Tấn Hùng    | System Architect / Backend Developer |
| 23122031 | Nguyễn Huy Hoàng   | Project Manager                      |
| 23122037 | Nguyễn Đăng Khôi   | Business Analyst / Backend Developer |
| 23122042 | Trần Tạ Quang Minh | AI/ML Engineer                       |
| 23122043 | Nguyễn Bá Nam      | Frontend Developer                   |
| 23122056 | Lâm Hoàng Vũ       | QA Engineer                          |

## Ghi chú

Đây là đồ án được phát triển phục vụ mục đích học tập trong học phần CSC10011.
 