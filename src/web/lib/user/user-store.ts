import { collections } from "@/lib/db/firestore";
import { getDocument, setDocument, queryDocuments, updateDocument } from "@/lib/db/firestore-helpers";
import { where, arrayUnion } from "firebase/firestore";
import type { MelonUser } from "@/lib/auth/types";

export interface ChildProfile {
  uid: string;
  displayName: string;
  avatarEmoji: string;
  grade: string;
  birthYear?: number;
  linkedParentUid?: string;
  createdAt: string;
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
};

export const AVATAR_EMOJIS = [
  "🦊", "🐼", "🐸", "🦁", "🐯", "🐧", "🦋", "🐬",
  "🦄", "🐉", "🦝", "🐨", "🐺", "🦀", "🦕", "🐝"
];

export const GRADE_OPTIONS = [
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
  "Grade 6", "Grade 7", "Grade 8", "Grade 9",
];
