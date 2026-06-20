"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import { Bot, ChevronLeft, ChevronRight, Eye, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import { auth } from "@/lib/auth/firebase";
import { collections } from "@/lib/db/firestore";
import { deleteDocument, queryDocuments, setDocument, updateDocument } from "@/lib/db/firestore-helpers";
import type {
  GeneratedQuestion,
  GeneratedQuestionSet,
  ParsedChoice,
  ParsedQuestion,
  QuestionBankQuestion,
  QuestionSet,
  RubricLevel,
  StudentSubmission,
} from "@/lib/problems/types";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { PracticeExamPanel } from "@/components/problems/PracticeExamPanel";
import { QuestionMedia } from "@/components/problems/QuestionMedia";

interface SavedProblemListsProps {
  mode: "admin" | "student";
  uid?: string;
  onExerciseSessionChange?: (active: boolean) => void;
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortNewest<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

function vietnamDateKey(date = new Date()) {
  const vietnamDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = vietnamDate.getUTCFullYear();
  const month = String(vietnamDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(vietnamDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const rubricLabels: Record<RubricLevel, string> = {
  unclassified: "Chưa phân loại",
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
};

const rubricOptions = Object.entries(rubricLabels) as [RubricLevel, string][];
const questionPageSize = 12;
const listPageSize = 8;

function PaginationControls({
  currentPage,
  pageCount,
  visibleCount,
  totalCount,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  visibleCount: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  if (totalCount <= listPageSize) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs font-bold uppercase text-[#666]">
        Trang {currentPage}/{pageCount} · Hiển thị {visibleCount}/{totalCount}
      </div>
      <div className="flex gap-2">
        <NbButton
          type="button"
          variant="ghost"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="w-4 h-4" />
          Trước
        </NbButton>
        <NbButton
          type="button"
          variant="ghost"
          size="sm"
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
        >
          Sau
          <ChevronRight className="w-4 h-4" />
        </NbButton>
      </div>
    </div>
  );
}

type QuestionDraft = {
  questionNumber: number;
  section: string;
  type: QuestionBankQuestion["type"];
  stem: string;
  choicesText: string;
  answer: string;
  answerText: string;
  explanation: string;
  imageUrlsText: string;
  visualDescription: string;
  rubricLevel: RubricLevel;
};

function choicesToText(choices: ParsedChoice[]) {
  return choices.map((choice) => `${choice.key}|${choice.text}`).join("\n");
}

function choicesFromText(value: string): ParsedChoice[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, ...rest] = line.includes("|")
        ? line.split("|")
        : line.replace(/^([A-Da-d])[\).:\s-]+/, "$1|").split("|");
      return {
        key: (key || "").trim().toUpperCase(),
        text: rest.join("|").trim(),
      };
    })
    .filter((choice) => choice.key && choice.text);
}

function questionToDraft(question: QuestionBankQuestion): QuestionDraft {
  return {
    questionNumber: question.questionNumber,
    section: question.section,
    type: question.type,
    stem: question.stem,
    choicesText: choicesToText(question.choices),
    answer: question.answer,
    answerText: question.answerText,
    explanation: question.explanation,
    imageUrlsText: question.imageUrls.join("\n"),
    visualDescription: question.visualDescription,
    rubricLevel: question.rubricLevel,
  };
}

function emptyQuestionDraft(nextNumber: number): QuestionDraft {
  return {
    questionNumber: nextNumber,
    section: "Tự luận",
    type: "short_answer",
    stem: "",
    choicesText: "",
    answer: "",
    answerText: "",
    explanation: "",
    imageUrlsText: "",
    visualDescription: "",
    rubricLevel: "unclassified",
  };
}

function SubQuestionList({ question }: { question: ParsedQuestion }) {
  if (question.subQuestions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {question.subQuestions.map((subQuestion) => (
        <div key={`${question.id}-${subQuestion.label}`} className="rounded-lg border-2 border-[#ddd] bg-white p-3">
          <div className="font-bold">
            {subQuestion.label}. {subQuestion.stem}
          </div>
          {subQuestion.answerText ? (
            <div className="mt-1 font-bold text-nb-green">Đáp án: {subQuestion.answerText}</div>
          ) : null}
          {subQuestion.explanation ? (
            <div className="mt-1 text-sm font-semibold text-[#555]">{subQuestion.explanation}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function QuestionPreview({
  questions,
  editable,
  onRubricChange,
  onEditQuestion,
  onDeleteQuestion,
}: {
  questions: ParsedQuestion[];
  editable?: boolean;
  onRubricChange?: (question: QuestionBankQuestion, rubricLevel: RubricLevel) => void;
  onEditQuestion?: (question: QuestionBankQuestion) => void;
  onDeleteQuestion?: (question: QuestionBankQuestion) => void;
}) {
  const visibleQuestions = questions.slice(0, editable ? 30 : 3);
  if (visibleQuestions.length === 0) {
    return <p className="text-sm font-semibold text-[#666]">Chưa có JSON câu hỏi được lưu.</p>;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {visibleQuestions.map((question) => (
        <div key={question.id} className="rounded-lg border-2 border-[#ddd] p-3 text-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="font-bold">Câu {question.questionNumber}: {question.stem}</div>
            {editable && "rubricLevel" in question && onRubricChange ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="nb-input min-w-40 text-xs"
                  value={(question as QuestionBankQuestion).rubricLevel}
                  onChange={(event) =>
                    onRubricChange(question as QuestionBankQuestion, event.target.value as RubricLevel)
                  }
                >
                  {rubricOptions.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <NbButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onEditQuestion?.(question as QuestionBankQuestion)}
                  aria-label="Sửa câu hỏi"
                >
                  <Pencil className="w-4 h-4" />
                </NbButton>
                <NbButton
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => onDeleteQuestion?.(question as QuestionBankQuestion)}
                  aria-label="Xóa câu hỏi"
                >
                  <Trash2 className="w-4 h-4" />
                </NbButton>
              </div>
            ) : null}
          </div>
          {question.answerText || question.answer ? (
            <div className="mt-1 text-nb-green font-bold">Đáp án: {question.answerText || question.answer}</div>
          ) : null}
          <SubQuestionList question={question} />
          {question.choices.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {question.choices.map((choice) => (
                <div key={`${question.id}-${choice.key}`} className="rounded-lg border-2 border-nb-black p-2 font-bold">
                  {choice.key}. {choice.text}
                </div>
              ))}
            </div>
          ) : null}
          <QuestionMedia imageUrls={question.imageUrls} visualDescription={question.visualDescription} />
        </div>
      ))}
      {questions.length > visibleQuestions.length && (
        <p className="text-xs font-bold uppercase text-[#666]">
          Còn {questions.length - visibleQuestions.length} câu khác
        </p>
      )}
    </div>
  );
}

function QuestionEditor({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: QuestionDraft;
  onChange: (draft: QuestionDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-3 rounded-xl border-2 border-nb-black bg-nb-bg p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase">Số câu</span>
          <input
            className="nb-input text-sm"
            type="number"
            min={1}
            value={draft.questionNumber}
            onChange={(event) => onChange({ ...draft, questionNumber: Number(event.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase">Loại</span>
          <select
            className="nb-input text-sm"
            value={draft.type}
            onChange={(event) => onChange({ ...draft, type: event.target.value as QuestionDraft["type"] })}
          >
            <option value="multiple_choice">Trắc nghiệm</option>
            <option value="short_answer">Điền đáp số</option>
            <option value="essay">Tự luận</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase">Mức độ</span>
          <select
            className="nb-input text-sm"
            value={draft.rubricLevel}
            onChange={(event) => onChange({ ...draft, rubricLevel: event.target.value as RubricLevel })}
          >
            {rubricOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase">Phần</span>
          <input
            className="nb-input text-sm"
            value={draft.section}
            onChange={(event) => onChange({ ...draft, section: event.target.value })}
            placeholder="VD: Trắc nghiệm"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-[0.65rem] font-bold uppercase">Nội dung câu hỏi</span>
        <textarea
          className="nb-input min-h-28 text-sm"
          value={draft.stem}
          onChange={(event) => onChange({ ...draft, stem: event.target.value })}
        />
      </label>

      {draft.type === "multiple_choice" && (
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase">Lựa chọn, mỗi dòng dạng A|nội dung</span>
          <textarea
            className="nb-input min-h-24 text-sm"
            value={draft.choicesText}
            onChange={(event) => onChange({ ...draft, choicesText: event.target.value })}
            placeholder={"A|25 456,82\nB|25 456,83"}
          />
        </label>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase">Đáp án chọn</span>
          <input
            className="nb-input text-sm"
            value={draft.answer}
            onChange={(event) => onChange({ ...draft, answer: event.target.value })}
            placeholder="VD: B"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.65rem] font-bold uppercase">Nội dung đáp án</span>
          <input
            className="nb-input text-sm"
            value={draft.answerText}
            onChange={(event) => onChange({ ...draft, answerText: event.target.value })}
            placeholder="VD: 25 456,83"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-[0.65rem] font-bold uppercase">Giải thích ngắn</span>
        <textarea
          className="nb-input min-h-20 text-sm"
          value={draft.explanation}
          onChange={(event) => onChange({ ...draft, explanation: event.target.value })}
        />
      </label>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-[0.65rem] font-bold uppercase">Mô tả hình ảnh</span>
        <textarea
          className="nb-input min-h-20 text-sm"
          value={draft.visualDescription}
          onChange={(event) => onChange({ ...draft, visualDescription: event.target.value })}
        />
      </label>

      <label className="mt-3 flex flex-col gap-1.5">
        <span className="text-[0.65rem] font-bold uppercase">URL ảnh, mỗi dòng một ảnh</span>
        <textarea
          className="nb-input min-h-20 text-sm"
          value={draft.imageUrlsText}
          onChange={(event) => onChange({ ...draft, imageUrlsText: event.target.value })}
          placeholder="https://..."
        />
      </label>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <NbButton type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4" />
          Hủy
        </NbButton>
        <NbButton type="button" variant="secondary" size="sm" loading={saving} onClick={onSave}>
          <Save className="w-4 h-4" />
          Lưu câu
        </NbButton>
      </div>
    </div>
  );
}

export function SavedProblemLists({ mode, uid, onExerciseSessionChange }: SavedProblemListsProps) {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [questions, setQuestions] = useState<QuestionBankQuestion[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<"all" | "4" | "5">("all");
  const [rubricFilter, setRubricFilter] = useState<"all" | RubricLevel>("all");
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setDraft, setSetDraft] = useState<{ title: string; grade: number }>({ title: "", grade: 5 });
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [submissionDraft, setSubmissionDraft] = useState<{ title: string; grade: number }>({ title: "", grade: 5 });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft | null>(null);
  const [addingQuestionSetId, setAddingQuestionSetId] = useState<string | null>(null);
  const [questionPage, setQuestionPage] = useState(1);
  const [setPage, setSetPage] = useState(1);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exerciseActive, setExerciseActive] = useState(false);

  const handleExerciseSessionChange = useCallback((active: boolean) => {
    setExerciseActive(active);
    onExerciseSessionChange?.(active);
  }, [onExerciseSessionChange]);

  useEffect(() => () => onExerciseSessionChange?.(false), [onExerciseSessionChange]);

  // AI classification state
  const [classifying, setClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState<{ classified: number; total: number } | null>(null);

  // Smart exam generation state
  const [generating, setGenerating] = useState(false);
  const [generatedSets, setGeneratedSets] = useState<GeneratedQuestionSet[]>([]);
  const [, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [todayKey] = useState(() => vietnamDateKey());

  const hasGeneratedToday = useMemo(() => {
    return generatedSets.some((set) => {
      if (!set.createdAt) return false;
      return vietnamDateKey(new Date(set.createdAt)) === todayKey;
    });
  }, [generatedSets, todayKey]);

  const loadSavedProblems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "admin") {
        const [savedSets, savedQuestions, savedSubmissions] = await Promise.all([
          queryDocuments(collections.questionSets),
          queryDocuments(collections.questionBank),
          queryDocuments(collections.studentSubmissions),
        ]);
        setQuestionSets(sortNewest(savedSets));
        setQuestions(savedQuestions);
        setSubmissions(sortNewest(savedSubmissions));
      } else if (uid) {
        const savedSubmissions = await queryDocuments(
          collections.studentSubmissions,
          where("uid", "==", uid)
        );
        const [savedSets, savedQuestions, genSets, genQuestions] = await Promise.all([
          queryDocuments(collections.questionSets),
          queryDocuments(collections.questionBank),
          queryDocuments(collections.generatedQuestionSets, where("childUid", "==", uid)).catch((err) => {
            console.error("Lỗi tải generatedQuestionSets:", err);
            return [] as GeneratedQuestionSet[];
          }),
          queryDocuments(collections.generatedQuestions, where("childUid", "==", uid)).catch((err) => {
            console.error("Lỗi tải generatedQuestions:", err);
            return [] as GeneratedQuestion[];
          }),
        ]);
        setGeneratedSets(sortNewest(genSets));
        setGeneratedQuestions(genQuestions);

        // Gộp đề AI vào danh sách đề để PracticeExamPanel dùng chung.
        const genAsSets: QuestionSet[] = genSets.map((gs) => ({
          id: gs.id,
          title: gs.title,
          grade: gs.grade,
          subject: gs.subject,
          language: "vi" as const,
          sourceFiles: [],
          createdAt: gs.createdAt,
          updatedAt: gs.updatedAt,
          isAiGenerated: true,
        }));
        const genAsQuestions: QuestionBankQuestion[] = genQuestions.map((gq) => ({
          ...gq,
          sourceSetId: gq.generatedSetId,
          sourceTitle: genSets.find((s) => s.id === gq.generatedSetId)?.title ?? "Đề AI",
          sourceFiles: [],
          sourcePageRange: "",
          rubricLevel: gq.rubricLevel ?? "unclassified",
          createdBy: "ai-smart-gen",
          updatedBy: "ai-smart-gen",
          classifiedAt: gq.createdAt ?? null,
        }));

        setQuestionSets(sortNewest([...savedSets, ...genAsSets]));
        setQuestions([...savedQuestions, ...genAsQuestions]);
        setSubmissions(sortNewest(savedSubmissions));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được danh sách đề đã lưu.");
    } finally {
      setLoading(false);
    }
  }, [mode, uid]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSavedProblems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSavedProblems]);

  const questionsBySet = useMemo(() => {
    const grouped = new Map<string, QuestionBankQuestion[]>();
    questions
      .filter((question) => gradeFilter === "all" || String(question.grade) === gradeFilter)
      .filter((question) => rubricFilter === "all" || question.rubricLevel === rubricFilter)
      .forEach((question) => {
      const key = question.sourceSetId || question.questionSetId;
      const existing = grouped.get(key) ?? [];
      existing.push(question);
      grouped.set(key, existing);
    });
    grouped.forEach((items) => items.sort((a, b) => a.questionNumber - b.questionNumber));
    return grouped;
  }, [gradeFilter, questions, rubricFilter]);

  const filteredQuestionSets = useMemo(() => {
    if (gradeFilter === "all" && rubricFilter === "all") return questionSets;
    return questionSets.filter((questionSet) => (questionsBySet.get(questionSet.id)?.length ?? 0) > 0);
  }, [gradeFilter, questionSets, questionsBySet, rubricFilter]);

  const setPageCount = Math.max(1, Math.ceil(filteredQuestionSets.length / listPageSize));
  const currentSetPage = Math.min(setPage, setPageCount);
  const visibleQuestionSets = filteredQuestionSets.slice(
    (currentSetPage - 1) * listPageSize,
    currentSetPage * listPageSize
  );

  const submissionPageCount = Math.max(1, Math.ceil(submissions.length / listPageSize));
  const currentSubmissionPage = Math.min(submissionPage, submissionPageCount);
  const visibleSubmissions = submissions.slice(
    (currentSubmissionPage - 1) * listPageSize,
    currentSubmissionPage * listPageSize
  );

  const filteredQuestions = useMemo(() => {
    return questions
      .filter((question) => gradeFilter === "all" || String(question.grade) === gradeFilter)
      .filter((question) => rubricFilter === "all" || question.rubricLevel === rubricFilter)
      .sort((a, b) => {
        const titleCompare = (a.sourceTitle || "").localeCompare(b.sourceTitle || "", "vi");
        if (titleCompare !== 0) return titleCompare;
        return a.questionNumber - b.questionNumber;
      });
  }, [gradeFilter, questions, rubricFilter]);

  const questionPageCount = Math.max(1, Math.ceil(filteredQuestions.length / questionPageSize));
  const currentQuestionPage = Math.min(questionPage, questionPageCount);
  const visibleQuestions = filteredQuestions.slice(
    (currentQuestionPage - 1) * questionPageSize,
    currentQuestionPage * questionPageSize
  );

  const questionSetById = useMemo(() => {
    return new Map(questionSets.map((questionSet) => [questionSet.id, questionSet]));
  }, [questionSets]);

  function questionSetForQuestion(question: QuestionBankQuestion): QuestionSet {
    const setId = question.sourceSetId || question.questionSetId;
    return questionSetById.get(setId) ?? {
      id: setId,
      title: question.sourceTitle || setId,
      grade: question.grade,
      subject: question.subject,
      language: "vi",
      sourceFiles: question.sourceFiles ?? [],
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  async function handleRubricChange(question: QuestionBankQuestion, rubricLevel: RubricLevel) {
    const now = new Date().toISOString();
    setQuestions((items) =>
      items.map((item) =>
        item.id === question.id
          ? {
              ...item,
              rubricLevel,
              updatedAt: now,
              updatedBy: uid ?? "admin",
              classifiedAt: rubricLevel === "unclassified" ? null : now,
            }
          : item
      )
    );
    await updateDocument(collections.questionBank, question.id, {
      rubricLevel,
      updatedAt: now,
      updatedBy: uid ?? "admin",
      classifiedAt: rubricLevel === "unclassified" ? null : now,
    });
  }

  const unclassifiedCount = useMemo(
    () => questions.filter((q) => q.rubricLevel === "unclassified").length,
    [questions],
  );

  async function handleAiClassify(classifyAll: boolean) {
    setClassifying(true);
    setClassifyProgress(null);
    setError(null);

    try {
      const body = classifyAll
        ? { all: true }
        : { questionIds: filteredQuestions.filter((q) => q.rubricLevel === "unclassified").map((q) => q.id) };

      const res = await fetch("/api/v1/problems/classify-rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }

      // Phản hồi thường, ví dụ không còn câu nào cần phân loại.
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        await res.json();
        void loadSavedProblems();
        return;
      }

      // SSE streaming
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Không có dữ liệu phản hồi.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              classified: number;
              total: number;
              current?: { questionId: string; rubricLevel: RubricLevel; confidence: number; reasoning: string };
              error?: string;
            };

            setClassifyProgress({ classified: event.classified, total: event.total });

            if (event.type === "progress" && event.current) {
              const result = event.current;
              setQuestions((items) =>
                items.map((item) =>
                  item.id === result.questionId
                    ? { ...item, rubricLevel: result.rubricLevel, updatedBy: "ai-rubric-classifier", updatedAt: new Date().toISOString() }
                    : item,
                ),
              );
            }

            if (event.type === "error" && event.error) {
              console.warn("Lỗi phân loại AI:", event.error);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi phân loại AI");
    } finally {
      setClassifying(false);
      setClassifyProgress(null);
    }
  }

  function beginEditSet(questionSet: QuestionSet) {
    setEditingSetId(questionSet.id);
    setSetDraft({ title: questionSet.title, grade: questionSet.grade });
  }

  function beginEditSubmission(submission: StudentSubmission) {
    setEditingSubmissionId(submission.id);
    setSubmissionDraft({
      title: submission.title || submission.questionSet?.title || "Đề học sinh gửi",
      grade: submission.grade || submission.questionSet?.grade || 5,
    });
  }

  async function saveSubmission(submission: StudentSubmission) {
    if (!submissionDraft.title.trim()) {
      setError("Tên đề học sinh gửi không được để trống.");
      return;
    }

    setMutating(true);
    setError(null);
    const now = new Date().toISOString();
    const nextQuestionSet = submission.questionSet
      ? { ...submission.questionSet, title: submissionDraft.title.trim(), grade: submissionDraft.grade }
      : submission.questionSet;
    try {
      await updateDocument(collections.studentSubmissions, submission.id, {
        title: submissionDraft.title.trim(),
        grade: submissionDraft.grade,
        questionSet: nextQuestionSet,
        updatedAt: now,
      });
      setSubmissions((items) =>
        items.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                title: submissionDraft.title.trim(),
                grade: submissionDraft.grade,
                questionSet: nextQuestionSet,
                updatedAt: now,
              }
            : item
        )
      );
      setEditingSubmissionId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được đề học sinh gửi.");
    } finally {
      setMutating(false);
    }
  }

  async function deleteSubmission(submission: StudentSubmission) {
    const ok = window.confirm(`Xóa đề "${submission.title || submission.questionSet?.title || "Đề học sinh gửi"}"?`);
    if (!ok) return;

    setMutating(true);
    setError(null);
    try {
      await deleteDocument(collections.studentSubmissions, submission.id);
      setSubmissions((items) => items.filter((item) => item.id !== submission.id));
      setExpandedId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không xóa được đề học sinh gửi.");
    } finally {
      setMutating(false);
    }
  }

  async function saveSet(questionSet: QuestionSet) {
    if (!setDraft.title.trim()) {
      setError("Tên bộ đề không được để trống.");
      return;
    }

    setMutating(true);
    setError(null);
    const now = new Date().toISOString();
    try {
      await updateDocument(collections.questionSets, questionSet.id, {
        title: setDraft.title.trim(),
        grade: setDraft.grade,
        updatedAt: now,
      });

      const questionSetQuestions = questions.filter((question) => (question.sourceSetId || question.questionSetId) === questionSet.id);
      await Promise.all(
        questionSetQuestions.map((question) =>
          updateDocument(collections.questionBank, question.id, {
            sourceTitle: setDraft.title.trim(),
            grade: setDraft.grade,
            updatedAt: now,
            updatedBy: uid ?? "admin",
          })
        )
      );

      setQuestionSets((items) =>
        items.map((item) =>
          item.id === questionSet.id
            ? { ...item, title: setDraft.title.trim(), grade: setDraft.grade, updatedAt: now }
            : item
        )
      );
      setQuestions((items) =>
        items.map((item) =>
          (item.sourceSetId || item.questionSetId) === questionSet.id
            ? { ...item, sourceTitle: setDraft.title.trim(), grade: setDraft.grade, updatedAt: now, updatedBy: uid ?? "admin" }
            : item
        )
      );
      setEditingSetId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được bộ đề.");
    } finally {
      setMutating(false);
    }
  }

  async function deleteQuestionSet(questionSet: QuestionSet) {
    const ok = window.confirm(`Xóa bộ đề "${questionSet.title}" và toàn bộ câu hỏi bên trong?`);
    if (!ok) return;

    setMutating(true);
    setError(null);
    try {
      const questionSetQuestions = questions.filter((question) => (question.sourceSetId || question.questionSetId) === questionSet.id);
      await Promise.all([
        ...questionSetQuestions.map((question) => deleteDocument(collections.questionBank, question.id)),
        deleteDocument(collections.questionSets, questionSet.id),
      ]);
      setQuestionSets((items) => items.filter((item) => item.id !== questionSet.id));
      setQuestions((items) => items.filter((item) => (item.sourceSetId || item.questionSetId) !== questionSet.id));
      setExpandedId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không xóa được bộ đề.");
    } finally {
      setMutating(false);
    }
  }

  function beginEditQuestion(question: QuestionBankQuestion) {
    setAddingQuestionSetId(null);
    setEditingQuestionId(question.id);
    setQuestionDraft(questionToDraft(question));
  }

  function beginAddQuestion(questionSet: QuestionSet, setQuestions: QuestionBankQuestion[]) {
    const maxQuestionNumber = setQuestions.reduce((max, question) => Math.max(max, question.questionNumber), 0);
    setEditingQuestionId(null);
    setAddingQuestionSetId(questionSet.id);
    setQuestionDraft(emptyQuestionDraft(maxQuestionNumber + 1));
  }

  function cancelQuestionEditor() {
    setEditingQuestionId(null);
    setAddingQuestionSetId(null);
    setQuestionDraft(null);
  }

  async function saveQuestion(questionSet: QuestionSet) {
    if (!questionDraft?.stem.trim()) {
      setError("Nội dung câu hỏi không được để trống.");
      return;
    }

    setMutating(true);
    setError(null);
    const now = new Date().toISOString();
    const isEditing = Boolean(editingQuestionId);
    const questionId = editingQuestionId ?? `${questionSet.id}-manual-${now.replace(/\D/g, "")}`;
    const choices = choicesFromText(questionDraft.choicesText);
    const payload: QuestionBankQuestion = {
      id: questionId,
      questionSetId: questionSet.id,
      sourceSetId: questionSet.id,
      sourceTitle: questionSet.title,
      sourceFiles: questionSet.sourceFiles,
      sourcePageRange: "",
      grade: questionSet.grade,
      subject: "math",
      section: questionDraft.section.trim() || "Tự luận",
      questionNumber: Number(questionDraft.questionNumber) || 1,
      type: questionDraft.type,
      stem: questionDraft.stem.trim(),
      choices: questionDraft.type === "multiple_choice" ? choices : [],
      subQuestions: [],
      answer: questionDraft.answer.trim(),
      answerText: questionDraft.answerText.trim(),
      answerSource: questionDraft.answer.trim() || questionDraft.answerText.trim() ? "provided" : "unknown",
      explanation: questionDraft.explanation.trim(),
      imageUrls: questionDraft.imageUrlsText
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean),
      visualDescription: questionDraft.visualDescription.trim(),
      rawText: questionDraft.stem.trim(),
      confidence: isEditing ? 0.95 : 1,
      rubricLevel: questionDraft.rubricLevel,
      createdBy: uid ?? "admin",
      updatedBy: uid ?? "admin",
      classifiedAt: questionDraft.rubricLevel === "unclassified" ? null : now,
      createdAt: isEditing
        ? questions.find((question) => question.id === editingQuestionId)?.createdAt ?? now
        : now,
      updatedAt: now,
    };

    try {
      await setDocument(collections.questionBank, questionId, payload);
      setQuestions((items) => {
        const next = isEditing
          ? items.map((item) => (item.id === questionId ? payload : item))
          : [...items, payload];
        return next.sort((a, b) => a.questionNumber - b.questionNumber);
      });
      cancelQuestionEditor();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được câu hỏi.");
    } finally {
      setMutating(false);
    }
  }

  async function deleteQuestion(question: QuestionBankQuestion) {
    const ok = window.confirm(`Xóa câu ${question.questionNumber}?`);
    if (!ok) return;

    setMutating(true);
    setError(null);
    try {
      await deleteDocument(collections.questionBank, question.id);
      setQuestions((items) => items.filter((item) => item.id !== question.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không xóa được câu hỏi.");
    } finally {
      setMutating(false);
    }
  }

  return (
    <div className={exerciseActive ? "mt-0 flex flex-col gap-5" : "mt-8 flex flex-col gap-5"}>
      {!exerciseActive && (
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm">Đề đã lưu</h3>
        </div>
        <NbButton variant="ghost" size="sm" loading={loading} onClick={loadSavedProblems}>
          <RefreshCw className="w-4 h-4" />
        </NbButton>
      </div>
      )}

      {error && <p className="text-sm font-bold text-nb-red">{error}</p>}

      {mode === "student" && !exerciseActive && (
        <div className="nb-card rounded-2xl bg-gradient-to-br from-[#fff4e0] to-[#fff9ed] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="h-5 w-5 text-nb-orange" />
                <h3 className="font-display text-sm">Tự động thiết kế đề ôn tập riêng cho con</h3>
              </div>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">
                Melon sẽ thiết kế đề ôn tập cá nhân hóa dựa trên những câu làm
                đúng/sai trước đây của con để giúp con bứt phá điểm số! Câu sai sẽ
                được ôn lại, câu đúng sẽ được nâng cấp độ khó.
              </p>
              {generatedSets.length > 0 && (
                <p className="mt-2 text-xs font-bold text-[#888]">
                  Đã tạo {generatedSets.length} đề ôn tập trước đó
                </p>
              )}
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
              <NbButton
                type="button"
                variant="primary"
                size="lg"
                loading={generating}
                disabled={generating || !uid || hasGeneratedToday}
                onClick={async () => {
                  setGenerating(true);
                  setError(null);
                  try {
                    const token = await auth?.currentUser?.getIdToken();
                    if (!token) throw new Error("Chưa đăng nhập.");
                    const res = await fetch("/api/v1/practice/generate-smart-set", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error((data as { error?: string }).error || `Lỗi ${res.status}`);
                    }
                    const data = await res.json().catch(() => ({})) as { cached?: boolean; message?: string };
                    if (data.cached && data.message) {
                      setError(data.message);
                    }
                    await loadSavedProblems();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Không thể tạo đề ôn tập.");
                  } finally {
                    setGenerating(false);
                  }
                }}
              >
                <Sparkles className="h-4 w-4" />
                {hasGeneratedToday
                  ? "Đã thiết kế đề hôm nay"
                  : generating
                    ? "Đang thiết kế đề..."
                    : "Thiết kế đề cho con"}
              </NbButton>
              <p className="text-[0.7rem] font-bold text-nb-orange/80 text-center md:text-right">
                * Mỗi ngày con chỉ được thiết kế tối đa 1 đề
              </p>
            </div>
          </div>
        </div>
      )}

      {mode === "student" && (
        <PracticeExamPanel
          uid={uid}
          questionSets={questionSets}
          questions={questions}
          loading={loading}
          onSessionChange={handleExerciseSessionChange}
        />
      )}

      {mode === "admin" && (
        <div className="nb-card rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-display text-xs">
              {mode === "admin" ? "Chưa có đề." : "Chưa có đề."}
            </h4>
            <NbPill color="orange">{filteredQuestions.length} câu</NbPill>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.7rem] font-bold uppercase">Lớp</span>
              <select
                className="nb-input text-sm"
                value={gradeFilter}
                onChange={(event) => {
                  setQuestionPage(1);
                  setSetPage(1);
                  setGradeFilter(event.target.value as "all" | "4" | "5");
                }}
              >
                <option value="all">Tất cả</option>
                <option value="4">Lớp 4</option>
                <option value="5">Lớp 5</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.7rem] font-bold uppercase">Rubric</span>
              <select
                className="nb-input text-sm"
                value={rubricFilter}
                onChange={(event) => {
                  setQuestionPage(1);
                  setSetPage(1);
                  setRubricFilter(event.target.value as "all" | RubricLevel);
                }}
              >
                <option value="all">Tất cả</option>
                {rubricOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>
          {mode === "admin" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <NbButton
                variant="secondary"
                size="sm"
                loading={classifying}
                disabled={classifying || unclassifiedCount === 0}
                onClick={() => void handleAiClassify(true)}
              >
                <Bot className="w-4 h-4" />
                {classifying ? "Đang phân loại..." : `AI phân loại tất cả (${unclassifiedCount})`}
              </NbButton>
              {classifyProgress && (
                <div className="flex flex-1 flex-col gap-1 min-w-48">
                  <div className="nb-progress-track h-4">
                    <div
                      className="nb-progress-fill bg-nb-green"
                      style={{ width: `${Math.round((classifyProgress.classified / classifyProgress.total) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-[#666]">
                    {classifyProgress.classified}/{classifyProgress.total} câu
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-col gap-3">
            {filteredQuestions.length === 0 ? (
              <p className="text-sm font-semibold text-[#666]">Chưa có câu nào trong kho đề chung.</p>
            ) : (
              visibleQuestions.map((question) => {
                const questionSet = questionSetForQuestion(question);
                const isExpanded = expandedId === `question-${question.id}`;
                const isEditingQuestion = editingQuestionId === question.id;
                return (
                  <div key={question.id} className="rounded-xl border-2 border-nb-black p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold uppercase text-[#666]">
                          {question.section} · Câu {question.questionNumber} · {question.type}
                        </div>
                        <div className="mt-1 text-xs font-bold text-[#666]">
                          Bộ đề: {question.sourceTitle || questionSet.title}
                        </div>
                        <div className="mt-1 font-bold">{question.stem}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[0.7rem] font-bold uppercase text-[#666]">
                          <span>Lớp {question.grade}</span>
                          <span>
                            {question.updatedBy === "ai-rubric-classifier" && "🤖 "}
                            Mức độ: {rubricLabels[question.rubricLevel]}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {mode === "admin" ? (
                          <>
                            <select
                              className="nb-input min-w-44 text-xs"
                              value={question.rubricLevel}
                              onChange={(event) => {
                                void handleRubricChange(question, event.target.value as RubricLevel);
                              }}
                            >
                              {rubricOptions.map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                            <NbButton
                              variant="ghost"
                              size="sm"
                              onClick={() => beginEditQuestion(question)}
                              disabled={mutating}
                              aria-label="Sửa câu hỏi"
                            >
                              <Pencil className="w-4 h-4" />
                            </NbButton>
                            <NbButton
                              variant="danger"
                              size="sm"
                              onClick={() => void deleteQuestion(question)}
                              disabled={mutating}
                              aria-label="Xóa câu hỏi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </NbButton>
                          </>
                        ) : null}
                        <NbButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : `question-${question.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </NbButton>
                      </div>
                    </div>

                    <QuestionMedia imageUrls={question.imageUrls} visualDescription={question.visualDescription} />

                    {isEditingQuestion && questionDraft && (
                      <QuestionEditor
                        draft={questionDraft}
                        onChange={setQuestionDraft}
                        onCancel={cancelQuestionEditor}
                        onSave={() => void saveQuestion(questionSet)}
                        saving={mutating}
                      />
                    )}

                    {isExpanded && (
                      <div className="mt-3 rounded-lg border-2 border-[#ddd] p-3 text-sm">
                        {question.answerText || question.answer ? (
                          <div className="text-nb-green font-bold">Đáp án: {question.answerText || question.answer}</div>
                        ) : null}
                        <SubQuestionList question={question} />
                        {question.choices.length > 0 ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                            {question.choices.map((choice) => (
                              <div key={`${question.id}-${choice.key}`} className="rounded-lg border-2 border-nb-black p-2 font-bold">
                                {choice.key}. {choice.text}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {filteredQuestions.length > questionPageSize && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase text-[#666]">
                Trang {currentQuestionPage}/{questionPageCount} · Hiển thị {visibleQuestions.length}/{filteredQuestions.length} câu
              </div>
              <div className="flex gap-2">
                <NbButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={questionPage <= 1}
                  onClick={() => setQuestionPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Trước
                </NbButton>
                <NbButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={questionPage >= questionPageCount}
                  onClick={() => setQuestionPage((page) => Math.min(questionPageCount, page + 1))}
                >
                  Sau
                  <ChevronRight className="w-4 h-4" />
                </NbButton>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "admin" && (
        <div className="nb-card rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-display text-xs">Quản lý bộ đề</h4>
            <NbPill color="orange">{filteredQuestionSets.length} bộ đề</NbPill>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {filteredQuestionSets.length === 0 ? (
              <p className="text-sm font-semibold text-[#666]">Chưa có bộ đề nào.</p>
            ) : (
              visibleQuestionSets.map((questionSet) => {
                const setQuestions = questionsBySet.get(questionSet.id) ?? [];
                const isEditingSet = editingSetId === questionSet.id;
                const isAddingQuestion = addingQuestionSetId === questionSet.id;
                return (
                  <div key={questionSet.id} className="rounded-xl border-2 border-nb-black p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        {isEditingSet ? (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[0.65rem] font-bold uppercase">Tên bộ đề</span>
                              <input
                                className="nb-input text-sm"
                                value={setDraft.title}
                                onChange={(event) => setSetDraft((draft) => ({ ...draft, title: event.target.value }))}
                              />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[0.65rem] font-bold uppercase">Lớp</span>
                              <select
                                className="nb-input text-sm"
                                value={setDraft.grade}
                                onChange={(event) => setSetDraft((draft) => ({ ...draft, grade: Number(event.target.value) }))}
                              >
                                <option value={4}>Lớp 4</option>
                                <option value={5}>Lớp 5</option>
                              </select>
                            </label>
                          </div>
                        ) : (
                          <>
                            <div className="font-bold">{questionSet.title}</div>
                            <div className="mt-1 text-xs font-bold uppercase text-[#666]">
                              ID đề: {questionSet.id} · Lớp {questionSet.grade} · {setQuestions.length} câu · {formatDate(questionSet.createdAt)}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isEditingSet ? (
                          <>
                            <NbButton variant="ghost" size="sm" onClick={() => setEditingSetId(null)} disabled={mutating}>
                              <X className="w-4 h-4" />
                            </NbButton>
                            <NbButton variant="secondary" size="sm" loading={mutating} onClick={() => void saveSet(questionSet)}>
                              <Save className="w-4 h-4" />
                            </NbButton>
                          </>
                        ) : (
                          <>
                            <NbButton variant="ghost" size="sm" onClick={() => beginEditSet(questionSet)} disabled={mutating} aria-label="Sửa bộ đề">
                              <Pencil className="w-4 h-4" />
                            </NbButton>
                            <NbButton variant="danger" size="sm" onClick={() => void deleteQuestionSet(questionSet)} disabled={mutating} aria-label="Xóa bộ đề">
                              <Trash2 className="w-4 h-4" />
                            </NbButton>
                            <NbButton type="button" variant="ghost" size="sm" onClick={() => beginAddQuestion(questionSet, setQuestions)}>
                              <Plus className="w-4 h-4" />
                              Thêm câu
                            </NbButton>
                          </>
                        )}
                      </div>
                    </div>
                    {isAddingQuestion && questionDraft && (
                      <QuestionEditor
                        draft={questionDraft}
                        onChange={setQuestionDraft}
                        onCancel={cancelQuestionEditor}
                        onSave={() => void saveQuestion(questionSet)}
                        saving={mutating}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
          <PaginationControls
            currentPage={currentSetPage}
            pageCount={setPageCount}
            visibleCount={visibleQuestionSets.length}
            totalCount={filteredQuestionSets.length}
            onPageChange={setSetPage}
          />
        </div>
      )}

      <div className="nb-card rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-display text-xs">
            {mode === "admin" ? "Đề học sinh gửi" : "Đề đã lưu"}
          </h4>
          <NbPill color="green">{submissions.length} lượt lưu</NbPill>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {submissions.length === 0 ? (
            <p className="text-sm font-semibold text-[#666]">
              {mode === "admin" ? "Chưa có đề." : "Chưa có đề."}
            </p>
          ) : (
            visibleSubmissions.map((submission) => {
              const savedQuestions = submission.questions ?? [];
              const isExpanded = expandedId === `submission-${submission.id}`;
              const isEditingSubmission = editingSubmissionId === submission.id;
              return (
                <div key={submission.id} className="rounded-xl border-2 border-nb-black p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      {isEditingSubmission ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px]">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[0.65rem] font-bold uppercase">Tên đề</span>
                            <input
                              className="nb-input text-sm"
                              value={submissionDraft.title}
                              onChange={(event) => setSubmissionDraft((draft) => ({ ...draft, title: event.target.value }))}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[0.65rem] font-bold uppercase">Lớp</span>
                            <select
                              className="nb-input text-sm"
                              value={submissionDraft.grade}
                              onChange={(event) => setSubmissionDraft((draft) => ({ ...draft, grade: Number(event.target.value) }))}
                            >
                              <option value={4}>Lớp 4</option>
                              <option value={5}>Lớp 5</option>
                            </select>
                          </label>
                        </div>
                      ) : (
                        <>
                          <div className="font-bold">
                            {submission.title || submission.questionSet?.title || "Đề học sinh gửi"}
                          </div>
                          <div className="mt-1 text-xs font-bold uppercase text-[#666]">
                            {mode === "admin" ? `UID: ${submission.uid} · ` : ""}
                            Lớp {submission.grade || submission.questionSet?.grade || 5} · {submission.questionCount ?? savedQuestions.length} câu · {formatDate(submission.createdAt)}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isEditingSubmission ? (
                        <>
                          <NbButton variant="ghost" size="sm" onClick={() => setEditingSubmissionId(null)} disabled={mutating}>
                            <X className="w-4 h-4" />
                          </NbButton>
                          <NbButton variant="secondary" size="sm" loading={mutating} onClick={() => void saveSubmission(submission)}>
                            <Save className="w-4 h-4" />
                          </NbButton>
                        </>
                      ) : (
                        <>
                          <NbButton
                            variant="ghost"
                            size="sm"
                            onClick={() => beginEditSubmission(submission)}
                            disabled={mutating}
                            aria-label="Sửa đề học sinh gửi"
                          >
                            <Pencil className="w-4 h-4" />
                          </NbButton>
                          <NbButton
                            variant="danger"
                            size="sm"
                            onClick={() => void deleteSubmission(submission)}
                            disabled={mutating}
                            aria-label="Xóa đề học sinh gửi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </NbButton>
                          <NbButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setExpandedId(isExpanded ? null : `submission-${submission.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </NbButton>
                        </>
                      )}
                    </div>
                  </div>
                  {isExpanded && <QuestionPreview questions={savedQuestions} />}
                </div>
              );
            })
          )}
        </div>
        <PaginationControls
          currentPage={currentSubmissionPage}
          pageCount={submissionPageCount}
          visibleCount={visibleSubmissions.length}
          totalCount={submissions.length}
          onPageChange={setSubmissionPage}
        />
      </div>
    </div>
  );
}
