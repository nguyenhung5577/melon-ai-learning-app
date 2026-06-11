"use client";

import {
  MOCK_LESSONS,
  isCurrentMathLesson,
  type Lesson,
  type Subject,
} from "@/lib/lessons/lesson-store";

const STORAGE_KEY = "melon.generated.math.lessons.v2";

export interface GeneratedExerciseQuestion {
  question: string;
  choices?: Record<string, string>;
  answer?: string;
  explanation?: string;
}

function safeJsonParse(raw: string | null): Lesson[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lesson[]) : [];
  } catch {
    return [];
  }
}

export function getGeneratedLessons(): Lesson[] {
  if (typeof window === "undefined") return [];
  return safeJsonParse(window.localStorage.getItem(STORAGE_KEY)).filter(isCurrentMathLesson);
}

export function saveGeneratedLesson(lesson: Lesson): void {
  if (typeof window === "undefined") return;
  const existing = getGeneratedLessons().filter((item) => item.id !== lesson.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([lesson, ...existing]));
}

export function getAllGeneratedAndMockLessons(): Lesson[] {
  return [...getGeneratedLessons(), ...MOCK_LESSONS];
}

export function buildLessonFromExercises(params: {
  topic: string;
  subject: Subject;
  questions: GeneratedExerciseQuestion[];
  sourceFileId?: string;
}): Lesson {
  const { topic, subject, questions, sourceFileId } = params;
  const lessonId = `gen-${Date.now()}`;

  const introSlide: Lesson["slides"][number] = {
    id: `${lessonId}-intro`,
    type: "text",
    title: `Let's learn: ${topic}`,
    content: `This lesson was generated from your uploaded material${sourceFileId ? ` (file_id: ${sourceFileId})` : ""}.`,
    xp: 15,
  };

  const quizSlides: Lesson["slides"] = questions.map((item, idx) => {
    const options = item.choices ? Object.values(item.choices) : [];
    const answer = item.choices && item.answer ? item.choices[item.answer] ?? item.answer : item.answer ?? "";
    return {
      id: `${lessonId}-q${idx + 1}`,
      type: "quiz",
      title: `Question ${idx + 1}`,
      content: item.question,
      options,
      answer,
      xp: 35,
    };
  });

  const slides = [introSlide, ...quizSlides];
  const xpReward = slides.reduce((sum, slide) => sum + slide.xp, 0);

  return {
    id: lessonId,
    title: topic,
    subject,
    type: "quiz",
    emoji: "🧠",
    description: "AI-generated lesson from your uploaded PDF.",
    duration: Math.max(8, Math.round(slides.length * 2.5)),
    xpReward,
    difficulty: 2,
    tags: subject === "math"
      ? ["math_curriculum_v2", "grade_4", "grade_5", "ai", "rag", "generated"]
      : ["ai", "rag", "generated"],
    slides,
    aiEnabled: true,
    audioEnabled: true,
    thumbnailBg: "#7c3aed",
    createdAt: new Date().toISOString(),
  };
}
