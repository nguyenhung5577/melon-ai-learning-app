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

export interface StudentPersonalizedPlanRecord {
  id: string;
  childUid: string;
  status: "active" | "stale" | "completed";
  generatedAt: string;
  basedOnProgressUpdatedAt: string;
  targetConcepts: string[];
  recommendedLessonIds: string[];
  recommendedQuestionFilters: RecommendedQuestionFilter[];
  reasonSummary: string;
  source: "rules_v1" | "llm_v1";
  createdAt?: string;
  updatedAt: string;
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
