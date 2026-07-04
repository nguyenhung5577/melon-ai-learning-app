import { collections } from "@/lib/db/firestore";
import { getDocument, queryDocuments, setDocument } from "@/lib/db/firestore-helpers";
import { where } from "firebase/firestore";

export type LessonType = "video" | "interactive" | "quiz" | "reading";
export type Subject = "math";

export interface LessonSlide {
  id: string;
  type: "text" | "quiz" | "drag-drop" | "fill-blank";
  title: string;
  content: string;
  questionId?: string;
  options?: string[];
  answer?: string | string[];
  xp: number;
}

export interface Lesson {
  id: string;
  title: string;
  subject: Subject;
  type: LessonType;
  emoji: string;
  description: string;
  duration: number;
  xpReward: number;
  difficulty: 1 | 2 | 3;
  tags: string[];
  slides: LessonSlide[];
  aiEnabled: boolean;
  audioEnabled: boolean;
  thumbnailBg: string;
  cloudinaryUrl?: string;
  pdfUrl?: string;
  archived?: boolean;
  deletedAt?: string;
  updatedAt?: string;
  createdAt: string;
}

const CURRICULUM_TAG = "math_curriculum_v2";
const GRADE_TAGS = new Set(["grade_4", "grade_5"]);

function slideId(lessonId: string, index: number) {
  return `${lessonId}-s${index}`;
}

function textSlide(lessonId: string, index: number, title: string, content: string, xp = 15): LessonSlide {
  return {
    id: slideId(lessonId, index),
    type: "text",
    title,
    content,
    xp,
  };
}

function quizSlide(
  lessonId: string,
  index: number,
  title: string,
  content: string,
  options: string[],
  answer: string,
  xp = 35
): LessonSlide {
  return {
    id: slideId(lessonId, index),
    type: "quiz",
    title,
    content,
    options,
    answer,
    xp,
  };
}

function lesson(params: Omit<Lesson, "subject" | "aiEnabled" | "audioEnabled" | "createdAt" | "tags"> & {
  tags: string[];
}): Lesson {
  return {
    ...params,
    subject: "math",
    aiEnabled: true,
    audioEnabled: true,
    tags: [CURRICULUM_TAG, ...params.tags],
    createdAt: "2026-06-01T00:00:00Z",
  };
}

export const MATH_CURRICULUM_LESSONS: Lesson[] = [
  lesson({
    id: "math-g4-fractions-foundation",
    title: "Phân số: tử số, mẫu số và phần bằng nhau",
    type: "interactive",
    emoji: "🍉",
    description: "Ôn nền tảng phân số bằng hình ảnh phần bằng nhau, phù hợp khi con còn nhầm tử số và mẫu số.",
    duration: 12,
    xpReward: 110,
    difficulty: 1,
    tags: ["grade_4", "fractions", "nhan_biet"],
    thumbnailBg: "#ff914d",
    slides: [
      textSlide(
        "math-g4-fractions-foundation",
        1,
        "Phân số là gì?",
        "Một phân số cho biết ta lấy **mấy phần bằng nhau** trong một hình hoặc một nhóm đồ vật. Số ở trên là **tử số**, số ở dưới là **mẫu số**."
      ),
      quizSlide(
        "math-g4-fractions-foundation",
        2,
        "Kiểm tra nhanh",
        "Trong phân số 3/8, mẫu số là số nào?",
        ["3", "8", "5", "11"],
        "8"
      ),
      textSlide(
        "math-g4-fractions-foundation",
        3,
        "Mẹo nhớ",
        "Mẫu số cho biết hình được chia thành bao nhiêu phần bằng nhau. Tử số cho biết mình đang xét bao nhiêu phần trong đó."
      ),
    ],
  }),
  lesson({
    id: "math-g4-equivalent-fractions",
    title: "Phân số bằng nhau",
    type: "interactive",
    emoji: "🧩",
    description: "Giúp con hiểu vì sao 1/2 = 2/4 = 3/6 bằng cách nhân hoặc chia cả tử và mẫu.",
    duration: 14,
    xpReward: 130,
    difficulty: 2,
    tags: ["grade_4", "fractions", "thong_hieu"],
    thumbnailBg: "#ffde59",
    slides: [
      textSlide(
        "math-g4-equivalent-fractions",
        1,
        "Cùng nhân cả tử và mẫu",
        "Nếu nhân cả tử số và mẫu số với cùng một số khác 0, ta được một phân số **bằng phân số ban đầu**."
      ),
      quizSlide(
        "math-g4-equivalent-fractions",
        2,
        "Chọn phân số bằng nhau",
        "Phân số nào bằng 1/2?",
        ["2/3", "2/4", "3/4", "4/6"],
        "2/4"
      ),
      quizSlide(
        "math-g4-equivalent-fractions",
        3,
        "Tìm số còn thiếu",
        "2/5 = 6/?",
        ["10", "12", "15", "20"],
        "15"
      ),
    ],
  }),
  lesson({
    id: "math-g4-common-denominator",
    title: "Quy đồng mẫu số để so sánh phân số",
    type: "interactive",
    emoji: "⚖️",
    description: "Luyện bước tìm mẫu số chung, đổi phân số, rồi so sánh tử số.",
    duration: 16,
    xpReward: 150,
    difficulty: 2,
    tags: ["grade_4", "fractions", "thong_hieu", "recommended"],
    thumbnailBg: "#38b6ff",
    slides: [
      textSlide(
        "math-g4-common-denominator",
        1,
        "Vì sao cần quy đồng?",
        "Khi hai phân số có mẫu số khác nhau, ta đưa chúng về **cùng mẫu số** để so sánh dễ hơn."
      ),
      textSlide(
        "math-g4-common-denominator",
        2,
        "Ba bước làm",
        "**Bước 1:** tìm mẫu số chung. **Bước 2:** đổi từng phân số. **Bước 3:** so sánh tử số."
      ),
      quizSlide(
        "math-g4-common-denominator",
        3,
        "So sánh",
        "So sánh 1/3 và 2/6.",
        ["1/3 < 2/6", "1/3 = 2/6", "1/3 > 2/6", "Không so sánh được"],
        "1/3 = 2/6"
      ),
    ],
  }),
  lesson({
    id: "math-g4-fraction-add-subtract",
    title: "Cộng trừ phân số cùng mẫu và khác mẫu",
    type: "quiz",
    emoji: "➕",
    description: "Tập trung vào lỗi thường gặp: quên quy đồng trước khi cộng hoặc trừ.",
    duration: 18,
    xpReward: 170,
    difficulty: 2,
    tags: ["grade_4", "fractions", "van_dung"],
    thumbnailBg: "#b497ff",
    slides: [
      textSlide(
        "math-g4-fraction-add-subtract",
        1,
        "Cùng mẫu thì giữ mẫu",
        "Khi cộng hoặc trừ hai phân số cùng mẫu số, ta giữ nguyên mẫu số và cộng hoặc trừ tử số."
      ),
      quizSlide(
        "math-g4-fraction-add-subtract",
        2,
        "Cùng mẫu",
        "3/7 + 2/7 = ?",
        ["5/7", "5/14", "6/7", "1/7"],
        "5/7"
      ),
      quizSlide(
        "math-g4-fraction-add-subtract",
        3,
        "Khác mẫu",
        "1/2 + 1/4 = ?",
        ["2/6", "1/6", "3/4", "2/4"],
        "3/4"
      ),
    ],
  }),
  lesson({
    id: "math-g4-word-problem-reading",
    title: "Toán có lời văn: đọc đề không bị rối",
    type: "interactive",
    emoji: "🔎",
    description: "Rèn thói quen gạch câu hỏi, tìm dữ kiện và chọn phép tính trước khi giải.",
    duration: 15,
    xpReward: 140,
    difficulty: 1,
    tags: ["grade_4", "word_problems", "nhan_biet", "recommended"],
    thumbnailBg: "#22c55e",
    slides: [
      textSlide(
        "math-g4-word-problem-reading",
        1,
        "Đọc đề theo 3 bước",
        "**Bước 1:** đề hỏi gì? **Bước 2:** dữ kiện nào cần dùng? **Bước 3:** cần cộng, trừ, nhân hay chia?"
      ),
      quizSlide(
        "math-g4-word-problem-reading",
        2,
        "Chọn phép tính",
        "Lan có 24 viên bi, cho bạn 9 viên. Hỏi Lan còn lại bao nhiêu viên bi?",
        ["24 + 9", "24 - 9", "24 x 9", "24 : 9"],
        "24 - 9"
      ),
      quizSlide(
        "math-g4-word-problem-reading",
        3,
        "Đề hỏi gì?",
        "Một đề hỏi 'còn lại bao nhiêu', thường con cần nghĩ đến phép tính nào trước?",
        ["Cộng", "Trừ", "Nhân", "Chia"],
        "Trừ"
      ),
    ],
  }),
  lesson({
    id: "math-g5-word-problem-fractions",
    title: "Bài toán lời văn với phân số",
    type: "interactive",
    emoji: "📝",
    description: "Kết hợp đọc đề và phân số: tìm phần đã dùng, phần còn lại, hoặc tổng số phần.",
    duration: 18,
    xpReward: 180,
    difficulty: 3,
    tags: ["grade_5", "word_problems", "fractions", "van_dung"],
    thumbnailBg: "#ff85c0",
    slides: [
      textSlide(
        "math-g5-word-problem-fractions",
        1,
        "Tóm tắt trước khi tính",
        "Với bài toán phân số, con nên viết ngắn: **có gì**, **dùng bao nhiêu phần**, **hỏi phần nào**."
      ),
      quizSlide(
        "math-g5-word-problem-fractions",
        2,
        "Phần còn lại",
        "Một bình nước đầy. Minh uống 1/4 bình. Còn lại bao nhiêu phần bình?",
        ["1/4", "2/4", "3/4", "4/4"],
        "3/4"
      ),
      quizSlide(
        "math-g5-word-problem-fractions",
        3,
        "Chọn phép tính",
        "Muốn tìm phần còn lại sau khi dùng 2/5, ta tính:",
        ["1 + 2/5", "1 - 2/5", "2/5 - 1", "1 x 2/5"],
        "1 - 2/5"
      ),
    ],
  }),
  lesson({
    id: "math-g4-geometry-area-perimeter",
    title: "Chu vi và diện tích hình chữ nhật",
    type: "interactive",
    emoji: "📐",
    description: "Phân biệt chu vi là đường bao quanh, diện tích là phần mặt bên trong.",
    duration: 15,
    xpReward: 145,
    difficulty: 2,
    tags: ["grade_4", "geometry", "thong_hieu"],
    thumbnailBg: "#38b6ff",
    slides: [
      textSlide(
        "math-g4-geometry-area-perimeter",
        1,
        "Chu vi và diện tích khác nhau thế nào?",
        "**Chu vi** là độ dài đường bao quanh. **Diện tích** là phần mặt phẳng bên trong hình."
      ),
      quizSlide(
        "math-g4-geometry-area-perimeter",
        2,
        "Công thức chu vi",
        "Hình chữ nhật dài 8 cm, rộng 3 cm. Chu vi là:",
        ["11 cm", "22 cm", "24 cm", "48 cm"],
        "22 cm"
      ),
      quizSlide(
        "math-g4-geometry-area-perimeter",
        3,
        "Công thức diện tích",
        "Hình chữ nhật dài 8 cm, rộng 3 cm. Diện tích là:",
        ["11 cm²", "22 cm²", "24 cm²", "48 cm²"],
        "24 cm²"
      ),
    ],
  }),
  lesson({
    id: "math-g5-decimals-place-value",
    title: "Số thập phân và giá trị chữ số",
    type: "interactive",
    emoji: "🔢",
    description: "Ôn hàng phần mười, phần trăm và cách đọc số thập phân.",
    duration: 14,
    xpReward: 135,
    difficulty: 2,
    tags: ["grade_5", "arithmetic", "decimals", "thong_hieu"],
    thumbnailBg: "#ffde59",
    slides: [
      textSlide(
        "math-g5-decimals-place-value",
        1,
        "Đọc số thập phân",
        "Trong số thập phân, chữ số bên phải dấu phẩy lần lượt thuộc hàng phần mười, phần trăm, phần nghìn."
      ),
      quizSlide(
        "math-g5-decimals-place-value",
        2,
        "Giá trị chữ số",
        "Trong số 4,37, chữ số 3 thuộc hàng nào?",
        ["Đơn vị", "Phần mười", "Phần trăm", "Phần nghìn"],
        "Phần mười"
      ),
      quizSlide(
        "math-g5-decimals-place-value",
        3,
        "So sánh",
        "Số nào lớn hơn?",
        ["4,3", "4,27", "Hai số bằng nhau", "Không so sánh được"],
        "4,3"
      ),
    ],
  }),
  lesson({
    id: "math-g5-ratio-rate",
    title: "Tỉ số và bài toán rút về đơn vị",
    type: "interactive",
    emoji: "⚡",
    description: "Giúp con nhận ra bài toán 'mỗi một' và dùng chia trước, nhân sau.",
    duration: 18,
    xpReward: 180,
    difficulty: 3,
    tags: ["grade_5", "word_problems", "arithmetic", "van_dung"],
    thumbnailBg: "#b497ff",
    slides: [
      textSlide(
        "math-g5-ratio-rate",
        1,
        "Rút về đơn vị",
        "Nếu biết nhiều đơn vị có tổng bao nhiêu, ta có thể chia để tìm **1 đơn vị**, rồi nhân để tìm số đơn vị cần hỏi."
      ),
      quizSlide(
        "math-g5-ratio-rate",
        2,
        "Tìm 1 đơn vị",
        "3 quyển vở giá 24 000 đồng. 1 quyển vở giá bao nhiêu?",
        ["6 000 đồng", "8 000 đồng", "21 000 đồng", "72 000 đồng"],
        "8 000 đồng"
      ),
      quizSlide(
        "math-g5-ratio-rate",
        3,
        "Tìm nhiều đơn vị",
        "Nếu 1 quyển vở giá 8 000 đồng, 5 quyển giá bao nhiêu?",
        ["13 000 đồng", "32 000 đồng", "40 000 đồng", "48 000 đồng"],
        "40 000 đồng"
      ),
    ],
  }),
  lesson({
    id: "math-g5-mixed-exam-strategy",
    title: "Chiến thuật làm đề Toán tổng hợp",
    type: "quiz",
    emoji: "🎯",
    description: "Luyện cách chọn câu dễ trước, kiểm tra lại phép tính và không bỏ trống câu vừa sức.",
    duration: 20,
    xpReward: 200,
    difficulty: 2,
    tags: ["grade_5", "mixed_exams", "logic", "van_dung"],
    thumbnailBg: "#22c55e",
    slides: [
      textSlide(
        "math-g5-mixed-exam-strategy",
        1,
        "Làm câu dễ trước",
        "Khi gặp đề tổng hợp, con nên làm câu chắc trước để lấy điểm và giữ bình tĩnh."
      ),
      quizSlide(
        "math-g5-mixed-exam-strategy",
        2,
        "Chọn chiến thuật",
        "Nếu gặp câu quá khó ngay đầu bài, con nên làm gì?",
        ["Bỏ cả đề", "Dừng lại thật lâu", "Đánh dấu rồi làm câu dễ trước", "Chọn bừa ngay"],
        "Đánh dấu rồi làm câu dễ trước"
      ),
      quizSlide(
        "math-g5-mixed-exam-strategy",
        3,
        "Kiểm tra lại",
        "Sau khi tính xong bài lời văn, việc nào giúp giảm lỗi sai?",
        ["Đọc lại câu hỏi và đơn vị", "Xóa hết bài", "Đổi đáp án liên tục", "Không cần xem lại"],
        "Đọc lại câu hỏi và đơn vị"
      ),
    ],
  }),
];

export const MOCK_LESSONS = MATH_CURRICULUM_LESSONS;

export function isCurrentMathLesson(lesson: Lesson): boolean {
  if (lesson.tags?.includes(CURRICULUM_TAG)) return true;
  return lesson.tags?.some((tag) => GRADE_TAGS.has(tag)) ?? false;
}

function uniqueLessons(lessons: Lesson[]): Lesson[] {
  const byId = new Map<string, Lesson>();
  for (const item of lessons) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}

function sortLessons(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    const aGrade = a.tags.includes("grade_4") ? 4 : 5;
    const bGrade = b.tags.includes("grade_4") ? 4 : 5;
    if (aGrade !== bGrade) return aGrade - bGrade;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return a.title.localeCompare(b.title, "vi");
  });
}

function mergeWithCurriculum(docs: Lesson[]): Lesson[] {
  const archivedIds = new Set(docs.filter((lesson) => lesson.archived).map((lesson) => lesson.id));
  const activeDocs = docs.filter((lesson) => !lesson.archived);

  return sortLessons(uniqueLessons([
    ...MATH_CURRICULUM_LESSONS.filter((lesson) => !archivedIds.has(lesson.id)),
    ...activeDocs,
  ]));
}

export async function seedLessons() {
  const existing = await queryDocuments(collections.lessons);
  const existingIds = new Set(existing.map((item) => item.id));
  for (const lesson of MATH_CURRICULUM_LESSONS) {
    if (!existingIds.has(lesson.id)) {
      await setDocument(collections.lessons, lesson.id, lesson, true);
    }
  }
}

export async function getAllLessons(): Promise<Lesson[]> {
  try {
    const docs = await queryDocuments(collections.lessons);
    return mergeWithCurriculum(docs);
  } catch {
    return MATH_CURRICULUM_LESSONS;
  }
}

export async function getLessonById(id: string): Promise<Lesson | undefined> {
  const fallback = MATH_CURRICULUM_LESSONS.find((lesson) => lesson.id === id);

  try {
    const doc = await getDocument(collections.lessons, id);
    if (doc?.archived) return undefined;
    if (doc) return doc;
    return fallback;
  } catch {
    return fallback;
  }
}

export async function getLessonsBySubject(subject: Subject): Promise<Lesson[]> {
  try {
    const docs = await queryDocuments(collections.lessons, where("subject", "==", subject));
    return mergeWithCurriculum(docs);
  } catch {
    return MATH_CURRICULUM_LESSONS;
  }
}
