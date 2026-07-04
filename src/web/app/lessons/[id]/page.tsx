"use client";

import { useState, useCallback, use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, Volume2, Check, X, ChevronRight } from "lucide-react";
import { getLessonById, type Lesson, type LessonSlide } from "@/lib/lessons/lesson-store";
import { KidShell } from "@/components/layout/KidShell";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { auth } from "@/lib/auth/firebase";
import { useAuthContext } from "@/lib/auth/auth-context";
import { collections } from "@/lib/db/firestore";
import { getDocument } from "@/lib/db/firestore-helpers";
import { gamificationStore } from "@/lib/gamification/gamification-store";
import { logActivityEvent } from "@/lib/activity";
import { bus } from "@/lib/core/event-bus";
import type { QuestionBankQuestion } from "@/lib/problems/types";
import { cn } from "@/lib/utils";

type AnswerState = "idle" | "correct" | "wrong";

const conceptTags = new Set([
  "arithmetic",
  "fractions",
  "geometry",
  "word_problems",
  "logic",
  "mixed_exams",
  "decimals",
]);

const skillTags = new Set([
  "nhan_biet",
  "thong_hieu",
  "van_dung",
  "van_dung_cao",
]);

function tagsFromLesson(lesson: Lesson | null | undefined, allowed: Set<string>) {
  return (lesson?.tags ?? []).filter((tag) => allowed.has(tag));
}

function normalizeAnswer(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(?<=\d)\s(?=\d{3}\b)/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/^(-?\d+)\s+(-?\d+)$/g, "$1/$2")
    .replace(/[.,;:]$/g, "");
}

function choiceDisplayKey(choice: QuestionBankQuestion["choices"][number] | undefined, index: number) {
  return choice?.key || ["A", "B", "C", "D"][index] || String(index + 1);
}

function expectedChoiceKey(question: QuestionBankQuestion | null | undefined) {
  const expectedAnswer = normalizeAnswer(question?.answer);
  if (!question || !expectedAnswer) return "";

  const choice = (question.choices ?? []).find((item, index) => (
    normalizeAnswer(choiceDisplayKey(item, index)) === expectedAnswer
  ));
  if (!choice) return "";

  const index = question.choices.indexOf(choice);
  return normalizeAnswer(choiceDisplayKey(choice, index));
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
  const expectedKey = expectedChoiceKey(question);
  if (expectedKey) {
    const keyChoice = (question.choices ?? []).find((choice, index) => (
      normalizeAnswer(choiceDisplayKey(choice, index)) === expectedKey
    ));
    if (keyChoice?.text?.trim()) return keyChoice.text.trim();
  }

  if (question.answerTextMarkdown?.trim()) return question.answerTextMarkdown.trim();
  if (question.answerText?.trim()) return question.answerText.trim();

  const expected = normalizeAnswer(question.answer);
  const matchingChoice = (question.choices ?? []).find((choice, index) => (
    normalizeAnswer(choiceDisplayKey(choice, index)) === expected || normalizeAnswer(choice.text) === expected
  ));

  return matchingChoice?.text?.trim() || question.answer?.trim() || "";
}

function slideAnswer(slide: LessonSlide) {
  if (Array.isArray(slide.answer)) return slide.answer[0] ?? "";
  return String(slide.answer ?? "");
}

function optionIsCorrect(
  option: string,
  index: number,
  slide: LessonSlide,
  question: QuestionBankQuestion | null | undefined
) {
  const submitted = normalizeAnswer(option);
  if (!submitted) return false;

  if (question) {
    const expectedAnswer = normalizeAnswer(question.answer);
    const expectedText = normalizeAnswer(question.answerText);
    const expectedMarkdown = normalizeAnswer(question.answerTextMarkdown);
    const choice = question.choices?.[index];
    const choiceKey = normalizeAnswer(choiceDisplayKey(choice, index));
    const expectedKey = expectedChoiceKey(question);

    if (expectedAnswer && (submitted === expectedAnswer || choiceKey === expectedAnswer)) return true;
    if (expectedKey) return choiceKey === expectedKey;
    if (expectedText && submitted === expectedText) return true;
    if (expectedMarkdown && submitted === expectedMarkdown) return true;
    if (choice?.text && expectedText && normalizeAnswer(choice.text) === expectedText) return submitted === normalizeAnswer(choice.text);
    if (choice?.text && expectedMarkdown && normalizeAnswer(choice.text) === expectedMarkdown) return submitted === normalizeAnswer(choice.text);
  }

  return submitted === normalizeAnswer(slideAnswer(slide));
}

interface SlideRendererProps {
  slide: LessonSlide;
  question?: QuestionBankQuestion | null;
  onComplete: (xp: number) => void;
  onQuizAnswer?: (correct: boolean) => void;
}

function TextSlide({ slide, onComplete }: SlideRendererProps) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-h2">{slide.title}</h2>
      <div
        className="text-base font-medium leading-relaxed text-nb-black [&_strong]:font-black [&_code]:bg-nb-yellow [&_code]:px-1 [&_code]:border [&_code]:border-nb-black [&_code]:font-mono"
        dangerouslySetInnerHTML={{
          __html: slide.content
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/`(.+?)`/g, "<code>$1</code>"),
        }}
      />
      <NbButton
        variant="primary"
        size="lg"
        onClick={() => onComplete(slide.xp)}
        className="self-start"
        icon={<ChevronRight className="w-4 h-4" />}
        iconPosition="right"
      >
        Đã hiểu
      </NbButton>
    </div>
  );
}

function QuizSlide({ slide, question, onComplete, onQuizAnswer }: SlideRendererProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [state, setState] = useState<AnswerState>("idle");
  const [recordedAnswer, setRecordedAnswer] = useState(false);

  const stem = questionStem(question) || slide.content;
  const options = question ? questionChoices(question) : (slide.options ?? []);

  function handleSelect(opt: string, index: number) {
    if (state !== "idle") return;
    setSelectedIndex(index);
    const isCorrect = optionIsCorrect(opt, index, slide, question);
    if (!recordedAnswer) {
      onQuizAnswer?.(isCorrect);
      setRecordedAnswer(true);
    }
    setState(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setTimeout(() => onComplete(slide.xp), 900);
    } else {
      setTimeout(() => {
        setState("idle");
        setSelectedIndex(null);
      }, 1500);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-[0.7rem] text-[#888] mb-2 tracking-widest uppercase">
          Câu hỏi
        </div>
        <h2 className="font-display text-h2 leading-snug">{stem}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map((opt, i) => {
          const letter = ["A", "B", "C", "D"][i];
          const isSelected = selectedIndex === i;
          const isCorrect = isSelected && state === "correct";
          const isWrong = isSelected && state === "wrong";

          return (
            <button
              key={`${slide.id}-${i}-${opt}`}
              onClick={() => handleSelect(opt, i)}
              disabled={state !== "idle"}
              className={cn(
                "flex items-center gap-4 [border:var(--nb-border)] rounded-[18px] p-5",
                "cursor-pointer transition-all duration-150 select-none text-left",
                "[box-shadow:6px_6px_0_var(--nb-black)]",
                "hover:not(:disabled):-translate-x-0.5 hover:not(:disabled):-translate-y-0.5",
                "hover:not(:disabled):[box-shadow:9px_9px_0_var(--nb-black)]",
                "active:not(:disabled):translate-x-0.5 active:not(:disabled):translate-y-0.5",
                isCorrect && "bg-nb-green [border-color:var(--nb-green)] [box-shadow:6px_6px_0_var(--nb-green)]",
                isWrong && "bg-nb-red [border-color:#ff4d4d] [box-shadow:6px_6px_0_#ff4d4d]",
                !isSelected && "bg-white",
                "disabled:cursor-not-allowed disabled:opacity-65"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full [border:3px_solid_var(--nb-black)] flex items-center justify-center",
                  "font-display text-[0.85rem] flex-shrink-0",
                  isCorrect ? "bg-white text-nb-green" : "bg-nb-bg"
                )}
              >
                {isCorrect ? <Check className="w-4 h-4" /> : isWrong ? <X className="w-4 h-4 text-white" /> : letter}
              </div>
              <span className="font-body font-bold text-base leading-snug flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DragDropSlide({ slide, onComplete }: SlideRendererProps) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-h2">{slide.title}</h2>
      <div className="nb-card rounded-2xl p-6 bg-white">
        <p className="font-medium text-base leading-relaxed mb-6">{slide.content}</p>
        <div className="flex gap-4 flex-wrap">
          {(slide.answer as string[])?.map((item) => (
            <div
              key={item}
              className="nb-card rounded-xl px-4 py-2 font-bold text-sm bg-nb-yellow cursor-grab"
              draggable
            >
              {item}
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm font-semibold text-[#666]">
        Bài tương tác kéo-thả sẽ được hoàn thiện ở phiên bản sau.
      </p>
      <NbButton variant="primary" size="lg" onClick={() => onComplete(slide.xp)} className="self-start">
        Tiếp tục →
      </NbButton>
    </div>
  );
}

export default function LessonPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuthContext();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questionById, setQuestionById] = useState<Record<string, QuestionBankQuestion>>({});
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [hintText, setHintText] = useState("Bấm gợi ý khi cần");
  const [hintLoading, setHintLoading] = useState(false);
  const lessonStartedAtRef = useRef(0);
  const quizCorrectRef = useRef(0);
  const quizTotalRef = useRef(0);

  useEffect(() => {
    if (user?.role === "parent") {
      router.replace("/parent");
    }
    if (user?.role === "admin") {
      router.replace("/admin");
    }
  }, [router, user?.role]);

  useEffect(() => {
    let mounted = true;
    lessonStartedAtRef.current = Date.now();
    quizCorrectRef.current = 0;
    quizTotalRef.current = 0;

    getLessonById(id).then(async (storedLesson) => {
      if (!mounted) return;
      setCurrentSlideIdx(0);
      setTotalXp(0);
      setCompleted(false);
      setQuestionById({});
      setLesson(storedLesson ?? null);

      const questionIds = Array.from(new Set(
        (storedLesson?.slides ?? [])
          .map((item) => item.questionId)
          .filter((questionId): questionId is string => Boolean(questionId))
      ));

      if (questionIds.length === 0) return;

      const entries = await Promise.all(questionIds.map(async (questionId) => {
        try {
          const question = await getDocument(collections.questionBank, questionId);
          return question ? ([questionId, question] as const) : null;
        } catch {
          return null;
        }
      }));

      if (!mounted) return;
      const foundEntries = entries.filter((entry): entry is readonly [string, QuestionBankQuestion] => Boolean(entry));
      setQuestionById(Object.fromEntries(foundEntries));
    }).catch(() => {
      if (mounted) setLesson(null);
    });

    return () => {
      mounted = false;
    };
  }, [id]);

  const slide = lesson?.slides?.[currentSlideIdx];
  const slideQuestion = slide?.questionId ? questionById[slide.questionId] ?? null : null;

  const handleQuizAnswer = useCallback((correct: boolean) => {
    quizCorrectRef.current += correct ? 1 : 0;
    quizTotalRef.current += 1;
  }, []);

  const handleSlideComplete = useCallback(
    (xp: number) => {
      const newXp = totalXp + xp;
      setTotalXp(newXp);
      setHintShown(false);
      setHintText("Bấm gợi ý khi cần");

      if (currentSlideIdx < (lesson?.slides.length ?? 0) - 1) {
        setCurrentSlideIdx((i) => i + 1);
      } else {
        setCompleted(true);
        const score = Math.round((newXp / (lesson?.xpReward ?? 1)) * 100);
        const lessonStartedAt = lessonStartedAtRef.current || Date.now();
        const timeOnTaskSeconds = Math.max(
          1,
          Math.round((Date.now() - lessonStartedAt) / 1000)
        );
        const finalQuizCorrect = quizCorrectRef.current;
        const finalQuizTotal = quizTotalRef.current;
        bus.emit("lesson:completed", { lessonId: id, score });

        if (user) {
          gamificationStore.addXp(
            user.uid,
            newXp,
            `Hoàn thành: ${lesson?.title ?? id}`,
            id
          );
          logActivityEvent(user.uid, {
            type: "lesson_completed",
            lessonId: id,
            subject: lesson?.subject ?? "unknown",
            score,
            xpEarned: newXp,
          });
          auth?.currentUser?.getIdToken()
            .then((token) => {
              if (!token) return undefined;
              return fetch("/api/v1/progress/lesson-completion", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  childUid: user.uid,
                  lessonId: id,
                  lessonTitle: lesson?.title ?? id,
                  subject: lesson?.subject ?? "unknown",
                  scorePercent: score,
                  quizCorrect: finalQuizCorrect,
                  quizTotal: finalQuizTotal,
                  xpEarned: newXp,
                  timeOnTaskSeconds,
                  concepts: tagsFromLesson(lesson, conceptTags),
                  skills: tagsFromLesson(lesson, skillTags),
                }),
              });
            })
            .catch(() => {
              /* Progress tracking should not block lesson completion. */
            });
        }
      }
    },
    [currentSlideIdx, lesson, totalXp, id, user]
  );

  async function handleHint() {
    if (hintLoading || !slide) return;
    setHintShown(true);
    setHintLoading(true);
    setHintText("Đang mở gợi ý...");
    try {
      let token = await auth?.currentUser?.getIdToken();
      if (!token) {
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 100));
          token = await auth?.currentUser?.getIdToken();
          if (token) break;
        }
      }
      if (!token) {
        throw new Error("Lỗi tải thông tin đăng nhập. Vui lòng F5 lại trang!");
      }

      const res = await fetch("/api/v1/exercise/guide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          question: questionStem(slideQuestion) || slide.content,
          correctAnswer: slideQuestion ? questionAnswer(slideQuestion) : slideAnswer(slide),
          topic: lesson?.title ?? "Bài học",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không tạo được gợi ý");
      }
      const guidance = (data.guidance as string) || "Làm từng bước nhé.";
      setHintText(guidance);

      if (lesson?.audioEnabled && data.audioUrl) {
        const audio = new Audio(data.audioUrl as string);
        audio.play().catch(() => {
          /* Ignore autoplay restrictions in browsers */
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      setHintText(message || "Đọc lại đề, tìm dữ kiện, rồi làm từng bước.");
    } finally {
      setHintLoading(false);
    }
  }

  if (!lesson || !lesson.slides || lesson.slides.length === 0 || !slide) {
    return (
      <KidShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="text-6xl">🚧</div>
          <p className="font-display text-lg">Bài học này đang được chuẩn bị.</p>
          <p className="text-sm text-[#666] max-w-xs text-center">Chưa có nội dung cho bài này.</p>
          <NbButton variant="secondary" onClick={() => router.push("/lessons")}>
            Quay lại bài học
          </NbButton>
        </div>
      </KidShell>
    );
  }

  const progress = Math.round((currentSlideIdx / lesson.slides.length) * 100);

  if (completed) {
    const pct = Math.round((totalXp / lesson.xpReward) * 100);
    return (
      <div className="min-h-dvh bg-nb-bg flex items-center justify-center p-4">
        <div className="app-container">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-8 py-16 px-6 text-center"
          >
            <div className="text-7xl">🎉</div>
            <h1 className="font-display text-[clamp(1.75rem,4vw,3rem)] text-nb-orange">
              Hoàn thành bài học!
            </h1>
            <div className="nb-card rounded-2xl p-8 flex flex-col items-center gap-2">
              <div className="font-display text-6xl text-nb-orange leading-none">
                {totalXp}
              </div>
              <div className="font-bold text-sm uppercase text-[#666]">XP nhận được</div>
              <div className="mt-2 font-bold text-sm">Điểm: {pct}%</div>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <NbButton
                variant="primary"
                size="lg"
                onClick={() => {
                  setCompleted(false);
                  setCurrentSlideIdx(0);
                  setTotalXp(0);
                  quizCorrectRef.current = 0;
                  quizTotalRef.current = 0;
                  lessonStartedAtRef.current = Date.now();
                }}
              >
                Học lại
              </NbButton>
              <NbButton
                variant="secondary"
                size="lg"
                onClick={() => router.push("/lessons")}
              >
                Bài khác
              </NbButton>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-nb-bg flex flex-col">
      <div className="app-container flex flex-col flex-1">
        <div className="flex items-center gap-4 px-6 py-4 bg-white [border-bottom:var(--nb-border)] flex-wrap">
          <NbButton
            variant="danger"
            size="sm"
            onClick={() => router.push("/lessons")}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Thoát
          </NbButton>

          <div className="flex-1 flex flex-col gap-1.5 min-w-[160px]">
            <div className="flex justify-between items-center">
              <span className="font-display text-[0.75rem] text-nb-black">
                {lesson.title}
              </span>
              <span className="font-display text-[0.75rem] text-nb-orange">
                {currentSlideIdx + 1}/{lesson.slides.length}
              </span>
            </div>
            <div className="nb-progress-track h-[18px]">
              <motion.div
                className="nb-progress-fill h-full"
                style={{
                  background: "linear-gradient(90deg, var(--nb-green) 0%, var(--nb-blue) 100%)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <NbPill color="yellow" icon={<Zap className="w-3 h-3" />}>
            {totalXp} xp
          </NbPill>
        </div>

        <div className="flex-1 px-6 py-8 flex flex-col gap-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {slide.type === "text" && (
                <TextSlide slide={slide} onComplete={handleSlideComplete} />
              )}
              {slide.type === "quiz" && (
                <QuizSlide
                  slide={slide}
                  question={slideQuestion}
                  onComplete={handleSlideComplete}
                  onQuizAnswer={handleQuizAnswer}
                />
              )}
              {(slide.type === "drag-drop" || slide.type === "fill-blank") && (
                <DragDropSlide slide={slide} onComplete={handleSlideComplete} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {lesson.aiEnabled && (
          <div className="px-6 pb-8">
            <div className="flex items-end gap-4">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full [border:4px_solid_var(--nb-black)] [box-shadow:4px_4px_0_var(--nb-black)]",
                    "bg-gradient-to-br from-nb-purple to-nb-blue",
                    "flex items-center justify-center text-3xl ai-float cursor-pointer"
                  )}
                  onClick={handleHint}
                  role="button"
                  aria-label="Mở gợi ý"
                >
                  🍈
                </div>
                <span className="font-display text-[0.55rem] bg-nb-black text-nb-yellow px-1.5 py-0.5 rounded whitespace-nowrap">
                  Gợi ý
                </span>
              </div>

              <div
                className={cn(
                  "flex-1 [border:var(--nb-border)] rounded-[20px_20px_20px_4px]",
                  "[box-shadow:var(--nb-shadow)] p-4 flex flex-col gap-3 transition-all duration-200",
                  hintShown
                    ? "bg-gradient-to-br from-[#fff9ed] to-[#fff0c8] [border-color:var(--nb-yellow)] [box-shadow:8px_8px_0_var(--nb-orange)]"
                    : "bg-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full [border:2px_solid_var(--nb-black)]",
                      hintShown ? "bg-nb-orange" : "bg-nb-green"
                    )}
                  />
                  <span className="font-display text-[0.65rem] text-[#888] uppercase tracking-widest">
                    {hintShown ? "Gợi ý" : "Trợ giúp"}
                  </span>
                </div>

                <p className={cn("text-sm font-semibold leading-relaxed", hintShown && "typewriter-cursor")}>
                  {hintText}
                </p>

                <div className="flex gap-2 flex-wrap">
                  {!hintShown && (
                    <button
                      onClick={handleHint}
                      className={cn(
                        "nb-pill bg-nb-yellow cursor-pointer",
                        "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:5px_5px_0_var(--nb-black)]",
                        "transition-all duration-150"
                      )}
                    >
                      💡 Gợi ý
                    </button>
                  )}
                  {lesson.audioEnabled && (
                    <button
                      onClick={handleHint}
                      disabled={hintLoading}
                      className="nb-pill bg-nb-blue cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Play audio"
                    >
                      <Volume2 className="w-3 h-3" />
                      {hintLoading ? "Đang tải..." : "Nghe"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
