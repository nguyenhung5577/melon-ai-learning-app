"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
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
import type {
  CourseQuestionFilter,
  CourseRunSnapshot,
  PersonalizedNextAction,
  StudentPersonalizedPlanRecord,
} from "@/lib/progress/types";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { QuestionMedia } from "@/components/problems/QuestionMedia";
import { cn } from "@/lib/utils";

interface PersonalizedExercisePanelProps {
  uid?: string;
  questions: QuestionBankQuestion[];
  loadingQuestions?: boolean;
  onSessionChange?: (active: boolean) => void;
  preferredCourseRunId?: string;
}

type AnswerState = "idle" | "correct" | "wrong";

type CompoundPart = {
  label: string;
  text: string;
};

type FractionValue = {
  numerator: string;
  denominator: string;
};

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
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/^(-?\d+)\s+(-?\d+)$/g, "$1/$2")
    .replace(/[.,;:]$/g, "");
}

function textValue(value: unknown) {
  return String(value ?? "");
}

function searchableText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function inferQuestionConcepts(question: QuestionBankQuestion): string[] {
  const choices = question.choices ?? [];
  const subQuestions = question.subQuestions ?? [];
  const explicit = question.concepts?.map((concept) => textValue(concept).trim()).filter(Boolean) ?? [];
  const text = searchableText([
    textValue(question.stem),
    choices.map((choice) => textValue(choice.text)).join(" "),
    subQuestions.map((subQuestion) => textValue(subQuestion.stem)).join(" "),
    textValue(question.visualDescription),
  ].join(" "));
  const concepts = new Set<string>();

  const hasArithmeticExpression =
    /(^|\s)\d[\d\s.,]*\s*([+\-x×*:])\s*\d/.test(text) ||
    text.includes("dat tinh") ||
    text.includes("tinh roi tinh") ||
    text.includes("thuc hien phep tinh");

  if (
    hasArithmeticExpression ||
    text.includes("so thap phan") ||
    text.includes("viet so") ||
    text.includes("gia tri chu so")
  ) {
    concepts.add("arithmetic");
  }

  if (
    text.includes("phan so") ||
    /\d+\s*\/\s*\d+/.test(text) ||
    text.includes("tu so") ||
    text.includes("mau so") ||
    text.includes("quy dong")
  ) {
    concepts.add("fractions");
  }

  if (
    text.includes("chu vi") ||
    text.includes("dien tich") ||
    text.includes("hinh chu nhat") ||
    text.includes("hinh vuong") ||
    text.includes("hinh tam giac")
  ) {
    concepts.add("geometry");
  }

  if (
    text.includes("bai toan") ||
    text.includes("loi van") ||
    text.includes("hoi ") ||
    text.includes("con lai") ||
    text.includes("tat ca")
  ) {
    concepts.add("word_problems");
  }

  return concepts.size > 0 ? Array.from(concepts) : explicit;
}

function splitCompoundPrompt(stem: string): { lead: string; parts: CompoundPart[] } {
  const matches = Array.from(stem.matchAll(/([a-dA-D])\)\s*/g));
  if (matches.length < 2) {
    return { lead: stem, parts: [] };
  }

  const firstIndex = matches[0].index ?? 0;
  const lead = stem.slice(0, firstIndex).trim().replace(/[:：]\s*$/, "");
  const parts = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? stem.length;
    return {
      label: match[1].toLowerCase(),
      text: stem.slice(start, end).trim().replace(/[.;,]\s*$/, ""),
    };
  }).filter((part) => part.text.length > 0);

  return parts.length >= 2 ? { lead, parts } : { lead: stem, parts: [] };
}

function formatCompoundAnswer(parts: CompoundPart[], answers: Record<string, string>) {
  return parts
    .map((part) => `${part.label}) ${(answers[part.label] ?? "").trim()}`)
    .join("; ");
}

function parseFractionValue(value: string, allowSpacePair = false): FractionValue | null {
  const text = value.trim().replace(/\s+/g, " ");
  const slashMatch = text.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (slashMatch) {
    return { numerator: slashMatch[1], denominator: slashMatch[2] };
  }

  if (!allowSpacePair) return null;

  const pairMatch = text.match(/^(-?\d+)\s+(-?\d+)$/);
  if (!pairMatch) return null;
  return { numerator: pairMatch[1], denominator: pairMatch[2] };
}

function splitFractionAnswer(value: string): FractionValue {
  const text = value.trim().replace(/\s+/g, " ");
  const slashIndex = text.indexOf("/");
  if (slashIndex >= 0) {
    return {
      numerator: text.slice(0, slashIndex).trim(),
      denominator: text.slice(slashIndex + 1).trim(),
    };
  }

  const fraction = parseFractionValue(text, true);
  return fraction ?? { numerator: text, denominator: "" };
}

function formatFractionAnswer(value: FractionValue) {
  return `${value.numerator.trim()}/${value.denominator.trim()}`;
}

function expectsSingleFractionAnswer(question: QuestionBankQuestion, hasCompoundPrompt: boolean) {
  if (question.type !== "short_answer" || (question.choices ?? []).length > 0 || hasCompoundPrompt) return false;
  const concepts = inferQuestionConcepts(question);
  if (!concepts.includes("fractions")) return false;

  const text = searchableText([
    textValue(question.stem),
    textValue(question.answer),
    textValue(question.answerText),
    textValue(question.visualDescription),
  ].join(" "));

  return (
    text.includes("phan so") ||
    text.includes("tu so") ||
    text.includes("mau so") ||
    Boolean(parseFractionValue(textValue(question.answer), true)) ||
    Boolean(parseFractionValue(textValue(question.answerText), true))
  );
}

function questionReferencesVisual(question: QuestionBankQuestion) {
  const text = searchableText(`${textValue(question.stem)} ${textValue(question.visualDescription)}`);
  return (
    text.includes("hinh o tren") ||
    text.includes("hinh tren") ||
    text.includes("hinh ve") ||
    text.includes("hinh sau") ||
    text.includes("to mau")
  );
}

function isDisplayableImageUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^data:image\//i.test(value);
}

function hasQuestionImage(question: QuestionBankQuestion) {
  return (question.imageUrls ?? []).some((url) => isDisplayableImageUrl(textValue(url).trim()));
}

function hasQuestionVisual(question: QuestionBankQuestion) {
  const hasImage = hasQuestionImage(question);
  const visualText = searchableText(textValue(question.visualDescription).trim());
  const hasDescription = Boolean(visualText) &&
    !visualText.includes("khong co hinh") &&
    !visualText.includes("khong co anh") &&
    !visualText.includes("no image") &&
    !visualText.includes("no visual");

  return hasImage || hasDescription;
}

function hasAnswerData(question: QuestionBankQuestion) {
  return Boolean(textValue(question.answer).trim() || textValue(question.answerText).trim());
}

function hasValidChoices(question: QuestionBankQuestion) {
  const choices = question.choices ?? [];
  return choices.length >= 2 &&
    choices.every((choice) => textValue(choice.key).trim() && textValue(choice.text).trim());
}

function isPracticeReadyQuestion(question: QuestionBankQuestion) {
  if (!textValue(question.stem).trim()) return false;
  if (!hasAnswerData(question)) return false;
  if (questionReferencesVisual(question) && !hasQuestionImage(question)) return false;

  if (question.type === "multiple_choice") {
    return hasValidChoices(question);
  }

  if (question.type === "short_answer") {
    return true;
  }

  return false;
}

function FractionDisplay({ numerator, denominator }: FractionValue) {
  return (
    <span
      className="inline-flex min-w-12 flex-col items-center justify-center align-middle font-display text-[1rem] leading-none text-nb-black"
      aria-label={`${numerator} phần ${denominator}`}
    >
      <span className="px-1">{numerator}</span>
      <span className="my-1 h-[3px] w-full min-w-10 rounded-full bg-nb-black" aria-hidden="true" />
      <span className="px-1">{denominator}</span>
    </span>
  );
}

function MathText({ value, renderSpacePairAsFraction = false }: { value: string; renderSpacePairAsFraction?: boolean }) {
  const fraction = parseFractionValue(value, renderSpacePairAsFraction);
  if (fraction) {
    return <FractionDisplay {...fraction} />;
  }

  return <>{value}</>;
}

function isLocallyCorrect(question: QuestionBankQuestion, answer: string) {
  const submitted = normalizeAnswer(answer);
  const expectedAnswer = normalizeAnswer(question.answer);
  const expectedText = normalizeAnswer(question.answerText);

  if (!submitted) return false;
  if (expectedAnswer && submitted === expectedAnswer) return true;
  if (expectedText && submitted === expectedText) return true;

  const selectedChoice = (question.choices ?? []).find((choice) => normalizeAnswer(choice.key) === submitted);
  return Boolean(selectedChoice && expectedText && normalizeAnswer(selectedChoice.text) === expectedText);
}

function conceptMatches(question: QuestionBankQuestion, action: PersonalizedNextAction) {
  if (action.concepts.length === 0) return true;
  const questionConcepts = inferQuestionConcepts(question);
  if (questionConcepts.length === 0) return false;
  return action.concepts.some((concept) => questionConcepts.includes(concept));
}

function rubricMatchesQuestion(question: QuestionBankQuestion, action: PersonalizedNextAction) {
  return (
    action.rubricLevels.length === 0 ||
    action.rubricLevels.includes(question.rubricLevel) ||
    question.rubricLevel === "unclassified"
  );
}

function readyMathQuestion(question: QuestionBankQuestion) {
  return question.subject === "math" && isPracticeReadyQuestion(question);
}

function questionSortScore(question: QuestionBankQuestion, action: PersonalizedNextAction) {
  const concepts = inferQuestionConcepts(question);
  const conceptHit = action.concepts.length === 0 ||
    concepts.some((concept) => action.concepts.includes(concept));
  const rubricHit = rubricMatchesQuestion(question, action);

  return {
    concept: conceptHit ? 0 : 1,
    rubric: rubricHit ? 0 : 1,
    number: Number(question.questionNumber ?? 0) || 0,
  };
}

function sortQuestionsForAction(items: QuestionBankQuestion[], action: PersonalizedNextAction) {
  return [...items].sort((a, b) => {
    const aScore = questionSortScore(a, action);
    const bScore = questionSortScore(b, action);
    if (aScore.concept !== bScore.concept) return aScore.concept - bScore.concept;
    if (aScore.rubric !== bScore.rubric) return aScore.rubric - bScore.rubric;
    if (aScore.number !== bScore.number) return aScore.number - bScore.number;
    return a.id.localeCompare(b.id);
  });
}

function selectQuestionsForAction(questions: QuestionBankQuestion[], action: PersonalizedNextAction) {
  const targetCount = Math.max(1, action.questionCount);
  const readyQuestions = questions.filter(readyMathQuestion);
  const primary = sortQuestionsForAction(
    readyQuestions.filter((question) => rubricMatchesQuestion(question, action) && conceptMatches(question, action)),
    action
  );
  const selected = primary.slice(0, targetCount);

  if (selected.length >= targetCount) return selected;

  const selectedIds = new Set(selected.map((question) => question.id));
  const fallback = sortQuestionsForAction(
    readyQuestions.filter((question) => !selectedIds.has(question.id)),
    action
  );

  return [
    ...selected,
    ...fallback.slice(0, targetCount - selected.length),
  ];
}

function keywordMatchesQuestion(question: QuestionBankQuestion, filter: CourseQuestionFilter) {
  if (filter.keywords.length === 0) return true;

  const text = searchableText([
    textValue(question.stem),
    textValue(question.sourceTitle),
    textValue(question.section),
    textValue(question.visualDescription),
    textValue(question.rawText),
  ].join(" "));

  return filter.keywords.some((keyword) => text.includes(searchableText(keyword)));
}

function stageMatchesQuestion(question: QuestionBankQuestion, filter: CourseQuestionFilter) {
  if (!readyMathQuestion(question)) return false;
  if (question.subject !== filter.subject) return false;
  if (Number(question.grade ?? 0) !== filter.grade) return false;
  if (filter.rubricLevels.length > 0 && !filter.rubricLevels.includes(question.rubricLevel)) return false;
  return keywordMatchesQuestion(question, filter);
}

function selectQuestionsForStage(
  questions: QuestionBankQuestion[],
  snapshot: CourseRunSnapshot
) {
  const targetCount = Math.max(1, snapshot.currentStage.questionFilter.questionCount);
  const primary = questions.filter((question) => stageMatchesQuestion(question, snapshot.currentStage.questionFilter));
  const selected = primary.slice(0, targetCount);

  if (selected.length >= targetCount) return selected;

  const fallbackAction: PersonalizedNextAction = {
    id: snapshot.course.id,
    priority: snapshot.run.currentStageOrder,
    title: snapshot.currentStage.title,
    description: snapshot.currentStage.description,
    actionType: "mixed_practice",
    concepts: [],
    rubricLevels: snapshot.currentStage.questionFilter.rubricLevels,
    questionCount: targetCount,
    reason: snapshot.run.personalizedReason,
    hintMode: snapshot.currentStage.hintMode,
    uiMode: snapshot.currentStage.uiMode,
  };
  const selectedIds = new Set(selected.map((question) => question.id));
  const fallback = sortQuestionsForAction(
    questions.filter((question) => readyMathQuestion(question) && !selectedIds.has(question.id)),
    fallbackAction
  );

  return [
    ...selected,
    ...fallback.slice(0, targetCount - selected.length),
  ];
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
  onSessionChange,
  preferredCourseRunId,
}: PersonalizedExercisePanelProps) {
  const [plan, setPlan] = useState<StudentPersonalizedPlanRecord | null>(null);
  const [courseRuns, setCourseRuns] = useState<CourseRunSnapshot[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [courseRunsLoading, setCourseRunsLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [activeCourseRunId, setActiveCourseRunId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [partAnswers, setPartAnswers] = useState<Record<string, string>>({});
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [hintText, setHintText] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchText, setScratchText] = useState("");
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({});
  const [sessionXp, setSessionXp] = useState(0);
  const [attemptSaving, setAttemptSaving] = useState(false);
  const [planReloadKey, setPlanReloadKey] = useState(0);
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
  }, [uid, planReloadKey]);

  useEffect(() => {
    if (!uid) return;

    let mounted = true;

    async function loadCourseRuns() {
      setCourseRunsLoading(true);

      try {
        const res = await fetch(`/api/v1/course-run/${uid}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "KhÃ´ng táº£i Ä‘Æ°á»£c khÃ³a há»c cÃ¡ nhÃ¢n hÃ³a.");
        }

        if (!mounted) return;
        const nextRuns = (data.runs ?? []) as CourseRunSnapshot[];
        setCourseRuns(nextRuns);
        setActiveCourseRunId((current) => current ?? preferredCourseRunId ?? nextRuns[0]?.run.id ?? null);
      } catch (error) {
        if (!mounted) return;
        setCourseRuns([]);
        setPlanError((current) => current ?? (error instanceof Error ? error.message : "KhÃ´ng táº£i Ä‘Æ°á»£c khÃ³a há»c cÃ¡ nhÃ¢n hÃ³a."));
      } finally {
        if (mounted) setCourseRunsLoading(false);
      }
    }

    void loadCourseRuns();

    return () => {
      mounted = false;
    };
  }, [uid, planReloadKey, preferredCourseRunId]);

  const actions = useMemo(() => {
    const items = plan?.nextBestActions?.length ? plan.nextBestActions : [fallbackAction];
    return items.slice(0, 3);
  }, [plan]);

  const activeAction = useMemo(() => {
    return actions.find((action) => action.id === activeActionId) ?? actions[0] ?? fallbackAction;
  }, [actions, activeActionId]);

  const activeCourseRun = useMemo(() => {
    return courseRuns.find((snapshot) => snapshot.run.id === activeCourseRunId) ?? courseRuns[0] ?? null;
  }, [courseRuns, activeCourseRunId]);

  const usingCourseRun = Boolean(activeCourseRun);
  const currentCoachingAction = useMemo<PersonalizedNextAction>(() => {
    if (!activeCourseRun) return activeAction;

    return {
      id: activeCourseRun.currentStage.id,
      priority: activeCourseRun.run.currentStageOrder,
      title: activeCourseRun.currentStage.title,
      description: activeCourseRun.currentStage.description,
      actionType: "mixed_practice",
      concepts: activeCourseRun.course.conceptLabels,
      rubricLevels: activeCourseRun.currentStage.questionFilter.rubricLevels,
      questionCount: activeCourseRun.currentStage.questionFilter.questionCount,
      reason: activeCourseRun.run.personalizedReason,
      hintMode: activeCourseRun.currentStage.hintMode,
      uiMode: activeCourseRun.currentStage.uiMode,
    };
  }, [activeAction, activeCourseRun]);

  const sessionQuestions = useMemo(() => {
    if (activeCourseRun) {
      return selectQuestionsForStage(questions, activeCourseRun);
    }
    return selectQuestionsForAction(questions, activeAction);
  }, [activeAction, activeCourseRun, questions]);

  const currentQuestion = sessionQuestions[currentIndex] ?? null;
  const compoundPrompt = useMemo(
    () => splitCompoundPrompt(currentQuestion?.stem ?? ""),
    [currentQuestion?.stem]
  );
  const currentQuestionConcepts = useMemo(
    () => currentQuestion ? inferQuestionConcepts(currentQuestion) : [],
    [currentQuestion]
  );
  const expectsFractionAnswer = Boolean(
    currentQuestion && expectsSingleFractionAnswer(currentQuestion, compoundPrompt.parts.length > 0)
  );
  const fractionAnswer = splitFractionAnswer(answer);
  const submittedAnswer = compoundPrompt.parts.length > 0
    ? formatCompoundAnswer(compoundPrompt.parts, partAnswers)
    : expectsFractionAnswer
      ? formatFractionAnswer(fractionAnswer)
    : answer;
  const hasSubmittedAnswer = compoundPrompt.parts.length > 0
    ? compoundPrompt.parts.every((part) => (partAnswers[part.label] ?? "").trim().length > 0)
    : expectsFractionAnswer
      ? fractionAnswer.numerator.trim().length > 0 && fractionAnswer.denominator.trim().length > 0
    : answer.trim().length > 0;
  const progress = sessionQuestions.length > 0
    ? Math.round((currentIndex / sessionQuestions.length) * 100)
    : 0;
  const currentWrongCount = currentQuestion ? wrongCounts[currentQuestion.id] ?? 0 : 0;
  const activeStageProgress = activeCourseRun
    ? activeCourseRun.run.stageProgress[activeCourseRun.currentStage.id] ?? null
    : null;

  useEffect(() => {
    if (courseRuns.length === 0) {
      setActiveCourseRunId(null);
      return;
    }

    const preferredExists = preferredCourseRunId && courseRuns.some((snapshot) => snapshot.run.id === preferredCourseRunId);
    if (preferredExists && activeCourseRunId !== preferredCourseRunId) {
      setActiveCourseRunId(preferredCourseRunId);
      return;
    }

    if (!activeCourseRunId || !courseRuns.some((snapshot) => snapshot.run.id === activeCourseRunId)) {
      setActiveCourseRunId(preferredCourseRunId && preferredExists ? preferredCourseRunId : courseRuns[0].run.id);
    }
  }, [activeCourseRunId, courseRuns, preferredCourseRunId]);

  useEffect(() => {
    onSessionChange?.(sessionStarted && Boolean(currentQuestion));
  }, [currentQuestion, onSessionChange, sessionStarted]);

  useEffect(() => () => onSessionChange?.(false), [onSessionChange]);

  const resetQuestionState = useCallback(() => {
    setAnswer("");
    setPartAnswers({});
    setAnswerState("idle");
    setFeedbackMessage("");
    setHintText("");
    setScratchText("");
    questionStartedAtRef.current = Date.now();
  }, []);

  const finishSession = useCallback(() => {
    setSessionStarted(false);
    setCurrentIndex(0);
    resetQuestionState();
    setPlanReloadKey((current) => current + 1);
  }, [resetQuestionState]);

  function startSession(actionId?: string) {
    if (actionId) setActiveActionId(actionId);
    setSessionStarted(true);
    setCurrentIndex(0);
    setSessionXp(0);
    setWrongCounts({});
    resetQuestionState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextQuestion() {
    if (currentIndex >= sessionQuestions.length - 1) {
      finishSession();
      return;
    }

    setCurrentIndex((index) => index + 1);
    resetQuestionState();
  }

  async function loadHint(answerOverride?: string) {
    if (!currentQuestion || hintLoading) return;

    setHintLoading(true);
    setHintText("Cosmo đang tách bài thành các bước nhỏ...");

    try {
      const res = await fetch("/api/v1/exercise/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.stem,
          studentAnswer: answerOverride ?? submittedAnswer,
          correctAnswer: currentQuestion.answerText || currentQuestion.answer,
          topic: currentCoachingAction.concepts.map(conceptLabel).join(", ") || currentCoachingAction.title,
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

  async function submitAnswer(answerOverride?: string) {
    const answerToSubmit = answerOverride ?? submittedAnswer;
    const hasAnswerToSubmit = answerOverride ? answerOverride.trim().length > 0 : hasSubmittedAnswer;
    if (!currentQuestion || attemptSaving || !hasAnswerToSubmit) return;

    setAttemptSaving(true);
    setPlanError(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Con cần đăng nhập để lưu kết quả luyện tập.");
      }

      const now = new Date().getTime();
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
          submittedAnswer: answerToSubmit,
          timeSpentMs,
          startedAt: new Date(startedAtMs).toISOString(),
          source: "question_bank",
          courseId: activeCourseRun?.course.id,
          courseRunId: activeCourseRun?.run.id,
          pipelineId: activeCourseRun?.pipeline.id,
          stageId: activeCourseRun?.currentStage.id,
          stageTitle: activeCourseRun?.currentStage.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không lưu được kết quả làm bài.");
      }

      const isCorrect = Boolean(data.isCorrect ?? isLocallyCorrect(currentQuestion, answerToSubmit));
      const nextWrongCount = isCorrect ? currentWrongCount : currentWrongCount + 1;

      if (!isCorrect) {
        setWrongCounts((items) => ({
          ...items,
          [currentQuestion.id]: nextWrongCount,
        }));
      }

      setAnswerState(isCorrect ? "correct" : "wrong");
      setFeedbackMessage(feedbackText(isCorrect ? "correct" : "wrong", nextWrongCount, currentCoachingAction));
      setSessionXp((xp) => xp + (isCorrect ? 10 : 2));

      if (!isCorrect && (currentCoachingAction.hintMode === "step_by_step" || nextWrongCount >= 2)) {
        void loadHint(answerToSubmit);
      }

      if (currentQuestion.type === "multiple_choice") {
        window.setTimeout(() => {
          if (isCorrect) {
            nextQuestion();
            return;
          }

          setAnswer("");
          setAnswerState("idle");
          setFeedbackMessage("");
        }, isCorrect ? 900 : 1500);
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
    const isFractionQuestion = currentQuestionConcepts.includes("fractions");
    const visualMissing = questionReferencesVisual(currentQuestion) && !hasQuestionVisual(currentQuestion);

    function updateFractionAnswer(part: keyof FractionValue, value: string) {
      const next = { ...fractionAnswer, [part]: value };
      setAnswer(formatFractionAnswer(next));
      if (canRetry) setAnswerState("idle");
    }

    return (
      <div className="flex min-h-dvh flex-col bg-nb-bg">
        <div className="flex flex-wrap items-center gap-4 bg-white px-6 py-4 [border-bottom:var(--nb-border)]">
          <NbButton
            type="button"
            variant="danger"
            size="sm"
            onClick={finishSession}
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
          >
            Thoát
          </NbButton>

          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-[0.75rem] text-nb-black">{currentCoachingAction.title}</span>
              <span className="font-display text-[0.75rem] text-nb-orange">
                {currentIndex + 1}/{sessionQuestions.length}
              </span>
            </div>
            <div className="nb-progress-track h-[18px]">
              <div
                className="nb-progress-fill h-full"
                style={{
                  background: "linear-gradient(90deg, var(--nb-green) 0%, var(--nb-blue) 100%)",
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          <NbPill color="yellow" icon={<Zap className="h-3 w-3" />}>
            {sessionXp} xp
          </NbPill>
        </div>

        <div className="flex flex-1 flex-col gap-8 px-6 py-8">
          <div
            className={cn(
              "grid gap-5",
              (hasQuestionVisual(currentQuestion) || visualMissing) && "lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)] lg:items-start"
            )}
          >
            <div>
              <div className="mb-2 font-display text-[0.7rem] uppercase tracking-widest text-[#888]">
                Câu hỏi
              </div>
              <h2 className="max-w-5xl font-display text-[clamp(1.15rem,2.2vw,1.65rem)] leading-relaxed text-nb-black">
                {compoundPrompt.parts.length > 0 ? compoundPrompt.lead : currentQuestion.stem}
              </h2>
              {compoundPrompt.parts.length > 0 && (
                <div className="mt-5 grid grid-cols-1 gap-3">
                  {compoundPrompt.parts.map((part) => (
                    <div key={part.label} className="rounded-[18px] bg-white p-4 [border:var(--nb-border)] [box-shadow:4px_4px_0_var(--nb-black)]">
                      <span className="mr-3 font-display text-[0.75rem] uppercase text-nb-orange">{part.label})</span>
                      <span className="font-body text-base font-bold leading-relaxed">
                        <MathText value={part.text} renderSpacePairAsFraction={isFractionQuestion} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <QuestionMedia imageUrls={currentQuestion.imageUrls} visualDescription={currentQuestion.visualDescription} />
              {visualMissing && (
                <div className="rounded-[18px] bg-[#fff0c8] p-4 [border:var(--nb-border)] [box-shadow:4px_4px_0_var(--nb-black)]">
                  <div className="font-display text-[0.7rem] uppercase tracking-widest text-[#777]">
                    Cần hình minh họa
                  </div>
                  <p className="mt-2 text-sm font-bold leading-relaxed text-nb-black">
                    Câu này nhắc tới hình ở trên, nhưng hệ thống chưa nhận được ảnh/hình rõ ràng. Con nên mở gợi ý hoặc báo lại để thêm hình.
                  </p>
                </div>
              )}
            </div>
          </div>

          {isMultipleChoice ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {currentQuestion.choices.map((choice, choiceIndex) => {
                const letter = choice.key || ["A", "B", "C", "D"][choiceIndex] || String(choiceIndex + 1);
                const isSelected = answer === choice.key;
                const isCorrectChoice = answerState === "correct" && isSelected;
                const isWrongChoice = answerState === "wrong" && isSelected;

                return (
                  <button
                    key={`${currentQuestion.id}-${choice.key}`}
                    type="button"
                    disabled={answerState !== "idle" || attemptSaving}
                    onClick={() => {
                      if (answerState !== "idle" || attemptSaving) return;
                      setAnswer(choice.key);
                      void submitAnswer(choice.key);
                    }}
                    className={cn(
                      "flex min-h-24 items-center gap-4 rounded-[18px] p-5 text-left",
                      "cursor-pointer select-none transition-all duration-150 [border:var(--nb-border)] [box-shadow:6px_6px_0_var(--nb-black)]",
                      "hover:not(:disabled):-translate-x-0.5 hover:not(:disabled):-translate-y-0.5 hover:not(:disabled):[box-shadow:9px_9px_0_var(--nb-black)]",
                      "active:not(:disabled):translate-x-0.5 active:not(:disabled):translate-y-0.5",
                      isCorrectChoice && "bg-nb-green [border-color:var(--nb-green)] [box-shadow:6px_6px_0_var(--nb-green)]",
                      isWrongChoice && "bg-nb-red [border-color:#ff4d4d] [box-shadow:6px_6px_0_#ff4d4d]",
                      !isSelected && "bg-white",
                      isSelected && answerState === "idle" && "bg-nb-yellow",
                      "disabled:cursor-not-allowed disabled:opacity-65"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full [border:3px_solid_var(--nb-black)]",
                        "font-display text-[0.85rem]",
                        isCorrectChoice ? "bg-white text-nb-green" : "bg-nb-bg text-nb-black"
                      )}
                    >
                      {isCorrectChoice ? <Check className="h-4 w-4" /> : isWrongChoice ? <X className="h-4 w-4 text-white" /> : letter}
                    </span>
                    <span className="font-body flex-1 text-base font-bold leading-snug">
                      <MathText value={choice.text} renderSpacePairAsFraction={isFractionQuestion} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : compoundPrompt.parts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {compoundPrompt.parts.map((part) => (
                <label key={part.label} className="flex flex-col gap-2">
                  <span className="text-xs font-black uppercase">Đáp án {part.label})</span>
                  <input
                    className="nb-input text-base"
                    value={partAnswers[part.label] ?? ""}
                    disabled={answerState === "correct"}
                    onChange={(event) => {
                      setPartAnswers((items) => ({ ...items, [part.label]: event.target.value }));
                      if (canRetry) setAnswerState("idle");
                    }}
                    placeholder={`Nhập đáp án ${part.label})`}
                  />
                </label>
              ))}
            </div>
          ) : expectsFractionAnswer ? (
            <div className="max-w-md">
              <div className="mb-3 font-display text-[0.7rem] uppercase tracking-widest text-[#888]">
                Đáp án của con
              </div>
              <div className="rounded-[20px] bg-white p-5 [border:var(--nb-border)] [box-shadow:6px_6px_0_var(--nb-black)]">
                <div className="flex items-center justify-center gap-5">
                  <div className="flex flex-col items-center rounded-2xl bg-nb-bg px-6 py-4 [border:var(--nb-border)]">
                    <label className="flex flex-col items-center gap-1">
                      <span className="text-[0.6rem] font-black uppercase text-[#666]">Tử số</span>
                      <input
                        className="h-11 w-28 border-0 bg-transparent text-center font-display text-xl outline-none"
                        value={fractionAnswer.numerator}
                        disabled={answerState === "correct"}
                        inputMode="numeric"
                        onChange={(event) => updateFractionAnswer("numerator", event.target.value)}
                        aria-label="Tử số"
                      />
                    </label>
                    <div className="my-1 h-[4px] w-32 rounded-full bg-nb-black" aria-hidden="true" />
                    <label className="flex flex-col items-center gap-1">
                      <input
                        className="h-11 w-28 border-0 bg-transparent text-center font-display text-xl outline-none"
                        value={fractionAnswer.denominator}
                        disabled={answerState === "correct"}
                        inputMode="numeric"
                        onChange={(event) => updateFractionAnswer("denominator", event.target.value)}
                        aria-label="Mẫu số"
                      />
                      <span className="text-[0.6rem] font-black uppercase text-[#666]">Mẫu số</span>
                    </label>
                  </div>
                  <div className="text-sm font-bold leading-relaxed text-[#555]">
                    Viết phân số chỉ phần được tô màu.
                  </div>
                </div>
              </div>
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

          {!isMultipleChoice && (
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
                      {feedbackMessage || feedbackText(answerState, currentWrongCount, currentCoachingAction)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {answerState !== "correct" && (
                    <NbButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void submitAnswer()}
                      loading={attemptSaving}
                      disabled={!hasSubmittedAnswer}
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
          )}

          <div className="mt-auto flex items-end gap-4">
            <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={() => void loadHint()}
                className="ai-float flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-nb-purple to-nb-blue text-3xl [border:4px_solid_var(--nb-black)] [box-shadow:4px_4px_0_var(--nb-black)]"
                aria-label="Gợi ý Cosmo"
              >
                🍈
              </button>
              <span className="whitespace-nowrap rounded bg-nb-black px-1.5 py-0.5 font-display text-[0.55rem] text-nb-yellow">
                Cosmo
              </span>
            </div>

            <div
              className={cn(
                "flex-1 rounded-[20px_20px_20px_4px] bg-white p-4 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]",
                hintText && "bg-gradient-to-br from-[#fff9ed] to-[#fff0c8] [border-color:var(--nb-yellow)] [box-shadow:8px_8px_0_var(--nb-orange)]"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full [border:2px_solid_var(--nb-black)]",
                    hintText ? "bg-nb-orange" : "bg-nb-green"
                  )}
                />
                <span className="font-display text-[0.65rem] uppercase tracking-widest text-[#888]">
                  {hintText ? "Hint" : "Cosmo"}
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#555]">
                {hintText || "Cần gợi ý thì hỏi Cosmo nhé!"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadHint()}
                  disabled={hintLoading}
                  className={cn(
                    "nb-pill cursor-pointer bg-nb-yellow",
                    "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:5px_5px_0_var(--nb-black)]",
                    "transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <Lightbulb className="h-3 w-3" />
                  {hintLoading ? "Đang tải..." : "Gợi ý"}
                </button>
                <button
                  type="button"
                  onClick={() => setScratchOpen((open) => !open)}
                  className="nb-pill cursor-pointer bg-nb-blue hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150"
                >
                  <PencilLine className="h-3 w-3" />
                  Nháp
                </button>
              </div>

              {scratchOpen && (
                <textarea
                  className="nb-input mt-4 min-h-28 text-sm"
                  value={scratchText}
                  onChange={(event) => setScratchText(event.target.value)}
                  placeholder="Viết phép tính, dữ kiện hoặc bước giải ở đây"
                />
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

      {usingCourseRun && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {courseRuns.slice(0, 3).map((snapshot) => {
              const matches = selectQuestionsForStage(questions, snapshot).length;
              const selected = snapshot.run.id === activeCourseRun?.run.id;

              return (
                <button
                  key={snapshot.run.id}
                  type="button"
                  onClick={() => {
                    setActiveCourseRunId(snapshot.run.id);
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
                      Khóa {snapshot.course.grade}
                    </span>
                    <span className="text-[0.7rem] font-black uppercase text-nb-orange">
                      {matches} câu
                    </span>
                  </div>
                  <div className="mt-2 font-black leading-snug">{snapshot.course.title}</div>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">
                    {snapshot.currentStage.title}: {snapshot.currentStage.description}
                  </p>
                </button>
              );
            })}
          </div>

          {activeCourseRun && (
            <div className="mt-5 rounded-xl border-2 border-nb-black bg-[#fff9ed] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase text-[#666]">Khóa đang theo</div>
                  <h4 className="mt-1 font-display text-[0.95rem] leading-snug">
                    {activeCourseRun.course.title}
                  </h4>
                  <p className="mt-2 text-sm font-bold leading-relaxed">{activeCourseRun.run.personalizedReason}</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">
                    Chặng hiện tại: {activeCourseRun.currentStage.title}. {activeCourseRun.currentStage.supportText}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeCourseRun.course.conceptLabels.map((concept) => (
                      <NbPill key={concept} color="orange">
                        {conceptLabel(concept)}
                      </NbPill>
                    ))}
                    {activeCourseRun.currentStage.questionFilter.rubricLevels.map((rubric) => (
                      <NbPill key={rubric} color="green">
                        {rubricLabels[rubric] ?? rubric}
                      </NbPill>
                    ))}
                    <NbPill color="yellow">
                      {activeStageProgress ? `${activeStageProgress.accuracy}% đúng` : "Chưa có lượt làm"}
                    </NbPill>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {activeCourseRun.pipeline.stages.map((stage, index) => {
                      const progressItem = activeCourseRun.run.stageProgress[stage.id];
                      const isCurrent = stage.id === activeCourseRun.currentStage.id;
                      const statusLabel =
                        progressItem?.status === "mastered" ? "Đã xong"
                          : progressItem?.status === "retry_required" ? "Cần ôn lại"
                            : isCurrent ? "Đang học"
                              : progressItem ? "Đã mở" : "Chưa tới";

                      return (
                        <div
                          key={stage.id}
                          className={cn(
                            "rounded-lg border-2 border-nb-black bg-white p-3 [box-shadow:3px_3px_0_var(--nb-black)]",
                            isCurrent && "bg-nb-yellow"
                          )}
                        >
                          <div className="text-[0.65rem] font-black uppercase text-[#666]">Chặng {index + 1}</div>
                          <div className="mt-1 text-sm font-black leading-snug">{stage.title}</div>
                          <div className="mt-2 text-[0.7rem] font-semibold text-[#555]">{statusLabel}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <NbButton
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={() => startSession()}
                  loading={planLoading || courseRunsLoading || loadingQuestions}
                  disabled={sessionQuestions.length === 0}
                >
                  Vào chặng này
                  <ChevronRight className="h-4 w-4" />
                </NbButton>
              </div>

              {sessionQuestions.length === 0 && !planLoading && !courseRunsLoading && !loadingQuestions && (
                <p className="mt-3 text-sm font-bold text-nb-red">
                  Chưa chọn đủ câu hỏi phù hợp cho chặng này từ kho Firebase. Hãy bổ sung thêm câu cùng lớp, cùng rubric hoặc cùng từ khóa.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!usingCourseRun && (
      <>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {actions.map((action) => {
          const matches = selectQuestionsForAction(questions, action).length;
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
            Kho đề chưa có câu đủ dữ liệu cho bước này. Admin cần bổ sung ảnh/đáp án, gắn rubric/concept hoặc nhập thêm câu cùng chủ đề.
          </p>
        )}
      </div>
      </>
      )}
    </div>
  );
}
