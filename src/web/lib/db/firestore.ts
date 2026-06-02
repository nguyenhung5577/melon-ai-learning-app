import { db } from "@/lib/auth/firebase";
import { collection, DocumentData, CollectionReference } from "firebase/firestore";
import type { MelonUser } from "@/lib/auth/types";
import type { ChildProfile } from "@/lib/user/user-store";
import type { Lesson } from "@/lib/lessons/lesson-store";
import type { GamificationData } from "@/lib/gamification/gamification-store";
import type { ActivityEvent } from "@/lib/activity";
import type {
  KidQuestionStats,
  ParseJob,
  ParsedQuestion,
  QuestionAttempt,
  QuestionBankMeta,
  QuestionBankQuestion,
  QuestionSet,
  StudentSubmission,
} from "@/lib/problems/types";

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
};

// Subcollections
export const subcollections = {
  activityEvents: (uid: string) => createCollection<ActivityEvent>(`activity/${uid}/events`),
  aiContents: (lessonId: string) => createCollection<DocumentData>(`lessons/${lessonId}/ai_contents`),
};
