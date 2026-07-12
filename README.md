# Melon AI Learning App



Melon AI Learning App là nền tảng học tập có hỗ trợ AI dành cho học sinh và phụ huynh. Ứng dụng tập trung vào học bài, luyện đề và theo dõi tiến độ học tập trong một môi trường trực quan, dễ sử dụng. Bên cạnh đó, hệ thống có trợ lý AI, nội dung luyện tập thích ứng và các cơ chế gamification như XP, huy hiệu và bảng xếp hạng.



## Tính năng chính



- Học bài tương tác theo nội dung trên hệ thống.

- Luyện đề và tạo bộ câu hỏi bằng AI.

- Hỏi đáp với trợ lý AI trong quá trình học.

- Phân tích đề từ văn bản, PDF và hình ảnh.

- Theo dõi tiến độ, kết quả và lịch sử học tập.

- Tích lũy XP, huy hiệu và tham gia bảng xếp hạng.

- Khu vực phụ huynh để theo dõi việc học của con.



## Công nghệ sử dụng



- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI, Framer Motion, Recharts.

- **Backend:** FastAPI, Uvicorn, Pydantic, PyMuPDF.

- **Database:** Firebase Firestore.

- **Authentication:** Firebase Authentication, Firebase Admin SDK.

- **AI services:** OpenAI, Google Gemini, ElevenLabs.

- **Storage:** Cloudinary.

- **Deployment:** Vercel, Render.



## Truy cập hệ thống



- [Website](https://melon-ai-learning-app.vercel.app/)

- [Tài liệu dự án](https://github.com/nguyenhung5577/melon-ai-learning-app/tree/main/docs)



## Hướng dẫn chạy cục bộ



1. Clone repository.



   ```bash

   git clone https://github.com/nguyenhung5577/melon-ai-learning-app.git

   cd melon-ai-learning-app

   ```



2. Cài đặt dependencies cho frontend.



   ```bash

   cd src/web

   npm install

   ```



3. Cài đặt dependencies cho backend.



   ```bash

   cd ../melon-ai-backend

   conda create -n myenv python=3.11

   conda activate myenv

   pip install -r requirements.txt

   ```



4. Cấu hình các biến môi trường cần thiết.



   ```bash

   cd ../web

   cp .env.example .env.local

   ```



   Tạo thêm file `src/melon-ai-backend/.env` và điền các khóa cần thiết cho Firebase, OpenAI, ElevenLabs, Pinecone, Cloudinary và URL backend. Không đưa API key, secret hoặc credential thật vào repository.



5. Chạy frontend và backend.



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