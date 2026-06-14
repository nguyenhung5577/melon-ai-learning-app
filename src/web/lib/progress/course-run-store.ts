import type { Firestore, Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebase-admin";
import type {
  CourseDefinition,
  CoursePipelineDefinition,
  CoursePipelineStage,
  CourseRunSnapshot,
  CourseStageStatus,
  CourseStageType,
  StudentCourseRunRecord,
  StudentCourseStageProgress,
  StudentExerciseAttemptInput,
  StudentProgressRecord,
} from "./types";

type LearningPreferences = {
  domain?: string;
  gradeLevel?: "grade_4" | "grade_5";
  weakTopics?: string[];
};

type ChildDocument = {
  grade?: string;
  learningPreferences?: LearningPreferences;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
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

function gradeFromChild(child?: ChildDocument): 4 | 5 {
  const pref = child?.learningPreferences?.gradeLevel;
  if (pref === "grade_4") return 4;
  if (pref === "grade_5") return 5;

  const text = String(child?.grade ?? "");
  if (text.includes("5")) return 5;
  return 4;
}

function weakTopicsFromChild(child?: ChildDocument): string[] {
  return unique(child?.learningPreferences?.weakTopics ?? []);
}

function stageIndex(pipeline: CoursePipelineDefinition, stageId: string): number {
  return Math.max(0, pipeline.stages.findIndex((stage) => stage.id === stageId));
}

function stageById(pipeline: CoursePipelineDefinition, stageId: string): CoursePipelineStage {
  return pipeline.stages.find((stage) => stage.id === stageId) ?? pipeline.stages[0];
}

function firstStageOfType(
  pipeline: CoursePipelineDefinition,
  ...types: CourseStageType[]
): CoursePipelineStage {
  return pipeline.stages.find((stage) => types.includes(stage.stageType)) ?? pipeline.stages[0];
}

function priorityScoreForCourse(
  course: CourseDefinition,
  progress: StudentProgressRecord,
  child?: ChildDocument
): number {
  const weakTopics = weakTopicsFromChild(child);
  const weakTopicIndex = weakTopics.indexOf(course.primaryConcept);
  const weakTopicBoost = weakTopicIndex >= 0 ? Math.max(0, 100 - (weakTopicIndex * 20)) : 20;
  const stat = progress.conceptStats?.[course.primaryConcept];
  const attempts = Number(stat?.attempts ?? 0);
  const accuracy = Number(stat?.accuracy ?? 0);
  const accuracyBoost = attempts < 3 ? 40 : Math.max(0, 100 - accuracy);
  return weakTopicBoost + accuracyBoost + Math.max(0, 20 - course.recommendedOrder);
}

function courseReasonText(course: CourseDefinition, progress: StudentProgressRecord): string {
  const stat = progress.conceptStats?.[course.primaryConcept];
  const attempts = Number(stat?.attempts ?? 0);
  const accuracy = Number(stat?.accuracy ?? 0);
  const label = course.conceptLabels[0] ?? course.primaryConcept;

  if (attempts < 3) {
    return `Mình bắt đầu với vài câu khởi động về ${label} để vào nhịp nhé.`;
  }
  if (accuracy < 70) {
    return `Melon chọn lộ trình ôn lại ${label} để con làm chắc hơn từng bước.`;
  }
  return `Con đã khá chắc phần ${label} rồi, mình chuyển sang chặng luyện sâu hơn nhé.`;
}

function startingStageForCourse(
  course: CourseDefinition,
  pipeline: CoursePipelineDefinition,
  progress: StudentProgressRecord
): CoursePipelineStage {
  const stat = progress.conceptStats?.[course.primaryConcept];
  const attempts = Number(stat?.attempts ?? 0);
  const accuracy = Number(stat?.accuracy ?? 0);

  if (attempts < 3) {
    return firstStageOfType(pipeline, "diagnostic", "foundation");
  }
  if (accuracy < 50) {
    return firstStageOfType(pipeline, "foundation", "remedial", "practice");
  }
  if (accuracy < 70) {
    return firstStageOfType(pipeline, "practice", "checkpoint");
  }
  if (accuracy < 85) {
    return firstStageOfType(pipeline, "checkpoint", "practice", "challenge");
  }
  return firstStageOfType(pipeline, "challenge", "checkpoint");
}

function stageProgressRecord(
  stageId: string,
  status: CourseStageStatus,
  at: string
): StudentCourseStageProgress {
  return {
    stageId,
    attempts: 0,
    correct: 0,
    accuracy: 0,
    status,
    enteredAt: at,
  };
}

function createCourseRun(
  childUid: string,
  course: CourseDefinition,
  pipeline: CoursePipelineDefinition,
  progress: StudentProgressRecord,
  child: ChildDocument | undefined,
  now: string
): StudentCourseRunRecord {
  const startingStage = startingStageForCourse(course, pipeline, progress);
  const stageProgress: Record<string, StudentCourseStageProgress> = {
    [startingStage.id]: stageProgressRecord(startingStage.id, "in_progress", now),
  };

  return {
    id: documentId(childUid, course.id),
    childUid,
    courseId: course.id,
    pipelineId: pipeline.id,
    status: "active",
    priorityScore: priorityScoreForCourse(course, progress, child),
    personalizedReason: courseReasonText(course, progress),
    currentStageId: startingStage.id,
    currentStageOrder: stageIndex(pipeline, startingStage.id) + 1,
    stageProgress,
    recommendedQuestionFilter: startingStage.questionFilter,
    startedAt: now,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

async function loadChild(db: Firestore, childUid: string): Promise<ChildDocument | undefined> {
  const snap = await db.collection("children").doc(childUid).get();
  return snap.exists ? snap.data() as ChildDocument : undefined;
}

function emptyProgress(childUid: string, now: string): StudentProgressRecord {
  return {
    id: childUid,
    childUid,
    schemaVersion: 1,
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
    weakConcepts: [],
    recommendedConcepts: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function loadProgress(db: Firestore, childUid: string, now: string): Promise<StudentProgressRecord> {
  const snap = await db.collection("studentProgress").doc(childUid).get();
  return snap.exists ? snap.data() as StudentProgressRecord : emptyProgress(childUid, now);
}

async function loadActiveCourses(db: Firestore, grade: 4 | 5): Promise<CourseDefinition[]> {
  const snap = await db.collection("courses")
    .where("subject", "==", "math")
    .where("grade", "==", grade)
    .where("status", "==", "active")
    .get();

  return snap.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }) as CourseDefinition)
    .sort((a, b) => a.recommendedOrder - b.recommendedOrder);
}

async function loadPipelines(db: Firestore, courseIds: string[]): Promise<Map<string, CoursePipelineDefinition>> {
  const pipelines = new Map<string, CoursePipelineDefinition>();
  if (courseIds.length === 0) return pipelines;

  const snap = await db.collection("coursePipelines").get();
  for (const doc of snap.docs) {
    const pipeline = { ...doc.data(), id: doc.id } as CoursePipelineDefinition;
    if (courseIds.includes(pipeline.courseId)) {
      pipelines.set(pipeline.courseId, pipeline);
    }
  }
  return pipelines;
}

export async function ensureCourseRunsForChild(childUid: string): Promise<void> {
  const db = adminDb();
  const now = new Date().toISOString();
  const [child, progress] = await Promise.all([
    loadChild(db, childUid),
    loadProgress(db, childUid, now),
  ]);

  if (!child) return;

  const grade = gradeFromChild(child);
  const courses = await loadActiveCourses(db, grade);
  const pipelinesByCourse = await loadPipelines(db, courses.map((course) => course.id));
  const existingSnap = await db.collection("studentCourseRuns").where("childUid", "==", childUid).get();
  const existingByCourse = new Map(
    existingSnap.docs.map((doc) => {
      const run = { ...doc.data(), id: doc.id } as StudentCourseRunRecord;
      return [run.courseId, run] as const;
    })
  );

  for (const course of courses) {
    const pipeline = pipelinesByCourse.get(course.id);
    if (!pipeline || pipeline.stages.length === 0) continue;

    const current = existingByCourse.get(course.id);
    const nextPriority = priorityScoreForCourse(course, progress, child);
    const nextReason = courseReasonText(course, progress);
    const currentStage = current ? stageById(pipeline, current.currentStageId) : undefined;
    const payload = current
      ? {
          ...current,
          priorityScore: nextPriority,
          personalizedReason: nextReason,
          recommendedQuestionFilter: currentStage?.questionFilter ?? current.recommendedQuestionFilter,
          updatedAt: now,
        }
      : createCourseRun(childUid, course, pipeline, progress, child, now);

    await db.collection("studentCourseRuns").doc(payload.id).set(stripUndefined(payload), { merge: true });
  }
}

export async function getCourseRunSnapshots(
  childUid: string,
  options?: { includeCompleted?: boolean }
): Promise<CourseRunSnapshot[]> {
  const db = adminDb();
  await ensureCourseRunsForChild(childUid);

  let runQuery = db.collection("studentCourseRuns").where("childUid", "==", childUid);
  if (!options?.includeCompleted) {
    runQuery = runQuery.where("status", "==", "active");
  }

  const runSnap = await runQuery.get();

  const runs = runSnap.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }) as StudentCourseRunRecord)
    .sort((a, b) => {
      const aCompleted = a.status === "completed" ? 1 : 0;
      const bCompleted = b.status === "completed" ? 1 : 0;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });

  if (runs.length === 0) return [];

  const [courseSnap, pipelineSnap] = await Promise.all([
    db.collection("courses").get(),
    db.collection("coursePipelines").get(),
  ]);

  const coursesById = new Map(
    courseSnap.docs.map((doc) => [doc.id, { ...doc.data(), id: doc.id } as CourseDefinition] as const)
  );
  const pipelinesById = new Map(
    pipelineSnap.docs.map((doc) => [doc.id, { ...doc.data(), id: doc.id } as CoursePipelineDefinition] as const)
  );

  return runs
    .map((run) => {
      const course = coursesById.get(run.courseId);
      const pipeline = pipelinesById.get(run.pipelineId);
      if (!course || !pipeline) return null;
      const currentStage = stageById(pipeline, run.currentStageId);
      return { course, pipeline, run, currentStage } as CourseRunSnapshot;
    })
    .filter((item): item is CourseRunSnapshot => Boolean(item));
}

export async function syncCourseRunAttemptInTransaction(
  tx: Transaction,
  db: Firestore,
  input: StudentExerciseAttemptInput,
  now: string
): Promise<void> {
  if (!input.courseRunId || !input.courseId || !input.pipelineId || !input.stageId) return;

  const runRef = db.collection("studentCourseRuns").doc(input.courseRunId);
  const pipelineRef = db.collection("coursePipelines").doc(input.pipelineId);
  const [runSnap, pipelineSnap] = await Promise.all([
    tx.get(runRef),
    tx.get(pipelineRef),
  ]);

  if (!runSnap.exists || !pipelineSnap.exists) return;

  const run = runSnap.data() as StudentCourseRunRecord;
  const pipeline = { ...pipelineSnap.data(), id: pipelineSnap.id } as CoursePipelineDefinition;
  const stage = stageById(pipeline, input.stageId);
  const previous = run.stageProgress?.[stage.id] ?? stageProgressRecord(stage.id, "in_progress", now);
  const attempts = previous.attempts + 1;
  const correct = previous.correct + (input.isCorrect ? 1 : 0);
  const accuracy = clampPercent((correct / attempts) * 100);

  const nextStageProgress = {
    ...run.stageProgress,
    [stage.id]: {
      ...previous,
      attempts,
      correct,
      accuracy,
      status: "in_progress" as CourseStageStatus,
      lastAttemptAt: now,
    },
  };

  let nextStatus = run.status;
  let nextStageId = run.currentStageId;
  let nextStageOrder = run.currentStageOrder;
  let recommendedQuestionFilter = run.recommendedQuestionFilter;

  if (attempts >= stage.minAttempts) {
    if (accuracy >= stage.passAccuracy) {
      nextStageProgress[stage.id] = {
        ...nextStageProgress[stage.id],
        status: "mastered",
        completedAt: now,
      };

      if (stage.nextStageId) {
        const upcoming = stageById(pipeline, stage.nextStageId);
        nextStageId = upcoming.id;
        nextStageOrder = stageIndex(pipeline, upcoming.id) + 1;
        recommendedQuestionFilter = upcoming.questionFilter;
        nextStageProgress[upcoming.id] = nextStageProgress[upcoming.id] ?? stageProgressRecord(upcoming.id, "ready", now);
      } else {
        nextStatus = "completed";
      }
    } else if (stage.remedialStageId) {
      nextStageProgress[stage.id] = {
        ...nextStageProgress[stage.id],
        status: "retry_required",
      };
      const remedial = stageById(pipeline, stage.remedialStageId);
      nextStageId = remedial.id;
      nextStageOrder = stageIndex(pipeline, remedial.id) + 1;
      recommendedQuestionFilter = remedial.questionFilter;
      nextStageProgress[remedial.id] = nextStageProgress[remedial.id] ?? stageProgressRecord(remedial.id, "ready", now);
    } else {
      nextStageProgress[stage.id] = {
        ...nextStageProgress[stage.id],
        status: "retry_required",
      };
    }
  }

  tx.set(runRef, stripUndefined({
    ...run,
    status: nextStatus,
    currentStageId: nextStageId,
    currentStageOrder: nextStageOrder,
    stageProgress: nextStageProgress,
    recommendedQuestionFilter,
    lastActivityAt: now,
    completedAt: nextStatus === "completed" ? now : run.completedAt,
    updatedAt: now,
  }), { merge: true });
}
