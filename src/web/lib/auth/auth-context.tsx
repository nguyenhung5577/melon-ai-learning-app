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
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
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
    console.error("Error fetching user doc", e);
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
  signInWithGoogle: (role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!auth) {
      // Firebase not configured — run in demo/mock mode
      setState({ user: null, loading: false, error: null });
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

  async function signInWithGoogle(role: UserRole = "kid") {
    if (!auth) throw new Error("Firebase not configured. Add keys to .env.local");
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const saved = await fetchUserDoc(cred.user.uid);
    const user = toMelonUser(cred.user, saved || { role });
    const merged = { ...user, ...saved, uid: cred.user.uid } as MelonUser;
    if (!saved) {
      await saveUserDoc(merged);
    }
    setState({ user: merged, loading: false, error: null });
  }

  async function logout() {
    if (auth) await signOut(auth);
    setState({ user: null, loading: false, error: null });
    bus.emit("auth:signedOut", {});
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signUp, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
