"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Lightbulb,
  PencilLine,
  RotateCcw,
  Sparkles,
  Target,
  Volume2,
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
  autoStart?: boolean;
}

type AnswerState = "idle" | "correct" | "wrong";

type CompoundPart = {
  key: string;
  label: string;
  text: string;
  answerText?: string;
  explanation?: string;
};

type FractionValue = {
  numerator: string;
  denominator: string;
};

type SessionCompletionStats = {
  attempts: number;
  correct: number;
  xp: number;
  timeSpentMs: number;
  concepts: string[];
  skills: string[];
};

type QuestionSelectionContext = {
  rotationSeed: string;
  globallyAttemptedIds: Set<string>;
  globallyAttemptedFingerprints: Set<string>;
  sourceUsageCounts: Map<string, number>;
};

const fallbackAction: PersonalizedNextAction = {
  id: "balanced",
  priority: 1,
  title: "Luyện cân bằng",
  description: "Làm vài câu để bắt đầu.",
  actionType: "mixed_practice",
  concepts: [],
  rubricLevels: ["thong_hieu", "van_dung"],
  questionCount: 5,
  reason: "Chưa có đủ dữ liệu để xác định điểm yếu rõ ràng.",
  hintMode: "available",
  uiMode: "normal",
};

const hintCachePrefix = "melon.exerciseHint.v1";

const conceptLabels: Record<string, string> = {
  arithmetic: "Số học",
  fractions: "Phân số",
  geometry: "Hình học",
  word_problems: "Toán có lời văn",
  logic: "Tư duy logic",
  mixed_exams: "Đề tổng hợp",
};

const mojibakeWindows1252Bytes: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function conceptLabel(concept: string) {
  return conceptLabels[concept] ?? concept.replace(/[_-]+/g, " ");
}

function mojibakeScore(value: string) {
  const suspicious = value.match(/[ÃÂÄÅÆÐðÑÒÓÔÕÙÝÞáºá»à¸à¹]/g)?.length ?? 0;
  const replacement = value.match(/\uFFFD/g)?.length ?? 0;
  const vietnamese = value.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu)?.length ?? 0;
  return suspicious * 3 + replacement * 6 - vietnamese;
}

function encodeWindows1252Mojibake(value: string): Uint8Array | null {
  const bytes: number[] = [];

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    const mapped = mojibakeWindows1252Bytes[char];
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }

  return new Uint8Array(bytes);
}

function repairMojibake(value: string) {
  if (!/[ÃÂÄÅÆÐðÑÒÓÔÕÙÝÞáºá»à¸à¹]/.test(value)) return value;

  const encoded = encodeWindows1252Mojibake(value);
  if (!encoded) return value;

  try {
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
    return mojibakeScore(repaired) < mojibakeScore(value) ? repaired : value;
  } catch {
    return value;
  }
}

function cleanQuestionText(value: unknown) {
  return repairMojibake(textValue(value))
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanQuestion(question: QuestionBankQuestion): QuestionBankQuestion {
  return {
    ...question,
    stem: cleanQuestionText(question.stem),
    stemMarkdown: cleanQuestionText(question.stemMarkdown),
    section: cleanQuestionText(question.section),
    answer: cleanQuestionText(question.answer),
    answerText: cleanQuestionText(question.answerText),
    answerTextMarkdown: cleanQuestionText(question.answerTextMarkdown),
    explanation: cleanQuestionText(question.explanation),
    visualDescription: cleanQuestionText(question.visualDescription),
    visualDescriptionMarkdown: cleanQuestionText(question.visualDescriptionMarkdown),
    rawText: cleanQuestionText(question.rawText),
    rawTextMarkdown: cleanQuestionText(question.rawTextMarkdown),
    sourceTitle: cleanQuestionText(question.sourceTitle),
    choices: (question.choices ?? []).map((choice) => ({
      ...choice,
      key: cleanQuestionText(choice.key),
      text: cleanQuestionText(choice.text),
      textMarkdown: cleanQuestionText(choice.textMarkdown),
    })),
    subQuestions: (question.subQuestions ?? []).map((subQuestion) => ({
      ...subQuestion,
      label: cleanQuestionText(subQuestion.label),
      stem: cleanQuestionText(subQuestion.stem),
      stemMarkdown: cleanQuestionText(subQuestion.stemMarkdown),
      answerText: cleanQuestionText(subQuestion.answerText),
      answerTextMarkdown: cleanQuestionText(subQuestion.answerTextMarkdown),
      explanation: cleanQuestionText(subQuestion.explanation),
    })),
    concepts: (question.concepts ?? []).map(cleanQuestionText).filter(Boolean),
    skills: (question.skills ?? []).map(cleanQuestionText).filter(Boolean),
  };
}

function qualityFingerprint(question: QuestionBankQuestion) {
  return searchableText([
    question.stem,
    question.choices?.map((choice) => choice.text).join(" "),
    question.answerText || question.answer,
  ].join(" "))
    .replace(/\b(cau|bai)\s*\d+[\.:)]?/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function questionQualityScore(question: QuestionBankQuestion) {
  let score = 0;
  const stem = cleanQuestionText(question.stem);
  const answer = cleanQuestionText(question.answerText || question.answer);

  if (stem.length >= 12) score += 20;
  if (stem.length > 220) score -= 6;
  if (answer) score += 16;
  if (question.type === "multiple_choice" && hasValidChoices(question)) score += 14;
  if (question.type === "short_answer") score += 8;
  if (Number(question.confidence ?? 0) > 0) score += Math.round(Number(question.confidence) * 8);
  if (hasQuestionVisual(question)) score += 4;
  if (questionReferencesVisual(question) && !hasQuestionImage(question)) score -= 35;
  score -= Math.max(0, mojibakeScore(stem));

  return score;
}

function normalizeQuestionBank(questions: QuestionBankQuestion[]) {
  const bestByFingerprint = new Map<string, QuestionBankQuestion>();

  for (const rawQuestion of questions) {
    const question = cleanQuestion(rawQuestion);
    if (!readyMathQuestion(question)) continue;

    const fingerprint = qualityFingerprint(question);
    if (fingerprint.length < 12) continue;

    const current = bestByFingerprint.get(fingerprint);
    if (!current || questionQualityScore(question) > questionQualityScore(current)) {
      bestByFingerprint.set(fingerprint, question);
    }
  }

  return Array.from(bestByFingerprint.values());
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

function fallbackCompoundLabel(index: number) {
  return String.fromCharCode(97 + index);
}

function normalizeCompoundLabel(value: unknown, index: number) {
  const fallback = fallbackCompoundLabel(index);
  const label = cleanQuestionText(value).toLowerCase();
  return label.match(/([a-z])\s*$/i)?.[1]?.toLowerCase() ?? fallback;
}

function displayCompoundLabel(value: unknown, index: number) {
  return cleanQuestionText(value).match(/([a-z])\s*$/i)?.[1] || fallbackCompoundLabel(index);
}

function subQuestionCompoundParts(question: QuestionBankQuestion): CompoundPart[] {
  return (question.subQuestions ?? [])
    .map((subQuestion, index) => ({
      key: normalizeCompoundLabel(subQuestion.label, index),
      label: displayCompoundLabel(subQuestion.label, index),
      text: cleanQuestionText(subQuestion.stemMarkdown || subQuestion.stem),
      answerText: cleanQuestionText(subQuestion.answerTextMarkdown || subQuestion.answerText),
      explanation: cleanQuestionText(subQuestion.explanation),
    }))
    .filter((part) => part.text.length > 0 || textValue(part.answerText).trim().length > 0);
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
    const key = match[1].toLowerCase();
    return {
      key,
      label: key,
      text: stem.slice(start, end).trim().replace(/[.;,]\s*$/, ""),
    };
  }).filter((part) => part.text.length > 0);

  return parts.length >= 2 ? { lead, parts } : { lead: stem, parts: [] };
}

function compoundPromptForQuestion(question: QuestionBankQuestion, stem: string) {
  const subQuestionParts = subQuestionCompoundParts(question);
  if (subQuestionParts.length > 0) {
    return { lead: stem, parts: subQuestionParts };
  }

  return splitCompoundPrompt(stem);
}

function formatCompoundAnswer(parts: CompoundPart[], answers: Record<string, string>) {
  return parts
    .map((part) => `${part.key}) ${(answers[part.key] ?? "").trim()}`)
    .join("; ");
}

function parseLabeledAnswerParts(value: unknown, labels: string[]): Record<string, string> | null {
  const text = cleanQuestionText(value);
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

function compoundAnswerResults(
  question: QuestionBankQuestion,
  parts: CompoundPart[],
  answers: Record<string, string>
): Record<string, boolean> | null {
  const labels = parts.map((part) => part.key);
  const expectedFromSubQuestions = parts.reduce<Record<string, string>>((items, part) => {
    if (textValue(part.answerText).trim()) items[part.key] = textValue(part.answerText);
    return items;
  }, {});
  const expected = Object.keys(expectedFromSubQuestions).length > 0
    ? expectedFromSubQuestions
    : parseLabeledAnswerParts(question.answerText, labels) ??
      parseLabeledAnswerParts(question.answer, labels) ??
      parseLabeledAnswerParts(question.explanation, labels);

  if (!expected) return null;

  return parts.reduce<Record<string, boolean>>((items, part) => {
    const submitted = normalizeAnswer(answers[part.key]);
    const correct = normalizeAnswer(expected[part.key]);
    if (correct) items[part.key] = submitted === correct;
    return items;
  }, {});
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

function choiceDisplayKey(choice: QuestionBankQuestion["choices"][number], index: number) {
  return choice.key || ["A", "B", "C", "D"][index] || String(index + 1);
}

function expectedChoiceKey(question: QuestionBankQuestion) {
  const expectedAnswer = normalizeAnswer(question.answer);
  if (!expectedAnswer) return "";

  const choice = (question.choices ?? []).find((item, index) => (
    normalizeAnswer(choiceDisplayKey(item, index)) === expectedAnswer
  ));
  if (!choice) return "";

  const index = question.choices.indexOf(choice);
  return normalizeAnswer(choiceDisplayKey(choice, index));
}

function emptySessionStats(): SessionCompletionStats {
  return {
    attempts: 0,
    correct: 0,
    xp: 0,
    timeSpentMs: 0,
    concepts: [],
    skills: [],
  };
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

  if (!value.includes("$$")) return <>{value}</>;
  const chunks = value.split(/(\$\$.*?\$\$)/g).filter((chunk) => chunk.length > 0);

  return (
    <>
      {chunks.map((chunk, index) => {
        const inlineMath = chunk.match(/^\$\$([\s\S]*)\$\$$/)?.[1]?.trim();
        if (!inlineMath) return <span key={`${chunk}-${index}`}>{chunk}</span>;

        const fractionMatch = inlineMath.match(/^\\frac\{(-?\d+)\}\{(-?\d+)\}$/);
        if (fractionMatch) {
          return <FractionDisplay key={`${chunk}-${index}`} numerator={fractionMatch[1]} denominator={fractionMatch[2]} />;
        }

        const exponentMatch = inlineMath.match(/^(-?\d+)\^\{(-?\d+)\}$/);
        if (exponentMatch) {
          return (
            <span key={`${chunk}-${index}`}>
              {exponentMatch[1]}
              <sup>{exponentMatch[2]}</sup>
            </span>
          );
        }

        if (inlineMath === "\\le") return <span key={`${chunk}-${index}`}>≤</span>;
        if (inlineMath === "\\ge") return <span key={`${chunk}-${index}`}>≥</span>;

        return <span key={`${chunk}-${index}`}>{inlineMath}</span>;
      })}
    </>
  );
}

function isLocallyCorrect(question: QuestionBankQuestion, answer: string) {
  const submitted = normalizeAnswer(answer);
  const expectedAnswer = normalizeAnswer(question.answer);
  const expectedText = normalizeAnswer(question.answerText);
  const expectedMarkdown = normalizeAnswer(question.answerTextMarkdown);

  if (!submitted) return false;

  const compoundPrompt = compoundPromptForQuestion(question, question.stemMarkdown || question.stem);
  const expectedSubAnswers = compoundPrompt.parts.filter((part) => textValue(part.answerText).trim());
  if (expectedSubAnswers.length > 0) {
    const labels = compoundPrompt.parts.map((part) => part.key);
    const submittedParts = parseLabeledAnswerParts(answer, labels);
    if (submittedParts) {
      return expectedSubAnswers.every((part) => (
        normalizeAnswer(submittedParts[part.key]) === normalizeAnswer(part.answerText)
      ));
    }
  }

  if (expectedAnswer && submitted === expectedAnswer) return true;

  const selectedChoice = (question.choices ?? []).find((choice, index) => (
    normalizeAnswer(choiceDisplayKey(choice, index)) === submitted ||
    normalizeAnswer(choice.text) === submitted
  ));

  const expectedKey = expectedChoiceKey(question);
  if (expectedKey) {
    if (!selectedChoice) return false;
    const index = question.choices.indexOf(selectedChoice);
    return normalizeAnswer(choiceDisplayKey(selectedChoice, index)) === expectedKey;
  }

  if (expectedText && submitted === expectedText) return true;
  if (expectedMarkdown && submitted === expectedMarkdown) return true;

  const expectedChoiceText = expectedText || expectedMarkdown;
  return Boolean(selectedChoice && expectedChoiceText && normalizeAnswer(selectedChoice.text) === expectedChoiceText);
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

function questionSourceKey(question: QuestionBankQuestion) {
  return question.sourceSetId || question.questionSetId || question.sourceTitle || "unknown";
}

function questionNumber(question: QuestionBankQuestion) {
  return Number(question.questionNumber ?? 0) || 0;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildSelectionContext(
  courseRuns: CourseRunSnapshot[],
  currentRunId?: string,
  stageId?: string,
  actionId?: string
): QuestionSelectionContext {
  const globallyAttemptedIds = new Set<string>();
  const globallyAttemptedFingerprints = new Set<string>();
  const sourceUsageCounts = new Map<string, number>();

  for (const snapshot of courseRuns) {
    if (snapshot.run.id === currentRunId) continue;
    for (const questionId of snapshot.attemptedQuestionIds ?? []) {
      globallyAttemptedIds.add(questionId);
    }
  }

  const rotationSeed = [currentRunId ?? "action", stageId ?? actionId ?? "default"].join(":");

  return {
    rotationSeed,
    globallyAttemptedIds,
    globallyAttemptedFingerprints,
    sourceUsageCounts,
  };
}

function enrichSelectionContext(
  context: QuestionSelectionContext,
  readyQuestions: QuestionBankQuestion[]
) {
  for (const question of readyQuestions) {
    if (!context.globallyAttemptedIds.has(question.id)) continue;
    context.globallyAttemptedFingerprints.add(qualityFingerprint(question));
    const source = questionSourceKey(question);
    context.sourceUsageCounts.set(source, (context.sourceUsageCounts.get(source) ?? 0) + 1);
  }
  return context;
}

function diversityScore(question: QuestionBankQuestion, context?: QuestionSelectionContext) {
  if (!context) return 0;

  const fingerprint = qualityFingerprint(question);
  const source = questionSourceKey(question);
  const sourceUsage = context.sourceUsageCounts.get(source) ?? 0;
  const globallySeen =
    context.globallyAttemptedIds.has(question.id) || context.globallyAttemptedFingerprints.has(fingerprint);
  const rotation = (hashString(`${context.rotationSeed}:${question.id}`) % 17) - 8;

  let score = 0;
  if (!globallySeen) score += 36;
  else score -= 28;
  score -= sourceUsage * 7;
  score += rotation;

  return score;
}

function rubricScore(question: QuestionBankQuestion, desiredRubrics: string[]) {
  if (desiredRubrics.length === 0) return 12;
  if (desiredRubrics.includes(question.rubricLevel)) return 18;
  if (question.rubricLevel === "unclassified") return 6;
  return -10;
}

function conceptScore(question: QuestionBankQuestion, desiredConcepts: string[]) {
  if (desiredConcepts.length === 0) return 8;
  const concepts = inferQuestionConcepts(question);
  if (concepts.length === 0) return -8;
  const hits = concepts.filter((concept) => desiredConcepts.includes(concept)).length;
  return hits > 0 ? 28 + (hits * 4) : -14;
}

function keywordScore(question: QuestionBankQuestion, keywords: string[]) {
  if (keywords.length === 0) return 8;
  const text = searchableText([
    textValue(question.stem),
    textValue(question.sourceTitle),
    textValue(question.section),
    textValue(question.visualDescription),
    textValue(question.rawText),
  ].join(" "));
  const hits = keywords.filter((keyword) => text.includes(searchableText(keyword))).length;
  return hits > 0 ? 22 + (hits * 4) : -18;
}

function questionDifficultyRank(question: QuestionBankQuestion) {
  const order: Record<string, number> = {
    nhan_biet: 1,
    thong_hieu: 2,
    van_dung: 3,
    van_dung_cao: 4,
    unclassified: 2,
  };
  return order[question.rubricLevel] ?? 2;
}

function stageQuestionScore(
  question: QuestionBankQuestion,
  filter: CourseQuestionFilter,
  courseConcept: string,
  context?: QuestionSelectionContext
) {
  let score = questionQualityScore(question);
  score += question.subject === filter.subject ? 18 : -60;
  score += Number(question.grade ?? 0) === filter.grade ? 20 : -35;
  score += rubricScore(question, filter.rubricLevels);
  score += keywordScore(question, filter.keywords);
  score += conceptScore(question, [courseConcept]);
  score += diversityScore(question, context);

  return score;
}

function actionQuestionScore(
  question: QuestionBankQuestion,
  action: PersonalizedNextAction,
  context?: QuestionSelectionContext
) {
  let score = questionQualityScore(question);
  score += rubricScore(question, action.rubricLevels);
  score += conceptScore(question, action.concepts);
  score += diversityScore(question, context);
  return score;
}

function pickRankedQuestions(
  questions: QuestionBankQuestion[],
  targetCount: number,
  scoreQuestion: (question: QuestionBankQuestion) => number,
  options?: { minScore?: number }
) {
  const ranked = questions
    .map((question) => ({ question, score: scoreQuestion(question) }))
    .filter((item) => item.score >= (options?.minScore ?? -Infinity))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const difficultyDelta = questionDifficultyRank(a.question) - questionDifficultyRank(b.question);
      if (difficultyDelta !== 0) return difficultyDelta;
      const sourceDelta = questionSourceKey(a.question).localeCompare(questionSourceKey(b.question), "vi");
      if (sourceDelta !== 0) return sourceDelta;
      if (questionNumber(a.question) !== questionNumber(b.question)) return questionNumber(a.question) - questionNumber(b.question);
      return a.question.id.localeCompare(b.question.id);
    });

  const selected: QuestionBankQuestion[] = [];
  const usedIds = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const takeQuestion = (question: QuestionBankQuestion) => {
    selected.push(question);
    usedIds.add(question.id);
    const source = questionSourceKey(question);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  };

  for (const { question } of ranked) {
    if (selected.length >= targetCount) break;
    const source = questionSourceKey(question);
    if ((sourceCounts.get(source) ?? 0) >= 2 && ranked.length > targetCount) continue;
    takeQuestion(question);
  }

  for (const { question } of ranked) {
    if (selected.length >= targetCount) break;
    if (!usedIds.has(question.id)) takeQuestion(question);
  }

  return selected;
}

function selectQuestionsForAction(
  questions: QuestionBankQuestion[],
  action: PersonalizedNextAction,
  courseRuns: CourseRunSnapshot[] = []
) {
  const targetCount = Math.max(1, action.questionCount);
  const readyQuestions = normalizeQuestionBank(questions);
  const context = enrichSelectionContext(buildSelectionContext(courseRuns, undefined, undefined, action.id), readyQuestions);
  const globallyFresh = readyQuestions.filter((question) => (
    !context.globallyAttemptedIds.has(question.id) &&
    !context.globallyAttemptedFingerprints.has(qualityFingerprint(question))
  ));
  const strict = globallyFresh.filter((question) => rubricMatchesQuestion(question, action) && conceptMatches(question, action));
  const selected = pickRankedQuestions(
    strict,
    targetCount,
    (question) => actionQuestionScore(question, action, context),
    { minScore: 30 }
  );

  if (selected.length >= targetCount) return selected;

  const selectedIds = new Set(selected.map((question) => question.id));
  const strictFallback = readyQuestions.filter((question) => (
    !selectedIds.has(question.id) &&
    rubricMatchesQuestion(question, action) &&
    conceptMatches(question, action)
  ));
  const extraStrict = pickRankedQuestions(
    strictFallback,
    targetCount - selected.length,
    (question) => actionQuestionScore(question, action, context)
  );
  const strictSelected = [...selected, ...extraStrict];

  if (strictSelected.length >= targetCount) return strictSelected;

  const strictIds = new Set(strictSelected.map((question) => question.id));
  const fallback = pickRankedQuestions(
    readyQuestions.filter((question) => !strictIds.has(question.id)),
    targetCount - strictSelected.length,
    (question) => actionQuestionScore(question, action, context)
  );

  return [...strictSelected, ...fallback];
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
  snapshot: CourseRunSnapshot,
  courseRuns: CourseRunSnapshot[] = []
) {
  const currentProgress = snapshot.run.stageProgress[snapshot.currentStage.id];
  const remainingAttempts = currentProgress?.status === "retry_required"
    ? snapshot.currentStage.minAttempts
    : Math.max(1, snapshot.currentStage.minAttempts - Number(currentProgress?.attempts ?? 0));
  const targetCount = Math.max(
    1,
    Math.min(snapshot.currentStage.questionFilter.questionCount, remainingAttempts)
  );
  const filter = snapshot.currentStage.questionFilter;
  const readyQuestions = normalizeQuestionBank(questions);
  const context = enrichSelectionContext(
    buildSelectionContext(courseRuns, snapshot.run.id, snapshot.currentStage.id),
    readyQuestions
  );
  const attemptedQuestionIds = new Set(snapshot.attemptedQuestionIds ?? []);
  const attemptedFingerprints = new Set(
    readyQuestions
      .filter((question) => attemptedQuestionIds.has(question.id))
      .map(qualityFingerprint)
  );
  const isFreshQuestion = (question: QuestionBankQuestion) => (
    !attemptedQuestionIds.has(question.id) && !attemptedFingerprints.has(qualityFingerprint(question))
  );
  const freshQuestions = readyQuestions.filter(isFreshQuestion);
  const globallyFreshStrict = freshQuestions.filter((question) => (
    !context.globallyAttemptedIds.has(question.id) &&
    !context.globallyAttemptedFingerprints.has(qualityFingerprint(question)) &&
    stageMatchesQuestion(question, filter)
  ));
  const selected = pickRankedQuestions(
    globallyFreshStrict,
    targetCount,
    (question) => stageQuestionScore(question, filter, snapshot.course.primaryConcept, context),
    { minScore: 45 }
  );

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
  const localFreshStrict = pickRankedQuestions(
    freshQuestions.filter((question) => !selectedIds.has(question.id) && stageMatchesQuestion(question, filter)),
    targetCount - selected.length,
    (question) => stageQuestionScore(question, filter, snapshot.course.primaryConcept, context)
  );
  const strictSelected = [...selected, ...localFreshStrict];
  const strictIds = new Set(strictSelected.map((question) => question.id));

  if (strictSelected.length >= targetCount) {
    return strictSelected;
  }

  const relaxedSameGrade = pickRankedQuestions(
    freshQuestions.filter((question) => Number(question.grade ?? 0) === filter.grade && !strictIds.has(question.id)),
    targetCount - strictSelected.length,
    (question) => stageQuestionScore(question, filter, snapshot.course.primaryConcept, context)
  );
  const relaxedIds = new Set([...strictIds, ...relaxedSameGrade.map((question) => question.id)]);

  if (strictSelected.length + relaxedSameGrade.length >= targetCount) {
    return [...strictSelected, ...relaxedSameGrade];
  }

  const fallback = pickRankedQuestions(
    freshQuestions.filter((question) => !relaxedIds.has(question.id)),
    targetCount - strictSelected.length - relaxedSameGrade.length,
    (question) => actionQuestionScore(question, fallbackAction, context)
  );

  const freshSelected = [...strictSelected, ...relaxedSameGrade, ...fallback];
  if (freshSelected.length >= targetCount) return freshSelected;

  const freshSelectedIds = new Set(freshSelected.map((question) => question.id));
  const repeatFallback = pickRankedQuestions(
    readyQuestions.filter((question) => !freshSelectedIds.has(question.id)),
    targetCount - freshSelected.length,
    (question) => stageQuestionScore(question, filter, snapshot.course.primaryConcept, context)
  );

  return [...freshSelected, ...repeatFallback];
}

function feedbackText(state: AnswerState, wrongCount: number, action: PersonalizedNextAction) {
  if (state === "correct") {
    if (action.actionType === "micro_lesson_then_guided_retry") {
      return "Đúng rồi! Con đã sửa được bước khó nhất.";
    }
    return "Đúng rồi!";
  }

  if (state === "wrong" && wrongCount >= 2) {
    return "Dạng này hơi khó. Mình tách bài thành từng bước nhỏ nhé.";
  }

  if (state === "wrong") {
    return "Chưa đúng ở bước này thôi. Con nhìn lại dữ kiện rồi thử thêm một lần nhé.";
  }

  return "Chọn đáp án rồi bấm Kiểm tra. Con có thể dùng nháp nếu cần.";
}

function hintCacheKey(uid: string | undefined, questionId: string, answer: string) {
  const answerHash = hashString(answer.trim().toLowerCase()).toString(36);
  return `${hintCachePrefix}:${uid ?? "guest"}:${questionId}:${answerHash}`;
}

function readHintCache(key: string) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeHintCache(key: string, value: string) {
  if (typeof window === "undefined" || !value.trim()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Cache chỉ để giảm gọi AI, bỏ qua nếu trình duyệt chặn localStorage.
  }
}

export function PersonalizedExercisePanel({
  uid,
  questions,
  loadingQuestions = false,
  onSessionChange,
  preferredCourseRunId,
  autoStart = false,
}: PersonalizedExercisePanelProps) {
  const router = useRouter();
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
  const [partResults, setPartResults] = useState<Record<string, boolean>>({});
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [hintText, setHintText] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [hintAudioUrl, setHintAudioUrl] = useState("");
  const [hintAudioLoading, setHintAudioLoading] = useState(false);
  const [hintAudioError, setHintAudioError] = useState("");
  const [scratchOpen, setScratchOpen] = useState(false);
  const [scratchText, setScratchText] = useState("");
  const hintAudioRef = useRef<HTMLAudioElement | null>(null);
  const [wrongCounts, setWrongCounts] = useState<Record<string, number>>({});
  const [sessionXp, setSessionXp] = useState(0);
  const [attemptSaving, setAttemptSaving] = useState(false);
  const [planReloadKey, setPlanReloadKey] = useState(0);
  const questionStartedAtRef = useRef(0);
  const autoStartConsumedRef = useRef(false);
  const sessionStatsRef = useRef<SessionCompletionStats>(emptySessionStats());
  const finishingSessionRef = useRef(false);

  useEffect(() => {
    if (!uid) return;

    let mounted = true;

    async function loadPlan() {
      setPlanLoading(true);
      setPlanError(null);

      try {
        const token = await auth?.currentUser?.getIdToken();
        if (!token) throw new Error("Bạn cần đăng nhập để tải tiến độ cá nhân hóa.");
        const res = await fetch(`/api/v1/progress/${uid}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
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
        const token = await auth?.currentUser?.getIdToken();
        if (!token) throw new Error("Bạn cần đăng nhập để tải khóa học cá nhân hóa.");
        const res = await fetch(`/api/v1/course-run/${uid}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Không tải được khóa học cá nhân hóa.");
        }

        if (!mounted) return;
        const nextRuns = (data.runs ?? []) as CourseRunSnapshot[];
        setCourseRuns(nextRuns);
        setActiveCourseRunId((current) => current ?? preferredCourseRunId ?? nextRuns[0]?.run.id ?? null);
      } catch (error) {
        if (!mounted) return;
        setCourseRuns([]);
        setPlanError((current) => current ?? (error instanceof Error ? error.message : "Không tải được khóa học cá nhân hóa."));
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
      return selectQuestionsForStage(questions, activeCourseRun, courseRuns);
    }
    return selectQuestionsForAction(questions, activeAction, courseRuns);
  }, [activeAction, activeCourseRun, courseRuns, questions]);

  const currentQuestion = sessionQuestions[currentIndex] ?? null;
  const displayStem = currentQuestion?.stemMarkdown || currentQuestion?.stem || "";
  const compoundPrompt = useMemo(
    () => currentQuestion ? compoundPromptForQuestion(currentQuestion, displayStem) : { lead: displayStem, parts: [] },
    [currentQuestion, displayStem]
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
    ? compoundPrompt.parts.every((part) => (partAnswers[part.key] ?? "").trim().length > 0)
    : expectsFractionAnswer
      ? fractionAnswer.numerator.trim().length > 0 && fractionAnswer.denominator.trim().length > 0
    : answer.trim().length > 0;
  const progress = sessionQuestions.length > 0
    ? Math.round((currentIndex / sessionQuestions.length) * 100)
    : 0;
  const currentWrongCount = currentQuestion ? wrongCounts[currentQuestion.id] ?? 0 : 0;
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
    setPartResults({});
    setAnswerState("idle");
    setFeedbackMessage("");
    setHintText("");
    setHintAudioUrl("");
    setHintAudioError("");
    setScratchText("");
    questionStartedAtRef.current = Date.now();
  }, []);

  const saveSessionCompletion = useCallback(async () => {
    const stats = sessionStatsRef.current;
    if (!uid || stats.attempts === 0 || finishingSessionRef.current) return;

    finishingSessionRef.current = true;
    const scorePercent = Math.round((stats.correct / stats.attempts) * 100);
    const lessonId = activeCourseRun
      ? `${activeCourseRun.run.id}_${activeCourseRun.currentStage.id}`
      : currentCoachingAction.id;
    const lessonTitle = activeCourseRun
      ? `${activeCourseRun.course.title} - ${activeCourseRun.currentStage.title}`
      : currentCoachingAction.title;
    const concepts = activeCourseRun
      ? [activeCourseRun.course.primaryConcept, ...stats.concepts]
      : stats.concepts;

    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error("Bạn cần đăng nhập để lưu tiến độ phiên học.");

      const res = await fetch("/api/v1/progress/lesson-completion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          childUid: uid,
          lessonId,
          lessonTitle,
          subject: "math",
          scorePercent,
          quizCorrect: stats.correct,
          quizTotal: stats.attempts,
          xpEarned: stats.xp,
          timeOnTaskSeconds: Math.max(1, Math.round(stats.timeSpentMs / 1000)),
          concepts: Array.from(new Set(concepts.filter(Boolean))),
          skills: Array.from(new Set(stats.skills.filter(Boolean))),
          completedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không lưu được tiến độ phiên học.");
      }
    } finally {
      finishingSessionRef.current = false;
    }
  }, [activeCourseRun, currentCoachingAction.id, currentCoachingAction.title, uid]);

  const finishSession = useCallback(async () => {
    try {
      await saveSessionCompletion();
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Không lưu được tiến độ phiên học.");
      return;
    }

    setSessionStarted(false);
    setCurrentIndex(0);
    resetQuestionState();
    sessionStatsRef.current = emptySessionStats();
    setPlanReloadKey((current) => current + 1);
    router.replace("/lessons");
  }, [resetQuestionState, router, saveSessionCompletion]);

  const startSession = useCallback((actionId?: string) => {
    if (actionId) setActiveActionId(actionId);
    setSessionStarted(true);
    setCurrentIndex(0);
    setSessionXp(0);
    setWrongCounts({});
    sessionStatsRef.current = emptySessionStats();
    resetQuestionState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resetQuestionState]);

  useEffect(() => {
    if (!autoStart || autoStartConsumedRef.current || sessionStarted) return;
    if (!uid || !activeCourseRun || loadingQuestions || courseRunsLoading) return;
    if (sessionQuestions.length === 0) return;

    autoStartConsumedRef.current = true;
    startSession();
  }, [
    activeCourseRun,
    autoStart,
    courseRunsLoading,
    loadingQuestions,
    sessionQuestions.length,
    sessionStarted,
    startSession,
    uid,
  ]);

  function nextQuestion() {
    if (currentIndex >= sessionQuestions.length - 1) {
      void finishSession();
      return;
    }

    setCurrentIndex((index) => index + 1);
    resetQuestionState();
  }

  async function loadHint(answerOverride?: string) {
    if (!currentQuestion || hintLoading) return;

    const answerForHint = answerOverride ?? submittedAnswer;
    const cacheKey = hintCacheKey(uid, currentQuestion.id, answerForHint);
    const cachedHint = readHintCache(cacheKey);
    if (cachedHint) {
      setHintText(cachedHint);
      setHintAudioUrl("");
      setHintAudioError("");
      return;
    }

    setHintLoading(true);
    setHintText("Đang mở gợi ý...");
    setHintAudioUrl("");
    setHintAudioError("");

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
          question: currentQuestion.stem,
          studentAnswer: answerForHint,
          correctAnswer: currentQuestion.answerText || currentQuestion.answer || compoundPrompt.parts
            .filter((part) => textValue(part.answerText).trim())
            .map((part) => `${part.key}) ${part.answerText}`)
            .join("; "),
          topic: currentCoachingAction.concepts.map(conceptLabel).join(", ") || currentCoachingAction.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không tạo được gợi ý.");
      }
      const guidance = data.guidance || "Đọc lại đề rồi làm từng bước.";
      writeHintCache(cacheKey, guidance);
      setHintText(guidance);
      setHintAudioUrl(data.audioUrl || "");
    } catch (err: unknown) {
      setHintText(err instanceof Error ? err.message : "Đọc lại đề rồi làm từng bước.");
      setHintAudioUrl("");
    } finally {
      setHintLoading(false);
    }
  }

  async function playHintAudio() {
    const textToSpeak = hintText.trim();
    if (!textToSpeak || hintLoading || hintAudioLoading) return;

    setHintAudioError("");
    setHintAudioLoading(true);

    try {
      let audioUrl = hintAudioUrl;
      if (!audioUrl) {
        const token = await auth?.currentUser?.getIdToken();
        if (!token) throw new Error("Bạn cần đăng nhập để nghe gợi ý.");

        const res = await fetch("/api/v1/ai/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: textToSpeak.slice(0, 1000) }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Không tạo được âm thanh.");
        }
        audioUrl = data.audioUrl || "";
        if (!audioUrl) throw new Error("Không có âm thanh để phát.");
        setHintAudioUrl(audioUrl);
      }

      hintAudioRef.current?.pause();
      const audio = new Audio(audioUrl);
      hintAudioRef.current = audio;
      await audio.play();
    } catch (error) {
      setHintAudioError(error instanceof Error ? error.message : "Không phát được gợi ý.");
    } finally {
      setHintAudioLoading(false);
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
      const nextPartResults = compoundPrompt.parts.length > 0
        ? compoundAnswerResults(currentQuestion, compoundPrompt.parts, partAnswers)
        : null;

      if (nextPartResults) {
        setPartResults(nextPartResults);
        const correctPartCount = Object.values(nextPartResults).filter(Boolean).length;
        setFeedbackMessage(
          isCorrect
            ? "Đúng hết rồi!"
            : `Đúng ${correctPartCount}/${compoundPrompt.parts.length} ý. Mình sửa những ý còn đỏ nhé.`
        );
      } else {
        setPartResults({});
        setFeedbackMessage(feedbackText(isCorrect ? "correct" : "wrong", nextWrongCount, currentCoachingAction));
      }
      const earnedXp = isCorrect ? 10 : 2;
      const questionConcepts = currentQuestion.concepts?.length
        ? currentQuestion.concepts
        : inferQuestionConcepts(currentQuestion);
      const questionSkills = currentQuestion.skills ?? [];

      sessionStatsRef.current = {
        attempts: sessionStatsRef.current.attempts + 1,
        correct: sessionStatsRef.current.correct + (isCorrect ? 1 : 0),
        xp: sessionStatsRef.current.xp + earnedXp,
        timeSpentMs: sessionStatsRef.current.timeSpentMs + timeSpentMs,
        concepts: Array.from(new Set([...sessionStatsRef.current.concepts, ...questionConcepts])),
        skills: Array.from(new Set([...sessionStatsRef.current.skills, ...questionSkills])),
      };
      setSessionXp((xp) => xp + earnedXp);

      const nextCourseRun = data.courseRun as { status?: string; currentStageId?: string } | undefined;
      const courseRunMoved = Boolean(
        activeCourseRun &&
          nextCourseRun &&
          (nextCourseRun.status === "completed" || nextCourseRun.currentStageId !== activeCourseRun.currentStage.id)
      );

      if (courseRunMoved) {
        setFeedbackMessage(nextCourseRun?.status === "completed" ? "Hoàn thành khóa." : "Hoàn thành chặng.");
        window.setTimeout(() => {
          void finishSession();
        }, 900);
        return;
      }

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
            onClick={() => void finishSession()}
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
              <h2 className="max-w-5xl whitespace-pre-line break-words font-body text-[clamp(1.15rem,2.2vw,1.65rem)] font-black leading-relaxed text-nb-black [overflow-wrap:anywhere]">
                <MathText value={compoundPrompt.parts.length > 0 ? compoundPrompt.lead : displayStem} renderSpacePairAsFraction={isFractionQuestion} />
              </h2>
              {compoundPrompt.parts.length > 0 && (
                <div className="mt-5 grid grid-cols-1 gap-3">
                  {compoundPrompt.parts.map((part) => (
                    <div key={part.key} className="rounded-[18px] bg-white p-4 [border:var(--nb-border)] [box-shadow:4px_4px_0_var(--nb-black)]">
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
                  <p className="mt-2 text-sm font-bold leading-relaxed text-nb-black">Câu này cần hình minh họa.</p>
                </div>
              )}
            </div>
          </div>

          {isMultipleChoice ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {currentQuestion.choices.map((choice, choiceIndex) => {
                const letter = choiceDisplayKey(choice, choiceIndex);
                const isSelected = answer === letter;
                const isCorrectChoice = answerState === "correct" && isSelected;
                const isWrongChoice = answerState === "wrong" && isSelected;

                return (
                  <button
                    key={`${currentQuestion.id}-choice-${choiceIndex}-${choice.key || "missing"}`}
                    type="button"
                    disabled={answerState !== "idle" || attemptSaving}
                    onClick={() => {
                      if (answerState !== "idle" || attemptSaving) return;
                      setAnswer(letter);
                      void submitAnswer(letter);
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
                      <MathText value={choice.textMarkdown || choice.text} renderSpacePairAsFraction={isFractionQuestion} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : compoundPrompt.parts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {compoundPrompt.parts.map((part) => {
                const partResult = partResults[part.key];
                const hasPartResult = partResult !== undefined;

                return (
                  <label key={part.key} className="flex flex-col gap-2">
                    <span className="text-xs font-black uppercase">Đáp án {part.label})</span>
                    <input
                      className={cn(
                        "nb-input text-base",
                        hasPartResult && partResult && "border-nb-green bg-[#e9fff1]",
                        hasPartResult && !partResult && "border-nb-red bg-[#fff0c8]"
                      )}
                      value={partAnswers[part.key] ?? ""}
                      disabled={answerState === "correct"}
                      onChange={(event) => {
                        setPartAnswers((items) => ({ ...items, [part.key]: event.target.value }));
                        if (canRetry) {
                          setAnswerState("idle");
                          setPartResults({});
                        }
                      }}
                      placeholder={`Nhập đáp án ${part.label})`}
                    />
                    {hasPartResult ? (
                      <span className={cn("text-xs font-black", partResult ? "text-nb-green" : "text-nb-red")}>
                        {partResult ? "Đúng rồi" : "Chưa đúng"}
                      </span>
                    ) : null}
                  </label>
                );
              })}
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
                    <NbButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAnswerState("idle");
                        setPartResults({});
                      }}
                    >
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
                aria-label="Mở gợi ý"
              >
                🍈
              </button>
              <span className="whitespace-nowrap rounded bg-nb-black px-1.5 py-0.5 font-display text-[0.55rem] text-nb-yellow">
                Gợi ý
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
                  {hintText ? "Gợi ý" : "Trợ giúp"}
                </span>
              </div>

              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#555]">
                {hintText || "Bấm gợi ý khi cần"}
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
                  onClick={() => void playHintAudio()}
                  disabled={!hintText || hintLoading || hintText === "Đang mở gợi ý..." || hintAudioLoading}
                  className={cn(
                    "nb-pill cursor-pointer bg-nb-green",
                    "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:[box-shadow:5px_5px_0_var(--nb-black)]",
                    "transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                  aria-label="Nghe gợi ý"
                >
                  <Volume2 className="h-3 w-3" />
                  {hintAudioLoading ? "Đang đọc..." : "Nghe"}
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

              {hintAudioError && <p className="mt-3 text-xs font-bold text-nb-red">{hintAudioError}</p>}
            </div>
          </div>

          {planError && <p className="text-sm font-bold text-nb-red">{planError}</p>}
        </div>
      </div>
    );
  }

  const waitingForSession =
    planLoading ||
    courseRunsLoading ||
    loadingQuestions ||
    (usingCourseRun ? !activeCourseRun : false) ||
    sessionQuestions.length > 0;

  return (
    <div className="flex min-h-[calc(100dvh-96px)] items-center justify-center px-6 py-12">
      <div className="max-w-md rounded-2xl border-4 border-nb-black bg-white p-6 text-center shadow-[8px_8px_0_var(--nb-black)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-nb-black bg-nb-yellow text-3xl shadow-[4px_4px_0_var(--nb-black)]">
          🍈
        </div>
        <h3 className="font-display text-sm leading-relaxed">Chưa mở được bài học</h3>
        <p className="mt-3 text-sm font-bold leading-relaxed text-[#555]">
          {planError
            ? planError
            : waitingForSession
              ? "Đang mở bài..."
              : "Chưa có câu hỏi cho chặng này."}
        </p>
      </div>
    </div>
  );
}
