import { db } from "@/lib/auth/firebase";
import { collection, DocumentData, CollectionReference } from "firebase/firestore";
import type { MelonUser } from "@/lib/auth/types";
import type { ChildProfile } from "@/lib/user/user-store";
import type { Lesson } from "@/lib/lessons/lesson-store";
import type { GamificationData } from "@/lib/gamification/gamification-store";
import type { ActivityEvent } from "@/lib/activity";
import type {
  GeneratedQuestion,
  GeneratedQuestionSet,
  KidQuestionStats,
  ParseJob,
  ParsedQuestion,
  QuestionAttempt,
  QuestionBankMeta,
  QuestionBankQuestion,
  QuestionSet,
  StudentSubmission,
} from "@/lib/problems/types";
import type {
  CourseDefinition,
  CoursePipelineDefinition,
  StudentExerciseAttemptRecord,
  StudentCourseRunRecord,
  StudentLessonProgressRecord,
  StudentPersonalizedPlanRecord,
  StudentProgressRecord,
  LessonCompletionRecord,
} from "@/lib/progress/types";

/**
 * Helper to strongly type a Firestore collection
 */
const createCollection = <T = DocumentData>(collectionName: string) => {
  return collection(db!, collectionName) as CollectionReference<T>;
};

// Top-level collections
export const collections = {
  get users() { return createCollection<MelonUser>("users"); },
  get children() { return createCollection<ChildProfile>("children"); },
  get lessons() { return createCollection<Lesson>("lessons"); },
  get gamification() { return createCollection<GamificationData>("gamification"); },
  get questionSets() { return createCollection<QuestionSet>("questionSets"); },
  get questions() { return createCollection<ParsedQuestion>("questions"); },
  get questionBank() { return createCollection<QuestionBankQuestion>("questionBank"); },
  get questionBankMeta() { return createCollection<QuestionBankMeta>("questionBankMeta"); },
  get questionAttempts() { return createCollection<QuestionAttempt>("questionAttempts"); },
  get kidQuestionStats() { return createCollection<KidQuestionStats>("kidQuestionStats"); },
  get studentSubmissions() { return createCollection<StudentSubmission>("studentSubmissions"); },
  get parseJobs() { return createCollection<ParseJob>("parseJobs"); },
  get studentProgress() { return createCollection<StudentProgressRecord>("studentProgress"); },
  get studentLessonProgress() { return createCollection<StudentLessonProgressRecord>("studentLessonProgress"); },
  get studentLessonCompletions() { return createCollection<LessonCompletionRecord>("studentLessonCompletions"); },
  get studentExerciseAttempts() { return createCollection<StudentExerciseAttemptRecord>("studentExerciseAttempts"); },
  get studentPersonalizedPlans() { return createCollection<StudentPersonalizedPlanRecord>("studentPersonalizedPlans"); },
  get courses() { return createCollection<CourseDefinition>("courses"); },
  get coursePipelines() { return createCollection<CoursePipelineDefinition>("coursePipelines"); },
  get studentCourseRuns() { return createCollection<StudentCourseRunRecord>("studentCourseRuns"); },
  get generatedQuestionSets() { return createCollection<GeneratedQuestionSet>("generatedQuestionSets"); },
  get generatedQuestions() { return createCollection<GeneratedQuestion>("generatedQuestions"); },
};

// Subcollections
export const subcollections = {
  activityEvents: (uid: string) => createCollection<ActivityEvent>(`activity/${uid}/events`),
  aiContents: (lessonId: string) => createCollection<DocumentData>(`lessons/${lessonId}/ai_contents`),
};
