# Melon Full App Test Guide

Tài liệu này hướng dẫn cài đặt và test toàn bộ ứng dụng Melon theo bản code hiện tại trên branch `feat/refactor`.

Mục tiêu:

- Chạy được frontend Next.js.
- Chạy được backend FastAPI AI khi cần RAG/TTS.
- Cấu hình Firebase, Firebase Admin, Cloudinary, OpenAI/Gemini.
- Tạo đủ tài khoản test cho các vai trò: guest, parent, child, admin.
- Test toàn bộ luồng chính: học lesson, progress tracking, parent dashboard, family/child account, practice/question bank, admin upload, AI tutor, RAG/TTS.

## 1. Kiến Trúc Hiện Tại

```text
Browser
  -> Next.js app: src/web
  -> Next.js API routes
      /api/auth/child/login
      /api/parents/children
      /api/questions/attempts
      /api/v1/progress/*
      /api/v1/ai/*
      /api/v1/rag/*
      /api/upload
  -> Firebase Auth / Firestore / Firebase Admin SDK
  -> Cloudinary
  -> FastAPI melon-ai-backend
  -> OpenAI / Gemini / ElevenLabs
```

Runtime chính:

| Service | Folder | Default URL |
|---|---|---|
| Frontend | `src/web` | `http://localhost:3000` |
| AI backend | `src/melon-ai-backend` | `http://127.0.0.1:8001` |

## 2. Điều Kiện Cần Có

### 2.1. Công cụ local

- Node.js tương thích Next.js 16.
- npm.
- Python 3.11.
- Conda hoặc Python venv.
- Git.
- Trình duyệt Chrome/Edge.

Kiểm tra:

```powershell
node -v
npm -v
python --version
git --version
```

### 2.2. Dịch vụ ngoài

Để test đầy đủ nhất cần:

- Firebase project.
- Firebase Authentication bật Google provider.
- Firestore database.
- Firebase Admin service account.
- Cloudinary cloud + unsigned upload preset.
- OpenAI API key.
- Google Gemini API key, dùng cho multimodal/problem parsing nếu flow cần.
- ElevenLabs API key nếu test TTS/audio.

## 3. Cài Đặt Frontend

Từ repo root:

```powershell
cd src\web
npm install
```

Chạy kiểm tra:

```powershell
npm run type-check
```

Chạy dev server:

```powershell
npm run dev
```

Mở:

```text
http://localhost:3000
```

## 4. Cài Đặt Backend AI

Từ repo root:

```powershell
cd src\melon-ai-backend
conda create -n myenv python=3.11
conda activate myenv
pip install -r requirements.txt
```

Tạo file:

```text
src/melon-ai-backend/.env
```

Template:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

Chạy backend:

```powershell
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Test:

```powershell
curl http://127.0.0.1:8001/health
```

Kỳ vọng:

```json
{
  "status": "ok",
  "message": "Melon AI is running"
}
```

Swagger:

```text
http://127.0.0.1:8001/docs
```

## 5. Cấu Hình Environment Frontend

Tạo file:

```text
src/web/.env.local
```

Template đầy đủ:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MELON_AI_BACKEND_URL=http://127.0.0.1:8001

# Firebase client
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_LINES\n-----END PRIVATE KEY-----\n"

# AI providers
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
GOOGLE_GENERATIVE_AI_API_KEY=your_google_gemini_key

# Optional RAG/vector settings used by older code paths/docs
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=melon-lessons
PINECONE_NAMESPACE=default

# Cloudinary upload
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset

# Optional TTS
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

Sau khi sửa `.env.local`, restart frontend:

```powershell
npm run dev
```

## 6. Firebase Setup

### 6.1. Authentication

Trong Firebase Console:

1. Vào `Authentication`.
2. Vào `Sign-in method`.
3. Enable `Google`.
4. Thêm domain `localhost` vào Authorized domains nếu chưa có.

### 6.2. Firestore

Tạo Firestore database ở test mode hoặc dùng rules phù hợp môi trường test.

Các collections quan trọng trong app:

| Collection | Mục đích |
|---|---|
| `users` | Profile và role user |
| `children` | Hồ sơ child account |
| `childCredentials` | Child ID + hash PIN/password |
| `questionBank` | Kho câu hỏi |
| `questionSets` | Bộ đề |
| `studentProgress` | Tổng hợp tiến độ học sinh |
| `studentLessonProgress` | Tiến độ theo lesson |
| `studentLessonCompletions` | Event hoàn thành lesson |
| `studentExerciseAttempts` | Event làm bài luyện tập |
| `kidQuestionStats` | Thống kê từng câu hỏi theo học sinh |
| `courseRuns` | Luồng học cá nhân hóa |
| `coursePipelines` | Pipeline học |

Xem thêm:

```text
docs/personalized-learning-firestore-contract.md
docs/parent-child-auth-database-contract.md
```

### 6.3. Firebase Admin service account

Trong Firebase Console:

1. Project settings.
2. Service accounts.
3. Generate new private key.
4. Lấy:
   - `project_id`
   - `client_email`
   - `private_key`
5. Điền vào `.env.local`.

Lưu ý private key phải giữ `\n`:

```env
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 7. Tài Khoản Test Chuẩn

Repo không chứa secret hoặc tài khoản Firebase thật. Bảng dưới đây là bộ tài khoản test nên tạo trong Firebase test project.

### 7.1. Guest

| Vai trò | Cách dùng |
|---|---|
| Guest | Không đăng nhập |

Guest test được:

- Landing page.
- Lessons list mock.
- Leaderboard demo.
- Một số trang public/demo.

### 7.2. Parent

Parent dùng Google login, không dùng email/password trong UI hiện tại.

| Field | Giá trị đề xuất |
|---|---|
| Role | `parent` |
| Login method | Google |
| Test account | `melon.parent.test@gmail.com` hoặc Google account test của nhóm |
| Password | Không lưu trong repo; dùng password Google test account của nhóm |

Cách tạo:

1. Mở `http://localhost:3000`.
2. Bấm login.
3. Chọn tab `Parent`.
4. Bấm `Continue with Google`.
5. Login Google test account.
6. App tự tạo document `users/{uid}` với role `parent`.

### 7.3. Admin

Admin cũng login bằng Google, sau đó promote role bằng dev helper.

| Field | Giá trị đề xuất |
|---|---|
| Role | `admin` |
| Login method | Google |
| Test account | `melon.admin.test@gmail.com` hoặc Google account test của nhóm |
| Password | Không lưu trong repo |

Cách tạo:

1. Login Google bằng account admin test.
2. Mở:

   ```text
   http://localhost:3000/admin
   ```

3. Nếu chưa phải admin, bấm:

   ```text
   Set My Role to Admin
   ```

4. Logout rồi login lại, hoặc reload.
5. Vào lại `/admin`, kỳ vọng thấy admin dashboard.

### 7.4. Child

Child không cần Gmail. Parent tạo child ở trang Family.

| Field | Giá trị đề xuất |
|---|---|
| Role | `kid` |
| Login method | Child ID + PIN/password |
| Child ID | `melon_kid01` |
| PIN/password | `123456` |
| Display name | `Melon Kid 01` |
| Grade | `Grade 4` |
| Weak topics | `fractions`, `word_problems` |
| Current score | `7` |
| Target score | `9` |
| Session minutes | `30` |
| Sessions/week | `5` |

Cách tạo:

1. Login parent.
2. Mở:

   ```text
   http://localhost:3000/family
   ```

3. Điền form tạo child:
   - Child ID: `melon_kid01`
   - Display Name: `Melon Kid 01`
   - Grade: `Grade 4`
   - PIN/password: `123456`
   - Confirm PIN/password: `123456`
   - Chọn weak topics.
4. Bấm `Create Child`.
5. Kỳ vọng child xuất hiện ở danh sách bên phải.

Login child:

1. Logout parent.
2. Mở login modal.
3. Chọn tab `Child`.
4. Nhập:
   - Child ID: `melon_kid01`
   - PIN/password: `123456`
5. Kỳ vọng login thành công và role là `kid`.

## 8. Dữ Liệu Test Chuẩn

### 8.1. Lesson mock có sẵn

Các lesson có thể test ngay:

| Lesson ID | URL |
|---|---|
| `lesson-001` | `http://localhost:3000/lessons/lesson-001` |
| `lesson-002` | `http://localhost:3000/lessons/lesson-002` |
| `lesson-003` | `http://localhost:3000/lessons/lesson-003` |
| `lesson-004` | `http://localhost:3000/lessons/lesson-004` |
| `lesson-005` | `http://localhost:3000/lessons/lesson-005` |

### 8.2. Progress API data

Demo child:

```text
demo-child
```

Test API:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/progress/demo-child `
  -Method Get | ConvertTo-Json -Depth 8
```

Manual completion payload:

```powershell
$body = @{
  childUid = "test-child"
  lessonId = "lesson-test"
  lessonTitle = "Test Lesson"
  subject = "math"
  scorePercent = 88
  quizCorrect = 3
  quizTotal = 4
  xpEarned = 120
  timeOnTaskSeconds = 600
  concepts = @("fractions")
  skills = @("problem_solving")
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/progress/lesson-completion `
  -Method Post `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 8
```

### 8.3. Question bank data

Question bank cần có dữ liệu trong Firestore để test `/practice` và `/study` tốt nhất.

Các cách tạo dữ liệu:

```powershell
cd src\web
npm run seed:course-pipelines
npm run migrate:question-bank
npm run import:pdf-question-bank
```

Các script này thường cần Firebase Admin env.

Nếu không có file PDF/input cho import, dùng admin UI:

```text
http://localhost:3000/admin/question-bank
```

Sau đó dùng tab `Đọc đề` để parse đề từ text/PDF/image.

## 9. Link Test Chính

| Tính năng | URL |
|---|---|
| Home | `http://localhost:3000` |
| Lessons | `http://localhost:3000/lessons` |
| Lesson player | `http://localhost:3000/lessons/lesson-001` |
| Child progress page | `http://localhost:3000/progress` |
| Badges | `http://localhost:3000/badges` |
| Leaderboard | `http://localhost:3000/leaderboard` |
| Parent dashboard | `http://localhost:3000/parent` |
| Family management | `http://localhost:3000/family` |
| Practice | `http://localhost:3000/practice` |
| Study | `http://localhost:3000/study` |
| Admin dashboard | `http://localhost:3000/admin` |
| Admin lessons | `http://localhost:3000/admin/lessons` |
| Admin question bank | `http://localhost:3000/admin/question-bank` |
| Admin PDF upload | `http://localhost:3000/admin/pdf-upload` |
| Backend Swagger | `http://127.0.0.1:8001/docs` |

## 10. Test Role: Guest

Không đăng nhập.

### 10.1. Landing page

URL:

```text
http://localhost:3000
```

Kỳ vọng:

- Page load không crash.
- Header/nav hiển thị.
- Nút login mở modal.
- Có thể chuyển giữa Parent và Child tab trong modal.

### 10.2. Lessons public/demo

URL:

```text
http://localhost:3000/lessons
```

Kỳ vọng:

- Thấy danh sách lesson mock.
- Filter subject hoạt động.
- Click lesson mở player.

URL:

```text
http://localhost:3000/lessons/lesson-001
```

Kỳ vọng:

- Slide text hiển thị.
- Quiz hiển thị đáp án.
- Hoàn thành lesson được.
- Vì chưa login, progress server không ghi theo user thật.

### 10.3. Parent/admin guard

Mở:

```text
http://localhost:3000/parent
http://localhost:3000/family
http://localhost:3000/admin
```

Kỳ vọng:

- Parent/family yêu cầu parent account.
- Admin yêu cầu admin access.

## 11. Test Role: Parent

### 11.1. Parent login

1. Mở `http://localhost:3000`.
2. Bấm login.
3. Chọn `Parent`.
4. Bấm `Continue with Google`.
5. Login Google test account.

Kỳ vọng:

- Login thành công.
- Document `users/{parentUid}` được tạo với `role: "parent"`.

### 11.2. Family - tạo child account

URL:

```text
http://localhost:3000/family
```

Dữ liệu nhập:

```text
Child ID: melon_kid01
Display Name: Melon Kid 01
Grade: Grade 4
PIN/password: 123456
Confirm PIN/password: 123456
Primary goal: Improve math score
Current score: 7
Target score: 9
Weak topics: Fractions, Word problems
Practice source: Both
Session minutes: 30
Sessions per week: 5
Reminder: Evening
Parent report: Weekly
```

Kỳ vọng:

- Tạo child thành công.
- Child xuất hiện trong list.
- Firestore có:
  - `users/{childUid}` role `kid`
  - `children/{childUid}`
  - `childCredentials/{loginId}`
  - parent user có `childUids`.

### 11.3. Parent dashboard

URL:

```text
http://localhost:3000/parent
```

Kỳ vọng:

- Nếu chưa có child thật, dashboard dùng `demo-child`.
- Nếu có child, dashboard tracking child đó.
- Các metric hiển thị:
  - Time Learned
  - Lessons Done
  - Avg Quiz
  - Total XP
  - Daily XP chart
  - Study Time chart
  - Subjects Studied
  - Recent Lesson Completions

### 11.4. Parent không được vào kid-only page

Mở khi đang login parent:

```text
http://localhost:3000/practice
http://localhost:3000/study
```

Kỳ vọng:

- App redirect hoặc hiển thị trạng thái redirect, vì `KidOnlyGuard` chặn parent/admin.

## 12. Test Role: Child

### 12.1. Child login

1. Logout parent.
2. Mở login modal.
3. Chọn tab `Child`.
4. Nhập:

```text
Child ID: melon_kid01
PIN/password: 123456
```

Kỳ vọng:

- Login thành công.
- Firebase sign-in bằng custom token.
- User role là `kid`.

### 12.2. Child học lesson

URL:

```text
http://localhost:3000/lessons/lesson-001
```

Flow:

1. Bấm `Got it` qua slide text.
2. Làm quiz.
3. Nếu trả lời sai, app cho thử lại.
4. Hoàn thành lesson.

Kỳ vọng:

- XP được cộng.
- Completion screen hiển thị.
- API `/api/v1/progress/lesson-completion` được gọi.
- Firestore hoặc local/server progress store ghi:
  - lesson completion
  - quiz score
  - XP
  - time-on-task
  - concepts/skills nếu có.

Kiểm bằng API:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/progress/<childUid> `
  -Method Get | ConvertTo-Json -Depth 8
```

### 12.3. Child progress page

URL:

```text
http://localhost:3000/progress
```

Kỳ vọng:

- Hiển thị XP, level, badges, recent activity.

### 12.4. Child practice

URL:

```text
http://localhost:3000/practice
```

Kỳ vọng nếu question bank đã có dữ liệu:

- Thấy danh sách đề hoặc câu hỏi.
- Bắt đầu làm bài được.
- Submit answer.
- Kết quả đúng/sai hiển thị.
- API `/api/questions/attempts` lưu attempt.
- Progress aggregate cập nhật:
  - `studentExerciseAttempts`
  - `studentProgress`
  - `kidQuestionStats`

### 12.5. Child study personalized flow

URL:

```text
http://localhost:3000/study
```

Kỳ vọng:

- App load câu hỏi từ Firestore `questionBank`.
- Nếu có `courseRunId`:

```text
http://localhost:3000/study?courseRunId=<courseRunId>
```

- App auto-start personalized exercise panel.
- Submit answer cập nhật progress.

## 13. Test Role: Admin

### 13.1. Admin login/promote

1. Login bằng Google account admin test.
2. Mở:

```text
http://localhost:3000/admin
```

3. Nếu thấy `Admin Access Required`, bấm:

```text
Set My Role to Admin
```

4. Logout/login lại.

Kỳ vọng:

- Vào được admin dashboard.
- `users/{adminUid}.role` là `admin`.

### 13.2. Admin dashboard

URL:

```text
http://localhost:3000/admin
```

Kỳ vọng:

- Dashboard load được.
- Các card/stat không crash.

### 13.3. Admin question bank

URL:

```text
http://localhost:3000/admin/question-bank
```

Tab `Đọc đề`:

- Paste đề toán hoặc upload PDF/image.
- Nếu dùng AI parsing, cần `GOOGLE_GENERATIVE_AI_API_KEY`.
- Parse ra câu hỏi.
- Save vào Firestore.

Tab `Quản lý kho`:

- Xem danh sách question sets/questions.
- Kiểm tra bộ đề mới xuất hiện.

Kỳ vọng Firestore:

- `questionSets`
- `questionBank`

### 13.4. Admin PDF upload/RAG

URL:

```text
http://localhost:3000/admin/pdf-upload
```

Điều kiện:

- Cloudinary env đầy đủ.
- FastAPI backend đang chạy.
- `MELON_AI_BACKEND_URL=http://127.0.0.1:8001`.

Flow:

1. Nhập `Lesson ID`, ví dụ `math-rag-001`.
2. Chọn subject.
3. Upload PDF.
4. Chờ Cloudinary upload.
5. Chờ Melon AI ingestion.
6. Lấy `file_id`.
7. Generate quiz.
8. Save as local lesson.
9. Mở `/lessons`, kiểm tra lesson mới.

Kỳ vọng:

- Cloudinary trả URL.
- Backend `/api/v1/ingest` trả job.
- Ingest completed.
- Quiz generated từ context.

### 13.5. Admin lessons

URL:

```text
http://localhost:3000/admin/lessons
```

Kỳ vọng:

- Page load được.
- Danh sách lessons/admin tools không crash.

## 14. Test API Trực Tiếp

### 14.1. Progress summary

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/progress/demo-child `
  -Method Get | ConvertTo-Json -Depth 8
```

### 14.2. Lesson completion

```powershell
$body = @{
  childUid = "api-child"
  lessonId = "api-lesson-001"
  lessonTitle = "API Test Lesson"
  subject = "math"
  scorePercent = 90
  quizCorrect = 4
  quizTotal = 5
  xpEarned = 150
  timeOnTaskSeconds = 900
  concepts = @("geometry")
  skills = @("reasoning")
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/progress/lesson-completion `
  -Method Post `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 8
```

### 14.3. Child login API

```powershell
$body = @{
  loginId = "melon_kid01"
  passwordOrPin = "123456"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:3000/api/auth/child/login `
  -Method Post `
  -ContentType "application/json" `
  -Body $body | ConvertTo-Json -Depth 4
```

Kỳ vọng:

```json
{
  "customToken": "..."
}
```

### 14.4. AI moderation

Cần `OPENAI_API_KEY`.

```powershell
curl -X POST http://localhost:3000/api/v1/ai/moderate `
  -H "Content-Type: application/json" `
  -d '{"text":"Can you help me learn fractions?"}'
```

### 14.5. RAG ingest proxy

Cần backend chạy.

```powershell
curl -F "file=@sample.pdf" http://localhost:3000/api/v1/rag/ingest
```

Poll:

```powershell
curl http://localhost:3000/api/v1/rag/ingest/<job_id>
```

## 15. Full End-To-End Scenario Khuyến Nghị

### Scenario A: Guest smoke test

1. Mở `/`.
2. Mở `/lessons`.
3. Mở `/lessons/lesson-001`.
4. Làm lesson đến completion.
5. Mở `/leaderboard`.

Pass nếu không crash và UI chính hoạt động.

### Scenario B: Parent creates child

1. Login parent bằng Google.
2. Mở `/family`.
3. Tạo `melon_kid01`.
4. Kiểm tra child card.
5. Mở `/parent`.

Pass nếu child được tạo và dashboard load.

### Scenario C: Child learns and progress appears for parent

1. Logout parent.
2. Login child `melon_kid01` / `123456`.
3. Hoàn thành `/lessons/lesson-001`.
4. Logout child.
5. Login parent.
6. Mở `/parent`.

Pass nếu dashboard có completion mới, time-on-task, XP, avg quiz.

### Scenario D: Admin creates question bank

1. Login admin.
2. Mở `/admin/question-bank`.
3. Parse/paste đề toán mẫu.
4. Save question set.
5. Mở tab quản lý kho.

Pass nếu câu hỏi xuất hiện trong Firestore và UI.

### Scenario E: Child practice updates personalized progress

1. Login child.
2. Mở `/practice`.
3. Chọn đề/câu hỏi.
4. Submit một số đáp án đúng/sai.
5. Mở `/progress` hoặc parent dashboard.

Pass nếu attempts được lưu và accuracy/weak concepts cập nhật.

### Scenario F: Admin RAG PDF to generated lesson

1. Chạy FastAPI backend.
2. Login admin.
3. Mở `/admin/pdf-upload`.
4. Upload PDF.
5. Ingest completed.
6. Generate quiz.
7. Save lesson.
8. Mở `/lessons`.
9. Học lesson generated.

Pass nếu lesson generated học được.

## 16. Dữ Liệu Đề Toán Mẫu Để Paste

Dùng trong `/admin/question-bank` hoặc `/practice` upload text.

```text
ĐỀ TEST TOÁN LỚP 4

Câu 1. Tính: 125 + 378 = ?
A. 493
B. 503
C. 513
D. 523
Đáp án: B
Giải thích: 125 + 378 = 503.

Câu 2. Một hình chữ nhật có chiều dài 12 cm, chiều rộng 5 cm. Diện tích là bao nhiêu?
A. 17 cm2
B. 34 cm2
C. 60 cm2
D. 120 cm2
Đáp án: C
Giải thích: Diện tích hình chữ nhật = dài x rộng = 12 x 5 = 60 cm2.

Câu 3. Rút gọn phân số 6/12.
A. 1/2
B. 1/3
C. 2/3
D. 3/4
Đáp án: A
Giải thích: Chia cả tử và mẫu cho 6, ta được 1/2.
```

## 17. Checklist Trước Khi Demo

### Local services

- [ ] Frontend chạy ở `http://localhost:3000`.
- [ ] Backend AI chạy ở `http://127.0.0.1:8001` nếu test RAG/TTS.
- [ ] `npm run type-check` pass.

### Env

- [ ] Firebase client env đúng.
- [ ] Firebase Admin env đúng.
- [ ] Cloudinary env đúng.
- [ ] OpenAI key đúng.
- [ ] Gemini key đúng nếu test image/PDF parsing.
- [ ] ElevenLabs key đúng nếu test TTS.

### Accounts

- [ ] Parent Google account login được.
- [ ] Admin Google account đã promote admin.
- [ ] Child `melon_kid01` tạo được.
- [ ] Child login bằng ID/PIN được.

### Data

- [ ] Có lesson mock.
- [ ] Có ít nhất một child.
- [ ] Có ít nhất một lesson completion.
- [ ] Có question bank data nếu test practice/study.
- [ ] Có PDF test nếu test RAG upload.

## 18. Lỗi Thường Gặp

### 18.1. Login Google không hoạt động

Kiểm tra:

- Firebase env client.
- Google provider đã bật.
- Authorized domain có `localhost`.

### 18.2. Child creation lỗi `Missing FIREBASE_ADMIN_*`

Kiểm tra:

```env
FIREBASE_ADMIN_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_ADMIN_PRIVATE_KEY
```

Restart frontend sau khi sửa env.

### 18.3. Child login lỗi

Kiểm tra:

- Child ID đúng.
- PIN/password đúng.
- Firestore có `childCredentials/{loginId}`.
- Firebase Admin env đúng.

### 18.4. Parent dashboard trống

Kiểm tra:

- Parent đã tạo child.
- Child đã hoàn thành lesson hoặc có exercise attempts.
- Gọi API:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/progress/<childUid> `
  -Method Get | ConvertTo-Json -Depth 8
```

### 18.5. Practice/study không có câu hỏi

Kiểm tra:

- Firestore `questionBank` có document.
- Đã chạy seed/import hoặc dùng admin question bank để tạo dữ liệu.

### 18.6. PDF upload lỗi

Kiểm tra:

- Cloudinary cloud name.
- Cloudinary unsigned upload preset.
- Backend AI đang chạy.
- `MELON_AI_BACKEND_URL` đúng.

### 18.7. AI tutor/chat lỗi

Kiểm tra:

- `OPENAI_API_KEY`.
- Quota OpenAI.
- Network.

## 19. Lệnh Kiểm Tra Code

Type-check:

```powershell
cd src\web
npm run type-check
```

Lint scoped cho các module mới:

```powershell
npx eslint "app/lessons/[id]/page.tsx" app/parent/page.tsx app/api/v1/progress lib/progress
```

Lint toàn repo:

```powershell
npm run lint
```

Lưu ý: nếu lint toàn repo fail ở file cũ, ghi lại lỗi cụ thể. Đừng kết luận app không chạy nếu type-check và flow chính vẫn pass.

## 20. Ghi Chú Bảo Mật Khi Demo

- Không commit `.env.local`.
- Không chụp màn hình private key.
- Không đưa password Google thật vào tài liệu public.
- Child PIN trong tài liệu này chỉ dùng cho Firebase test project.
- Admin self-promote là dev helper, không dùng cho production.

