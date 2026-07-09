import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { initializeFirestore, getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

let auth: Auth | undefined;
let db: Firestore | undefined;

if (typeof window !== "undefined" && firebaseConfig.apiKey) {
  const isNewApp = getApps().length === 0;
  const app = isNewApp ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  
  if (isNewApp) {
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
  } else {
    db = getFirestore(app);
  }

  // Kết nối Emulator nếu được cấu hình
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      console.log("🔥 Connected to Firebase Emulator Suite");
    } catch (e) {
      // Bỏ qua lỗi kết nối nhiều lần do HMR của Next.js
    }
  }
}

export { auth, db };
