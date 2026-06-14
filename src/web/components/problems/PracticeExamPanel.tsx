"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  RefreshCcw,
  Target,
  Trophy,
} from "lucide-react";
import { auth } from "@/lib/auth/firebase";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { QuestionMedia } from "@/components/problems/QuestionMedia";
import type { QuestionBankQuestion, QuestionSet, RubricLevel } from "@/lib/problems/types";
import { cn } from "@/lib/utils";

interface PracticeExamPanelProps {
  uid?: string;
  questionSets: QuestionSet[];
  questions: QuestionBankQuestion[];
  loading?: boolean;
  onSessionChange?: (active: boolean) => void;
}

type ExamSummary = {
  set: QuestionSet;
  questions: QuestionBankQuestion[];
  durationMinutes: number;
};

type ExamResult = {
  total: number;
  correct: number;
  answered: number;
  durationSeconds: number;
};

function textValue(value: unknown) {
  return String(value ?? "");
}

function normalizeAnswer(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/^(-?\d+)\s+(-?\d+)$/g, "$1/$2")
    .replace(/[.,;:]$/g, "");
}

function hasAnswerData(question: QuestionBankQuestion) {
  return Boolean(textValue(question.answer).trim() || textValue(question.answerText).trim());
}

function hasValidChoices(question: QuestionBankQuestion) {
  const choices = question.choices ?? [];
  return choices.length >= 2 &&
    choices.every((choice) => textValue(choice.key).trim() && textValue(choice.text).trim());
}

function questionReferencesVisual(question: QuestionBankQuestion) {
  const text = textValue(question.stem).toLowerCase();
  return text.includes("hình trên") || text.includes("hình vẽ") || text.includes("tô màu");
}

function hasQuestionImage(question: QuestionBankQuestion) {
  return (question.imageUrls ?? []).some((url) => /^https?:\/\//i.test(textValue(url).trim()) || /^data:image\//i.test(textValue(url).trim()));
}

function isExamReadyQuestion(question: QuestionBankQuestion) {
  if (question.subject !== "math") return false;
  if (!textValue(question.stem).trim()) return false;
  if (!hasAnswerData(question)) return false;
  if (questionReferencesVisual(question) && !hasQuestionImage(question)) return false;
  if (question.type === "multiple_choice") return hasValidChoices(question);
  return question.type === "short_answer";
}

function estimateDurationMinutes(questionCount: number) {
  return Math.min(60, Math.max(40, 40 + Math.max(0, questionCount - 10)));
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours} giờ ${remainMinutes} phút`;
  }
  return `${Math.max(1, minutes)} phút`;
}

function rubricLabel(level: RubricLevel) {
  const labels: Record<RubricLevel, string> = {
    unclassified: "Chưa phân loại",
    nhan_biet: "Nhận biết",
    thong_hieu: "Thông hiểu",
    van_dung: "Vận dụng",
    van_dung_cao: "Vận dụng cao",
  };
  return labels[level] ?? "Câu hỏi";
}

function isLocallyCorrect(question: QuestionBankQuestion, submittedAnswer: string) {
  const submitted = normalizeAnswer(submittedAnswer);
  if (!submitted) return false;
  const expectedAnswer = normalizeAnswer(question.answer);
  const expectedText = normalizeAnswer(question.answerText);
  if (expectedAnswer && submitted === expectedAnswer) return true;
  if (expectedText && submitted === expectedText) return true;

  const selectedChoice = (question.choices ?? []).find((choice) => normalizeAnswer(choice.key) === submitted);
  return Boolean(selectedChoice && expectedText && normalizeAnswer(selectedChoice.text) === expectedText);
}

function resultTone(correct: number, total: number) {
  const ratio = total > 0 ? correct / total : 0;
  if (ratio >= 0.9) {
    return {
      title: "Con làm rất chắc tay rồi.",
      subtitle: "Giữ nhịp này và thử thêm một đề khó hơn ở lượt sau.",
      color: "green" as const,
    };
  }
  if (ratio >= 0.7) {
    return {
      title: "Con đang làm khá tốt.",
      subtitle: "Xem lại vài câu chưa trọn vẹn rồi làm thêm một đề nữa để lên tay.",
      color: "yellow" as const,
    };
  }
  return {
    title: "Mình ôn lại vài chỗ rồi làm tiếp nhé.",
    subtitle: "Đề dài cần chia thời gian đều hơn. Làm thêm một lượt nữa sẽ rõ tiến bộ hơn.",
    color: "orange" as const,
  };
}

export function PracticeExamPanel({
  uid,
  questionSets,
  questions,
  loading = false,
  onSessionChange,
}: PracticeExamPanelProps) {
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const startedAtRef = useRef<number>(0);

  const exams = useMemo<ExamSummary[]>(() => {
    return questionSets
      .map((set) => {
        const setQuestions = questions
          .filter((question) => (question.sourceSetId || question.questionSetId) === set.id)
          .filter(isExamReadyQuestion)
          .sort((a, b) => a.questionNumber - b.questionNumber);

        return {
          set,
          questions: setQuestions,
          durationMinutes: estimateDurationMinutes(setQuestions.length),
        };
      })
      .filter((item) => item.questions.length >= 5)
      .sort((a, b) => {
        if (b.set.grade !== a.set.grade) return b.set.grade - a.set.grade;
        return (b.set.createdAt ?? "").localeCompare(a.set.createdAt ?? "");
      });
  }, [questionSets, questions]);

  const activeExam = useMemo(
    () => exams.find((exam) => exam.set.id === activeExamId) ?? null,
    [activeExamId, exams]
  );
  const currentQuestion = activeExam?.questions[currentIndex] ?? null;
  const answeredCount = activeExam
    ? activeExam.questions.filter((question) => (answers[question.id] ?? "").trim().length > 0).length
    : 0;

  useEffect(() => {
    onSessionChange?.(Boolean(activeExam));
  }, [activeExam, onSessionChange]);

  useEffect(() => () => onSessionChange?.(false), [onSessionChange]);

  const finishExam = useCallback(async () => {
    if (!activeExam || submitting || result) return;

    setSubmitting(true);
    const token = await auth?.currentUser?.getIdToken();
    const startedAtMs = startedAtRef.current || Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const totalElapsedMs = Math.max(1000, Date.now() - startedAtMs);
    const perQuestionMs = Math.max(1000, Math.round(totalElapsedMs / Math.max(1, activeExam.questions.length)));

    let correct = 0;
    let answered = 0;

    try {
      await Promise.all(activeExam.questions.map(async (question) => {
        const submittedAnswer = answers[question.id] ?? "";
        if (submittedAnswer.trim()) answered += 1;

        if (!token || !submittedAnswer.trim()) {
          if (submittedAnswer.trim() && isLocallyCorrect(question, submittedAnswer)) {
            correct += 1;
          }
          return;
        }

        const res = await fetch("/api/questions/attempts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questionId: question.id,
            submittedAnswer,
            timeSpentMs: perQuestionMs,
            startedAt,
            source: "question_bank",
          }),
        });
        const data = await res.json();
        const isCorrect = res.ok ? Boolean(data.isCorrect) : isLocallyCorrect(question, submittedAnswer);
        if (isCorrect) correct += 1;
      }));

      setResult({
        total: activeExam.questions.length,
        correct,
        answered,
        durationSeconds: Math.max(1, Math.round(totalElapsedMs / 1000)),
      });
      setReviewMode(false);
    } finally {
      setSubmitting(false);
    }
  }, [activeExam, answers, result, submitting]);

  useEffect(() => {
    if (!activeExam) return;
    if (timeLeft <= 0) return;

    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeExam, timeLeft]);

  useEffect(() => {
    if (activeExam && timeLeft === 0 && startedAtRef.current > 0 && !submitting && !result) {
      void finishExam();
    }
  }, [activeExam, finishExam, result, submitting, timeLeft]);

  useEffect(() => {
    if (!activeExam) return;
    startedAtRef.current = Date.now();
  }, [activeExam]);

  function startExam(exam: ExamSummary) {
    setActiveExamId(exam.set.id);
    setCurrentIndex(0);
    setAnswers({});
    setResult(null);
    setReviewMode(false);
    setSubmitting(false);
    setTimeLeft(exam.durationMinutes * 60);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restartExam() {
    if (!activeExam) return;
    startExam(activeExam);
  }

  function exitExam() {
    setActiveExamId(null);
    setCurrentIndex(0);
    setAnswers({});
    setTimeLeft(0);
    setSubmitting(false);
    setResult(null);
    setReviewMode(false);
    startedAtRef.current = 0;
  }

  if (activeExam && result && !reviewMode) {
    const tone = resultTone(result.correct, result.total);
    const completion = Math.round((result.answered / Math.max(1, result.total)) * 100);
    const accuracy = Math.round((result.correct / Math.max(1, result.total)) * 100);
    const wrongCount = result.answered - result.correct;
    const skippedCount = result.total - result.answered;

    return (
      <div className="flex min-h-dvh flex-col bg-nb-bg">
        <div className="bg-white px-6 py-4 [border-bottom:var(--nb-border)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <NbButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={exitExam}
              icon={<ArrowLeft className="h-3.5 w-3.5" />}
            >
              Về danh sách đề
            </NbButton>
            <NbPill color={tone.color} icon={<Trophy className="h-3 w-3" />}>
              Đã nộp bài
            </NbPill>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
          <section className="rounded-[24px] bg-white p-6 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <NbPill color="green">Lớp {activeExam.set.grade}</NbPill>
                  <NbPill color="orange">{activeExam.durationMinutes} phút</NbPill>
                  <NbPill color={tone.color}>{accuracy}% đúng</NbPill>
                </div>
                <h2 className="mt-4 font-display text-[clamp(1.45rem,3vw,2.3rem)] leading-tight text-nb-black">
                  {tone.title}
                </h2>
                <p className="mt-3 text-base font-semibold leading-relaxed text-[#555]">
                  {activeExam.set.title}
                </p>
                <p className="mt-2 text-base font-semibold leading-relaxed text-[#555]">
                  {tone.subtitle}
                </p>
              </div>

              <div className="min-w-[220px] rounded-[20px] bg-[#fff6dc] p-5 [border:var(--nb-border)]">
                <div className="text-[0.78rem] font-black uppercase text-[#666]">Điểm chính</div>
                <div className="mt-3 font-display text-[2.4rem] leading-none text-nb-black">
                  {result.correct}/{result.total}
                </div>
                <p className="mt-2 text-sm font-semibold text-[#555]">Số câu làm đúng trong cả đề.</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
              <div className="flex items-center gap-2 text-[0.75rem] font-black uppercase text-[#666]">
                <Target className="h-4 w-4 text-nb-orange" />
                Tỉ lệ đúng
              </div>
              <div className="mt-3 font-display text-3xl">{accuracy}%</div>
              <p className="mt-2 text-sm font-semibold text-[#555]">{result.correct} câu đúng</p>
            </div>

            <div className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
              <div className="flex items-center gap-2 text-[0.75rem] font-black uppercase text-[#666]">
                <Clock3 className="h-4 w-4 text-nb-blue" />
                Thời gian làm
              </div>
              <div className="mt-3 font-display text-3xl">{formatDuration(result.durationSeconds)}</div>
              <p className="mt-2 text-sm font-semibold text-[#555]">Hoàn thành trong {formatClock(result.durationSeconds)}</p>
            </div>

            <div className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
              <div className="flex items-center gap-2 text-[0.75rem] font-black uppercase text-[#666]">
                <CheckCircle2 className="h-4 w-4 text-nb-green" />
                Mức hoàn thành
              </div>
              <div className="mt-3 font-display text-3xl">{completion}%</div>
              <p className="mt-2 text-sm font-semibold text-[#555]">Đã trả lời {result.answered}/{result.total} câu</p>
            </div>

            <div className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
              <div className="flex items-center gap-2 text-[0.75rem] font-black uppercase text-[#666]">
                <FileText className="h-4 w-4 text-nb-pink" />
                Cần xem lại
              </div>
              <div className="mt-3 font-display text-3xl">{wrongCount + skippedCount}</div>
              <p className="mt-2 text-sm font-semibold text-[#555]">
                {wrongCount} câu sai, {skippedCount} câu bỏ trống
              </p>
            </div>
          </section>

          <section className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[0.78rem] font-black uppercase text-[#666]">Các bước tiếp theo</div>
                <p className="mt-2 text-sm font-semibold text-[#555]">
                  Xem lại bài vừa làm hoặc chọn một đề khác để luyện tiếp.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <NbButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReviewMode(true);
                    setCurrentIndex(0);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Eye className="h-4 w-4" />
                  Xem lại bài làm
                </NbButton>
                <NbButton type="button" variant="secondary" size="sm" onClick={restartExam}>
                  <RefreshCcw className="h-4 w-4" />
                  Làm lại đề này
                </NbButton>
                <NbButton type="button" variant="primary" size="sm" onClick={exitExam}>
                  Chọn đề khác
                  <ChevronRight className="h-4 w-4" />
                </NbButton>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
            <div className="text-[0.78rem] font-black uppercase text-[#666]">Tiến độ từng câu</div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {activeExam.questions.map((question, index) => {
                const answer = answers[question.id] ?? "";
                const isAnswered = answer.trim().length > 0;
                const isCorrect = isAnswered && isLocallyCorrect(question, answer);
                const cardTone = !isAnswered ? "bg-[#fff7e8]" : isCorrect ? "bg-[#eafaf0]" : "bg-[#ffe8e8]";

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => {
                      setReviewMode(true);
                      setCurrentIndex(index);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className={cn(
                      "rounded-[16px] p-4 text-left [border:var(--nb-border)] [box-shadow:4px_4px_0_var(--nb-black)] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5",
                      cardTone
                    )}
                  >
                    <div className="font-display text-sm">Câu {question.questionNumber}</div>
                    <div className="mt-2 text-xs font-bold text-[#555]">
                      {!isAnswered ? "Bỏ trống" : isCorrect ? "Đúng" : "Cần xem lại"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (activeExam && currentQuestion) {
    const isMultipleChoice = currentQuestion.type === "multiple_choice" && currentQuestion.choices.length > 0;
    const currentAnswer = answers[currentQuestion.id] ?? "";

    return (
      <div className="flex min-h-dvh flex-col bg-nb-bg">
        <div className="flex flex-wrap items-center gap-4 bg-white px-6 py-4 [border-bottom:var(--nb-border)]">
          <NbButton
            type="button"
            variant="danger"
            size="sm"
            onClick={reviewMode ? () => setReviewMode(false) : exitExam}
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            {reviewMode ? "Về kết quả" : "Thoát đề"}
          </NbButton>

          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-[0.75rem] text-nb-black">{activeExam.set.title}</span>
              <span className="font-display text-[0.75rem] text-nb-orange">
                {currentIndex + 1}/{activeExam.questions.length}
              </span>
            </div>
            <div className="nb-progress-track h-[18px]">
              <div
                className="nb-progress-fill h-full"
                style={{
                  background: "linear-gradient(90deg, var(--nb-orange) 0%, var(--nb-pink) 100%)",
                  width: `${Math.round(((currentIndex + 1) / activeExam.questions.length) * 100)}%`,
                }}
              />
            </div>
          </div>

          <NbPill color={timeLeft <= 300 ? "orange" : "yellow"} icon={<Clock3 className="h-3 w-3" />}>
            {result ? "Đã nộp bài" : formatClock(timeLeft)}
          </NbPill>
        </div>

        <div className="flex flex-1 flex-col gap-8 px-6 py-8">
          <div className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
            <div className="flex flex-wrap items-center gap-2">
              <NbPill color="green">Lớp {activeExam.set.grade}</NbPill>
              <NbPill color="orange">{activeExam.durationMinutes} phút</NbPill>
              <NbPill color="yellow">{rubricLabel(currentQuestion.rubricLevel)}</NbPill>
            </div>

            <div className="mt-4 text-[0.75rem] font-black uppercase text-[#777]">
              Câu {currentQuestion.questionNumber}
            </div>
            <h2 className="mt-2 font-display text-[clamp(1.15rem,2.2vw,1.6rem)] leading-relaxed text-nb-black">
              {currentQuestion.stem}
            </h2>

            <div className="mt-5">
              <QuestionMedia imageUrls={currentQuestion.imageUrls} visualDescription={currentQuestion.visualDescription} />
            </div>

            {isMultipleChoice ? (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {currentQuestion.choices.map((choice, index) => {
                  const letter = choice.key || ["A", "B", "C", "D"][index] || String(index + 1);
                  const selected = currentAnswer === choice.key;
                  return (
                    <button
                      key={`${currentQuestion.id}-${choice.key}`}
                      type="button"
                      disabled={Boolean(result)}
                      onClick={() => setAnswers((items) => ({ ...items, [currentQuestion.id]: choice.key }))}
                      className={cn(
                        "flex min-h-24 items-center gap-4 rounded-[18px] p-5 text-left",
                        "[border:var(--nb-border)] [box-shadow:6px_6px_0_var(--nb-black)] transition-all duration-150",
                        selected ? "bg-nb-yellow" : "bg-white hover:-translate-x-0.5 hover:-translate-y-0.5",
                        result ? "cursor-default hover:translate-x-0 hover:translate-y-0" : ""
                      )}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full [border:3px_solid_var(--nb-black)] font-display text-[0.85rem]">
                        {letter}
                      </span>
                      <span className="font-body flex-1 text-base font-bold leading-snug">{choice.text}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6">
                <label className="text-[0.8rem] font-black uppercase text-[#666]">Đáp án của con</label>
                <input
                  className="nb-input mt-2 text-base"
                  value={currentAnswer}
                  disabled={Boolean(result)}
                  onChange={(event) => setAnswers((items) => ({ ...items, [currentQuestion.id]: event.target.value }))}
                  placeholder="Nhập đáp án ngắn"
                />
              </div>
            )}
          </div>

          <div className="rounded-[20px] bg-white p-4 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-bold text-[#555]">
                Đã làm {answeredCount}/{activeExam.questions.length} câu
              </div>
              <div className="flex flex-wrap gap-2">
                <NbButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Câu trước
                </NbButton>
                {currentIndex < activeExam.questions.length - 1 ? (
                  <NbButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentIndex((index) => Math.min(activeExam.questions.length - 1, index + 1))}
                  >
                    Câu tiếp
                    <ChevronRight className="h-4 w-4" />
                  </NbButton>
                ) : result ? (
                  <NbButton type="button" variant="primary" size="sm" onClick={() => setReviewMode(false)}>
                    Xem kết quả
                    <Trophy className="h-4 w-4" />
                  </NbButton>
                ) : (
                  <NbButton type="button" variant="primary" size="sm" loading={submitting} onClick={() => void finishExam()}>
                    Nộp bài
                    <CheckCircle2 className="h-4 w-4" />
                  </NbButton>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nb-card rounded-2xl bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm">Đề luyện hôm nay</h3>
            <NbPill color="green" icon={<FileText className="h-3 w-3" />}>
              40-60 phút
            </NbPill>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#555]">
            Chọn một đề trọn vẹn để luyện nhịp làm bài, canh thời gian và giữ tập trung như khi làm kiểm tra thật.
          </p>
        </div>
        <NbPill color="yellow" icon={<Clock3 className="h-3 w-3" />}>
          {exams.length} đề
        </NbPill>
      </div>

      {loading ? (
        <div className="mt-5 rounded-xl border-2 border-dashed border-nb-black/20 py-16 text-center">
          <p className="font-display text-sm text-[#666]">Đang tải danh sách đề...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="mt-5 rounded-xl border-2 border-dashed border-nb-black/20 py-16 text-center">
          <p className="font-display text-sm text-[#666]">Chưa có đề đủ dữ liệu để luyện.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          {exams.map((exam) => (
            <div
              key={exam.set.id}
              className="rounded-[20px] bg-[#fff9ed] p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[0.7rem] font-black uppercase text-[#666]">Lớp {exam.set.grade}</div>
                  <h4 className="mt-2 font-display text-[0.95rem] leading-snug">{exam.set.title}</h4>
                </div>
                <NbPill color="orange">{exam.durationMinutes} phút</NbPill>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <NbPill color="green">{exam.questions.length} câu</NbPill>
                <NbPill color="yellow">Làm trọn đề</NbPill>
              </div>

              <p className="mt-4 text-sm font-semibold leading-relaxed text-[#555]">
                Phù hợp để luyện một phiên dài, rèn cách chia thời gian và hoàn thành đề từ đầu đến cuối.
              </p>

              <div className="mt-5 flex justify-end">
                <NbButton type="button" variant="primary" size="lg" onClick={() => startExam(exam)} disabled={!uid}>
                  Vào làm đề
                  <ChevronRight className="h-4 w-4" />
                </NbButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
