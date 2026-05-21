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
  completedAt?: string;
}

export interface LessonCompletionRecord extends LessonCompletionInput {
  id: string;
  completedAt: string;
  quizScorePercent: number;
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

