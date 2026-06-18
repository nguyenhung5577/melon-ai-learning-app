import type { DocumentData, Firestore, Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import { syncCourseRunAttemptInTransaction } from "./course-run-store";
import type {
  DailyProgressPoint,
  LessonCompletionInput,
  LessonCompletionRecord,
  MasteryState,
  PersonalizedNextAction,
  PersonalizedWeaknessSummary,
  RecommendedQuestionFilter,
  StatBucket,
  StudentExerciseAttemptInput,
  StudentExerciseAttemptRecord,
  StudentLessonProgressRecord,
  StudentPersonalizedPlanRecord,
  StudentProgressRecord,
  SubjectProgressPoint,
  ProgressSummary,
} from "./types";

const SCHEMA_VERSION = 1;
const WEAK_ACCURACY_THRESHOLD = 70;
const MASTERED_ACCURACY_THRESHOLD = 85;
const MIN_CONCEPT_ATTEMPTS = 3;

type LearningPreferences = {
  primaryGoal?: "improve_math_score" | "specialized_school_exam" | "strengthen_current_grade";
  gradeLevel?: "grade_4" | "grade_5";
  currentScore?: number;
  targetScore?: number;
  weakTopics?: string[];
  practiceSource?: "school_lessons" | "past_exams" | "both";
  sessionMinutes?: 15 | 30 | 45 | 60;
  sessionsPerWeek?: 2 | 3 | 5 | 7;
};

type ChildDocument = {
  learningPreferences?: LearningPreferences;
};

type ConceptDiagnostic = {
  concept: string;
  label: string;
  attempts: number;
  accuracy: number;
  recentAttempts: number;
  recentAccuracy: number;
  lessonCompletions: number;
  lessonAverageScore: number;
  masteryState: MasteryState;
  masteryEstimate: number;
  reviewUrgency: number;
  frictionScore: number;
  trendScore: number;
  evidenceScore: number;
  priorityScore: number;
  lastPracticedAt?: string;
  daysSincePractice: number;
  rubricLevels: string[];
  needsAttention: boolean;
  preferenceRank?: number;
  goalRank?: number;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeLevel(xp: number): number {
  return Math.floor(Math.max(0, xp) / 200) + 1;
}

function toDayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function toUtcDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyDailyWindow(days = 7): DailyProgressPoint[] {
  const points: DailyProgressPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = toUtcDateKey(d);
    points.push({
      date,
      day: toDayLabel(date),
      lessonsCompleted: 0,
      timeOnTaskMinutes: 0,
      xpEarned: 0,
      averageQuizScore: 0,
    });
  }
  return points;
}

function average(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function averageFloat(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function median(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (valid.length === 0) return 0;
  const middle = Math.floor(valid.length / 2);
  if (valid.length % 2 === 0) return (valid[middle - 1] + valid[middle]) / 2;
  return valid[middle];
}

function daysSince(timestamp: string | undefined, now: string): number {
  if (!timestamp) return 999;
  const target = Date.parse(timestamp);
  const current = Date.parse(now);
  if (!Number.isFinite(target) || !Number.isFinite(current)) return 999;
  return Math.max(0, Math.round((current - target) / (1000 * 60 * 60 * 24)));
}

function unique(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function documentId(...parts: string[]): string {
  return parts
    .join("_")
    .trim()
    .replace(/[\\/]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)])
    ) as T;
  }
  return value;
}

function masteryStateFromScore(scorePercent: number): MasteryState {
  if (scorePercent >= 80) return "mastered";
  if (scorePercent > 0) return "developing";
  return "in_progress";
}

function updateStatBucket(existing: StatBucket | undefined, isCorrect: boolean, at: string): StatBucket {
  const attempts = Math.max(0, Number(existing?.attempts ?? 0)) + 1;
  const correct = Math.max(0, Number(existing?.correct ?? 0)) + (isCorrect ? 1 : 0);
  const accuracy = attempts > 0 ? clampPercent((correct / attempts) * 100) : 0;

  return {
    attempts,
    correct,
    accuracy,
    lastPracticedAt: at,
    masteryState: accuracy >= 80 ? "mastered" : accuracy >= 50 ? "developing" : "in_progress",
  };
}

function emptyProgress(childUid: string, now: string, child?: ChildDocument): StudentProgressRecord {
  const preferenceWeakTopics = child?.learningPreferences?.weakTopics ?? [];
  const weakConcepts = unique(preferenceWeakTopics);

  return {
    id: childUid,
    childUid,
    schemaVersion: SCHEMA_VERSION,
    totalLessonsCompleted: 0,
    totalLessonAttempts: 0,
    totalExerciseAttempts: 0,
    totalCorrectExerciseAttempts: 0,
    totalTimeOnTaskSeconds: 0,
    totalXpEarned: 0,
    averageQuizScore: 0,
    exerciseAccuracy: 0,
    level: 1,
    subjectStats: {},
    conceptStats: {},
    weakConcepts,
    recommendedConcepts: weakConcepts,
    createdAt: now,
    updatedAt: now,
  };
}

function progressFromData(childUid: string, data: DocumentData | undefined, now: string, child?: ChildDocument) {
  return {
    ...emptyProgress(childUid, now, child),
    ...(data ?? {}),
    id: childUid,
    childUid,
    schemaVersion: Number(data?.schemaVersion ?? SCHEMA_VERSION),
    subjectStats: (data?.subjectStats ?? {}) as Record<string, StatBucket>,
    conceptStats: (data?.conceptStats ?? {}) as Record<string, StatBucket>,
    weakConcepts: unique(data?.weakConcepts ?? child?.learningPreferences?.weakTopics ?? []),
    recommendedConcepts: unique(data?.recommendedConcepts ?? data?.weakConcepts ?? child?.learningPreferences?.weakTopics ?? []),
  } satisfies StudentProgressRecord;
}

function normalizeCompletion(input: LessonCompletionInput): LessonCompletionRecord {
  const quizTotal = Math.max(0, Math.floor(input.quizTotal));
  const quizCorrect = Math.max(0, Math.min(quizTotal, Math.floor(input.quizCorrect)));
  const quizScorePercent = quizTotal > 0 ? clampPercent((quizCorrect / quizTotal) * 100) : 0;
  const completedAt = input.completedAt ?? new Date().toISOString();

  return stripUndefined({
    ...input,
    id: documentId(input.childUid, input.lessonId, String(Date.now()), Math.random().toString(36).slice(2, 8)),
    subject: input.subject || "unknown",
    scorePercent: clampPercent(input.scorePercent),
    quizCorrect,
    quizTotal,
    quizScorePercent,
    xpEarned: Math.max(0, Math.round(input.xpEarned)),
    timeOnTaskSeconds: Math.max(0, Math.round(input.timeOnTaskSeconds)),
    concepts: unique(input.concepts ?? []),
    skills: unique(input.skills ?? []),
    completedAt,
    masteryState: masteryStateFromScore(input.scorePercent),
  });
}

function demoRecords(childUid: string): LessonCompletionRecord[] {
  const now = new Date();
  const seed: Array<Omit<LessonCompletionInput, "childUid" | "completedAt"> & { daysAgo: number }> = [
    {
      daysAgo: 6,
      lessonId: "math-g4-fractions-foundation",
      lessonTitle: "Phân số: tử số, mẫu số và phần bằng nhau",
      subject: "math",
      scorePercent: 78,
      quizCorrect: 2,
      quizTotal: 3,
      xpEarned: 110,
      timeOnTaskSeconds: 720,
      concepts: ["fractions"],
      skills: ["nhan_biet"],
    },
    {
      daysAgo: 5,
      lessonId: "math-g4-common-denominator",
      lessonTitle: "Quy đồng mẫu số để so sánh phân số",
      subject: "math",
      scorePercent: 62,
      quizCorrect: 1,
      quizTotal: 3,
      xpEarned: 150,
      timeOnTaskSeconds: 960,
      concepts: ["fractions"],
      skills: ["thong_hieu"],
    },
    {
      daysAgo: 3,
      lessonId: "math-g4-word-problem-reading",
      lessonTitle: "Toán có lời văn: đọc đề không bị rối",
      subject: "math",
      scorePercent: 67,
      quizCorrect: 1,
      quizTotal: 2,
      xpEarned: 140,
      timeOnTaskSeconds: 840,
      concepts: ["word_problems"],
      skills: ["nhan_biet"],
    },
    {
      daysAgo: 1,
      lessonId: "math-g4-geometry-area-perimeter",
      lessonTitle: "Chu vi và diện tích hình chữ nhật",
      subject: "math",
      scorePercent: 86,
      quizCorrect: 2,
      quizTotal: 2,
      xpEarned: 145,
      timeOnTaskSeconds: 780,
      concepts: ["geometry"],
      skills: ["thong_hieu"],
    },
  ];

  return seed.map((item) => {
    const completedAt = new Date(now);
    completedAt.setUTCDate(now.getUTCDate() - item.daysAgo);
    return normalizeCompletion({
      ...item,
      childUid,
      completedAt: completedAt.toISOString(),
    });
  }).map((record, index) => ({
    ...record,
    id: `${childUid}-demo-${index + 1}`,
  }));
}

function weakConceptsFrom(progress: StudentProgressRecord, child?: ChildDocument): string[] {
  const weakFromStats = Object.entries(progress.conceptStats ?? {})
    .map(([concept, stats]) => {
      const attempts = Math.max(0, Number(stats?.attempts ?? 0));
      const accuracy = clampPercent(Number(stats?.accuracy ?? 0));
      const staleDays = daysSince(stats?.lastPracticedAt, progress.updatedAt);
      const needsAttention =
        (attempts < MIN_CONCEPT_ATTEMPTS && accuracy < MASTERED_ACCURACY_THRESHOLD) ||
        accuracy < 78 ||
        (stats?.masteryState === "mastered" && staleDays >= 35);
      return { concept, attempts, accuracy, needsAttention };
    })
    .filter((item) => item.needsAttention)
    .sort((a, b) => {
      if (a.attempts !== b.attempts) return a.attempts - b.attempts;
      return a.accuracy - b.accuracy;
    })
    .map((item) => item.concept);

  if (progress.totalExerciseAttempts === 0 && weakFromStats.length === 0) {
    return unique(child?.learningPreferences?.weakTopics ?? []);
  }

  return unique(weakFromStats);
}

function gradeFromPreferences(child?: ChildDocument): number | undefined {
  if (child?.learningPreferences?.gradeLevel === "grade_4") return 4;
  if (child?.learningPreferences?.gradeLevel === "grade_5") return 5;
  return undefined;
}

const conceptLabels: Record<string, string> = {
  arithmetic: "Số học",
  fractions: "Phân số",
  geometry: "Hình học",
  word_problems: "Toán có lời văn",
  logic: "Tư duy logic",
  mixed_exams: "Đề tổng hợp",
};

function conceptLabel(concept: string): string {
  return conceptLabels[concept] ?? concept.replace(/[_-]+/g, " ");
}

function curriculumConceptsForGrade(child?: ChildDocument): string[] {
  if (child?.learningPreferences?.gradeLevel === "grade_5") {
    return ["arithmetic", "fractions", "geometry", "word_problems", "mixed_exams"];
  }
  return ["arithmetic", "fractions", "geometry", "word_problems"];
}

function goalPriorityConcepts(child?: ChildDocument): string[] {
  const prefs = child?.learningPreferences;
  const weakTopics = unique(prefs?.weakTopics ?? []);
  const curriculum = curriculumConceptsForGrade(child);
  const currentScore = Number(prefs?.currentScore ?? 0);
  const targetScore = Number(prefs?.targetScore ?? currentScore);
  const scoreGap = Math.max(0, targetScore - currentScore);

  if (prefs?.primaryGoal === "specialized_school_exam") {
    return unique([
      ...weakTopics,
      "mixed_exams",
      "logic",
      "word_problems",
      "arithmetic",
      "geometry",
      "fractions",
      ...curriculum,
    ]);
  }

  if (prefs?.primaryGoal === "strengthen_current_grade") {
    return unique([
      ...weakTopics,
      ...curriculum,
      "word_problems",
      "arithmetic",
      "geometry",
      "fractions",
    ]);
  }

  if (scoreGap >= 2) {
    return unique([
      ...weakTopics,
      "arithmetic",
      "word_problems",
      "fractions",
      "geometry",
      ...curriculum,
    ]);
  }

  return unique([
    ...weakTopics,
    ...curriculum,
    "mixed_exams",
  ]);
}

function goalSummaryText(child?: ChildDocument): string | undefined {
  const prefs = child?.learningPreferences;
  if (!prefs?.primaryGoal) return undefined;

  if (prefs.primaryGoal === "specialized_school_exam") {
    return "ưu tiên mục tiêu điểm cao và bài tổng hợp";
  }
  if (prefs.primaryGoal === "strengthen_current_grade") {
    return "ưu tiên bám chắc chương trình hiện tại";
  }
  const currentScore = Number(prefs.currentScore ?? 0);
  const targetScore = Number(prefs.targetScore ?? currentScore);
  if (targetScore > currentScore) {
    return `ưu tiên nâng từ ${currentScore}/10 lên ${targetScore}/10`;
  }
  return "ưu tiên cải thiện điểm số";
}

// Legacy helper retained while the richer rules_v2 plan is rolling out.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function weaknessSummaryFrom(progress: StudentProgressRecord, targetConcepts: string[]): PersonalizedWeaknessSummary[] {
  return targetConcepts.map((concept) => {
    const stats = progress.conceptStats?.[concept];
    const attempts = Math.max(0, Number(stats?.attempts ?? 0));
    const accuracy = clampPercent(Number(stats?.accuracy ?? 0));
    const masteryState = stats?.masteryState ?? "not_started";

    return {
      concept,
      attempts,
      accuracy,
      masteryState,
      needsAttention: attempts < MIN_CONCEPT_ATTEMPTS || accuracy < WEAK_ACCURACY_THRESHOLD,
    };
  });
}

// Legacy helper retained while the richer rules_v2 plan is rolling out.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function actionForConcept(
  concept: string,
  stats: StatBucket | undefined,
  priority: number
): PersonalizedNextAction {
  const label = conceptLabel(concept);
  const attempts = Math.max(0, Number(stats?.attempts ?? 0));
  const accuracy = clampPercent(Number(stats?.accuracy ?? 0));
  const id = documentId("next", String(priority), concept || "balanced");

  if (attempts < MIN_CONCEPT_ATTEMPTS) {
    return {
      id,
      priority,
      title: `Kiểm tra nhẹ: ${label}`,
      description: "Làm một cụm câu ngắn để hệ thống xác định con đang chắc phần nào.",
      actionType: "diagnostic_short_set",
      concepts: [concept],
      rubricLevels: ["nhan_biet", "thong_hieu"],
      questionCount: 3,
      reason: "Chưa đủ 3 lượt làm để kết luận điểm yếu, nên cần kiểm tra nhẹ trước.",
      hintMode: "available",
      uiMode: "normal",
    };
  }

  if (accuracy < 50) {
    return {
      id,
      priority,
      title: `Ôn lại từng bước: ${label}`,
      description: "Xem gợi ý ngắn, sau đó làm lại các câu số nhỏ và rõ bước.",
      actionType: "micro_lesson_then_guided_retry",
      concepts: [concept],
      rubricLevels: ["nhan_biet"],
      questionCount: 4,
      reason: `Độ chính xác hiện tại là ${accuracy}%, cần giảm độ khó để lấp lỗ hổng trước.`,
      hintMode: "step_by_step",
      uiMode: "step_by_step",
    };
  }

  if (accuracy < WEAK_ACCURACY_THRESHOLD) {
    return {
      id,
      priority,
      title: `Luyện bù: ${label}`,
      description: "Luyện các câu cơ bản và thông hiểu, có gợi ý sau lần thử đầu.",
      actionType: "remediation_practice",
      concepts: [concept],
      rubricLevels: ["nhan_biet", "thong_hieu"],
      questionCount: 6,
      reason: `Độ chính xác hiện tại là ${accuracy}%, dưới ngưỡng 70% của lộ trình cá nhân hóa.`,
      hintMode: "after_first_wrong",
      uiMode: "slow_down_check_step",
    };
  }

  if (accuracy < MASTERED_ACCURACY_THRESHOLD) {
    return {
      id,
      priority,
      title: `Củng cố xen kẽ: ${label}`,
      description: "Luyện câu thông hiểu và vận dụng để con dùng kiến thức linh hoạt hơn.",
      actionType: "mixed_practice",
      concepts: [concept],
      rubricLevels: ["thong_hieu", "van_dung"],
      questionCount: 5,
      reason: `Độ chính xác hiện tại là ${accuracy}%, đã khá hơn nhưng chưa đủ ổn định để coi là thành thạo.`,
      hintMode: "after_first_wrong",
      uiMode: "normal",
    };
  }

  return {
    id,
    priority,
    title: `Thử thách nhỏ: ${label}`,
    description: "Làm vài câu vận dụng để giữ nhịp và tránh quên kiến thức.",
    actionType: "spiral_review_or_challenge",
    concepts: [concept],
    rubricLevels: ["van_dung", "van_dung_cao"],
    questionCount: 3,
    reason: `Độ chính xác hiện tại là ${accuracy}%, có thể tăng nhẹ độ khó.`,
    hintMode: "available",
    uiMode: "normal",
  };
}

function rubricLevelsForMastery(masteryEstimate: number, evidenceScore: number): string[] {
  if (evidenceScore < 0.35) return ["nhan_biet", "thong_hieu"];
  if (masteryEstimate < 0.45) return ["nhan_biet"];
  if (masteryEstimate < 0.7) return ["nhan_biet", "thong_hieu"];
  if (masteryEstimate < 0.85) return ["thong_hieu", "van_dung"];
  return ["van_dung", "van_dung_cao"];
}

function buildConceptDiagnostics(
  progress: StudentProgressRecord,
  child: ChildDocument | undefined,
  attempts: StudentExerciseAttemptRecord[],
  completions: LessonCompletionRecord[],
  now: string
): ConceptDiagnostic[] {
  const goalConcepts = goalPriorityConcepts(child);
  const conceptSet = new Set<string>();
  for (const concept of Object.keys(progress.conceptStats ?? {})) conceptSet.add(concept);
  for (const concept of child?.learningPreferences?.weakTopics ?? []) conceptSet.add(concept);
  for (const concept of goalConcepts) conceptSet.add(concept);
  for (const attempt of attempts) {
    for (const concept of attempt.concepts ?? []) conceptSet.add(concept);
  }
  for (const completion of completions) {
    for (const concept of completion.concepts ?? []) conceptSet.add(concept);
  }

  const allTimeSamples = attempts
    .map((attempt) => Number(attempt.timeSpentSeconds ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const learnerTimeBaseline = median(allTimeSamples) || 75;
  const preferenceOrder = new Map(
    unique(child?.learningPreferences?.weakTopics ?? []).map((concept, index) => [concept, index] as const)
  );
  const goalOrder = new Map(goalConcepts.map((concept, index) => [concept, index] as const));

  return Array.from(conceptSet)
    .map((concept) => {
      const stats = progress.conceptStats?.[concept];
      const conceptAttempts = attempts
        .filter((attempt) => (attempt.concepts ?? []).includes(concept))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      const recentAttempts = conceptAttempts.slice(0, 6);
      const recentWindow = conceptAttempts.slice(0, 3);
      const previousWindow = conceptAttempts.slice(3, 6);
      const conceptCompletions = completions
        .filter((record) => (record.concepts ?? []).includes(concept))
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      const latestAttemptAt = conceptAttempts[0]?.submittedAt;
      const latestCompletionAt = conceptCompletions[0]?.completedAt;
      const lastPracticedAt = [stats?.lastPracticedAt, latestAttemptAt, latestCompletionAt]
        .filter(Boolean)
        .sort()
        .at(-1);
      const attemptsCount = Math.max(0, Number(stats?.attempts ?? conceptAttempts.length));
      const accuracy = clampPercent(Number(stats?.accuracy ?? (
        attemptsCount > 0
          ? (conceptAttempts.filter((attempt) => attempt.isCorrect).length / Math.max(1, conceptAttempts.length)) * 100
          : 0
      )));
      const recentAccuracy = recentAttempts.length > 0
        ? clampPercent((recentAttempts.filter((attempt) => attempt.isCorrect).length / recentAttempts.length) * 100)
        : accuracy;
      const recentWindowAccuracy = recentWindow.length > 0
        ? recentWindow.filter((attempt) => attempt.isCorrect).length / recentWindow.length
        : accuracy / 100;
      const previousWindowAccuracy = previousWindow.length > 0
        ? previousWindow.filter((attempt) => attempt.isCorrect).length / previousWindow.length
        : recentWindowAccuracy;
      const trendScore = clampUnit(0.5 + ((recentWindowAccuracy - previousWindowAccuracy) / 2));
      const lessonAverageScore = conceptCompletions.length > 0
        ? average(conceptCompletions.map((record) => record.scorePercent))
        : 0;
      const evidenceScore = clampUnit((attemptsCount / 8) + (Math.min(3, conceptCompletions.length) * 0.12));
      const signalWeights = [
        { value: accuracy / 100, weight: attemptsCount > 0 ? 0.45 : 0 },
        { value: recentAccuracy / 100, weight: recentAttempts.length > 0 ? 0.35 : 0 },
        { value: lessonAverageScore / 100, weight: conceptCompletions.length > 0 ? 0.2 : 0 },
      ].filter((signal) => signal.weight > 0);
      const weightedObserved = signalWeights.length > 0
        ? signalWeights.reduce((sum, signal) => sum + (signal.value * signal.weight), 0) /
          signalWeights.reduce((sum, signal) => sum + signal.weight, 0)
        : 0.65;
      const evidenceWeight = clampUnit(0.18 + evidenceScore * 0.72);
      const masteryEstimate = clampUnit(
        (0.65 * (1 - evidenceWeight)) +
        (weightedObserved * evidenceWeight) +
        ((trendScore - 0.5) * 0.12)
      );
      const masteryState = stats?.masteryState
        ?? (masteryEstimate >= 0.82 ? "mastered" : masteryEstimate >= 0.55 ? "developing" : attemptsCount > 0 ? "in_progress" : "not_started");
      const daysSincePractice = daysSince(lastPracticedAt, now);
      const reviewUrgency = masteryEstimate >= 0.75
        ? clampUnit(daysSincePractice / 28) * 0.24
        : clampUnit(daysSincePractice / 42) * 0.12;
      const averageTimeSeconds = averageFloat(
        conceptAttempts.map((attempt) => Number(attempt.timeSpentSeconds ?? 0)).filter((value) => value > 0)
      );
      const frictionScore = averageTimeSeconds > 0 && learnerTimeBaseline > 0
        ? clampUnit((averageTimeSeconds - learnerTimeBaseline) / Math.max(learnerTimeBaseline, 30))
        : 0;
      const lowEvidencePenalty = attemptsCount < MIN_CONCEPT_ATTEMPTS
        ? 0.12 + ((MIN_CONCEPT_ATTEMPTS - attemptsCount) * 0.06)
        : 0;
      const recentDropPenalty = recentAttempts.length >= 3 && recentAccuracy + 15 < accuracy ? 0.12 : 0;
      const preferenceRank = preferenceOrder.get(concept);
      const preferenceBoost = preferenceRank === undefined ? 0 : Math.max(0.03, 0.18 - (preferenceRank * 0.04));
      const goalRank = goalOrder.get(concept);
      const goalBoost = goalRank === undefined ? 0 : Math.max(0.08, 0.28 - (goalRank * 0.03));
      const masteryGuard = attemptsCount >= 5 && masteryEstimate >= 0.84 && recentAccuracy >= 80 ? 0.14 : 0;
      const priorityScore = clampUnit(
        ((1 - masteryEstimate) * 0.42) +
        reviewUrgency +
        (frictionScore * 0.08) +
        lowEvidencePenalty +
        recentDropPenalty +
        goalBoost +
        preferenceBoost -
        masteryGuard
      );

      return {
        concept,
        label: conceptLabel(concept),
        attempts: attemptsCount,
        accuracy,
        recentAttempts: recentAttempts.length,
        recentAccuracy,
        lessonCompletions: conceptCompletions.length,
        lessonAverageScore,
        masteryState,
        masteryEstimate,
        reviewUrgency,
        frictionScore,
        trendScore,
        evidenceScore,
        priorityScore,
        lastPracticedAt,
        daysSincePractice,
        rubricLevels: rubricLevelsForMastery(masteryEstimate, evidenceScore),
        needsAttention: priorityScore >= 0.34,
        preferenceRank,
        goalRank,
      } satisfies ConceptDiagnostic;
    })
    .sort((a, b) => {
      if (a.goalRank !== undefined || b.goalRank !== undefined) {
        const rankDiff = (a.goalRank ?? 999) - (b.goalRank ?? 999);
        if (rankDiff !== 0) return rankDiff;
      }
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (a.preferenceRank !== undefined || b.preferenceRank !== undefined) {
        return (a.preferenceRank ?? 999) - (b.preferenceRank ?? 999);
      }
      return a.label.localeCompare(b.label);
    });
}

function recommendedConceptsFromProgress(progress: StudentProgressRecord, child?: ChildDocument): string[] {
  const ranked = Object.entries(progress.conceptStats ?? {})
    .map(([concept, stats]) => {
      const attempts = Math.max(0, Number(stats?.attempts ?? 0));
      const accuracy = clampPercent(Number(stats?.accuracy ?? 0));
      const staleDays = daysSince(stats?.lastPracticedAt, progress.updatedAt);
      const score =
        ((100 - accuracy) * 1.2) +
        (attempts < MIN_CONCEPT_ATTEMPTS ? 24 : 0) +
        (stats?.masteryState === "mastered" ? Math.min(18, staleDays / 2) : Math.min(10, staleDays / 4));
      return { concept, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.concept);

  return unique([
    ...progress.weakConcepts,
    ...ranked,
    ...(child?.learningPreferences?.weakTopics ?? []),
    ...(progress.recommendedConcepts ?? []),
  ]);
}

function weaknessSummaryFromDiagnostics(diagnostics: ConceptDiagnostic[]): PersonalizedWeaknessSummary[] {
  return diagnostics.map((diagnostic) => ({
    concept: diagnostic.concept,
    attempts: diagnostic.attempts,
    accuracy: diagnostic.accuracy,
    masteryState: diagnostic.masteryState,
    needsAttention: diagnostic.needsAttention,
  }));
}

function actionForDiagnostic(
  diagnostic: ConceptDiagnostic,
  priority: number
): PersonalizedNextAction {
  const id = documentId("next", String(priority), diagnostic.concept || "balanced");

  if (diagnostic.evidenceScore < 0.35 || diagnostic.attempts < MIN_CONCEPT_ATTEMPTS) {
    return {
      id,
      priority,
      title: `Kiểm tra nhanh: ${diagnostic.label}`,
      description: "Làm một cụm câu ngắn để hệ thống đo đúng mức hiện tại trước khi đẩy sang chặng mới.",
      actionType: "diagnostic_short_set",
      concepts: [diagnostic.concept],
      rubricLevels: ["nhan_biet", "thong_hieu"],
      questionCount: 3,
      reason: "Dữ liệu ở mảng này còn mỏng, nên cần chẩn đoán ngắn trước để tránh đẩy vào bài quá dễ hoặc quá khó.",
      hintMode: "available",
      uiMode: "normal",
    };
  }

  if (diagnostic.masteryEstimate < 0.45 || diagnostic.recentAccuracy < 45) {
    return {
      id,
      priority,
      title: `Ôn lại từng bước: ${diagnostic.label}`,
      description: "Đi từ câu nền tảng và mở gợi ý theo bước để vá đúng lỗ hổng đang gây sai nhiều nhất.",
      actionType: "micro_lesson_then_guided_retry",
      concepts: [diagnostic.concept],
      rubricLevels: ["nhan_biet"],
      questionCount: 4,
      reason: `Độ nắm vững ước tính mới khoảng ${Math.round(diagnostic.masteryEstimate * 100)}%, nên kéo về dạng nền để làm chắc lại.`,
      hintMode: "step_by_step",
      uiMode: "step_by_step",
    };
  }

  if (diagnostic.masteryEstimate < 0.7 || diagnostic.priorityScore >= 0.5) {
    return {
      id,
      priority,
      title: `Luyện bù: ${diagnostic.label}`,
      description: "Luyện lại các câu cốt lõi và thông hiểu, có hỗ trợ sau lần thử đầu để giữ nhịp tiến bộ.",
      actionType: "remediation_practice",
      concepts: [diagnostic.concept],
      rubricLevels: ["nhan_biet", "thong_hieu"],
      questionCount: 6,
      reason: `Mảng này chưa ổn định: đúng gần đây ${diagnostic.recentAccuracy}% và dữ liệu cho thấy vẫn còn khoảng trống cần bù.`,
      hintMode: "after_first_wrong",
      uiMode: "slow_down_check_step",
    };
  }

  if (diagnostic.reviewUrgency >= 0.14 || diagnostic.daysSincePractice >= 21) {
    return {
      id,
      priority,
      title: `Ôn xoắn ốc: ${diagnostic.label}`,
      description: "Đã khá ổn phần này, nhưng nên ôn lại bằng vài câu chọn lọc để tránh quên sau một thời gian.",
      actionType: "spiral_review_or_challenge",
      concepts: [diagnostic.concept],
      rubricLevels: diagnostic.rubricLevels,
      questionCount: 4,
      reason: `Phần này không còn yếu rõ ràng, nhưng đã ${diagnostic.daysSincePractice} ngày chưa chạm lại nên cần ôn ngắn để giữ độ chắc.`,
      hintMode: "after_first_wrong",
      uiMode: "normal",
    };
  }

  return {
    id,
    priority,
    title: `Củng cố nâng nhẹ: ${diagnostic.label}`,
    description: "Tăng độ linh hoạt bằng vài câu thông hiểu và vận dụng, tránh quay lại nền tảng khi đã vững.",
    actionType: "mixed_practice",
    concepts: [diagnostic.concept],
    rubricLevels: diagnostic.rubricLevels,
    questionCount: 3,
    reason: "Độ nắm vững hiện đã khá tốt, nên bài tiếp theo tập trung giữ nhịp và nâng nhẹ độ khó thay vì quay lại ôn nền.",
    hintMode: "available",
    uiMode: "normal",
  };
}

function balancedAction(priority = 1): PersonalizedNextAction {
  return {
    id: documentId("next", String(priority), "balanced"),
    priority,
    title: "Luyện cân bằng lớp 4-5",
    description: "Chọn một cụm câu vừa sức để tiếp tục thu thập dữ liệu học tập.",
    actionType: "mixed_practice",
    concepts: [],
    rubricLevels: ["thong_hieu", "van_dung"],
    questionCount: 5,
    reason: "Chưa có concept yếu rõ ràng, nên hệ thống tiếp tục luyện cân bằng.",
    hintMode: "available",
    uiMode: "normal",
  };
}

function buildPersonalizedPlan(
  progress: StudentProgressRecord,
  child: ChildDocument | undefined,
  now: string,
  attempts: StudentExerciseAttemptRecord[] = [],
  completions: LessonCompletionRecord[] = []
): StudentPersonalizedPlanRecord {
  const diagnostics = buildConceptDiagnostics(progress, child, attempts, completions, now);
  const goalConcepts = goalPriorityConcepts(child);
  const targetConcepts = unique([
    ...goalConcepts,
    ...diagnostics.filter((diagnostic) => diagnostic.needsAttention).map((diagnostic) => diagnostic.concept),
    ...(child?.learningPreferences?.weakTopics ?? []),
  ]).slice(0, 4);
  const grade = gradeFromPreferences(child);
  const nextBestActions = (diagnostics.length > 0
    ? diagnostics
        .filter((diagnostic) =>
          targetConcepts.includes(diagnostic.concept) ||
          diagnostic.priorityScore >= 0.45
        )
        .slice(0, 3)
        .map((diagnostic, index) => actionForDiagnostic(diagnostic, index + 1))
    : [balancedAction()]);
  const weaknessSummary = weaknessSummaryFromDiagnostics(diagnostics.slice(0, Math.max(4, targetConcepts.length)));
  const recommendedQuestionFilters: RecommendedQuestionFilter[] = nextBestActions.map((action) =>
    stripUndefined({
      grade,
      rubricLevels: action.rubricLevels,
      concepts: action.concepts,
      subject: "math",
    })
  );

  return stripUndefined({
    id: progress.childUid,
    childUid: progress.childUid,
    status: "active",
    generatedAt: now,
    basedOnProgressUpdatedAt: progress.updatedAt,
    targetConcepts,
    recommendedLessonIds: [],
    recommendedQuestionFilters,
    nextBestActions,
    weaknessSummary,
    reasonSummary: targetConcepts.length > 0
      ? `Ưu tiên ${targetConcepts.map(conceptLabel).join(", ")} vì ${goalSummaryText(child) ?? "mục tiêu học tập ban đầu"}; tiến trình hiện tại chỉ dùng để chỉnh mức bài và điểm vào phù hợp hơn.`
      : "Tiếp tục luyện Toán cân bằng cho đến khi có đủ dữ liệu để xác định điểm ưu tiên rõ ràng.",
    source: "rules_v2",
    createdAt: now,
    updatedAt: now,
  });
}

async function loadChildInTransaction(tx: Transaction, db: Firestore, childUid: string): Promise<ChildDocument | undefined> {
  const childSnap = await tx.get(db.collection("children").doc(childUid));
  return childSnap.exists ? childSnap.data() as ChildDocument : undefined;
}

async function loadProgressInTransaction(
  tx: Transaction,
  db: Firestore,
  childUid: string,
  now: string,
  child?: ChildDocument
): Promise<StudentProgressRecord> {
  const progressSnap = await tx.get(db.collection("studentProgress").doc(childUid));
  return progressFromData(childUid, progressSnap.data(), now, child);
}

function stageProgressAndPlan(
  tx: Transaction,
  db: Firestore,
  progress: StudentProgressRecord,
  child: ChildDocument | undefined,
  now: string
) {
  const weakConcepts = weakConceptsFrom(progress, child);
  const recommendedConcepts = recommendedConceptsFromProgress(
    {
      ...progress,
      weakConcepts,
    },
    child
  );
  const nextProgress: StudentProgressRecord = {
    ...progress,
    weakConcepts,
    recommendedConcepts,
    level: computeLevel(progress.totalXpEarned),
    updatedAt: now,
  };

  tx.set(db.collection("studentProgress").doc(progress.childUid), stripUndefined(nextProgress), { merge: true });
  tx.set(
    db.collection("studentPersonalizedPlans").doc(progress.childUid),
    stripUndefined(buildPersonalizedPlan(nextProgress, child, now)),
    { merge: true }
  );
}

export async function recordLessonCompletion(
  input: LessonCompletionInput
): Promise<LessonCompletionRecord> {
  const db = adminDb();
  const record = normalizeCompletion(input);
  const now = new Date().toISOString();

  await db.runTransaction(async (tx) => {
    await writeLessonCompletionInTransaction(tx, db, record, now);
  });

  return record;
}

async function writeLessonCompletionInTransaction(
  tx: Transaction,
  db: Firestore,
  record: LessonCompletionRecord,
  now: string
) {
  const child = await loadChildInTransaction(tx, db, record.childUid);
  const progress = await loadProgressInTransaction(tx, db, record.childUid, now, child);
  const lessonProgressRef = db.collection("studentLessonProgress").doc(documentId(record.childUid, record.lessonId));
  const lessonProgressSnap = await tx.get(lessonProgressRef);
  const currentLesson = lessonProgressSnap.data() as Partial<StudentLessonProgressRecord> | undefined;
  const nextAttemptCount = Number(currentLesson?.attemptCount ?? 0) + 1;
  const nextCompletedCount = Number(currentLesson?.completedCount ?? 0) + 1;
  const bestScorePercent = Math.max(Number(currentLesson?.bestScorePercent ?? 0), record.scorePercent);
  const masteryState = masteryStateFromScore(bestScorePercent);

  const lessonProgress: StudentLessonProgressRecord = {
    id: lessonProgressRef.id,
    childUid: record.childUid,
    lessonId: record.lessonId,
    lessonTitle: record.lessonTitle,
    subject: record.subject,
    status: masteryState,
    attemptCount: nextAttemptCount,
    completedCount: nextCompletedCount,
    totalTimeOnTaskSeconds: Number(currentLesson?.totalTimeOnTaskSeconds ?? 0) + record.timeOnTaskSeconds,
    totalXpEarned: Number(currentLesson?.totalXpEarned ?? 0) + record.xpEarned,
    bestScorePercent,
    latestScorePercent: record.scorePercent,
    latestQuizScorePercent: record.quizScorePercent,
    quizCorrect: record.quizCorrect,
    quizTotal: record.quizTotal,
    completionRatePercent: 100,
    masteryState,
    firstCompletedAt: currentLesson?.firstCompletedAt ?? record.completedAt,
    lastCompletedAt: record.completedAt,
    concepts: unique([...(currentLesson?.concepts ?? []), ...(record.concepts ?? [])]),
    skills: unique([...(currentLesson?.skills ?? []), ...(record.skills ?? [])]),
    createdAt: currentLesson?.createdAt ?? now,
    updatedAt: now,
  };

  const totalLessonAttempts = progress.totalLessonAttempts + 1;
  const nextAverageQuizScore = totalLessonAttempts > 0
    ? clampPercent(((progress.averageQuizScore * progress.totalLessonAttempts) + record.quizScorePercent) / totalLessonAttempts)
    : record.quizScorePercent;
  const subjectStats = { ...progress.subjectStats };
  subjectStats[record.subject] = updateStatBucket(subjectStats[record.subject], record.scorePercent >= 80, record.completedAt);
  const conceptStats = { ...progress.conceptStats };
  for (const concept of record.concepts ?? []) {
    conceptStats[concept] = updateStatBucket(conceptStats[concept], record.scorePercent >= 80, record.completedAt);
  }

  const nextProgress: StudentProgressRecord = {
    ...progress,
    totalLessonsCompleted: progress.totalLessonsCompleted + 1,
    totalLessonAttempts,
    totalTimeOnTaskSeconds: progress.totalTimeOnTaskSeconds + record.timeOnTaskSeconds,
    totalXpEarned: progress.totalXpEarned + record.xpEarned,
    averageQuizScore: nextAverageQuizScore,
    subjectStats,
    conceptStats,
    lastActivityAt: record.completedAt,
    updatedAt: now,
  };

  tx.set(db.collection("studentLessonCompletions").doc(record.id), stripUndefined(record));
  tx.set(lessonProgressRef, stripUndefined(lessonProgress), { merge: true });
  stageProgressAndPlan(tx, db, nextProgress, child, now);
}

export async function writeExerciseAttemptInTransaction(
  tx: Transaction,
  db: Firestore,
  input: StudentExerciseAttemptInput,
  attemptId?: string
): Promise<StudentExerciseAttemptRecord> {
  const now = input.submittedAt ?? new Date().toISOString();
  const child = await loadChildInTransaction(tx, db, input.childUid);
  const progress = await loadProgressInTransaction(tx, db, input.childUid, now, child);
  const record: StudentExerciseAttemptRecord = stripUndefined({
    ...input,
    id: attemptId ?? documentId(input.childUid, input.questionId, String(Date.now())),
    subject: input.subject || "math",
    concepts: unique(input.concepts ?? []),
    skills: unique(input.skills ?? []),
    timeSpentMs: Math.max(0, Math.round(input.timeSpentMs)),
    timeSpentSeconds: Math.round(Math.max(0, input.timeSpentMs) / 1000),
    startedAt: input.startedAt,
    submittedAt: now,
  });

  const totalExerciseAttempts = progress.totalExerciseAttempts + 1;
  const totalCorrectExerciseAttempts = progress.totalCorrectExerciseAttempts + (record.isCorrect ? 1 : 0);
  const subjectStats = { ...progress.subjectStats };
  subjectStats[record.subject] = updateStatBucket(subjectStats[record.subject], record.isCorrect, now);
  const conceptStats = { ...progress.conceptStats };
  for (const concept of record.concepts ?? []) {
    conceptStats[concept] = updateStatBucket(conceptStats[concept], record.isCorrect, now);
  }

  const nextProgress: StudentProgressRecord = {
    ...progress,
    totalExerciseAttempts,
    totalCorrectExerciseAttempts,
    totalTimeOnTaskSeconds: progress.totalTimeOnTaskSeconds + record.timeSpentSeconds,
    exerciseAccuracy: clampPercent((totalCorrectExerciseAttempts / totalExerciseAttempts) * 100),
    subjectStats,
    conceptStats,
    lastActivityAt: now,
    updatedAt: now,
  };

  await syncCourseRunAttemptInTransaction(tx, db, record, now);
  tx.set(db.collection("studentExerciseAttempts").doc(record.id), stripUndefined(record));
  stageProgressAndPlan(tx, db, nextProgress, child, now);
  return record;
}

export async function recordExerciseAttempt(input: StudentExerciseAttemptInput): Promise<StudentExerciseAttemptRecord> {
  const db = adminDb();
  let record: StudentExerciseAttemptRecord | undefined;

  await db.runTransaction(async (tx) => {
    record = await writeExerciseAttemptInTransaction(tx, db, input);
  });

  if (!record) {
    throw new Error("Không lưu được kết quả luyện tập.");
  }
  return record;
}

export async function getLessonCompletions(childUid: string): Promise<LessonCompletionRecord[]> {
  if (childUid === "demo-child") {
    return demoRecords(childUid);
  }

  const db = adminDb();
  const snap = await db.collection("studentLessonCompletions").where("childUid", "==", childUid).get();
  return snap.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }) as LessonCompletionRecord)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

async function getExerciseAttempts(childUid: string): Promise<StudentExerciseAttemptRecord[]> {
  if (childUid === "demo-child") {
    return [];
  }

  const db = adminDb();
  const snap = await db.collection("studentExerciseAttempts").where("childUid", "==", childUid).get();
  return snap.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }) as StudentExerciseAttemptRecord)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

function summaryFromRecords(childUid: string, records: LessonCompletionRecord[], progress?: StudentProgressRecord): ProgressSummary {
  const totalLessonsCompleted = progress?.totalLessonsCompleted ?? records.length;
  const totalTimeOnTaskSeconds = progress?.totalTimeOnTaskSeconds ?? records.reduce(
    (sum, record) => sum + record.timeOnTaskSeconds,
    0
  );
  const totalXpEarned = progress?.totalXpEarned ?? records.reduce((sum, record) => sum + record.xpEarned, 0);
  const averageQuizScore = progress?.averageQuizScore ?? average(
    records.filter((record) => record.quizTotal > 0).map((record) => record.quizScorePercent)
  );

  const daily = emptyDailyWindow();
  const dailyScores = new Map<string, number[]>();
  const dailyByDate = new Map(daily.map((point) => [point.date, point]));

  for (const record of records) {
    const date = record.completedAt.slice(0, 10);
    const point = dailyByDate.get(date);
    if (!point) continue;
    point.lessonsCompleted += 1;
    point.timeOnTaskMinutes += Math.round(record.timeOnTaskSeconds / 60);
    point.xpEarned += record.xpEarned;
    if (record.quizTotal > 0) {
      dailyScores.set(date, [...(dailyScores.get(date) ?? []), record.quizScorePercent]);
    }
  }

  for (const point of daily) {
    point.averageQuizScore = average(dailyScores.get(point.date) ?? []);
  }

  const subjectGroups = new Map<string, LessonCompletionRecord[]>();
  for (const record of records) {
    subjectGroups.set(record.subject, [...(subjectGroups.get(record.subject) ?? []), record]);
  }

  const subjectBreakdown: SubjectProgressPoint[] = Array.from(subjectGroups.entries())
    .map(([name, subjectRecords]) => ({
      name,
      lessonsCompleted: subjectRecords.length,
      timeOnTaskMinutes: Math.round(
        subjectRecords.reduce((sum, record) => sum + record.timeOnTaskSeconds, 0) / 60
      ),
      averageQuizScore: average(
        subjectRecords
          .filter((record) => record.quizTotal > 0)
          .map((record) => record.quizScorePercent)
      ),
    }))
    .sort((a, b) => b.lessonsCompleted - a.lessonsCompleted);

  const conceptsToReinforce = progress?.weakConcepts?.length
    ? progress.weakConcepts
    : subjectBreakdown
        .filter((subject) => subject.averageQuizScore > 0 && subject.averageQuizScore < 80)
        .map((subject) => subject.name);

  return {
    childUid,
    totalLessonsCompleted,
    totalTimeOnTaskSeconds,
    totalXpEarned,
    averageQuizScore,
    level: progress?.level ?? computeLevel(totalXpEarned),
    daily,
    subjectBreakdown,
    recentCompletions: records.slice(0, 5),
    conceptsToReinforce,
  };
}

export async function getProgressSummary(childUid: string): Promise<ProgressSummary> {
  if (childUid === "demo-child") {
    return summaryFromRecords(childUid, demoRecords(childUid));
  }

  const db = adminDb();
  const [progressSnap, completions] = await Promise.all([
    db.collection("studentProgress").doc(childUid).get(),
    getLessonCompletions(childUid),
  ]);
  const progress = progressSnap.exists
    ? progressFromData(childUid, progressSnap.data(), new Date().toISOString())
    : undefined;

  return summaryFromRecords(childUid, completions, progress);
}

export async function getPersonalizedPlan(childUid: string): Promise<StudentPersonalizedPlanRecord> {
  const now = new Date().toISOString();

  if (childUid === "demo-child") {
    const demoChild: ChildDocument = {
      learningPreferences: {
        gradeLevel: "grade_5",
        weakTopics: ["fractions", "word_problems"],
      },
    };
    const progress = {
      ...emptyProgress(childUid, now, demoChild),
      totalExerciseAttempts: 8,
      totalCorrectExerciseAttempts: 4,
      exerciseAccuracy: 50,
      conceptStats: {
        fractions: {
          attempts: 5,
          correct: 2,
          accuracy: 40,
          masteryState: "in_progress",
          lastPracticedAt: now,
        },
        word_problems: {
          attempts: 3,
          correct: 2,
          accuracy: 67,
          masteryState: "developing",
          lastPracticedAt: now,
        },
      },
      weakConcepts: ["fractions", "word_problems"],
      recommendedConcepts: ["fractions", "word_problems"],
      updatedAt: now,
    } satisfies StudentProgressRecord;

    return buildPersonalizedPlan(progress, demoChild, now);
  }

  const db = adminDb();
  const [childSnap, progressSnap, planSnap, completions, attempts] = await Promise.all([
    db.collection("children").doc(childUid).get(),
    db.collection("studentProgress").doc(childUid).get(),
    db.collection("studentPersonalizedPlans").doc(childUid).get(),
    getLessonCompletions(childUid),
    getExerciseAttempts(childUid),
  ]);
  const child = childSnap.exists ? childSnap.data() as ChildDocument : undefined;
  const progress = progressFromData(childUid, progressSnap.data(), now, child);
  const rebuiltPlan = buildPersonalizedPlan(progress, child, now, attempts, completions);

  if (!planSnap.exists) {
    return rebuiltPlan;
  }

  const storedPlan = planSnap.data() as Partial<StudentPersonalizedPlanRecord>;
  const planNeedsRefresh =
    storedPlan.basedOnProgressUpdatedAt !== progress.updatedAt ||
    !Array.isArray(storedPlan.nextBestActions) ||
    storedPlan.nextBestActions.length === 0;

  if (planNeedsRefresh) {
    return {
      ...rebuiltPlan,
      createdAt: storedPlan.createdAt ?? rebuiltPlan.createdAt,
    };
  }

  return {
    ...rebuiltPlan,
    ...storedPlan,
    id: childUid,
    childUid,
    weaknessSummary: storedPlan.weaknessSummary ?? rebuiltPlan.weaknessSummary,
  } as StudentPersonalizedPlanRecord;
}
