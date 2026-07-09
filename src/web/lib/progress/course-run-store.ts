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
  StudentExerciseAttemptRecord,
  StudentProgressRecord,
} from "./types";

type LearningPreferences = {
  domain?: string;
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

function goalFocusConcepts(child?: ChildDocument): string[] {
  const prefs = child?.learningPreferences;
  const weakTopics = unique(prefs?.weakTopics ?? []);
  if (prefs?.primaryGoal === "specialized_school_exam") {
    return unique([...weakTopics, "mixed_exams", "logic", "word_problems", "arithmetic", "geometry"]);
  }
  if (prefs?.primaryGoal === "strengthen_current_grade") {
    return unique([...weakTopics, "arithmetic", "fractions", "geometry", "word_problems"]);
  }
  return unique([...weakTopics, "arithmetic", "word_problems", "fractions", "geometry"]);
}

function goalIntensity(child?: ChildDocument): "recovery" | "standard" | "advanced" {
  const prefs = child?.learningPreferences;
  const current = Number(prefs?.currentScore ?? 0);
  const target = Number(prefs?.targetScore ?? current);
  if (prefs?.primaryGoal === "specialized_school_exam" || (current >= 8 && target >= 9)) {
    return "advanced";
  }
  if (prefs?.primaryGoal === "improve_math_score" && current < 7 && target > current) {
    return "recovery";
  }
  return "standard";
}

function activeCourseLimit(child?: ChildDocument): number {
  const prefs = child?.learningPreferences;
  const sessionsPerWeek = Number(prefs?.sessionsPerWeek ?? 3);
  const sessionMinutes = Number(prefs?.sessionMinutes ?? 30);

  if (sessionsPerWeek >= 5 && sessionMinutes >= 30) return 4;
  if (sessionsPerWeek >= 3) return 3;
  return 2;
}

function stageIndex(pipeline: CoursePipelineDefinition, stageId: string): number {
  return Math.max(0, pipeline.stages.findIndex((stage) => stage.id === stageId));
}

function orderedStageIds(pipeline: CoursePipelineDefinition, stageIds: string[]): string[] {
  return unique(stageIds).sort((left, right) => stageIndex(pipeline, left) - stageIndex(pipeline, right));
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

function visibleStageIdsForRun(
  pipeline: CoursePipelineDefinition,
  course: CourseDefinition,
  progress: StudentProgressRecord,
  child?: ChildDocument
): string[] {
  const stat = progress.conceptStats?.[course.primaryConcept];
  const attempts = Number(stat?.attempts ?? 0);
  const accuracy = Number(stat?.accuracy ?? 0);
  const intensity = goalIntensity(child);
  const visible: string[] = [];

  const pushStageType = (...types: CourseStageType[]) => {
    const stage = firstStageOfType(pipeline, ...types);
    if (stage?.id && !visible.includes(stage.id)) {
      visible.push(stage.id);
    }
  };

  if (attempts < 2) {
    pushStageType("diagnostic");
  }

  if (intensity === "recovery") {
    pushStageType("foundation");
    pushStageType("practice");
    pushStageType("checkpoint");
    return visible;
  }

  if (intensity === "advanced") {
    if (accuracy < 75 || attempts < 3) {
      pushStageType("practice");
    }
    pushStageType("checkpoint");
    pushStageType("challenge");
    return visible;
  }

  if (accuracy < 60) {
    pushStageType("foundation");
  }
  pushStageType("practice");
  pushStageType("checkpoint");
  pushStageType("challenge");
  return visible;
}

function priorityScoreForCourse(
  course: CourseDefinition,
  progress: StudentProgressRecord,
  child?: ChildDocument
): number {
  const weakTopics = weakTopicsFromChild(child);
  const goalConcepts = goalFocusConcepts(child);
  const goalIndex = goalConcepts.indexOf(course.primaryConcept);
  const weakTopicIndex = weakTopics.indexOf(course.primaryConcept);
  const recommendedIndex = (progress.recommendedConcepts ?? []).indexOf(course.primaryConcept);
  const weakConceptIndex = (progress.weakConcepts ?? []).indexOf(course.primaryConcept);
  const goalBoost = goalIndex >= 0 ? Math.max(0, 130 - (goalIndex * 18)) : 0;
  const weakTopicBoost = weakTopicIndex >= 0 ? Math.max(0, 90 - (weakTopicIndex * 18)) : 12;
  const recommendedBoost = recommendedIndex >= 0 ? Math.max(0, 120 - (recommendedIndex * 22)) : 0;
  const weakConceptBoost = weakConceptIndex >= 0 ? Math.max(0, 105 - (weakConceptIndex * 20)) : 0;
  const stat = progress.conceptStats?.[course.primaryConcept];
  const attempts = Number(stat?.attempts ?? 0);
  const accuracy = Number(stat?.accuracy ?? 0);
  const masteryState = stat?.masteryState;
  const staleDays = stat?.lastPracticedAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(stat.lastPracticedAt)) / (1000 * 60 * 60 * 24)))
    : 999;
  const needBoost = attempts < 3 ? 42 : Math.max(0, 100 - accuracy);
  const retentionBoost = masteryState === "mastered" ? Math.min(18, staleDays / 2) : Math.min(10, staleDays / 4);
  const masteryPenalty = masteryState === "mastered" && accuracy >= 85 ? 26 : 0;
  return goalBoost + weakTopicBoost + recommendedBoost + weakConceptBoost + needBoost + retentionBoost - masteryPenalty + Math.max(0, 20 - course.recommendedOrder);
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
  progress: StudentProgressRecord,
  child?: ChildDocument
): CoursePipelineStage {
  const stat = progress.conceptStats?.[course.primaryConcept];
  const attempts = Number(stat?.attempts ?? 0);
  const accuracy = Number(stat?.accuracy ?? 0);
  const masteryState = stat?.masteryState;
  const intensity = goalIntensity(child);

  if (intensity === "advanced" && attempts >= 2 && accuracy >= 75) {
    return firstStageOfType(pipeline, "checkpoint", "challenge", "practice");
  }
  if (attempts < 2) {
    return firstStageOfType(pipeline, "diagnostic", "foundation");
  }
  if (masteryState === "mastered" && accuracy >= 85) {
    return firstStageOfType(pipeline, "checkpoint", "challenge", "practice");
  }
  if (intensity === "recovery" && accuracy < 75) {
    return firstStageOfType(pipeline, "foundation", "practice");
  }
  if (accuracy < 50) {
    return firstStageOfType(pipeline, "foundation", "remedial", "practice");
  }
  if (accuracy < 70 || masteryState === "in_progress") {
    return firstStageOfType(pipeline, "practice", "checkpoint");
  }
  if (accuracy < 85 || masteryState === "developing") {
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

function reconcileCourseRunState(
  run: StudentCourseRunRecord,
  pipeline: CoursePipelineDefinition,
  now: string
): StudentCourseRunRecord {
  let nextRun = { ...run, stageProgress: { ...(run.stageProgress ?? {}) } };
  let changed = false;

  for (let guard = 0; guard < pipeline.stages.length; guard += 1) {
    const currentStage = stageById(pipeline, nextRun.currentStageId);
    const currentProgress = nextRun.stageProgress[currentStage.id];

    const shouldMarkMastered =
      currentProgress &&
      currentProgress.status === "in_progress" &&
      currentProgress.attempts >= currentStage.minAttempts &&
      currentProgress.accuracy >= currentStage.passAccuracy;
    const shouldMarkRetry =
      currentProgress &&
      currentProgress.status === "in_progress" &&
      currentProgress.attempts >= currentStage.minAttempts &&
      currentProgress.accuracy < currentStage.passAccuracy;

    if (shouldMarkMastered) {
      nextRun = {
        ...nextRun,
        stageProgress: {
          ...nextRun.stageProgress,
          [currentStage.id]: {
            ...currentProgress,
            status: "mastered",
            completedAt: currentProgress.completedAt ?? now,
          },
        },
      };
      changed = true;
      continue;
    }

    if (shouldMarkRetry) {
      nextRun = {
        ...nextRun,
        stageProgress: {
          ...nextRun.stageProgress,
          [currentStage.id]: {
            ...currentProgress,
            status: "retry_required",
          },
        },
      };
      changed = true;
      continue;
    }

    if (currentProgress?.status === "mastered") {
      if (!currentStage.nextStageId) {
        if (nextRun.status !== "completed") {
          nextRun = {
            ...nextRun,
            status: "completed",
            completedAt: nextRun.completedAt ?? currentProgress.completedAt ?? now,
          };
          changed = true;
        }
        break;
      }

      const upcoming = stageById(pipeline, currentStage.nextStageId);
      nextRun = {
        ...nextRun,
        currentStageId: upcoming.id,
        currentStageOrder: stageIndex(pipeline, upcoming.id) + 1,
        recommendedQuestionFilter: upcoming.questionFilter,
        status: "active",
        stageProgress: {
          ...nextRun.stageProgress,
          [upcoming.id]: nextRun.stageProgress[upcoming.id] ?? stageProgressRecord(upcoming.id, "in_progress", now),
        },
      };
      changed = true;
      continue;
    }

    if (currentProgress?.status === "retry_required" && currentStage.remedialStageId) {
      const remedial = stageById(pipeline, currentStage.remedialStageId);
      const remedialProgress = nextRun.stageProgress[remedial.id];
      if (remedial.id !== currentStage.id && remedialProgress?.status !== "mastered") {
        nextRun = {
          ...nextRun,
          currentStageId: remedial.id,
          currentStageOrder: stageIndex(pipeline, remedial.id) + 1,
          recommendedQuestionFilter: remedial.questionFilter,
          status: "active",
          stageProgress: {
            ...nextRun.stageProgress,
            [remedial.id]: nextRun.stageProgress[remedial.id] ?? stageProgressRecord(remedial.id, "in_progress", now),
          },
        };
        changed = true;
      }
    }

    break;
  }

  return changed
    ? {
        ...nextRun,
        lastActivityAt: nextRun.lastActivityAt ?? now,
        updatedAt: now,
      }
    : run;
}

function createCourseRun(
  childUid: string,
  course: CourseDefinition,
  pipeline: CoursePipelineDefinition,
  progress: StudentProgressRecord,
  child: ChildDocument | undefined,
  now: string
): StudentCourseRunRecord {
  const startingStage = startingStageForCourse(course, pipeline, progress, child);
  const stageProgress: Record<string, StudentCourseStageProgress> = {
    [startingStage.id]: stageProgressRecord(startingStage.id, "in_progress", now),
  };
  const visibleStageIds = orderedStageIds(pipeline, [
    ...visibleStageIdsForRun(pipeline, course, progress, child),
    startingStage.id,
  ]);

  return {
    id: documentId(childUid, course.id),
    childUid,
    courseId: course.id,
    pipelineId: pipeline.id,
    status: "active",
    priorityScore: priorityScoreForCourse(course, progress, child),
    personalizedReason: courseReasonText(course, progress),
    visibleStageIds,
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
  const activeLimit = activeCourseLimit(child);
  const rankedCourses = courses
    .map((course) => ({
      course,
      priorityScore: priorityScoreForCourse(course, progress, child),
    }))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.course.recommendedOrder - b.course.recommendedOrder;
    });
  const activeCourseIds = new Set(rankedCourses.slice(0, activeLimit).map((item) => item.course.id));

  for (const course of courses) {
    const pipeline = pipelinesByCourse.get(course.id);
    if (!pipeline || pipeline.stages.length === 0) continue;

    const current = existingByCourse.get(course.id);
    const nextPriority = priorityScoreForCourse(course, progress, child);
    const nextReason = courseReasonText(course, progress);
    const currentStage = current ? stageById(pipeline, current.currentStageId) : undefined;
    const nextVisibleStageIds = orderedStageIds(pipeline, [
      ...visibleStageIdsForRun(pipeline, course, progress, child),
      ...(current?.currentStageId ? [current.currentStageId] : []),
    ]);
    const desiredStatus =
      current?.status === "completed"
        ? "completed"
        : activeCourseIds.has(course.id)
          ? "active"
          : "paused";
    const payload = current
      ? {
          ...current,
          status: desiredStatus,
          priorityScore: nextPriority,
          personalizedReason: nextReason,
          visibleStageIds: nextVisibleStageIds,
          recommendedQuestionFilter: currentStage?.questionFilter ?? current.recommendedQuestionFilter,
          updatedAt: now,
        }
      : {
          ...createCourseRun(childUid, course, pipeline, progress, child, now),
          status: desiredStatus,
        };

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

  const now = new Date().toISOString();
  const snapshots: CourseRunSnapshot[] = [];
  const attemptSnap = await db.collection("studentExerciseAttempts").where("childUid", "==", childUid).get();
  const attemptsByCourseRun = new Map<string, StudentExerciseAttemptRecord[]>();
  for (const doc of attemptSnap.docs) {
    const attempt = { ...doc.data(), id: doc.id } as StudentExerciseAttemptRecord;
    if (!attempt.courseRunId) continue;
    attemptsByCourseRun.set(attempt.courseRunId, [...(attemptsByCourseRun.get(attempt.courseRunId) ?? []), attempt]);
  }

  for (const run of runs) {
      const course = coursesById.get(run.courseId);
      const pipeline = pipelinesById.get(run.pipelineId);
      if (!course || !pipeline) continue;

      const reconciledRun = reconcileCourseRunState(run, pipeline, now);
      if (reconciledRun !== run) {
        await db.collection("studentCourseRuns").doc(reconciledRun.id).set(stripUndefined(reconciledRun), { merge: true });
      }

      if (!options?.includeCompleted && reconciledRun.status !== "active") continue;

      const currentStage = stageById(pipeline, reconciledRun.currentStageId);
      const runAttempts = attemptsByCourseRun.get(reconciledRun.id) ?? [];
      const attemptedQuestionIdsByStage = runAttempts.reduce<Record<string, string[]>>((items, attempt) => {
        if (!attempt.stageId) return items;
        items[attempt.stageId] = unique([...(items[attempt.stageId] ?? []), attempt.questionId]);
        return items;
      }, {});
      snapshots.push({
        course,
        pipeline,
        run: reconciledRun,
        currentStage,
        attemptedQuestionIds: unique(runAttempts.map((attempt) => attempt.questionId)),
        attemptedQuestionIdsByStage,
      });
  }

  return snapshots.sort((a, b) => {
    const aCompleted = a.run.status === "completed" ? 1 : 0;
    const bCompleted = b.run.status === "completed" ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    if (b.run.priorityScore !== a.run.priorityScore) return b.run.priorityScore - a.run.priorityScore;
    return (b.run.updatedAt ?? "").localeCompare(a.run.updatedAt ?? "");
  });
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
  const reconciledRun = reconcileCourseRunState(run, pipeline, now);
  if (reconciledRun.currentStageId !== run.currentStageId || reconciledRun.status !== run.status) {
    tx.set(runRef, stripUndefined(reconciledRun), { merge: true });
    if (input.stageId !== reconciledRun.currentStageId) return;
  }

  const stage = stageById(pipeline, input.stageId);
  const activeRun = reconciledRun;
  const previousRaw = activeRun.stageProgress?.[stage.id] ?? stageProgressRecord(stage.id, "in_progress", now);
  const previous = previousRaw.status === "retry_required"
    ? stageProgressRecord(stage.id, "in_progress", now)
    : previousRaw;
  if (previous.status === "mastered" && input.stageId !== activeRun.currentStageId) return;

  const attempts = previous.attempts + 1;
  const correct = previous.correct + (input.isCorrect ? 1 : 0);
  const accuracy = clampPercent((correct / attempts) * 100);

  const nextStageProgress = {
    ...activeRun.stageProgress,
    [stage.id]: {
      ...previous,
      attempts,
      correct,
      accuracy,
      status: "in_progress" as CourseStageStatus,
      lastAttemptAt: now,
    },
  };

  let nextStatus = activeRun.status;
  let nextStageId = activeRun.currentStageId;
  let nextStageOrder = activeRun.currentStageOrder;
  let recommendedQuestionFilter = activeRun.recommendedQuestionFilter;

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
        nextStageProgress[upcoming.id] = nextStageProgress[upcoming.id] ?? stageProgressRecord(upcoming.id, "in_progress", now);
      } else {
        nextStatus = "completed";
      }
    } else if (stage.remedialStageId) {
      nextStageProgress[stage.id] = {
        ...nextStageProgress[stage.id],
        status: "retry_required",
      };
      const remedial = stageById(pipeline, stage.remedialStageId);
      if (nextStageProgress[remedial.id]?.status !== "mastered") {
        nextStageId = remedial.id;
        nextStageOrder = stageIndex(pipeline, remedial.id) + 1;
        recommendedQuestionFilter = remedial.questionFilter;
        nextStageProgress[remedial.id] = nextStageProgress[remedial.id] ?? stageProgressRecord(remedial.id, "in_progress", now);
      }
    } else {
      nextStageProgress[stage.id] = {
        ...nextStageProgress[stage.id],
        status: "retry_required",
      };
    }
  }

  tx.set(runRef, stripUndefined({
    ...activeRun,
    status: nextStatus,
    currentStageId: nextStageId,
    currentStageOrder: nextStageOrder,
    stageProgress: nextStageProgress,
    recommendedQuestionFilter,
    lastActivityAt: now,
    completedAt: nextStatus === "completed" ? now : activeRun.completedAt,
    updatedAt: now,
  }), { merge: true });
}
