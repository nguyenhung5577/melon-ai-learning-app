export type UserRole = "kid" | "parent" | "admin";

export interface MelonUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL: string | null;
  avatarUrl?: string;
  loginId?: string;
  linkedParentUid?: string;
  childUids?: string[];
  coppaConsented: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthState {
  user: MelonUser | null;
  loading: boolean;
  error: string | null;
}
