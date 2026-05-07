import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let auth: Auth | undefined;
let storage: FirebaseStorage | undefined;

if (typeof window !== "undefined" && firebaseConfig.apiKey) {
  const app =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth    = getAuth(app);
  storage = getStorage(app);
}

export { auth, storage };
