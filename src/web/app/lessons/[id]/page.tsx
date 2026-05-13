"use client";

import { useState, useCallback, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Zap, Brain, Volume2, Check, X, ChevronRight } from "lucide-react";
import { getLessonById, type Lesson, type LessonSlide } from "@/lib/lessons/mock-lessons";
import { getGeneratedLessons } from "@/lib/lessons/generated-lessons-store";
import { KidShell } from "@/components/layout/KidShell";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { bus } from "@/lib/core/event-bus";
import { cn } from "@/lib/utils";

type AnswerState = "idle" | "correct" | "wrong";

interface SlideRendererProps {
  slide: LessonSlide;
  onComplete: (xp: number) => void;
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
        Got it
      </NbButton>
    </div>
  );
}

function QuizSlide({ slide, onComplete }: SlideRendererProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<AnswerState>("idle");

  const correctAnswer = slide.answer as string;

  function handleSelect(opt: string) {
    if (state !== "idle") return;
    setSelected(opt);
    const isCorrect = opt === correctAnswer;
    setState(isCorrect ? "correct" : "wrong");

    if (isCorrect) {
      setTimeout(() => onComplete(slide.xp), 900);
    } else {
      setTimeout(() => {
        setState("idle");
        setSelected(null);
      }, 1500);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="font-display text-[0.7rem] text-[#888] mb-2 tracking-widest uppercase">
          Question
        </div>
        <h2 className="font-display text-h2 leading-snug">{slide.content}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(slide.options ?? []).map((opt, i) => {
          const letter = ["A", "B", "C", "D"][i];
          const isSelected = selected === opt;
          const isCorrect = isSelected && state === "correct";
          const isWrong = isSelected && state === "wrong";

          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
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
        (Drag-and-drop interaction — coming in Phase 2!)
      </p>
      <NbButton variant="primary" size="lg" onClick={() => onComplete(slide.xp)} className="self-start">
        Continue →
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

  const [lesson, setLesson] = useState<Lesson | undefined>(() => getLessonById(id));
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [hintText, setHintText] = useState("Need a hint? Ask me!");
  const [hintLoading, setHintLoading] = useState(false);

  useEffect(() => {
    const mockLesson = getLessonById(id);
    if (mockLesson) {
      setLesson(mockLesson);
      return;
    }
    const generated = getGeneratedLessons().find((item) => item.id === id);
    setLesson(generated);
  }, [id]);

  const handleSlideComplete = useCallback(
    (xp: number) => {
      const newXp = totalXp + xp;
      setTotalXp(newXp);
      setHintShown(false);
      setHintText("Need a hint? Ask me!");

      if (currentSlideIdx < (lesson?.slides.length ?? 0) - 1) {
        setCurrentSlideIdx((i) => i + 1);
      } else {
        setCompleted(true);
        bus.emit("lesson:completed", {
          lessonId: id,
          score: Math.round((newXp / (lesson?.xpReward ?? 1)) * 100),
        });
      }
    },
    [currentSlideIdx, lesson, totalXp, id]
  );

  async function handleHint() {
    if (hintLoading) return;
    setHintShown(true);
    setHintLoading(true);
    setHintText("Cosmo is preparing your step-by-step guidance...");
    try {
      const res = await fetch("/api/v1/exercise/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: slide.content,
          correctAnswer: typeof slide.answer === "string" ? slide.answer : undefined,
          topic: lesson?.title ?? "Lesson",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate guidance");
      }

      const guidance = (data.guidance as string) || "Let's solve this together!";
      setHintText(guidance);

      if (lesson?.audioEnabled && data.audioUrl) {
        const audio = new Audio(data.audioUrl as string);
        audio.play().catch(() => {
          /* Ignore autoplay restrictions in browsers */
        });
      }
    } catch {
      setHintText("Try this: identify key words in the question, remove wrong options, then choose the best match. You can do it! 🌟");
    } finally {
      setHintLoading(false);
    }
  }

  if (!lesson) {
    return (
      <KidShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="text-6xl">🔍</div>
          <p className="font-display text-lg">Lesson not found</p>
          <NbButton variant="secondary" onClick={() => router.push("/lessons")}>
            Browse Lessons
          </NbButton>
        </div>
      </KidShell>
    );
  }

  const slide = lesson.slides[currentSlideIdx];
  const progress = Math.round(((currentSlideIdx) / lesson.slides.length) * 100);

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
              Lesson Complete!
            </h1>
            <div className="nb-card rounded-2xl p-8 flex flex-col items-center gap-2">
              <div className="font-display text-6xl text-nb-orange leading-none">
                {totalXp}
              </div>
              <div className="font-bold text-sm uppercase text-[#666]">XP Earned</div>
              <div className="mt-2 font-bold text-sm">Score: {pct}%</div>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <NbButton
                variant="primary"
                size="lg"
                onClick={() => { setCompleted(false); setCurrentSlideIdx(0); setTotalXp(0); }}
              >
                Play Again
              </NbButton>
              <NbButton
                variant="secondary"
                size="lg"
                onClick={() => router.push("/lessons")}
              >
                More Lessons
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
        {/* Top bar */}
        <div className="flex items-center gap-4 px-6 py-4 bg-white [border-bottom:var(--nb-border)] flex-wrap">
          <NbButton
            variant="danger"
            size="sm"
            onClick={() => router.push("/lessons")}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Quit
          </NbButton>

          {/* Progress */}
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

          {/* XP chip */}
          <NbPill color="yellow" icon={<Zap className="w-3 h-3" />}>
            {totalXp} xp
          </NbPill>
        </div>

        {/* Slide content */}
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
                <QuizSlide slide={slide} onComplete={handleSlideComplete} />
              )}
              {(slide.type === "drag-drop" || slide.type === "fill-blank") && (
                <DragDropSlide slide={slide} onComplete={handleSlideComplete} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Cosmo AI assistant */}
        {lesson.aiEnabled && (
          <div className="px-6 pb-8">
            <div className="flex items-end gap-4">
              {/* Cosmo avatar */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full [border:4px_solid_var(--nb-black)] [box-shadow:4px_4px_0_var(--nb-black)]",
                    "bg-gradient-to-br from-nb-purple to-nb-blue",
                    "flex items-center justify-center text-3xl ai-float cursor-pointer"
                  )}
                  onClick={handleHint}
                  role="button"
                  aria-label="Ask Cosmo for a hint"
                >
                  🍈
                </div>
                <span className="font-display text-[0.55rem] bg-nb-black text-nb-yellow px-1.5 py-0.5 rounded whitespace-nowrap">
                  Cosmo
                </span>
              </div>

              {/* Chat bubble */}
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
                    {hintShown ? "Hint" : "Cosmo"}
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
                      💡 Get a hint
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
                      {hintLoading ? "Loading..." : "Listen"}
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
