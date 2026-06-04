import type { DocumentData, Firestore, Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import type {
  DailyProgressPoint,
  LessonCompletionInput,
  LessonCompletionRecord,
  MasteryState,
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
const MIN_CONCEPT_ATTEMPTS = 3;

type LearningPreferences = {
  gradeLevel?: "grade_4" | "grade_5";
  weakTopics?: string[];
};

type ChildDocument = {
  learningPreferences?: LearningPreferences;
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
      lessonId: "lesson-001",
      lessonTitle: "What is Photosynthesis?",
      subject: "science",
      scorePercent: 92,
      quizCorrect: 2,
      quizTotal: 2,
      xpEarned: 150,
      timeOnTaskSeconds: 1080,
      concepts: ["photosynthesis"],
    },
    {
      daysAgo: 5,
      lessonId: "lesson-002",
      lessonTitle: "Fractions Made Easy",
      subject: "math",
      scorePercent: 85,
      quizCorrect: 2,
      quizTotal: 3,
      xpEarned: 180,
      timeOnTaskSeconds: 1500,
      concepts: ["fractions"],
    },
    {
      daysAgo: 3,
      lessonId: "lesson-003",
      lessonTitle: "The Water Cycle",
      subject: "science",
      scorePercent: 100,
      quizCorrect: 1,
      quizTotal: 1,
      xpEarned: 120,
      timeOnTaskSeconds: 900,
      concepts: ["water_cycle"],
    },
    {
      daysAgo: 1,
      lessonId: "lesson-005",
      lessonTitle: "Intro to Python: Variables",
      subject: "coding",
      scorePercent: 75,
      quizCorrect: 1,
      quizTotal: 2,
      xpEarned: 220,
      timeOnTaskSeconds: 1260,
      concepts: ["variables"],
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
    .filter(([, stats]) => Number(stats.attempts ?? 0) >= MIN_CONCEPT_ATTEMPTS && Number(stats.accuracy ?? 0) < WEAK_ACCURACY_THRESHOLD)
    .map(([concept]) => concept);

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

function buildPersonalizedPlan(
  progress: StudentProgressRecord,
  child: ChildDocument | undefined,
  now: string
): StudentPersonalizedPlanRecord {
  const targetConcepts = unique(progress.weakConcepts.length > 0
    ? progress.weakConcepts
    : child?.learningPreferences?.weakTopics ?? []);
  const grade = gradeFromPreferences(child);
  const rubricLevels = progress.exerciseAccuracy > 0 && progress.exerciseAccuracy < WEAK_ACCURACY_THRESHOLD
    ? ["nhan_biet", "thong_hieu"]
    : ["thong_hieu", "van_dung"];
  const recommendedQuestionFilters: RecommendedQuestionFilter[] = [
    stripUndefined({
      grade,
      rubricLevels,
      concepts: targetConcepts,
      subject: "math",
    }),
  ];

  return stripUndefined({
    id: progress.childUid,
    childUid: progress.childUid,
    status: "active",
    generatedAt: now,
    basedOnProgressUpdatedAt: progress.updatedAt,
    targetConcepts,
    recommendedLessonIds: [],
    recommendedQuestionFilters,
    reasonSummary: targetConcepts.length > 0
      ? `Prioritize ${targetConcepts.join(", ")} based on parent goals and learner performance.`
      : "Continue balanced math practice until enough performance data is available.",
    source: "rules_v1",
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
  const recommendedConcepts = weakConcepts.length > 0
    ? weakConcepts
    : unique(child?.learningPreferences?.weakTopics ?? progress.recommendedConcepts ?? []);
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
