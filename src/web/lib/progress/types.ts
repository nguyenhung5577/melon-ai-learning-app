export interface LessonCompletionInput {
  childUid: string;
  lessonId: string;
  lessonTitle: string;
  subject: string;
  scorePercent: number;
  quizCorrect: number;
  quizTotal: number;
  xpEarned: number;
  timeOnTaskSeconds: number;
  concepts?: string[];
  skills?: string[];
  completedAt?: string;
}

export interface LessonCompletionRecord extends LessonCompletionInput {
  id: string;
  startedAt?: string;
  completedAt: string;
  quizScorePercent: number;
  attemptNumber?: number;
  masteryState?: MasteryState;
}

export type MasteryState = "not_started" | "in_progress" | "developing" | "mastered";

export interface StatBucket {
  attempts: number;
  correct: number;
  accuracy: number;
  lastPracticedAt?: string;
  masteryState: MasteryState;
}

export interface StudentProgressRecord {
  id: string;
  childUid: string;
  schemaVersion: number;
  totalLessonsCompleted: number;
  totalLessonAttempts: number;
  totalExerciseAttempts: number;
  totalCorrectExerciseAttempts: number;
  totalTimeOnTaskSeconds: number;
  totalXpEarned: number;
  averageQuizScore: number;
  exerciseAccuracy: number;
  level: number;
  subjectStats: Record<string, StatBucket>;
  conceptStats: Record<string, StatBucket>;
  weakConcepts: string[];
  recommendedConcepts: string[];
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentLessonProgressRecord {
  id: string;
  childUid: string;
  lessonId: string;
  lessonTitle: string;
  subject: string;
  status: MasteryState;
  attemptCount: number;
  completedCount: number;
  totalTimeOnTaskSeconds: number;
  totalXpEarned: number;
  bestScorePercent: number;
  latestScorePercent: number;
  latestQuizScorePercent: number;
  quizCorrect: number;
  quizTotal: number;
  completionRatePercent: number;
  masteryState: MasteryState;
  firstCompletedAt?: string;
  lastCompletedAt?: string;
  concepts: string[];
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentExerciseAttemptInput {
  childUid: string;
  questionId: string;
  questionSetId?: string;
  sourceTitle?: string;
  subject: string;
  grade?: number;
  rubricLevel?: string;
  submittedAnswer: string;
  isCorrect: boolean;
  timeSpentMs: number;
  startedAt?: string;
  submittedAt?: string;
  source: "practice" | "student_submission" | "question_bank";
  concepts?: string[];
  skills?: string[];
  courseId?: string;
  courseRunId?: string;
  pipelineId?: string;
  stageId?: string;
  stageTitle?: string;
}

export interface StudentExerciseAttemptRecord extends StudentExerciseAttemptInput {
  id: string;
  timeSpentSeconds: number;
  submittedAt: string;
}

export interface RecommendedQuestionFilter {
  grade?: number;
  rubricLevels: string[];
  concepts: string[];
  subject: string;
}

export type PersonalizedActionType =
  | "diagnostic_short_set"
  | "micro_lesson_then_guided_retry"
  | "remediation_practice"
  | "mixed_practice"
  | "spiral_review_or_challenge";

export type PersonalizedHintMode =
  | "available"
  | "after_first_wrong"
  | "step_by_step";

export type PersonalizedUiMode =
  | "normal"
  | "slow_down_check_step"
  | "step_by_step";

export interface PersonalizedWeaknessSummary {
  concept: string;
  attempts: number;
  accuracy: number;
  masteryState: MasteryState;
  needsAttention: boolean;
}

export interface PersonalizedNextAction {
  id: string;
  priority: number;
  title: string;
  description: string;
  actionType: PersonalizedActionType;
  concepts: string[];
  rubricLevels: string[];
  questionCount: number;
  reason: string;
  hintMode: PersonalizedHintMode;
  uiMode: PersonalizedUiMode;
}

export interface StudentPersonalizedPlanRecord {
  id: string;
  childUid: string;
  status: "active" | "stale" | "completed";
  generatedAt: string;
  basedOnProgressUpdatedAt: string;
  targetConcepts: string[];
  recommendedLessonIds: string[];
  recommendedQuestionFilters: RecommendedQuestionFilter[];
  nextBestActions?: PersonalizedNextAction[];
  weaknessSummary?: PersonalizedWeaknessSummary[];
  reasonSummary: string;
  source: "rules_v1" | "rules_v2" | "llm_v1";
  createdAt?: string;
  updatedAt: string;
}

export type CourseStageType =
  | "diagnostic"
  | "foundation"
  | "practice"
  | "checkpoint"
  | "remedial"
  | "challenge";

export type CourseRunStatus =
  | "active"
  | "completed"
  | "paused";

export type CourseStageStatus =
  | "locked"
  | "ready"
  | "in_progress"
  | "mastered"
  | "retry_required";

export interface CourseQuestionFilter {
  subject: "math";
  grade: number;
  rubricLevels: string[];
  keywords: string[];
  questionCount: number;
}

export interface CourseDefinition {
  id: string;
  title: string;
  subject: "math";
  grade: 4 | 5;
  primaryConcept: string;
  conceptLabels: string[];
  description: string;
  goalText: string;
  pipelineId: string;
  entryKeywords: string[];
  recommendedOrder: number;
  status: "active" | "draft";
  createdAt: string;
  updatedAt: string;
}

export interface CoursePipelineStage {
  id: string;
  title: string;
  description: string;
  stageType: CourseStageType;
  supportText: string;
  questionFilter: CourseQuestionFilter;
  passAccuracy: number;
  minAttempts: number;
  nextStageId?: string;
  remedialStageId?: string;
  hintMode: PersonalizedHintMode;
  uiMode: PersonalizedUiMode;
}

export interface CoursePipelineDefinition {
  id: string;
  courseId: string;
  version: number;
  stages: CoursePipelineStage[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentCourseStageProgress {
  stageId: string;
  attempts: number;
  correct: number;
  accuracy: number;
  status: CourseStageStatus;
  enteredAt: string;
  lastAttemptAt?: string;
  completedAt?: string;
}

export interface StudentCourseRunRecord {
  id: string;
  childUid: string;
  courseId: string;
  pipelineId: string;
  status: CourseRunStatus;
  priorityScore: number;
  personalizedReason: string;
  visibleStageIds?: string[];
  currentStageId: string;
  currentStageOrder: number;
  stageProgress: Record<string, StudentCourseStageProgress>;
  recommendedQuestionFilter: CourseQuestionFilter;
  startedAt: string;
  completedAt?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRunSnapshot {
  course: CourseDefinition;
  pipeline: CoursePipelineDefinition;
  run: StudentCourseRunRecord;
  currentStage: CoursePipelineStage;
  attemptedQuestionIds?: string[];
  attemptedQuestionIdsByStage?: Record<string, string[]>;
}

export interface DailyProgressPoint {
  date: string;
  day: string;
  lessonsCompleted: number;
  timeOnTaskMinutes: number;
  xpEarned: number;
  averageQuizScore: number;
}

export interface SubjectProgressPoint {
  name: string;
  lessonsCompleted: number;
  timeOnTaskMinutes: number;
  averageQuizScore: number;
}

export interface ProgressSummary {
  childUid: string;
  totalLessonsCompleted: number;
  totalTimeOnTaskSeconds: number;
  totalXpEarned: number;
  averageQuizScore: number;
  level: number;
  daily: DailyProgressPoint[];
  subjectBreakdown: SubjectProgressPoint[];
  recentCompletions: LessonCompletionRecord[];
  conceptsToReinforce: string[];
}
