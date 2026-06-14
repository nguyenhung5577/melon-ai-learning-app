import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx === -1) continue;
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);
const now = new Date().toISOString();

function stage(
  id,
  title,
  description,
  stageType,
  supportText,
  grade,
  rubricLevels,
  keywords,
  questionCount,
  passAccuracy,
  minAttempts,
  hintMode,
  uiMode,
  nextStageId,
  remedialStageId
) {
  return {
    id,
    title,
    description,
    stageType,
    supportText,
    questionFilter: {
      subject: "math",
      grade,
      rubricLevels,
      keywords,
      questionCount,
    },
    passAccuracy,
    minAttempts,
    hintMode,
    uiMode,
    ...(nextStageId ? { nextStageId } : {}),
    ...(remedialStageId ? { remedialStageId } : {}),
  };
}

function pipelineForCourse(course) {
  const keywords = course.entryKeywords;
  const grade = course.grade;
  return {
    id: `${course.id}-pipeline-v1`,
    courseId: course.id,
    version: 1,
    stages: [
      stage(
        "diagnostic",
        "Khởi động nhẹ",
        "Làm vài câu ngắn để vào nhịp trước khi học tiếp.",
        "diagnostic",
        "Chặng này giúp con bắt đầu nhẹ nhàng và làm quen với dạng bài sắp học.",
        grade,
        ["nhan_biet", "thong_hieu"],
        keywords,
        3,
        70,
        3,
        "available",
        "normal",
        "foundation",
        "foundation"
      ),
      stage(
        "foundation",
        "Ôn nền",
        "Ôn lại các ý chính để con làm chắc hơn.",
        "foundation",
        "Nếu còn vướng ở phần cơ bản, Melon sẽ chia nhỏ từng bước để con dễ theo.",
        grade,
        ["nhan_biet", "thong_hieu"],
        keywords,
        4,
        70,
        4,
        "step_by_step",
        "step_by_step",
        "practice",
        undefined
      ),
      stage(
        "practice",
        "Luyện chính",
        "Luyện tập đúng dạng bài trọng tâm của khóa học.",
        "practice",
        "Chặng này giúp con quen tay và làm vững hơn với dạng bài chính.",
        grade,
        ["thong_hieu", "van_dung"],
        keywords,
        5,
        75,
        5,
        "after_first_wrong",
        "slow_down_check_step",
        "checkpoint",
        "foundation"
      ),
      stage(
        "checkpoint",
        "Thử sức",
        "Làm một cụm câu để xem con đã sẵn sàng sang mức tiếp theo chưa.",
        "checkpoint",
        "Con cứ bình tĩnh làm từng câu, đây là chặng để tự tin hơn trước khi tăng độ khó.",
        grade,
        ["thong_hieu", "van_dung", "van_dung_cao"],
        keywords,
        4,
        80,
        4,
        "after_first_wrong",
        "normal",
        "challenge",
        "foundation"
      ),
      stage(
        "challenge",
        "Bứt phá",
        "Làm các câu linh hoạt hơn để tiến thêm một bước.",
        "challenge",
        "Khi đã chắc rồi, con sẽ gặp ít câu hơn nhưng cần suy nghĩ kỹ hơn.",
        grade,
        ["van_dung", "van_dung_cao"],
        keywords,
        3,
        85,
        3,
        "available",
        "normal",
        undefined,
        "practice"
      ),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

const courses = [
  {
    id: "math-g4-fractions",
    title: "Toán 4 - Phân số",
    subject: "math",
    grade: 4,
    primaryConcept: "fractions",
    conceptLabels: ["Phân số"],
    description: "Khóa học ôn nhận biết, so sánh và thao tác cơ bản với phân số lớp 4.",
    goalText: "Đọc hiểu, so sánh và làm đúng các bài phân số cơ bản.",
    entryKeywords: ["phân số", "tử số", "mẫu số", "quy đồng"],
    recommendedOrder: 1,
    status: "active",
  },
  {
    id: "math-g4-arithmetic",
    title: "Toán 4 - Số học và phép tính",
    subject: "math",
    grade: 4,
    primaryConcept: "arithmetic",
    conceptLabels: ["Số học", "Phép tính"],
    description: "Khóa học tập trung đặt tính, tính thuận tiện và phép chia nhân lớp 4.",
    goalText: "Làm chắc các phép tính và trình bày gọn bước tính.",
    entryKeywords: ["đặt tính", "tính", "thuận tiện", "chia", "nhân"],
    recommendedOrder: 2,
    status: "active",
  },
  {
    id: "math-g4-word-problems",
    title: "Toán 4 - Toán có lời văn",
    subject: "math",
    grade: 4,
    primaryConcept: "word_problems",
    conceptLabels: ["Toán có lời văn"],
    description: "Khóa học giúp con đọc đề, chọn phép tính và giải bài toán thực tế lớp 4.",
    goalText: "Biết tách dữ kiện và chọn đúng phép tính trong bài toán lời văn.",
    entryKeywords: ["hỏi", "bao nhiêu", "mua", "có tất cả", "còn lại"],
    recommendedOrder: 3,
    status: "active",
  },
  {
    id: "math-g5-fractions",
    title: "Toán 5 - Phân số và số thập phân",
    subject: "math",
    grade: 5,
    primaryConcept: "fractions",
    conceptLabels: ["Phân số", "Số thập phân"],
    description: "Khóa học ôn phân số, phân số thập phân và đổi qua lại với số thập phân.",
    goalText: "Làm chắc nhận biết và vận dụng phân số, số thập phân lớp 5.",
    entryKeywords: ["phân số", "thập phân", "phần mười", "phần trăm", "quy đồng"],
    recommendedOrder: 1,
    status: "active",
  },
  {
    id: "math-g5-mixed-exams",
    title: "Toán 5 - Đề tổng hợp",
    subject: "math",
    grade: 5,
    primaryConcept: "mixed_exams",
    conceptLabels: ["Đề tổng hợp"],
    description: "Khóa học mô phỏng các cụm câu tổng hợp để luyện chuyển dạng và giữ nhịp làm đề.",
    goalText: "Tăng độ ổn định khi gặp nhiều dạng bài trong cùng một cụm đề.",
    entryKeywords: ["đề kiểm tra", "tính", "thuận tiện", "viết số", "tỉ số phần trăm"],
    recommendedOrder: 2,
    status: "active",
  },
  {
    id: "math-g5-geometry",
    title: "Toán 5 - Hình học và đo lường",
    subject: "math",
    grade: 5,
    primaryConcept: "geometry",
    conceptLabels: ["Hình học", "Đo lường"],
    description: "Khóa học ôn diện tích, thể tích và nhận biết hình học lớp 5.",
    goalText: "Biết nhận dạng hình, đổi đơn vị và tính đúng các đại lượng hình học.",
    entryKeywords: ["hình", "diện tích", "thể tích", "hình hộp", "hình lập phương", "chu vi"],
    recommendedOrder: 3,
    status: "active",
  },
  {
    id: "math-g5-logic",
    title: "Toán 5 - Tư duy và chiến thuật làm bài",
    subject: "math",
    grade: 5,
    primaryConcept: "logic",
    conceptLabels: ["Tư duy logic", "Chiến thuật làm bài"],
    description: "Khóa học gom các câu cần suy luận, chọn chiến thuật và ra quyết định khi làm đề.",
    goalText: "Biết xử lý câu lạ, chọn chiến thuật phù hợp và giữ bình tĩnh khi làm đề.",
    entryKeywords: ["nên làm gì", "logic", "tư duy", "đúng", "suy luận"],
    recommendedOrder: 4,
    status: "active",
  },
].map((course) => ({
  ...course,
  pipelineId: `${course.id}-pipeline-v1`,
  createdAt: now,
  updatedAt: now,
}));

for (const course of courses) {
  const pipeline = pipelineForCourse(course);
  await db.collection("courses").doc(course.id).set(course, { merge: true });
  await db.collection("coursePipelines").doc(pipeline.id).set(pipeline, { merge: true });
  console.log(`Seeded ${course.id}`);
}

console.log(`Seeded ${courses.length} courses and ${courses.length} pipelines.`);
