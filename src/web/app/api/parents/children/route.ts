import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { adminAuth, adminDb, FieldValue } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

const LearningPreferencesSchema = z.object({
  primaryGoal: z.enum([
    "improve_math_score",
    "specialized_school_exam",
    "strengthen_current_grade",
  ]),
  domain: z.literal("math"),
  gradeLevel: z.enum(["grade_4", "grade_5"]),
  currentScore: z.number().min(0).max(10),
  targetScore: z.number().min(0).max(10),
  targetSchool: z.string().trim().max(80).optional(),
  weakTopics: z.array(z.enum([
    "arithmetic",
    "fractions",
    "geometry",
    "word_problems",
    "logic",
    "mixed_exams",
  ])).min(1),
  practiceSource: z.enum(["school_lessons", "past_exams", "both"]),
  sessionMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  sessionsPerWeek: z.union([z.literal(2), z.literal(3), z.literal(5), z.literal(7)]),
  reminderPreference: z.enum(["after_school", "evening", "weekend", "none"]),
  parentReportPreference: z.enum(["after_each_lesson", "weekly", "struggling_only", "none"]),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

const CreateChildSchema = z.object({
  loginId: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  displayName: z.string().trim().min(2).max(30),
  passwordOrPin: z.string().min(4).max(128),
  grade: z.string().min(1).max(40),
  avatarEmoji: z.string().min(1).max(8),
  learningPreferences: LearningPreferencesSchema,
});

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  const body = CreateChildSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing parent auth token." }, { status: 401 });
  }

  try {
    const auth = adminAuth();
    const db = adminDb();
    const decoded = await auth.verifyIdToken(token);
    const parentUid = decoded.uid;
    const parentSnap = await db.collection("users").doc(parentUid).get();
    const parent = parentSnap.data();

    if (!parentSnap.exists || parent?.role !== "parent") {
      return NextResponse.json({ error: "Only parent accounts can create child accounts." }, { status: 403 });
    }

    const data = body.data;
    const loginIdLower = data.loginId.toLowerCase();
    const credentialRef = db.collection("childCredentials").doc(loginIdLower);
    const existing = await credentialRef.get();
    if (existing.exists) {
      return NextResponse.json({ error: "Login ID này đã được dùng." }, { status: 409 });
    }

    const childUser = await auth.createUser({
      displayName: data.displayName,
      disabled: false,
    });
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(data.passwordOrPin, 12);

    try {
      await db.runTransaction(async (tx) => {
        const latestCredential = await tx.get(credentialRef);
        if (latestCredential.exists) {
          throw new Error("DUPLICATE_LOGIN_ID");
        }

        const child = {
          uid: childUser.uid,
          loginId: loginIdLower,
          displayName: data.displayName,
          avatarEmoji: data.avatarEmoji,
          grade: data.grade,
          learningPreferences: {
            ...data.learningPreferences,
            updatedAt: now,
            createdAt: data.learningPreferences.createdAt ?? now,
          },
          linkedParentUid: parentUid,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };

        tx.set(db.collection("users").doc(childUser.uid), {
          uid: childUser.uid,
          email: null,
          displayName: data.displayName,
          photoURL: null,
          role: "kid",
          loginId: loginIdLower,
          linkedParentUid: parentUid,
          coppaConsented: true,
          createdAt: now,
          updatedAt: now,
        });
        tx.set(db.collection("children").doc(childUser.uid), child);
        tx.set(credentialRef, {
          loginIdLower,
          childUid: childUser.uid,
          parentUid,
          passwordHash,
          hashVersion: "bcryptjs-12",
          disabled: false,
          createdAt: now,
          updatedAt: now,
        });
        tx.set(db.collection("users").doc(parentUid), {
          role: "parent",
          childUids: FieldValue.arrayUnion(childUser.uid),
          updatedAt: now,
        }, { merge: true });
      });
    } catch (transactionError) {
      await auth.deleteUser(childUser.uid).catch(() => undefined);
      if (transactionError instanceof Error && transactionError.message === "DUPLICATE_LOGIN_ID") {
        return NextResponse.json({ error: "Login ID này đã được dùng." }, { status: 409 });
      }
      throw transactionError;
    }

    const child = (await db.collection("children").doc(childUser.uid).get()).data();
    return NextResponse.json({ child });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tạo được tài khoản học sinh.";
    const status = message.startsWith("Missing FIREBASE_ADMIN_") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
