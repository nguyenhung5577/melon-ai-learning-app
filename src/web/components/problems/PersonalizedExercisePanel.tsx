"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Lightbulb,
  PencilLine,
  RotateCcw,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { auth } from "@/lib/auth/firebase";
import type { QuestionBankQuestion } from "@/lib/problems/types";
import type { PersonalizedNextAction, StudentPersonalizedPlanRecord } from "@/lib/progress/types";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { QuestionMedia } from "@/components/problems/QuestionMedia";
import { cn } from "@/lib/utils";

interface PersonalizedExercisePanelProps {
  uid?: string;
  questions: QuestionBankQuestion[];
  loadingQuestions?: boolean;
}

type AnswerState = "idle" | "correct" | "wrong";

const fallbackAction: PersonalizedNextAction = {
  id: "balanced",
  priority: 1,
  title: "Luyện cân bằng",
  description: "Làm một cụm câu vừa sức để hệ thống hiểu con hơn.",
  actionType: "mixed_practice",
  concepts: [],
  rubricLevels: ["thong_hieu", "van_dung"],
  questionCount: 5,
  reason: "Chưa có đủ dữ liệu để xác định điểm yếu rõ ràng.",
  hintMode: "available",
  uiMode: "normal",
};

const rubricLabels: Record<string, string> = {
  unclassified: "Chưa phân loại",
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
};

const conceptLabels: Record<string, string> = {
  arithmetic: "Số học",
  fractions: "Phân số",
  geometry: "Hình học",
  word_problems: "Toán có lời văn",
  logic: "Tư duy logic",
  mixed_exams: "Đề tổng hợp",
};

function conceptLabel(concept: string) {
  return conceptLabels[concept] ?? concept.replace(/[_-]+/g, " ");
}

function normalizeAnswer(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]$/g, "");
}

function isLocallyCorrect(question: QuestionBankQuestion, answer: string) {
  const submitted = normalizeAnswer(answer);
  const expectedAnswer = normalizeAnswer(question.answer);
  const expectedText = normalizeAnswer(question.answerText);

  if (!submitted) return false;
  if (expectedAnswer && submitted === expectedAnswer) return true;
  if (expectedText && submitted === expectedText) return true;

  const selectedChoice = question.choices.find((choice) => normalizeAnswer(choice.key) === submitted);
  return Boolean(selectedChoice && expectedText && normalizeAnswer(selectedChoice.text) === expectedText);
}

function conceptMatches(question: QuestionBankQuestion, action: PersonalizedNextAction) {
  if (action.concepts.length === 0) return true;
  const questionConcepts = question.concepts ?? [];
  if (questionConcepts.length === 0) return true;
  return action.concepts.some((concept) => questionConcepts.includes(concept));
}

function actionMatchesQuestion(question: QuestionBankQuestion, action: PersonalizedNextAction) {
  const rubricMatches =
    action.rubricLevels.length === 0 ||
    action.rubricLevels.includes(question.rubricLevel) ||
    question.rubricLevel === "unclassified";

  return question.subject === "math" && rubricMatches && conceptMatches(question, action);
}

function feedbackText(state: AnswerState, wrongCount: number, action: PersonalizedNextAction) {
  if (state === "correct") {
    if (action.actionType === "micro_lesson_then_guided_retry") {
      return "Đúng rồi! Con đã sửa được bước khó nhất.";
    }
    return "Đúng rồi! Con đang tiến gần hơn đến mục tiêu hôm nay.";
  }

  if (state === "wrong" && wrongCount >= 2) {
    return "Dạng này hơi khó. Mình tách bài thành từng bước nhỏ nhé.";
  }

  if (state === "wrong") {
    return "Chưa đúng ở bước này thôi. Con nhìn lại dữ kiện rồi thử thêm một lần nhé.";
  }

  return "Chọn đáp án rồi bấm Kiểm tra. Con có thể dùng nháp nếu cần.";
}

export function PersonalizedExercisePanel({
  uid,
  questions,
  loadingQuestions = false,
}: PersonalizedExercisePanelProps) {
  const [plan, setPlan] = useState<StudentPersonalizedPlanRecord | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [hintText, setHintText] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchText, setScratchText] = useState("");
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({});
  const [sessionXp, setSessionXp] = useState(0);
  const [attemptSaving, setAttemptSaving] = useState(false);
  const questionStartedAtRef = useRef(0);

  useEffect(() => {
    if (!uid) return;

    let mounted = true;

    async function loadPlan() {
      setPlanLoading(true);
      setPlanError(null);

      try {
        const res = await fetch(`/api/v1/progress/${uid}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Không tải được lộ trình cá nhân hóa.");
        }

        if (!mounted) return;
        const nextPlan = data.plan as StudentPersonalizedPlanRecord;
        setPlan(nextPlan);
        const firstAction = nextPlan.nextBestActions?.[0];
        setActiveActionId((current) => current ?? firstAction?.id ?? fallbackAction.id);
      } catch (error) {
        if (!mounted) return;
        setPlanError(error instanceof Error ? error.message : "Không tải được lộ trình cá nhân hóa.");
      } finally {
        if (mounted) setPlanLoading(false);
      }
    }

    void loadPlan();

    return () => {
      mounted = false;
    };
  }, [uid]);

  const actions = useMemo(() => {
    const items = plan?.nextBestActions?.length ? plan.nextBestActions : [fallbackAction];
    return items.slice(0, 3);
  }, [plan]);

  const activeAction = useMemo(() => {
    return actions.find((action) => action.id === activeActionId) ?? actions[0] ?? fallbackAction;
  }, [actions, activeActionId]);

  const sessionQuestions = useMemo(() => {
    const matched = questions
      .filter((question) => actionMatchesQuestion(question, activeAction))
      .sort((a, b) => {
        const aConceptHit = (a.concepts ?? []).some((concept) => activeAction.concepts.includes(concept)) ? 0 : 1;
        const bConceptHit = (b.concepts ?? []).some((concept) => activeAction.concepts.includes(concept)) ? 0 : 1;
        if (aConceptHit !== bConceptHit) return aConceptHit - bConceptHit;
        return a.questionNumber - b.questionNumber;
      });

    return matched.slice(0, Math.max(1, activeAction.questionCount));
  }, [activeAction, questions]);

  const currentQuestion = sessionQuestions[currentIndex] ?? null;
  const progress = sessionQuestions.length > 0
    ? Math.round((currentIndex / sessionQuestions.length) * 100)
    : 0;
  const currentWrongCount = currentQuestion ? wrongCounts[currentQuestion.id] ?? 0 : 0;

  const resetQuestionState = useCallback(() => {
    setAnswer("");
    setAnswerState("idle");
    setFeedbackMessage("");
    setHintText("");
    setScratchText("");
    questionStartedAtRef.current = Date.now();
  }, []);

  function startSession(actionId?: string) {
    if (actionId) setActiveActionId(actionId);
    setSessionStarted(true);
    setCurrentIndex(0);
    setSessionXp(0);
    setWrongCounts({});
    resetQuestionState();
  }

  function nextQuestion() {
    if (currentIndex >= sessionQuestions.length - 1) {
      setSessionStarted(false);
      setCurrentIndex(0);
      resetQuestionState();
      return;
    }

    setCurrentIndex((index) => index + 1);
    resetQuestionState();
  }

  async function loadHint() {
    if (!currentQuestion || hintLoading) return;

    setHintLoading(true);
    setHintText("Cosmo đang tách bài thành các bước nhỏ...");

    try {
      const res = await fetch("/api/v1/exercise/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.stem,
          studentAnswer: answer,
          correctAnswer: currentQuestion.answerText || currentQuestion.answer,
          topic: activeAction.concepts.map(conceptLabel).join(", ") || activeAction.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không tạo được gợi ý.");
      }
      setHintText(data.guidance || "Gợi ý: đọc lại đề hỏi gì, gạch dữ kiện quan trọng, rồi chọn phép tính phù hợp.");
    } catch {
      setHintText("Gợi ý: đọc lại đề hỏi gì, tìm dữ kiện cần dùng, rồi thử giải bằng một phép tính đơn giản trước.");
    } finally {
      setHintLoading(false);
    }
  }

  async function submitAnswer() {
    if (!currentQuestion || attemptSaving || !answer.trim()) return;

    setAttemptSaving(true);
    setPlanError(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Con cần đăng nhập để lưu kết quả luyện tập.");
      }

      const now = Date.now();
      const startedAtMs = questionStartedAtRef.current || now;
      const timeSpentMs = Math.max(0, now - startedAtMs);
      const res = await fetch("/api/questions/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          submittedAnswer: answer,
          timeSpentMs,
          startedAt: new Date(startedAtMs).toISOString(),
          source: "question_bank",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không lưu được kết quả làm bài.");
      }

      const isCorrect = Boolean(data.isCorrect ?? isLocallyCorrect(currentQuestion, answer));
      const nextWrongCount = isCorrect ? currentWrongCount : currentWrongCount + 1;

      if (!isCorrect) {
        setWrongCounts((items) => ({
          ...items,
          [currentQuestion.id]: nextWrongCount,
        }));
      }

      setAnswerState(isCorrect ? "correct" : "wrong");
      setFeedbackMessage(feedbackText(isCorrect ? "correct" : "wrong", nextWrongCount, activeAction));
      setSessionXp((xp) => xp + (isCorrect ? 10 : 2));

      if (!isCorrect && (activeAction.hintMode === "step_by_step" || nextWrongCount >= 2)) {
        void loadHint();
      }
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Không lưu được kết quả làm bài.");
    } finally {
      setAttemptSaving(false);
    }
  }

  if (!uid) {
    return null;
  }

  if (sessionStarted && currentQuestion) {
    const isMultipleChoice = currentQuestion.type === "multiple_choice" && currentQuestion.choices.length > 0;
    const canRetry = answerState === "wrong";

    return (
      <div className="nb-card rounded-2xl bg-white p-5">
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-nb-black pb-4">
          <NbButton type="button" variant="danger" size="sm" onClick={() => setSessionStarted(false)}>
            Thoát
          </NbButton>

          <div className="min-w-[180px] flex-1">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-xs font-black uppercase">{activeAction.title}</span>
              <span className="text-xs font-black text-nb-orange">
                {currentIndex + 1}/{sessionQuestions.length}
              </span>
            </div>
            <div className="nb-progress-track h-[18px]">
              <div
                className="nb-progress-fill h-full bg-nb-green"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <NbPill color="yellow" icon={<Zap className="h-3 w-3" />}>
            {sessionXp} XP
          </NbPill>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <NbPill color="green">{rubricLabels[currentQuestion.rubricLevel] ?? currentQuestion.rubricLevel}</NbPill>
            {(currentQuestion.concepts ?? activeAction.concepts).slice(0, 2).map((concept) => (
              <NbPill key={concept} color="orange">
                {conceptLabel(concept)}
              </NbPill>
            ))}
          </div>

          <div className="rounded-xl border-2 border-nb-black bg-nb-bg p-4">
            <div className="mb-2 text-xs font-black uppercase text-[#666]">
              Câu {currentQuestion.questionNumber}
            </div>
            <h3 className="text-lg font-black leading-relaxed text-nb-black">
              {currentQuestion.stem}
            </h3>
            <QuestionMedia imageUrls={currentQuestion.imageUrls} visualDescription={currentQuestion.visualDescription} />
          </div>

          {isMultipleChoice ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {currentQuestion.choices.map((choice) => {
                const isSelected = answer === choice.key;
                const isCorrectChoice = answerState === "correct" && isSelected;
                const isWrongChoice = answerState === "wrong" && isSelected;

                return (
                  <button
                    key={`${currentQuestion.id}-${choice.key}`}
                    type="button"
                    disabled={answerState === "correct"}
                    onClick={() => {
                      if (answerState === "correct") return;
                      setAnswer(choice.key);
                      if (canRetry) setAnswerState("idle");
                    }}
                    className={cn(
                      "flex min-h-20 items-center gap-3 rounded-xl border-2 border-nb-black bg-white p-3 text-left",
                      "transition-all duration-150 [box-shadow:4px_4px_0_var(--nb-black)]",
                      "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:6px_6px_0_var(--nb-black)]",
                      isSelected && "bg-nb-yellow",
                      isCorrectChoice && "bg-nb-green text-white",
                      isWrongChoice && "bg-nb-pink",
                      "disabled:cursor-not-allowed disabled:opacity-80"
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-nb-black bg-white font-black text-nb-black">
                      {isCorrectChoice ? <Check className="h-4 w-4" /> : isWrongChoice ? <X className="h-4 w-4" /> : choice.key}
                    </span>
                    <span className="font-bold leading-snug">{choice.text}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="flex flex-col gap-2">
              <span className="text-xs font-black uppercase">Đáp án của con</span>
              <input
                className="nb-input text-base"
                value={answer}
                disabled={answerState === "correct"}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (canRetry) setAnswerState("idle");
                }}
                placeholder="Nhập đáp án ngắn"
              />
            </label>
          )}

          <div
            className={cn(
              "rounded-xl border-2 border-nb-black p-4",
              answerState === "correct" && "bg-nb-green text-white",
              answerState === "wrong" && "bg-[#fff0c8]",
              answerState === "idle" && "bg-white"
            )}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-nb-black bg-white text-nb-black">
                  {answerState === "correct" ? <Sparkles className="h-5 w-5" /> : answerState === "wrong" ? <Lightbulb className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                </div>
                <div>
                  <div className="text-xs font-black uppercase">
                    {answerState === "correct" ? "Hoàn thành bước này" : answerState === "wrong" ? "Mình thử lại nhé" : "Sẵn sàng"}
                  </div>
                  <p className="mt-1 text-sm font-bold leading-relaxed">
                    {feedbackMessage || feedbackText(answerState, currentWrongCount, activeAction)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {answerState !== "correct" && (
                  <NbButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={submitAnswer}
                    loading={attemptSaving}
                    disabled={!answer.trim()}
                  >
                    <Check className="h-4 w-4" />
                    Kiểm tra
                  </NbButton>
                )}
                {answerState === "wrong" && (
                  <NbButton type="button" variant="ghost" size="sm" onClick={() => setAnswerState("idle")}>
                    <RotateCcw className="h-4 w-4" />
                    Thử lại
                  </NbButton>
                )}
                {answerState === "correct" && (
                  <NbButton type="button" variant="primary" size="sm" onClick={nextQuestion}>
                    {currentIndex >= sessionQuestions.length - 1 ? "Xong" : "Câu tiếp"}
                    <ChevronRight className="h-4 w-4" />
                  </NbButton>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border-2 border-nb-black bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-nb-orange" />
                  <span className="text-xs font-black uppercase">Gợi ý Cosmo</span>
                </div>
                <NbButton type="button" variant="ghost" size="sm" onClick={loadHint} loading={hintLoading}>
                  Gợi ý
                </NbButton>
              </div>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#555]">
                {hintText || "Gợi ý sẽ mở từng bước, không đưa đáp án ngay để con vẫn tự làm được."}
              </p>
            </div>

            <div className="rounded-xl border-2 border-nb-black bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <PencilLine className="h-4 w-4 text-nb-blue" />
                  <span className="text-xs font-black uppercase">Nháp</span>
                </div>
                <NbButton type="button" variant="ghost" size="sm" onClick={() => setScratchOpen((open) => !open)}>
                  {scratchOpen ? "Ẩn" : "Mở"}
                </NbButton>
              </div>
              {scratchOpen ? (
                <textarea
                  className="nb-input mt-3 min-h-28 text-sm"
                  value={scratchText}
                  onChange={(event) => setScratchText(event.target.value)}
                  placeholder="Viết phép tính, dữ kiện hoặc bước giải ở đây"
                />
              ) : (
                <p className="mt-3 text-sm font-semibold text-[#555]">
                  Dùng nháp khi con cần quy đồng, tính phụ hoặc tóm tắt đề.
                </p>
              )}
            </div>
          </div>

          {planError && <p className="text-sm font-bold text-nb-red">{planError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="nb-card rounded-2xl bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm">Lộ trình hôm nay</h3>
            <NbPill color="green" icon={<Target className="h-3 w-3" />}>
              Cá nhân hóa
            </NbPill>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#555]">
            Hệ thống chọn bài theo mục tiêu ban đầu và kết quả làm bài gần đây.
          </p>
        </div>
        <NbPill color="yellow" icon={<Sparkles className="h-3 w-3" />}>
          {sessionXp} XP phiên này
        </NbPill>
      </div>

      {planError && <p className="mt-3 text-sm font-bold text-nb-red">{planError}</p>}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {actions.map((action) => {
          const matches = questions.filter((question) => actionMatchesQuestion(question, action)).length;
          const selected = action.id === activeAction.id;

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setActiveActionId(action.id);
                setCurrentIndex(0);
                resetQuestionState();
              }}
              className={cn(
                "rounded-xl border-2 border-nb-black bg-nb-bg p-4 text-left transition-all",
                "[box-shadow:4px_4px_0_var(--nb-black)] hover:-translate-x-0.5 hover:-translate-y-0.5",
                selected && "bg-nb-yellow [box-shadow:6px_6px_0_var(--nb-black)]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.7rem] font-black uppercase text-[#666]">
                  Bước {action.priority}
                </span>
                <span className="text-[0.7rem] font-black uppercase text-nb-orange">
                  {matches} câu
                </span>
              </div>
              <div className="mt-2 font-black leading-snug">{action.title}</div>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">{action.description}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border-2 border-nb-black bg-[#fff9ed] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-black uppercase text-[#666]">Vì sao chọn bước này?</div>
            <p className="mt-1 text-sm font-bold leading-relaxed">{activeAction.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeAction.concepts.length > 0 ? activeAction.concepts.map((concept) => (
                <NbPill key={concept} color="orange">
                  {conceptLabel(concept)}
                </NbPill>
              )) : (
                <NbPill color="orange">Ôn cân bằng</NbPill>
              )}
              {activeAction.rubricLevels.map((rubric) => (
                <NbPill key={rubric} color="green">
                  {rubricLabels[rubric] ?? rubric}
                </NbPill>
              ))}
            </div>
          </div>
          <NbButton
            type="button"
            variant="primary"
            size="lg"
            onClick={() => startSession(activeAction.id)}
            loading={planLoading || loadingQuestions}
            disabled={sessionQuestions.length === 0}
          >
            Luyện ngay
            <ChevronRight className="h-4 w-4" />
          </NbButton>
        </div>

        {sessionQuestions.length === 0 && !planLoading && !loadingQuestions && (
          <p className="mt-3 text-sm font-bold text-nb-red">
            Kho đề chưa có câu phù hợp với bước này. Admin cần gắn rubric/concept cho câu hỏi hoặc nhập thêm câu cùng chủ đề.
          </p>
        )}
      </div>
    </div>
  );
}
