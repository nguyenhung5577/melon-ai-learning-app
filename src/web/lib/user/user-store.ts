import { collections } from "@/lib/db/firestore";
import { getDocument, setDocument, queryDocuments, updateDocument } from "@/lib/db/firestore-helpers";
import { where } from "firebase/firestore";
import type { MelonUser } from "@/lib/auth/types";

export interface ChildProfile {
  uid: string;
  loginId?: string;
  displayName: string;
  avatarEmoji: string;
  grade: string;
  learningPreferences?: ChildLearningPreferences;
  birthYear?: number;
  linkedParentUid?: string;
  status?: "active" | "disabled";
  createdAt: string;
}

export type PrimaryGoal =
  | "improve_math_score"
  | "specialized_school_exam"
  | "strengthen_current_grade";

export type GradeLevel = "grade_4" | "grade_5";

export type WeakTopic =
  | "arithmetic"
  | "fractions"
  | "geometry"
  | "word_problems"
  | "logic"
  | "mixed_exams";

export type PracticeSource = "school_lessons" | "past_exams" | "both";

export type ReminderPreference = "after_school" | "evening" | "weekend" | "none";

export type ParentReportPreference =
  | "after_each_lesson"
  | "weekly"
  | "struggling_only"
  | "none";

export interface ChildLearningPreferences {
  primaryGoal: PrimaryGoal;
  domain: "math";
  gradeLevel: GradeLevel;
  currentScore: number;
  targetScore: number;
  targetSchool?: string;
  weakTopics: WeakTopic[];
  practiceSource: PracticeSource;
  sessionMinutes: 15 | 30 | 45 | 60;
  sessionsPerWeek: 2 | 3 | 5 | 7;
  reminderPreference: ReminderPreference;
  parentReportPreference: ParentReportPreference;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateChildAccountInput {
  loginId: string;
  displayName: string;
  passwordOrPin: string;
  grade: string;
  avatarEmoji: string;
  learningPreferences: ChildLearningPreferences;
}

export interface ParentProfile {
  uid: string;
  displayName: string;
  email: string;
  childUids: string[];
  createdAt: string;
}

export const userStore = {
  async getChild(uid: string): Promise<ChildProfile | undefined> {
    const doc = await getDocument(collections.children, uid);
    return doc || undefined;
  },

  async upsertChild(profile: ChildProfile): Promise<void> {
    await setDocument(collections.children, profile.uid, profile, true);
  },

  async getParent(uid: string): Promise<MelonUser | undefined> {
    const doc = await getDocument(collections.users, uid);
    if (doc && doc.role === "parent") {
      return doc;
    }
    return undefined;
  },

  async linkChildToParent(parentUid: string, childUid: string): Promise<void> {
    const childDoc = await getDocument(collections.children, childUid);
    if (childDoc) {
      await updateDocument(collections.children, childUid, { linkedParentUid: parentUid });
    }
  },

  async getChildrenForParent(parentUid: string): Promise<ChildProfile[]> {
    return queryDocuments(collections.children, where("linkedParentUid", "==", parentUid));
  },

  async createChildAccount(input: CreateChildAccountInput): Promise<ChildProfile> {
    const res = await fetch("/api/parents/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Child account creation is not available yet.");
    }
    return data.child as ChildProfile;
  },
};

export const AVATAR_EMOJIS = [
  "🦊", "🐼", "🐸", "🦁", "🐯", "🐧", "🦋", "🐬",
  "🦄", "🐉", "🦝", "🐨", "🐺", "🦀", "🦕", "🐝"
];

export const GRADE_OPTIONS = [
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
  "Grade 6", "Grade 7", "Grade 8", "Grade 9",
];
