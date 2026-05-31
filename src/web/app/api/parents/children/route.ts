import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

export async function POST(req: NextRequest) {
  const body = CreateChildSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Create child backend is not implemented yet. Verify parent auth, create child user/profile, hash credential, and return { child }.",
      contract: {
        input: {
          loginId: "unique child login id",
          displayName: "child display name",
          passwordOrPin: "raw secret received only by backend",
          grade: "grade label",
          avatarEmoji: "selected avatar",
          learningPreferences: {
            primaryGoal: "improve_math_score",
            domain: "math",
            gradeLevel: "grade_4",
            currentScore: 7,
            targetScore: 9,
            targetSchool: "optional target school",
            weakTopics: ["fractions"],
            practiceSource: "both",
            sessionMinutes: 30,
            sessionsPerWeek: 5,
            reminderPreference: "evening",
            parentReportPreference: "weekly",
          },
        },
        output: {
          child: {
            uid: "childUid",
            loginId: "loginId",
            displayName: "displayName",
            grade: "grade",
            avatarEmoji: "avatarEmoji",
            learningPreferences: "stored learning preferences",
            linkedParentUid: "parentUid",
          },
        },
      },
    },
    { status: 501 }
  );
}
