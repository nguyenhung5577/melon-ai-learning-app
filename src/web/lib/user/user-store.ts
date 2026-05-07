/**
 * UserModule — localStorage-backed mock store (Phase 1 PA2).
 * Mirrors the shape described in SAD Section 3.2 UserModule.
 */

const KEY = "melon:users";

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

type StoredProfiles = {
  children: ChildProfile[];
  parents: ParentProfile[];
};

function load(): StoredProfiles {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { children: [], parents: [] };
  } catch {
    return { children: [], parents: [] };
  }
}

function save(data: StoredProfiles): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* noop */
  }
}

export const userStore = {
  getChild(uid: string): ChildProfile | undefined {
    return load().children.find((c) => c.uid === uid);
  },

  upsertChild(profile: ChildProfile): void {
    const data = load();
    const idx = data.children.findIndex((c) => c.uid === profile.uid);
    if (idx >= 0) data.children[idx] = profile;
    else data.children.push(profile);
    save(data);
  },

  getParent(uid: string): ParentProfile | undefined {
    return load().parents.find((p) => p.uid === uid);
  },

  upsertParent(profile: ParentProfile): void {
    const data = load();
    const idx = data.parents.findIndex((p) => p.uid === profile.uid);
    if (idx >= 0) data.parents[idx] = profile;
    else data.parents.push(profile);
    save(data);
  },

  linkChildToParent(parentUid: string, childUid: string): void {
    const data = load();
    const parent = data.parents.find((p) => p.uid === parentUid);
    if (parent && !parent.childUids.includes(childUid)) {
      parent.childUids.push(childUid);
    }
    const child = data.children.find((c) => c.uid === childUid);
    if (child) child.linkedParentUid = parentUid;
    save(data);
  },

  getChildrenForParent(parentUid: string): ChildProfile[] {
    const data = load();
    const parent = data.parents.find((p) => p.uid === parentUid);
    if (!parent) return [];
    return data.children.filter((c) => parent.childUids.includes(c.uid));
  },
};

export const AVATAR_EMOJIS = [
  "🦊", "🐼", "🐸", "🦁", "🐯", "🐧", "🦋", "🐬",
  "🦄", "🐉", "🦝", "🐨", "🦊", "🐺", "🦀", "🦕",
];

export const GRADE_OPTIONS = [
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5",
  "Grade 6", "Grade 7", "Grade 8", "Grade 9",
];
