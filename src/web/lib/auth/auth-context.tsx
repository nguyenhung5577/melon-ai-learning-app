"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { AuthState, MelonUser, UserRole } from "./types";
import { bus } from "@/lib/core/event-bus";

function toMelonUser(fbUser: FirebaseUser, dbUser?: Partial<MelonUser>): MelonUser {
  return {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName,
    photoURL: fbUser.photoURL,
    role: dbUser?.role ?? "kid",
    avatarUrl: dbUser?.avatarUrl,
    loginId: dbUser?.loginId,
    linkedParentUid: dbUser?.linkedParentUid,
    coppaConsented: dbUser?.coppaConsented ?? true,
    createdAt: dbUser?.createdAt ?? new Date().toISOString(),
  };
}

async function fetchUserDoc(uid: string): Promise<Partial<MelonUser> | null> {
  if (!db) return null;
  try {
    const d = await getDoc(doc(db, "users", uid));
    if (d.exists()) return d.data() as Partial<MelonUser>;
  } catch (e) {
    console.warn("Cảnh báo ngầm: Không thể đọc users doc do Firebase Rules. Bỏ qua để không hiện bảng đỏ.", e);
  }
  return null;
}

async function saveUserDoc(user: MelonUser): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, "users", user.uid), user, { merge: true });
  } catch (e) {
    console.error("Error saving user doc", e);
  }
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    role: UserRole,
    displayName?: string
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInChild: (loginId: string, passwordOrPin: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: Boolean(auth),
    error: null,
  });

  useEffect(() => {
    if (!auth) {
      // Firebase not configured — run in demo/mock mode
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const saved = await fetchUserDoc(fbUser.uid);
        const user = toMelonUser(fbUser, saved || undefined);
        const merged: MelonUser = { ...user, ...saved, uid: fbUser.uid };
        setState({ user: merged, loading: false, error: null });
        bus.emit("auth:signedIn", { uid: fbUser.uid, role: merged.role });
      } else {
        setState({ user: null, loading: false, error: null });
      }
    });

    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error("Firebase not configured. Add keys to .env.local");
    setState((s) => ({ ...s, error: null }));
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const saved = await fetchUserDoc(cred.user.uid);
    const user = toMelonUser(cred.user, saved || undefined);
    const merged = { ...user, ...saved, uid: cred.user.uid } as MelonUser;
    setState({ user: merged, loading: false, error: null });
  }

  async function signUp(
    email: string,
    password: string,
    role: UserRole,
    displayName?: string
  ) {
    if (!auth) throw new Error("Firebase not configured. Add keys to .env.local");
    setState((s) => ({ ...s, error: null }));
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    const user: MelonUser = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: displayName ?? null,
      photoURL: null,
      role,
      coppaConsented: true,
      createdAt: new Date().toISOString(),
    };
    await saveUserDoc(user);
    setState({ user, loading: false, error: null });
  }

  async function signInWithGoogle() {
    if (!auth) throw new Error("Firebase not configured. Add keys to .env.local");
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const saved = await fetchUserDoc(cred.user.uid);
    const user = toMelonUser(cred.user, saved || { role: "parent" });
    const merged = {
      ...user,
      ...saved,
      uid: cred.user.uid,
      role: saved?.role ?? "parent",
      coppaConsented: true,
    } as MelonUser;
    if (!saved) {
      await saveUserDoc(merged);
    }
    setState({ user: merged, loading: false, error: null });
  }

  async function signInChild(loginId: string, passwordOrPin: string) {
    if (!auth) throw new Error("Firebase not configured. Add keys to .env.local");
    setState((s) => ({ ...s, error: null }));

    const res = await fetch("/api/auth/child/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId: loginId.trim(), passwordOrPin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.customToken) {
      throw new Error(data.error ?? "Child login is not available yet.");
    }

    const cred = await signInWithCustomToken(auth, data.customToken);
    const saved = await fetchUserDoc(cred.user.uid);
    const user = toMelonUser(cred.user, saved || { role: "kid", loginId });
    const merged = {
      ...user,
      ...saved,
      uid: cred.user.uid,
      role: "kid",
      loginId: saved?.loginId ?? loginId,
    } as MelonUser;
    setState({ user: merged, loading: false, error: null });
  }

  async function logout() {
    if (auth) await signOut(auth);
    setState({ user: null, loading: false, error: null });
    bus.emit("auth:signedOut", {});
    router.replace("/");
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signInWithGoogle, signInChild, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
