import fs from "node:fs/promises";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
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

function uniqueQuestionId(question, index, seen) {
  const base = String(question.id || `question-${index + 1}`).trim();
  const nextCount = (seen.get(base) ?? 0) + 1;
  seen.set(base, nextCount);
  return nextCount === 1 ? base : `${base}-${nextCount}`;
}

async function parsePdf({ filePath, grade, title, pageRange, backendUrl }) {
  const fileBuffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append("files", new Blob([fileBuffer], { type: "application/pdf" }), path.basename(filePath));
  form.append("grade", String(grade));
  form.append("subject", "math");
  form.append("language", "vi");
  form.append("questionSetTitle", title || "");
  form.append("pageRange", pageRange || "");
  form.append("parseAllSets", "true");

  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/problems/parse`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data));
  }
  if ("sets" in data) return data.sets;
  return [data];
}

async function saveResults(db, results, { sourceFile, createdBy }) {
  const now = new Date().toISOString();
  let questionCount = 0;

  for (const result of results) {
    const questionSet = {
      ...result.questionSet,
      sourceFiles: result.questionSet.sourceFiles?.length ? result.questionSet.sourceFiles : [sourceFile],
      createdAt: result.questionSet.createdAt || now,
      updatedAt: now,
    };
    await db.collection("questionSets").doc(questionSet.id).set(questionSet, { merge: true });

    const seenQuestionIds = new Map();
    const batch = db.batch();
    for (const [index, question] of result.questions.entries()) {
      const id = uniqueQuestionId(question, index, seenQuestionIds);
      const ref = db.collection("questionBank").doc(id);
      batch.set(
        ref,
        {
          ...question,
          id,
          questionSetId: questionSet.id,
          sourceSetId: questionSet.id,
          sourceTitle: questionSet.title,
          sourceFiles: questionSet.sourceFiles,
          sourcePageRange: result.pageRange || "",
          rubricLevel: question.rubricLevel || "unclassified",
          createdBy,
          updatedBy: createdBy,
          classifiedAt: question.classifiedAt ?? null,
          createdAt: question.createdAt || now,
          updatedAt: now,
        },
        { merge: true }
      );
      questionCount += 1;
    }
    await batch.commit();
  }

  return { setCount: results.length, questionCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    throw new Error("Usage: npm run import:pdf-question-bank -- --file /path/file.pdf --grade 4 --title \"Tên đề\" --pages \"1-4\"");
  }

  const filePath = path.resolve(args.file);
  const backendUrl = args.backend || process.env.MELON_BACKEND_URL || "http://127.0.0.1:8001";
  const grade = Number(args.grade || 5);
  const results = await parsePdf({
    filePath,
    grade,
    title: args.title || "",
    pageRange: args.pages || "",
    backendUrl,
  });
  const summary = await saveResults(initDb(), results, {
    sourceFile: filePath,
    createdBy: args.createdBy || "script-import",
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
