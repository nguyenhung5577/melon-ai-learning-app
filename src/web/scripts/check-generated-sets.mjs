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

function textValue(value) {
  return String(value ?? "");
}

function hasAnswerData(question) {
  return Boolean(textValue(question.answer).trim() || textValue(question.answerText).trim());
}

function hasValidChoices(question) {
  const choices = question.choices ?? [];
  return choices.length >= 2 &&
    choices.every((choice) => textValue(choice.key).trim() && textValue(choice.text).trim());
}

function questionReferencesVisual(question) {
  const text = textValue(question.stem).toLowerCase();
  return text.includes("hình trên") || text.includes("hình vẽ") || text.includes("tô màu");
}

function hasQuestionImage(question) {
  return (question.imageUrls ?? []).some((url) => /^https?:\/\//i.test(textValue(url).trim()) || /^data:image\//i.test(textValue(url).trim()));
}

function checkExamReadyQuestion(question) {
  const reasons = [];
  if (question.subject !== "math") reasons.push("subject is not math");
  if (!textValue(question.stem).trim()) reasons.push("stem is empty");
  if (!hasAnswerData(question)) reasons.push("no answer data (answer & answerText empty)");
  if (questionReferencesVisual(question) && !hasQuestionImage(question)) reasons.push("references visual but has no image");
  if (question.type === "multiple_choice") {
    if (!hasValidChoices(question)) reasons.push("multiple choice but has invalid/insufficient choices");
  } else if (question.type !== "short_answer") {
    reasons.push(`type is neither multiple_choice nor short_answer (got: ${question.type})`);
  }
  return { ready: reasons.length === 0, reasons };
}

async function run() {
  console.log("Fetching child user profile...");
  const userSnap = await db.collection("users").doc("0101leLIdjSVm0AqeADPGCMkNZ73").get();
  if (userSnap.exists) {
    console.log("User Profile:");
    console.log(JSON.stringify(userSnap.data(), null, 2));
  } else {
    console.log("User 0101leLIdjSVm0AqeADPGCMkNZ73 not found in 'users' collection.");
  }

  console.log("\nFetching a sample from questionSets...");
  const sampleSetSnap = await db.collection("questionSets").limit(1).get();
  if (sampleSetSnap.size > 0) {
    console.log("Sample QuestionSet:");
    console.log(JSON.stringify(sampleSetSnap.docs[0].data(), null, 2));
  } else {
    console.log("No questionSets found.");
  }

  console.log("\nFetching generatedQuestionSets...");
  const setsSnap = await db.collection("generatedQuestionSets").get();
  console.log(`Found ${setsSnap.size} generated sets.`);

  for (const setDoc of setsSnap.docs) {
    const setData = setDoc.data();
    console.log(`\n===================================`);
    console.log(`Set ID: ${setDoc.id}`);
    console.log(`Title: ${setData.title}`);
    console.log(`childUid: ${setData.childUid}`);
    console.log(`grade: ${setData.grade}`);
    console.log(`createdAt: ${setData.createdAt}`);
    
    console.log(`Fetching questions for this set...`);
    const qSnap = await db.collection("generatedQuestions")
      .where("generatedSetId", "==", setDoc.id)
      .get();
    
    console.log(`Found ${qSnap.size} questions.`);
    let readyCount = 0;
    
    if (qSnap.size > 0) {
      console.log("\n--- DETAILED FIRST QUESTION RAW DATA ---");
      console.log(JSON.stringify(qSnap.docs[0].data(), null, 2));
      console.log("----------------------------------------\n");
    }

    qSnap.docs.forEach((qDoc, index) => {
      const q = qDoc.data();
      const checkResult = checkExamReadyQuestion(q);
      if (checkResult.ready) {
        readyCount++;
      } else {
        console.log(`  Question ${index + 1} (ID: ${qDoc.id}, Type: ${q.type}) is NOT ready: ${checkResult.reasons.join(", ")}`);
      }
    });

    console.log(`Summary: ${readyCount}/${qSnap.size} questions are ready.`);
  }
}

run().catch(console.error);
