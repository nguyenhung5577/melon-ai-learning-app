import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const rubricLevels = [
  ["unclassified", "Chưa phân loại"],
  ["nhan_biet", "Nhận biết"],
  ["thong_hieu", "Thông hiểu"],
  ["van_dung", "Vận dụng"],
  ["van_dung_cao", "Vận dụng cao"],
];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function projectId() {
  return process.env.FIREBASE_ADMIN_PROJECT_ID || requiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
}

function initDb() {
  initializeApp({
    credential: cert({
      projectId: projectId(),
      clientEmail: requiredEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: requiredEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
  return getFirestore();
}

async function seedQuestionBankMeta(db) {
  const now = new Date().toISOString();
  const batch = db.batch();

  for (const grade of [4, 5]) {
    for (const [rubricLevel, label] of rubricLevels) {
      const id = `grade_${grade}_${rubricLevel}`;
      batch.set(
        db.collection("questionBankMeta").doc(id),
        {
          id,
          grade,
          rubricLevel,
          label,
          questionCount: 0,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }
  }

  await batch.commit();
}

async function loadQuestionSets(db) {
  const snapshot = await db.collection("questionSets").get();
  const sets = new Map();
  snapshot.forEach((doc) => {
    sets.set(doc.id, { id: doc.id, ...doc.data() });
  });
  return sets;
}

function asQuestionBankDoc(question, set) {
  const now = new Date().toISOString();
  const sourceSetId = question.questionSetId || question.sourceSetId || set?.id || "";

  return {
    ...question,
    questionSetId: question.questionSetId || sourceSetId,
    sourceSetId,
    sourceTitle: question.sourceTitle || set?.title || "",
    sourceFiles: question.sourceFiles || set?.sourceFiles || [],
    sourcePageRange: question.sourcePageRange || "",
    rubricLevel: question.rubricLevel || "unclassified",
    classifiedAt: question.classifiedAt ?? null,
    createdBy: question.createdBy || "migration",
    updatedBy: question.updatedBy || "migration",
    createdAt: question.createdAt || now,
    updatedAt: now,
  };
}

async function migrateQuestions(db, questionSets) {
  const snapshot = await db.collection("questions").get();
  let count = 0;
  let batch = db.batch();

  for (const doc of snapshot.docs) {
    const question = { id: doc.id, ...doc.data() };
    const set = questionSets.get(question.questionSetId);
    batch.set(db.collection("questionBank").doc(doc.id), asQuestionBankDoc(question, set), { merge: true });
    count += 1;

    if (count % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  await batch.commit();
  return count;
}

async function importStudentSubmissionSnapshots(db) {
  if (process.env.IMPORT_STUDENT_SUBMISSIONS !== "true") {
    return 0;
  }

  const snapshot = await db.collection("studentSubmissions").get();
  let count = 0;
  let batch = db.batch();

  for (const submissionDoc of snapshot.docs) {
    const submission = { id: submissionDoc.id, ...submissionDoc.data() };
    const questions = Array.isArray(submission.questions) ? submission.questions : [];
    for (const question of questions) {
      const id = `submission_${submissionDoc.id}_${question.id}`;
      const sourceSet = submission.questionSet || {
        id: submission.questionSetId,
        title: submission.title || "Đề học sinh gửi",
        sourceFiles: submission.sourceFiles || [],
      };
      batch.set(
        db.collection("questionBank").doc(id),
        asQuestionBankDoc(
          {
            ...question,
            id,
            questionSetId: sourceSet.id,
            createdBy: submission.uid || "student-submission",
          },
          sourceSet
        ),
        { merge: true }
      );
      count += 1;

      if (count % 450 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }

  await batch.commit();
  return count;
}

async function main() {
  const db = initDb();
  await seedQuestionBankMeta(db);
  const questionSets = await loadQuestionSets(db);
  const migratedQuestions = await migrateQuestions(db, questionSets);
  const importedSubmissionQuestions = await importStudentSubmissionSnapshots(db);

  console.log(JSON.stringify({
    seededMetaBuckets: 10,
    migratedQuestions,
    importedSubmissionQuestions,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
