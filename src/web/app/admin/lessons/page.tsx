"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Edit,
  Eye,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminGuard } from "@/components/shared/AdminGuard";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { SectionHeader } from "@/components/shared/SectionHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthContext } from "@/lib/auth/auth-context";
import { collections } from "@/lib/db/firestore";
import { queryDocuments, setDocument } from "@/lib/db/firestore-helpers";
import {
  getAllLessons,
  type Lesson,
  type LessonSlide,
  type LessonType,
} from "@/lib/lessons/lesson-store";
import type { QuestionBankQuestion } from "@/lib/problems/types";
import { cn } from "@/lib/utils";

type DialogMode = "view" | "edit" | "create";
type EditableSlideType = Extract<LessonSlide["type"], "text" | "quiz">;

type SlideDraft = {
  id: string;
  type: EditableSlideType;
  title: string;
  content: string;
  questionId: string;
  xp: number;
};

type LessonDraft = {
  id: string;
  title: string;
  type: LessonType;
  emoji: string;
  description: string;
  duration: number;
  xpReward: number;
  difficulty: 1 | 2 | 3;
  tagsText: string;
  aiEnabled: boolean;
  thumbnailBg: string;
  slides: SlideDraft[];
};

const lessonTypeOptions: LessonType[] = ["interactive", "quiz", "reading", "video"];
const slideTypeOptions: EditableSlideType[] = ["text", "quiz"];
const CURRICULUM_TAG = "math_curriculum_v2";

function emptySlideDraft(index: number, lessonId = "lesson"): SlideDraft {
  return {
    id: `${lessonId || "lesson"}-s${index}`,
    type: "text",
    title: `Slide ${index}`,
    content: "",
    questionId: "",
    xp: 15,
  };
}

function emptyQuestionSlideDraft(index: number, lessonId = "lesson"): SlideDraft {
  return {
    id: `${lessonId || "lesson"}-q${index}`,
    type: "quiz",
    title: `Câu hỏi ${index}`,
    content: "",
    questionId: "",
    xp: 35,
  };
}

function emptyLessonDraft(): LessonDraft {
  return {
    id: "",
    title: "",
    type: "interactive",
    emoji: "📘",
    description: "",
    duration: 12,
    xpReward: 100,
    difficulty: 1,
    tagsText: `${CURRICULUM_TAG}, grade_4`,
    aiEnabled: true,
    thumbnailBg: "#ff914d",
    slides: [emptySlideDraft(1)],
  };
}

function answerToText(answer: LessonSlide["answer"]) {
  if (Array.isArray(answer)) return answer.join("\n");
  return String(answer ?? "");
}

function draftFromLesson(lesson: Lesson): LessonDraft {
  return {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type,
    emoji: lesson.emoji,
    description: lesson.description,
    duration: lesson.duration,
    xpReward: lesson.xpReward,
    difficulty: lesson.difficulty,
    tagsText: lesson.tags.join(", "),
    aiEnabled: lesson.aiEnabled,
    thumbnailBg: lesson.thumbnailBg,
    slides: lesson.slides.map((slide, index) => ({
      id: slide.id || `${lesson.id}-s${index + 1}`,
      type: slide.type === "quiz" ? "quiz" : "text",
      title: slide.title,
      content: slide.content,
      questionId: slide.questionId ?? "",
      xp: slide.xp,
    })),
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function splitList(value: string) {
  return value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnswer(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(?<=\d)\s(?=\d{3}\b)/g, "")
    .replace(/[.,;:]$/g, "");
}

function questionStem(question: QuestionBankQuestion | null | undefined) {
  return String(question?.stemMarkdown || question?.stem || question?.rawText || "").trim();
}

function questionChoices(question: QuestionBankQuestion | null | undefined) {
  return (question?.choices ?? [])
    .map((choice) => String(choice.text ?? "").trim())
    .filter(Boolean);
}

function questionAnswer(question: QuestionBankQuestion | null | undefined) {
  if (!question) return "";
  if (question.answerText?.trim()) return question.answerText.trim();

  const expected = normalizeAnswer(question.answer);
  const matchingChoice = (question.choices ?? []).find((choice) => (
    normalizeAnswer(choice.key) === expected || normalizeAnswer(choice.text) === expected
  ));

  return matchingChoice?.text?.trim() || question.answer?.trim() || "";
}

function isSelectableQuestion(question: QuestionBankQuestion) {
  return question.type === "multiple_choice" && questionChoices(question).length >= 2;
}

function questionLabel(question: QuestionBankQuestion) {
  const source = question.sourceTitle || question.questionSetId || "Kho đề";
  const stem = questionStem(question).replace(/\s+/g, " ");
  const shortStem = stem.length > 92 ? `${stem.slice(0, 92)}...` : stem;
  return `Lớp ${question.grade} - ${source} - Câu ${question.questionNumber}: ${shortStem}`;
}

function normalizeTags(draft: LessonDraft) {
  const tags = new Set(splitList(draft.tagsText));
  tags.add(CURRICULUM_TAG);
  if (![...tags].some((tag) => tag === "grade_4" || tag === "grade_5")) {
    tags.add("grade_4");
  }
  return [...tags];
}

function draftToLesson(
  draft: LessonDraft,
  questionById: Map<string, QuestionBankQuestion>,
  existing?: Lesson
): Lesson {
  const now = new Date().toISOString();
  const id = slugify(draft.id || draft.title) || `lesson-${Date.now()}`;
  const slides = draft.slides.map((slide, index): LessonSlide => {
    const rawSlideId = slide.id.trim();
    const slideId = !rawSlideId || rawSlideId.startsWith("lesson-s") ? `${id}-s${index + 1}` : rawSlideId;
    const xp = Math.max(0, Number(slide.xp) || 0);

    if (slide.type === "quiz") {
      const question = questionById.get(slide.questionId);
      const stem = questionStem(question);
      const choices = questionChoices(question);
      const answer = questionAnswer(question);

      return {
        id: slideId,
        type: "quiz",
        title: slide.title.trim() || (question ? `Câu ${question.questionNumber}` : `Quiz ${index + 1}`),
        content: stem || slide.content.trim(),
        questionId: question?.id ?? slide.questionId,
        options: choices,
        answer,
        xp,
      };
    }

    return {
      id: slideId,
      type: "text",
      title: slide.title.trim() || `Slide ${index + 1}`,
      content: slide.content.trim(),
      xp,
    };
  });

  return {
    id,
    title: draft.title.trim(),
    subject: "math",
    type: draft.type,
    emoji: draft.emoji.trim() || "📘",
    description: draft.description.trim(),
    duration: Math.max(1, Number(draft.duration) || 1),
    xpReward: Math.max(0, Number(draft.xpReward) || 0),
    difficulty: Number(draft.difficulty) as 1 | 2 | 3,
    tags: normalizeTags(draft),
    slides,
    aiEnabled: draft.aiEnabled,
    audioEnabled: existing?.audioEnabled ?? true,
    thumbnailBg: draft.thumbnailBg.trim() || "#ff914d",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    archived: false,
  };
}

function validateDraft(draft: LessonDraft, questionById: Map<string, QuestionBankQuestion>) {
  if (!draft.title.trim()) return "Vui lòng nhập tên bài học.";
  if (draft.slides.length === 0) return "Mỗi bài học cần ít nhất một slide.";

  const invalidTextSlide = draft.slides.find((slide) => (
    slide.type === "text" && !slide.content.trim()
  ));
  if (invalidTextSlide) return "Slide nội dung cần có phần mô tả.";

  const invalidQuizSlide = draft.slides.find((slide) => (
    slide.type === "quiz" && (!slide.questionId || !questionById.has(slide.questionId))
  ));
  if (invalidQuizSlide) return "Slide quiz cần chọn câu hỏi từ kho đề.";

  return null;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.65rem] font-black uppercase text-[#666]">{children}</span>;
}

function QuestionPreview({ question }: { question: QuestionBankQuestion }) {
  return (
    <div className="mt-3 rounded-xl bg-white p-4 [border:var(--nb-border)]">
      <div className="flex flex-wrap items-center gap-2">
        <NbPill color="yellow">Lớp {question.grade}</NbPill>
        <NbPill color="purple">{question.rubricLevel}</NbPill>
        <span className="text-xs font-bold text-[#777]">{question.sourceTitle}</span>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-relaxed text-[#444]">
        {questionStem(question)}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {questionChoices(question).map((option, index) => (
          <div key={`${question.id}-${index}-${option}`} className="rounded-lg border-2 border-nb-black px-3 py-2 text-sm font-bold">
            {option}
          </div>
        ))}
      </div>
      <div className="mt-3 text-sm font-bold text-nb-green">
        Đáp án: {questionAnswer(question)}
      </div>
    </div>
  );
}

function LessonOverview({ lesson }: { lesson: Lesson }) {
  const quizCount = lesson.slides.filter((slide) => slide.type === "quiz").length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="grid h-14 w-14 place-items-center rounded-xl text-3xl [border:var(--nb-border)]"
            style={{ backgroundColor: lesson.thumbnailBg }}
          >
            {lesson.emoji}
          </div>
          <div>
            <h3 className="font-display text-[1rem] leading-snug">{lesson.title}</h3>
            <p className="mt-1 text-xs font-bold text-[#777]">{lesson.id}</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-[#555]">{lesson.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {lesson.tags.map((tag) => (
            <NbPill key={tag} color="gray">{tag}</NbPill>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-[#fff9ed] p-4 [border:var(--nb-border)]">
        <div className="grid grid-cols-2 gap-3 text-sm font-bold">
          <div>
            <div className="text-xs uppercase text-[#777]">Loại</div>
            <div>{lesson.type}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-[#777]">Thời lượng</div>
            <div>{lesson.duration} phút</div>
          </div>
          <div>
            <div className="text-xs uppercase text-[#777]">XP</div>
            <div>+{lesson.xpReward}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-[#777]">Độ khó</div>
            <div>{lesson.difficulty}/3</div>
          </div>
          <div>
            <div className="text-xs uppercase text-[#777]">Slides</div>
            <div>{lesson.slides.length}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-[#777]">Câu hỏi</div>
            <div>{quizCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SlidePreview({
  slide,
  index,
  question,
}: {
  slide: LessonSlide;
  index: number;
  question?: QuestionBankQuestion;
}) {
  const options = question ? questionChoices(question) : (slide.options ?? []);
  const answer = question ? questionAnswer(question) : answerToText(slide.answer);

  return (
    <div className="rounded-xl bg-white p-4 [border:var(--nb-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-[0.72rem]">Slide {index + 1}: {slide.title}</div>
        <div className="flex flex-wrap gap-2">
          {slide.questionId ? <NbPill color="yellow">Kho đề</NbPill> : null}
          <NbPill color="blue">{slide.type}</NbPill>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-relaxed text-[#555]">
        {question ? questionStem(question) : slide.content}
      </p>
      {options.length ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {options.map((option, optionIndex) => (
            <div key={`${slide.id}-${optionIndex}-${option}`} className="rounded-lg border-2 border-nb-black px-3 py-2 text-sm font-bold">
              {option}
            </div>
          ))}
        </div>
      ) : null}
      {answer ? (
        <div className="mt-3 text-sm font-bold text-nb-green">
          Đáp án: {answer}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminLessonsPage() {
  const { user, logout } = useAuthContext();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questionBank, setQuestionBank] = useState<QuestionBankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [draft, setDraft] = useState<LessonDraft | null>(null);

  const questionOptions = useMemo(() => {
    return questionBank
      .filter(isSelectableQuestion)
      .sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        const sourceCompare = (a.sourceTitle || "").localeCompare(b.sourceTitle || "", "vi");
        if (sourceCompare !== 0) return sourceCompare;
        return a.questionNumber - b.questionNumber;
      });
  }, [questionBank]);

  const questionById = useMemo(() => {
    return new Map(questionBank.map((question) => [question.id, question]));
  }, [questionBank]);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextLessons, nextQuestions] = await Promise.all([
        getAllLessons(),
        queryDocuments(collections.questionBank),
      ]);
      setLessons(nextLessons);
      setQuestionBank(nextQuestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu bài học.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLessons();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadLessons]);

  const dialogOpen = dialogMode !== null;
  const activeTitle = useMemo(() => {
    if (dialogMode === "create") return "Thêm bài học";
    if (dialogMode === "edit") return "Chỉnh sửa bài học";
    return "Chi tiết bài học";
  }, [dialogMode]);

  function closeDialog() {
    if (saving) return;
    setDialogMode(null);
    setSelectedLesson(null);
    setDraft(null);
    setError(null);
  }

  function openCreate() {
    setSelectedLesson(null);
    setDraft(emptyLessonDraft());
    setDialogMode("create");
  }

  function openView(lesson: Lesson) {
    setSelectedLesson(lesson);
    setDraft(null);
    setDialogMode("view");
  }

  function openEdit(lesson: Lesson) {
    setSelectedLesson(lesson);
    setDraft(draftFromLesson(lesson));
    setDialogMode("edit");
  }

  function updateDraft(patch: Partial<LessonDraft>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function updateSlide(index: number, patch: Partial<SlideDraft>) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        slides: current.slides.map((slide, slideIndex) => (
          slideIndex === index ? { ...slide, ...patch } : slide
        )),
      };
    });
  }

  function addSlide() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        slides: [...current.slides, emptySlideDraft(current.slides.length + 1, current.id || slugify(current.title))],
      };
    });
  }

  function addQuestionSlide() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        slides: [
          ...current.slides,
          emptyQuestionSlideDraft(current.slides.length + 1, current.id || slugify(current.title)),
        ],
      };
    });
  }

  function removeSlide(index: number) {
    setDraft((current) => {
      if (!current || current.slides.length <= 1) return current;
      return {
        ...current,
        slides: current.slides.filter((_, slideIndex) => slideIndex !== index),
      };
    });
  }

  function applyQuestionToSlide(index: number, questionId: string) {
    const question = questionById.get(questionId);
    updateSlide(index, {
      questionId,
      title: question ? `Câu ${question.questionNumber}` : "",
      content: question ? questionStem(question) : "",
    });
  }

  async function saveLesson() {
    if (!draft) return;
    const validationError = validateDraft(draft, questionById);
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextLesson = draftToLesson(draft, questionById, selectedLesson ?? undefined);

    setSaving(true);
    setError(null);
    try {
      await setDocument(collections.lessons, nextLesson.id, nextLesson, true);
      await loadLessons();
      setSelectedLesson(nextLesson);
      setDialogMode("view");
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được bài học.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveLesson(lesson: Lesson) {
    if (!window.confirm(`Xóa bài học "${lesson.title}" khỏi danh sách?`)) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await setDocument(collections.lessons, lesson.id, {
        ...lesson,
        archived: true,
        deletedAt: now,
        updatedAt: now,
      }, true);
      await loadLessons();
      if (selectedLesson?.id === lesson.id) {
        setDialogMode(null);
        setSelectedLesson(null);
        setDraft(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được bài học.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName ?? "Quản trị viên"} onLogout={logout}>
        <SectionHeader
          title="Bài học"
          subtitle="Quản lý nội dung bài học và câu hỏi từ kho đề"
          badge={<NbPill color="green">{lessons.length} bài</NbPill>}
          action={
            <NbButton
              type="button"
              variant="primary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              Thêm bài học
            </NbButton>
          }
        />

        {error ? (
          <div className="mt-4 rounded-xl bg-[#fff0c8] p-3 text-sm font-bold text-nb-red [border:var(--nb-border)]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-2xl bg-white [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="[border-bottom:var(--nb-border)] bg-nb-bg">
                <th className="px-5 py-3 text-left font-display text-[0.7rem] uppercase">Bài học</th>
                <th className="hidden px-5 py-3 text-left font-display text-[0.7rem] uppercase md:table-cell">Loại</th>
                <th className="hidden px-5 py-3 text-left font-display text-[0.7rem] uppercase lg:table-cell">XP</th>
                <th className="hidden px-5 py-3 text-left font-display text-[0.7rem] uppercase lg:table-cell">Câu hỏi</th>
                <th className="px-5 py-3 text-left font-display text-[0.7rem] uppercase">AI</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-display text-sm text-[#666]">
                    Đang tải bài học...
                  </td>
                </tr>
              ) : lessons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <BookOpen className="mx-auto h-8 w-8 text-[#888]" />
                    <p className="mt-3 font-display text-sm text-[#666]">Chưa có bài học.</p>
                  </td>
                </tr>
              ) : lessons.map((lesson, index) => (
                <tr
                  key={lesson.id}
                  className={cn(
                    "transition-colors hover:bg-nb-bg",
                    index < lessons.length - 1 && "[border-bottom:2px_solid_#eee]"
                  )}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{lesson.emoji}</span>
                      <div>
                        <div className="font-bold text-nb-black">{lesson.title}</div>
                        <div className="text-xs text-[#888]">{lesson.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 font-semibold capitalize text-[#666] md:table-cell">
                    {lesson.type}
                  </td>
                  <td className="hidden px-5 py-4 lg:table-cell">
                    <span className="font-bold text-nb-orange">+{lesson.xpReward}</span>
                  </td>
                  <td className="hidden px-5 py-4 font-bold text-[#666] lg:table-cell">
                    {lesson.slides.filter((slide) => slide.type === "quiz").length}
                  </td>
                  <td className="px-5 py-4">
                    {lesson.aiEnabled ? <NbPill color="purple">AI</NbPill> : <span className="text-xs font-bold text-[#888]">Tắt</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded p-1.5 hover:bg-nb-bg"
                        aria-label="Xem bài học"
                        onClick={() => openView(lesson)}
                      >
                        <Eye className="h-4 w-4 text-[#777]" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 hover:bg-nb-bg"
                        aria-label="Sửa bài học"
                        onClick={() => openEdit(lesson)}
                      >
                        <Edit className="h-4 w-4 text-[#777]" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 hover:bg-nb-pink/20"
                        aria-label="Xóa bài học"
                        onClick={() => void archiveLesson(lesson)}
                      >
                        <Trash2 className="h-4 w-4 text-nb-red/80" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto rounded-2xl bg-white p-0 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
            <div className="sticky top-0 z-10 bg-white px-6 py-5 [border-bottom:var(--nb-border)]">
              <DialogHeader>
                <DialogTitle className="font-display text-lg">{activeTitle}</DialogTitle>
                <DialogDescription className="font-semibold text-[#666]">
                  {dialogMode === "view" ? "Xem cấu trúc bài học và câu hỏi đã gắn." : "Cập nhật nội dung bài học và chọn câu hỏi từ kho đề."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 py-5">
              {dialogMode === "view" && selectedLesson ? (
                <div className="flex flex-col gap-5">
                  <LessonOverview lesson={selectedLesson} />
                  <div className="flex flex-col gap-3">
                    <div className="font-display text-[0.85rem]">Nội dung slide</div>
                    {selectedLesson.slides.map((slide, index) => (
                      <SlidePreview
                        key={slide.id}
                        slide={slide}
                        index={index}
                        question={slide.questionId ? questionById.get(slide.questionId) : undefined}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {(dialogMode === "edit" || dialogMode === "create") && draft ? (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_1fr_1fr]">
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>Emoji</FieldLabel>
                      <input
                        className="nb-input text-center text-xl"
                        value={draft.emoji}
                        onChange={(event) => updateDraft({ emoji: event.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>Tên bài học</FieldLabel>
                      <input
                        className="nb-input"
                        value={draft.title}
                        onChange={(event) => updateDraft({ title: event.target.value })}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>ID</FieldLabel>
                      <input
                        className="nb-input"
                        value={draft.id}
                        disabled={dialogMode === "edit"}
                        onChange={(event) => updateDraft({ id: event.target.value })}
                        placeholder="Tự tạo từ tên nếu bỏ trống"
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <FieldLabel>Mô tả</FieldLabel>
                    <textarea
                      className="nb-input min-h-24"
                      value={draft.description}
                      onChange={(event) => updateDraft({ description: event.target.value })}
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>Loại</FieldLabel>
                      <select
                        className="nb-input"
                        value={draft.type}
                        onChange={(event) => updateDraft({ type: event.target.value as LessonType })}
                      >
                        {lessonTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>Thời lượng</FieldLabel>
                      <input
                        className="nb-input"
                        type="number"
                        min={1}
                        value={draft.duration}
                        onChange={(event) => updateDraft({ duration: Number(event.target.value) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>XP</FieldLabel>
                      <input
                        className="nb-input"
                        type="number"
                        min={0}
                        value={draft.xpReward}
                        onChange={(event) => updateDraft({ xpReward: Number(event.target.value) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>Độ khó</FieldLabel>
                      <select
                        className="nb-input"
                        value={draft.difficulty}
                        onChange={(event) => updateDraft({ difficulty: Number(event.target.value) as 1 | 2 | 3 })}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr_180px]">
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>Màu nền</FieldLabel>
                      <div className="grid grid-cols-[52px_1fr] gap-2">
                        <input
                          className="h-11 w-full cursor-pointer rounded-lg border-2 border-nb-black bg-white p-1"
                          type="color"
                          value={draft.thumbnailBg}
                          onChange={(event) => updateDraft({ thumbnailBg: event.target.value })}
                        />
                        <input
                          className="nb-input"
                          value={draft.thumbnailBg}
                          onChange={(event) => updateDraft({ thumbnailBg: event.target.value })}
                        />
                      </div>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <FieldLabel>Tags</FieldLabel>
                      <input
                        className="nb-input"
                        value={draft.tagsText}
                        onChange={(event) => updateDraft({ tagsText: event.target.value })}
                        placeholder="grade_4, fractions"
                      />
                    </label>
                    <label className="flex items-center gap-2 self-end rounded-xl bg-[#fff9ed] p-3 [border:var(--nb-border)]">
                      <input
                        type="checkbox"
                        checked={draft.aiEnabled}
                        onChange={(event) => updateDraft({ aiEnabled: event.target.checked })}
                      />
                      <span className="font-bold">AI</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-display text-[0.85rem]">Nội dung & câu hỏi</div>
                      <p className="mt-1 text-xs font-bold text-[#777]">
                        Kho đề có {questionOptions.length} câu trắc nghiệm có thể gắn vào bài học.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <NbButton type="button" variant="ghost" size="sm" onClick={addSlide} icon={<Plus className="h-4 w-4" />}>
                        Thêm nội dung
                      </NbButton>
                      <NbButton type="button" variant="secondary" size="sm" onClick={addQuestionSlide} icon={<Plus className="h-4 w-4" />}>
                        Thêm câu hỏi
                      </NbButton>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {draft.slides.map((slide, index) => {
                      const selectedQuestion = slide.questionId ? questionById.get(slide.questionId) : undefined;

                      return (
                        <div key={`${slide.id}-${index}`} className="rounded-xl bg-[#fff9ed] p-4 [border:var(--nb-border)]">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="font-display text-[0.72rem]">Slide {index + 1}</div>
                            <button
                              type="button"
                              className="rounded p-1.5 hover:bg-nb-pink/20 disabled:opacity-40"
                              disabled={draft.slides.length <= 1}
                              onClick={() => removeSlide(index)}
                              aria-label="Xóa slide"
                            >
                              <Trash2 className="h-4 w-4 text-nb-red/80" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_120px]">
                            <label className="flex flex-col gap-1.5">
                              <FieldLabel>Tiêu đề slide</FieldLabel>
                              <input
                                className="nb-input"
                                value={slide.title}
                                onChange={(event) => updateSlide(index, { title: event.target.value })}
                              />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <FieldLabel>Kiểu</FieldLabel>
                              <select
                                className="nb-input"
                                value={slide.type}
                                onChange={(event) => {
                                  const nextType = event.target.value as EditableSlideType;
                                  updateSlide(index, {
                                    type: nextType,
                                    questionId: nextType === "quiz" ? slide.questionId : "",
                                  });
                                }}
                              >
                                {slideTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <FieldLabel>XP slide</FieldLabel>
                              <input
                                className="nb-input"
                                type="number"
                                min={0}
                                value={slide.xp}
                                onChange={(event) => updateSlide(index, { xp: Number(event.target.value) })}
                              />
                            </label>
                          </div>

                          {slide.type === "text" ? (
                            <label className="mt-3 flex flex-col gap-1.5">
                              <FieldLabel>Nội dung</FieldLabel>
                              <textarea
                                className="nb-input min-h-28"
                                value={slide.content}
                                onChange={(event) => updateSlide(index, { content: event.target.value })}
                              />
                            </label>
                          ) : (
                            <div className="mt-3">
                              <label className="flex flex-col gap-1.5">
                                <FieldLabel>Câu hỏi từ kho đề</FieldLabel>
                                <select
                                  className="nb-input"
                                  value={slide.questionId}
                                  onChange={(event) => applyQuestionToSlide(index, event.target.value)}
                                >
                                  <option value="">Chọn câu hỏi</option>
                                  {questionOptions.map((question) => (
                                    <option key={question.id} value={question.id}>
                                      {questionLabel(question)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              {selectedQuestion ? (
                                <QuestionPreview question={selectedQuestion} />
                              ) : (
                                <div className="mt-3 rounded-xl bg-white p-4 text-sm font-bold text-[#777] [border:var(--nb-border)]">
                                  {questionOptions.length > 0 ? "Chưa chọn câu hỏi." : "Kho đề chưa có câu trắc nghiệm phù hợp."}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 bg-white px-6 py-4 [border-top:var(--nb-border)]">
              <NbButton type="button" variant="ghost" size="sm" onClick={closeDialog} icon={<X className="h-4 w-4" />}>
                Đóng
              </NbButton>
              {dialogMode === "view" && selectedLesson ? (
                <>
                  <NbButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(`/lessons/${selectedLesson.id}`, "_blank")}
                    icon={<Eye className="h-4 w-4" />}
                  >
                    Mở bản học sinh
                  </NbButton>
                  <NbButton type="button" variant="primary" size="sm" onClick={() => openEdit(selectedLesson)} icon={<Edit className="h-4 w-4" />}>
                    Chỉnh sửa
                  </NbButton>
                </>
              ) : null}
              {(dialogMode === "edit" || dialogMode === "create") ? (
                <NbButton type="button" variant="primary" size="sm" loading={saving} onClick={() => void saveLesson()} icon={<Save className="h-4 w-4" />}>
                  Lưu bài học
                </NbButton>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </AdminShell>
    </AdminGuard>
  );
}
