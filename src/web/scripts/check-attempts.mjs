import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore(app);

async function checkLogs() {
  console.log("Checking studentExerciseAttempts collection...");
  const attemptsRef = db.collection("studentExerciseAttempts");
  const snapshot = await attemptsRef.limit(10).get();
  console.log(`Total attempts found in query (limit 10): ${snapshot.size}`);
  
  if (snapshot.size > 0) {
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Attempt ID: ${doc.id}`);
      console.log(`- childUid: ${data.childUid}`);
      console.log(`- questionId: ${data.questionId}`);
      console.log(`- source: ${data.source}`);
      console.log(`- isCorrect: ${data.isCorrect}`);
      console.log(`- rubricLevel: ${data.rubricLevel}`);
      console.log(`- submittedAt: ${data.submittedAt}`);
      console.log("--------------------");
    });
  }

  console.log("\nChecking total count in studentExerciseAttempts...");
  const countSnap = await attemptsRef.count().get();
  console.log(`Total attempts in database: ${countSnap.data().count}`);
}

checkLogs().catch(err => {
  console.error("Error checking logs:", err);
});
