"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  History,
  RefreshCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
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

type ExamHistoryItem = {
  id: string;
  questionSetId: string;
  title: string;
  grade?: number;
  submittedAt: string;
  total: number;
  answered: number;
  correct: number;
  durationSeconds: number;
  source: "saved" | "local";
};

type CompoundPart = {
  key: string;
  label: string;
  text: string;
  answerText?: string;
  explanation?: string;
};

function textValue(value: unknown) {
  return String(value ?? "");
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

function hasAnswerData(question: QuestionBankQuestion) {
  return Boolean(
      textValue(question.answer).trim() ||
      textValue(question.answerText).trim() ||
      textValue(question.answerTextMarkdown).trim() ||
      (question.subQuestions ?? []).some((subQuestion) => (
        textValue(subQuestion.answerText).trim() || textValue(subQuestion.answerTextMarkdown).trim()
      ))
  );
}

function hasValidChoices(question: QuestionBankQuestion) {
  const choices = question.choices ?? [];
  return choices.length >= 2 && choices.every((choice) => textValue(choice.text).trim());
}

function questionReferencesVisual(question: QuestionBankQuestion) {
  const text = textValue(question.stem).toLowerCase();
  return text.includes("hình trên") || text.includes("hình vẽ") || text.includes("tô màu");
}

function hasQuestionImage(question: QuestionBankQuestion) {
  return (question.imageUrls ?? []).some((url) => /^https?:\/\//i.test(textValue(url).trim()) || /^data:image\//i.test(textValue(url).trim()));
}

function fallbackCompoundLabel(index: number) {
  return String.fromCharCode(97 + index);
}

function normalizeCompoundLabel(value: unknown, index: number) {
  const fallback = fallbackCompoundLabel(index);
  const label = textValue(value).trim().toLowerCase();
  return label.match(/([a-z])\s*$/i)?.[1]?.toLowerCase() ?? fallback;
}

function displayCompoundLabel(value: unknown, index: number) {
  return textValue(value).trim().match(/([a-z])\s*$/i)?.[1] || fallbackCompoundLabel(index);
}

function subQuestionCompoundParts(question: QuestionBankQuestion): CompoundPart[] {
  return (question.subQuestions ?? [])
    .map((subQuestion, index) => ({
      key: normalizeCompoundLabel(subQuestion.label, index),
      label: displayCompoundLabel(subQuestion.label, index),
      text: textValue(subQuestion.stemMarkdown || subQuestion.stem).trim(),
      answerText: textValue(subQuestion.answerTextMarkdown || subQuestion.answerText).trim(),
      explanation: textValue(subQuestion.explanation).trim(),
    }))
    .filter((part) => part.text.length > 0 || textValue(part.answerText).trim().length > 0);
}

function splitCompoundPrompt(stem: string): { lead: string; parts: CompoundPart[] } {
  const matches = Array.from(stem.matchAll(/([a-dA-D])\)\s*/g));
  if (matches.length < 2) return { lead: stem, parts: [] };

  const firstIndex = matches[0].index ?? 0;
  const lead = stem.slice(0, firstIndex).trim().replace(/:\s*$/, "");
  const parts = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? stem.length;
    const key = match[1].toLowerCase();
    return {
      key,
      label: key,
      text: stem.slice(start, end).trim().replace(/[.;,]\s*$/, ""),
    };
  }).filter((part) => part.text.length > 0);

  return parts.length >= 2 ? { lead, parts } : { lead: stem, parts: [] };
}

function compoundPromptForQuestion(question: QuestionBankQuestion) {
  const subQuestionParts = subQuestionCompoundParts(question);
  if (subQuestionParts.length > 0) {
    return { lead: textValue(question.stemMarkdown || question.stem), parts: subQuestionParts };
  }

  return splitCompoundPrompt(textValue(question.stemMarkdown || question.stem));
}

function answerKey(question: QuestionBankQuestion, part?: CompoundPart) {
  return part ? `${question.id}::${part.key}` : question.id;
}

function submittedAnswerForQuestion(question: QuestionBankQuestion, answers: Record<string, string>) {
  const parts = compoundPromptForQuestion(question).parts;
  if (parts.length === 0) return answers[question.id] ?? "";

  return parts
    .map((part) => `${part.key}) ${(answers[answerKey(question, part)] ?? "").trim()}`)
    .join("; ");
}

function hasAnyQuestionAnswer(question: QuestionBankQuestion, answers: Record<string, string>) {
  const parts = compoundPromptForQuestion(question).parts;
  if (parts.length === 0) return (answers[question.id] ?? "").trim().length > 0;
  return parts.some((part) => (answers[answerKey(question, part)] ?? "").trim().length > 0);
}

function isQuestionAnswered(question: QuestionBankQuestion, answers: Record<string, string>) {
  const parts = compoundPromptForQuestion(question).parts;
  if (parts.length === 0) return (answers[question.id] ?? "").trim().length > 0;
  return parts.every((part) => (answers[answerKey(question, part)] ?? "").trim().length > 0);
}

function parseLabeledAnswerParts(value: unknown, labels: string[]): Record<string, string> | null {
  const text = textValue(value).trim();
  if (!text) return null;

  const matches = Array.from(text.matchAll(/([a-z])\s*[\).:]\s*/giu))
    .filter((match) => match.index !== undefined);

  if (matches.length > 0) {
    const parts: Record<string, string> = {};
    for (let index = 0; index < matches.length; index += 1) {
      const label = matches[index][1].toLowerCase();
      const start = (matches[index].index ?? 0) + matches[index][0].length;
      const end = matches[index + 1]?.index ?? text.length;
      const answer = text.slice(start, end).trim().replace(/^[\s;,-]+|[\s;,-]+$/g, "");
      if (labels.includes(label) && answer) parts[label] = answer;
    }

    return Object.keys(parts).length > 0 ? parts : null;
  }

  const chunks = text
    .split(/\s*(?:;|\n|\|)\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);
  if (chunks.length !== labels.length) return null;

  return labels.reduce<Record<string, string>>((items, label, index) => {
    items[label] = chunks[index];
    return items;
  }, {});
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

  const compoundPrompt = compoundPromptForQuestion(question);
  const expectedSubAnswers = compoundPrompt.parts.filter((part) => textValue(part.answerText).trim());
  if (expectedSubAnswers.length > 0) {
    const labels = compoundPrompt.parts.map((part) => part.key);
    const submittedParts = parseLabeledAnswerParts(submittedAnswer, labels);
    if (submittedParts) {
      return expectedSubAnswers.every((part) => (
        normalizeAnswer(submittedParts[part.key]) === normalizeAnswer(part.answerText)
      ));
    }
  }

  const expectedAnswer = normalizeAnswer(question.answer);
  const expectedText = normalizeAnswer(question.answerText);
  const expectedMarkdown = normalizeAnswer(question.answerTextMarkdown);
  if (expectedAnswer && submitted === expectedAnswer) return true;
  if (expectedText && submitted === expectedText) return true;
  if (expectedMarkdown && submitted === expectedMarkdown) return true;

  const selectedChoice = (question.choices ?? []).find((choice, index) => (
    normalizeAnswer(choiceDisplayKey(choice, index)) === submitted ||
    normalizeAnswer(choice.text) === submitted
  ));
  const expectedChoiceText = expectedText || expectedMarkdown;
  return Boolean(selectedChoice && expectedChoiceText && normalizeAnswer(selectedChoice.text) === expectedChoiceText);
}

function choiceDisplayKey(choice: QuestionBankQuestion["choices"][number], index: number) {
  return choice.key || ["A", "B", "C", "D"][index] || String(index + 1);
}

function isCorrectChoice(question: QuestionBankQuestion, choice: QuestionBankQuestion["choices"][number], index: number) {
  const expectedAnswer = normalizeAnswer(question.answer);
  const expectedText = normalizeAnswer(question.answerText);
  const expectedMarkdown = normalizeAnswer(question.answerTextMarkdown);
  const choiceKey = normalizeAnswer(choiceDisplayKey(choice, index));
  const choiceText = normalizeAnswer(choice.text);

  return Boolean(
    (expectedAnswer && (choiceKey === expectedAnswer || choiceText === expectedAnswer)) ||
      (expectedText && (choiceKey === expectedText || choiceText === expectedText)) ||
      (expectedMarkdown && (choiceKey === expectedMarkdown || choiceText === expectedMarkdown))
  );
}

function correctChoiceLabel(question: QuestionBankQuestion) {
  const choice = (question.choices ?? []).find((item, index) => isCorrectChoice(question, item, index));
  if (choice) {
    const index = question.choices.indexOf(choice);
    return `${choiceDisplayKey(choice, index)}. ${choice.text}`;
  }
  return standardAnswerText(question);
}

function submittedChoiceLabel(question: QuestionBankQuestion, answer: string) {
  const submitted = normalizeAnswer(answer);
  const choice = (question.choices ?? []).find((item, index) => (
    normalizeAnswer(choiceDisplayKey(item, index)) === submitted || normalizeAnswer(item.text) === submitted
  ));
  if (choice) {
    const index = question.choices.indexOf(choice);
    return `${choiceDisplayKey(choice, index)}. ${choice.text}`;
  }
  return answer;
}

function standardAnswerText(question: QuestionBankQuestion) {
  return textValue(question.answerTextMarkdown || question.answerText || question.answer).trim();
}

function shortAnswerPlaceholder(question: QuestionBankQuestion) {
  const expected = normalizeAnswer(standardAnswerText(question));
  if (/^-?\d+\s*\/\s*-?\d+$/.test(expected)) return "Vi du: 3/4";
  if (/^-?\d+(?:[.,]\d+)?$/.test(expected)) return "Vi du: 124349 (khong can dau cach)";
  return "Nhap dap an ngan";
}

function subAnswerResults(question: QuestionBankQuestion, answers: Record<string, string>) {
  const parts = compoundPromptForQuestion(question).parts;
  const expectedFromSubQuestions = parts.reduce<Record<string, string>>((items, part) => {
    if (textValue(part.answerText).trim()) items[part.key] = textValue(part.answerText);
    return items;
  }, {});
  const labels = parts.map((part) => part.key);
  const expected = Object.keys(expectedFromSubQuestions).length > 0
    ? expectedFromSubQuestions
    : parseLabeledAnswerParts(question.answerText, labels) ??
      parseLabeledAnswerParts(question.answer, labels) ??
      parseLabeledAnswerParts(question.explanation, labels);

  if (!expected) return {};

  return parts.reduce<Record<string, boolean>>((items, part) => {
    const correct = normalizeAnswer(expected[part.key]);
    if (correct) {
      items[part.key] = normalizeAnswer(answers[answerKey(question, part)]) === correct;
    }
    return items;
  }, {});
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

function historyStorageKey(uid: string) {
  return `melon:practice-exam-history:${uid}`;
}

function writeLocalExamHistory(uid: string, items: ExamHistoryItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(historyStorageKey(uid), JSON.stringify(items.slice(0, 20)));
}

function readLocalExamHistory(uid: string): ExamHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(historyStorageKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExamHistoryItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.questionSetId && item?.submittedAt) : [];
  } catch {
    return [];
  }
}

export function PracticeExamPanel({
  uid,
  questionSets,
  questions,
  loading = false,
  onSessionChange,
}: PracticeExamPanelProps) {
  const router = useRouter();
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
    ? activeExam.questions.filter((question) => isQuestionAnswered(question, answers)).length
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
        const submittedAnswer = submittedAnswerForQuestion(question, answers);
        const hasAnyAnswer = hasAnyQuestionAnswer(question, answers);
        if (isQuestionAnswered(question, answers)) answered += 1;

        if (!token || !hasAnyAnswer) {
          if (hasAnyAnswer && isLocallyCorrect(question, submittedAnswer)) {
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

      const nextResult = {
        total: activeExam.questions.length,
        correct,
        answered,
        durationSeconds: Math.max(1, Math.round(totalElapsedMs / 1000)),
      };
      setResult(nextResult);
      if (uid) {
        const historyItem: ExamHistoryItem = {
          id: `local-${activeExam.set.id}-${Date.now()}`,
          questionSetId: activeExam.set.id,
          title: activeExam.set.title,
          grade: activeExam.set.grade,
          submittedAt: new Date().toISOString(),
          total: nextResult.total,
          answered: nextResult.answered,
          correct: nextResult.correct,
          durationSeconds: nextResult.durationSeconds,
          source: "local",
        };
        writeLocalExamHistory(uid, [historyItem, ...readLocalExamHistory(uid)]);
      }
      setReviewMode(false);
    } finally {
      setSubmitting(false);
    }
  }, [activeExam, answers, result, submitting, uid]);

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
                const submittedAnswer = submittedAnswerForQuestion(question, answers);
                const isAnswered = isQuestionAnswered(question, answers);
                const isCorrect = isAnswered && isLocallyCorrect(question, submittedAnswer);
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
    const compoundPrompt = compoundPromptForQuestion(currentQuestion);
    const isCompoundQuestion = !isMultipleChoice && compoundPrompt.parts.length > 0;
    const currentSubResults = result ? subAnswerResults(currentQuestion, answers) : {};
    const correctAnswerLabel = isMultipleChoice ? correctChoiceLabel(currentQuestion) : standardAnswerText(currentQuestion);
    const submittedAnswerLabel = isMultipleChoice && currentAnswer ? submittedChoiceLabel(currentQuestion, currentAnswer) : "";

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
              {isCompoundQuestion ? compoundPrompt.lead : currentQuestion.stem}
            </h2>

            <div className="mt-5">
              <QuestionMedia imageUrls={currentQuestion.imageUrls} visualDescription={currentQuestion.visualDescription} />
            </div>

            {isMultipleChoice ? (
              <div className="mt-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {currentQuestion.choices.map((choice, index) => {
                    const letter = choiceDisplayKey(choice, index);
                    const selected = currentAnswer === letter;
                    const correctChoice = result ? isCorrectChoice(currentQuestion, choice, index) : false;
                    const wrongSelected = Boolean(result && selected && !correctChoice);

                    return (
                      <button
                        key={`${currentQuestion.id}-choice-${index}-${choice.key || "missing"}`}
                        type="button"
                        disabled={Boolean(result)}
                        onClick={() => setAnswers((items) => ({ ...items, [currentQuestion.id]: letter }))}
                        className={cn(
                          "flex min-h-24 items-center gap-4 rounded-[18px] p-5 text-left",
                          "[border:var(--nb-border)] [box-shadow:6px_6px_0_var(--nb-black)] transition-all duration-150",
                          !result && (selected ? "bg-nb-yellow" : "bg-white hover:-translate-x-0.5 hover:-translate-y-0.5"),
                          result && correctChoice && "bg-[#e9fff1] [border-color:var(--nb-green)] [box-shadow:6px_6px_0_var(--nb-green)]",
                          result && wrongSelected && "bg-[#ffe8e8] [border-color:var(--nb-red)] [box-shadow:6px_6px_0_var(--nb-red)]",
                          result && !correctChoice && !wrongSelected && "bg-white opacity-75",
                          result ? "cursor-default hover:translate-x-0 hover:translate-y-0" : ""
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full [border:3px_solid_var(--nb-black)] font-display text-[0.85rem]",
                            result && correctChoice && "bg-nb-green text-white",
                            result && wrongSelected && "bg-nb-red text-white"
                          )}
                        >
                          {result && correctChoice ? <CheckCircle2 className="h-5 w-5" /> : result && wrongSelected ? <XCircle className="h-5 w-5" /> : letter}
                        </span>
                        <span className="font-body flex-1 text-base font-bold leading-snug">{choice.text}</span>
                        {result && correctChoice ? (
                          <span className="rounded-full bg-nb-green px-3 py-1 text-xs font-black uppercase text-white">
                            Đáp án đúng
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {result && correctAnswerLabel ? (
                  <div className="mt-4 rounded-[18px] bg-[#e9fff1] p-4 text-sm font-bold leading-relaxed text-nb-black [border:var(--nb-border)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-nb-green" />
                      <span>Đáp án đúng: {correctAnswerLabel}</span>
                    </div>
                    {submittedAnswerLabel && submittedAnswerLabel !== correctAnswerLabel ? (
                      <div className="mt-2 text-[#666]">Con đã chọn: {submittedAnswerLabel}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : isCompoundQuestion ? (
              <div className="mt-6 grid grid-cols-1 gap-4">
                {compoundPrompt.parts.map((part) => {
                  const key = answerKey(currentQuestion, part);
                  const partAnswer = answers[key] ?? "";
                  const partResult = currentSubResults[part.key];
                  const hasPartResult = partResult !== undefined;

                  return (
                    <div
                      key={part.key}
                      className={cn(
                        "rounded-[18px] bg-white p-4 [border:var(--nb-border)]",
                        hasPartResult && partResult && "bg-[#e9fff1]",
                        hasPartResult && !partResult && "bg-[#fff0c8]"
                      )}
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)_auto] md:items-center">
                        <div>
                          <div className="inline-flex rounded-md bg-nb-black px-2 py-1 font-display text-[0.65rem] uppercase text-white">
                            Ý {part.label}
                          </div>
                          <div className="mt-3 whitespace-pre-line text-base font-black leading-relaxed text-nb-black">
                            {part.text}
                          </div>
                          {result && textValue(part.answerText).trim() ? (
                            <div className="mt-2 text-sm font-bold text-[#555]">
                              Đáp án chuẩn: {part.answerText}
                            </div>
                          ) : null}
                        </div>

                        <input
                          className={cn(
                            "nb-input text-base",
                            hasPartResult && partResult && "border-nb-green",
                            hasPartResult && !partResult && "border-nb-red"
                          )}
                          value={partAnswer}
                          disabled={Boolean(result)}
                          onChange={(event) => setAnswers((items) => ({ ...items, [key]: event.target.value }))}
                          placeholder={`Nhập đáp án ${part.label}`}
                        />

                        {hasPartResult ? (
                          <div className={cn("flex items-center gap-1 font-display text-[0.78rem]", partResult ? "text-nb-green" : "text-nb-red")}>
                            {partResult ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                            {partResult ? "Đúng" : "Sai"}
                          </div>
                        ) : null}
                      </div>
                    </div>
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
                  placeholder={shortAnswerPlaceholder(currentQuestion)}
                />
                {result && correctAnswerLabel ? (
                  <div className="mt-4 rounded-[18px] bg-[#e9fff1] p-4 text-sm font-bold leading-relaxed text-nb-black [border:var(--nb-border)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-nb-green" />
                      <span>Đáp án chuẩn: {correctAnswerLabel}</span>
                    </div>
                    {currentAnswer.trim() && normalizeAnswer(currentAnswer) !== normalizeAnswer(correctAnswerLabel) ? (
                      <div className="mt-2 text-[#666]">Con đã nhập: {currentAnswer}</div>
                    ) : null}
                  </div>
                ) : null}
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
            <h3 className="font-display text-sm">Đề luyện</h3>
            <NbPill color="green" icon={<FileText className="h-3 w-3" />}>
              40-60 phút
            </NbPill>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NbButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push("/practice/history")}
            icon={<History className="h-4 w-4" />}
          >
            Lịch sử
          </NbButton>
          <NbPill color="yellow" icon={<Clock3 className="h-3 w-3" />}>
            {exams.length} đề
          </NbPill>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 rounded-xl border-2 border-dashed border-nb-black/20 py-16 text-center">
          <p className="font-display text-sm text-[#666]">Đang tải đề...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="mt-5 rounded-xl border-2 border-dashed border-nb-black/20 py-16 text-center">
          <p className="font-display text-sm text-[#666]">Chưa có đề.</p>
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
                {exam.set.isAiGenerated && (
                  <NbPill color="orange" icon={<Sparkles className="h-3 w-3" />}>
                    Đề tổng hợp của melon
                  </NbPill>
                )}
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
