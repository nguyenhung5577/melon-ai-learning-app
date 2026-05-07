export type UserRole = "kid" | "parent" | "admin";

export interface MelonUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  photoURL: string | null;
  coppaConsented: boolean;
  createdAt: string;
}

export interface AuthState {
  user: MelonUser | null;
  loading: boolean;
  error: string | null;
}
