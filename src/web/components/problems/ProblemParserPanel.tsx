"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileText, Languages, Save, Upload } from "lucide-react";
import { collections } from "@/lib/db/firestore";
import { setDocument } from "@/lib/db/firestore-helpers";
import { uploadFile } from "@/lib/storage/upload";
import type { ProblemParseResponse, ProblemParseResult, ProblemParseSet } from "@/lib/problems/types";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { QuestionMedia } from "@/components/problems/QuestionMedia";
import { cn } from "@/lib/utils";

interface ProblemParserPanelProps {
  mode: "admin" | "student";
  uid?: string;
}

const questionTypeLabels = {
  multiple_choice: "Trắc nghiệm",
  short_answer: "Điền đáp số",
  essay: "Tự luận",
} as const;

function errorMessageFromResponse(data: unknown): string {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "Không đọc được đề";

  const record = data as Record<string, unknown>;
  const detail = record.detail;
  const error = record.error;
  if (typeof detail === "string") return detail;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(detail ?? error ?? data, null, 2);
  } catch {
    return "Không đọc được đề";
  }
}

function fallbackId(prefix: string, index: number) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${index + 1}-${random}`;
}

function safeDocumentId(value: string | undefined, fallback: string) {
  const normalized = (value ?? "")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function ensureParseResultIds<T extends ProblemParseResult>(parsedResult: T, resultIndex: number): T {
  const questionSetId = safeDocumentId(parsedResult.questionSet.id, fallbackId("question-set", resultIndex));
  const seenQuestionIds = new Map<string, number>();

  return {
    ...parsedResult,
    questionSet: {
      ...parsedResult.questionSet,
      id: questionSetId,
    },
    questions: parsedResult.questions.map((question, questionIndex) => {
      const baseQuestionId = safeDocumentId(
        question.id,
        `${questionSetId}-cau-${question.questionNumber || questionIndex + 1}-${questionIndex + 1}`
      );
      const seenCount = seenQuestionIds.get(baseQuestionId) ?? 0;
      seenQuestionIds.set(baseQuestionId, seenCount + 1);
      const questionId = seenCount > 0 ? `${baseQuestionId}-${seenCount + 1}` : baseQuestionId;

      return {
        ...question,
        id: questionId,
        questionSetId,
      };
    }),
  };
}

export function ProblemParserPanel({ mode, uid }: ProblemParserPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [pageRange, setPageRange] = useState("");
  const [grade, setGrade] = useState(5);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [results, setResults] = useState<ProblemParseResult[]>([]);
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [showAnswers, setShowAnswers] = useState(mode === "admin");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const result = results[activeResultIndex] ?? null;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected);
    setError(null);
    setSaveMessage(null);
    setSourceUrls([]);
  }

  function normalizeParseResponse(data: ProblemParseResponse): ProblemParseResult[] {
    if ("sets" in data) {
      return data.sets;
    }
    return [data];
  }

  async function parseProblems() {
    if (!text.trim() && files.length === 0) return;

    setLoading(true);
    setUploading(false);
    setUploadProgress(0);
    setError(null);
    setSaveMessage(null);
    setResults([]);
    setActiveResultIndex(0);

    try {
      const response =
        files.length > 0
          ? await fetch("/api/v1/problems/parse", {
              method: "POST",
              body: (() => {
                const formData = new FormData();
                files.forEach((file) => formData.append("files", file, file.name));
                formData.append("text", text);
                formData.append("grade", String(grade));
                formData.append("subject", "math");
                formData.append("language", "vi");
                formData.append("pageRange", pageRange);
                formData.append("parseAllSets", "true");
                formData.append("questionSetTitle", title);
                return formData;
              })(),
            })
          : await fetch("/api/v1/problems/parse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sourceType: "text",
                text,
                grade,
                subject: "math",
                language: "vi",
                pageRange,
                questionSetTitle: title,
              }),
            });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(errorMessageFromResponse(data));
      }

      const parsedResults = normalizeParseResponse(data as ProblemParseResponse).map((parsedResult, resultIndex) =>
        ensureParseResultIds(
          {
            ...parsedResult,
            questionSet: {
              ...parsedResult.questionSet,
              sourceFiles: parsedResult.questionSet.sourceFiles.length > 0
                ? parsedResult.questionSet.sourceFiles
                : files.map((file) => file.name),
            },
          },
          resultIndex
        )
      );
      setResults(parsedResults);
      setActiveResultIndex(0);
      setShowAnswers(mode === "admin");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Không đọc được đề");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  async function saveResult() {
    if (results.length === 0) return;

    setSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const now = new Date().toISOString();
      let savedSourceUrls = sourceUrls;
      if (files.length > 0 && savedSourceUrls.length === 0) {
        setUploading(true);
        setUploadProgress(0);
        const uploadedUrls: string[] = [];
        for (const [index, file] of files.entries()) {
          const uploadResult = await uploadFile(
            file,
            mode === "admin" ? "melon/question-bank" : "melon/student-submissions"
          );
          if (!uploadResult || !uploadResult.url) {
            console.error("[BẢO HIỂM] Upload thất bại cho file:", file.name);
            continue; // Bỏ qua file lỗi, không làm crash vòng lặp
          }
          // --- LỚP TIỀN XỬ LÝ ẢNH CHỐNG MỜ/TỐI QUA CLOUDINARY ---
          let processedUrl = uploadResult.url;
          if (processedUrl.includes("res.cloudinary.com")) {
            // Chèn tham số transformation: e_improve (tự động cân bằng sáng), e_sharpen:100 (làm nét tối đa các nét chữ mờ), e_grayscale (đưa về đen trắng lọc nhiễu màu)
            processedUrl = processedUrl.replace("/upload/", "/upload/e_improve,e_sharpen:100,e_grayscale/");
          }
          console.log("[BẢO HIỂM URL FRONTEND] Đường dẫn ảnh đã xử lý nâng cao:", processedUrl);
          uploadedUrls.push(processedUrl);

          setUploadProgress(Math.round(((index + 1) / files.length) * 100));
        }
        savedSourceUrls = uploadedUrls;
        setSourceUrls(uploadedUrls);
      }

      const resultsToSave = results.map((parsedResult, resultIndex) =>
        ensureParseResultIds(
          {
            ...parsedResult,
            questionSet: {
              ...parsedResult.questionSet,
              sourceFiles: savedSourceUrls.length > 0 ? savedSourceUrls : parsedResult.questionSet.sourceFiles,
            },
          },
          resultIndex
        )
      );

      if (mode === "admin") {
        for (const parsedResult of resultsToSave) {
          await setDocument(collections.questionSets, parsedResult.questionSet.id, {
            ...parsedResult.questionSet,
            createdAt: now,
            updatedAt: now,
          });

          await Promise.all(
            parsedResult.questions.map((question) =>
              setDocument(collections.questionBank, question.id, {
                ...question,
                sourceSetId: parsedResult.questionSet.id,
                sourceTitle: parsedResult.questionSet.title,
                sourceFiles: parsedResult.questionSet.sourceFiles,
                sourcePageRange: (parsedResult as ProblemParseSet).pageRange ?? "",
                rubricLevel: "unclassified",
                createdBy: uid ?? "admin",
                updatedBy: uid ?? "admin",
                classifiedAt: null,
                createdAt: now,
                updatedAt: now,
              })
            )
          );
        }
        const questionCount = resultsToSave.reduce((total, parsedResult) => total + parsedResult.questions.length, 0);
        setSaveMessage(`Đã lưu ${resultsToSave.length} bộ đề, ${questionCount} câu vào kho đề.`);
      } else {
        if (!uid) {
          throw new Error("Bạn cần đăng nhập để lưu đề đã gửi.");
        }
        for (const [index, parsedResult] of resultsToSave.entries()) {
          const submissionId = `${uid}-${Date.now()}-${index + 1}`;
          await setDocument(collections.studentSubmissions, submissionId, {
            id: submissionId,
            uid,
            questionSetId: parsedResult.questionSet.id,
            title: parsedResult.questionSet.title,
            grade: parsedResult.questionSet.grade,
            subject: parsedResult.questionSet.subject,
            questionCount: parsedResult.questions.length,
            sourceFiles: parsedResult.questionSet.sourceFiles,
            questionSet: parsedResult.questionSet,
            questions: parsedResult.questions,
            createdAt: now,
            updatedAt: now,
          });
        }
        setSaveMessage(`Đã lưu ${resultsToSave.length} bộ đề vào lịch sử cá nhân.`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
      <div className="nb-card rounded-2xl bg-white p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm">T?o ??</h3>
          <NbPill color={mode === "admin" ? "orange" : "green"}>
            {mode === "admin" ? "Kho đề" : "Học sinh"}
          </NbPill>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-bold uppercase">Lớp</span>
            <select
              className="nb-input text-sm"
              value={grade}
              onChange={(event) => setGrade(Number(event.target.value))}
            >
              <option value={4}>Lớp 4</option>
              <option value={5}>Lớp 5</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-bold uppercase">Tên bộ đề</span>
          <input
            className="nb-input text-sm"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="VD: Đề Toán lớp 5 cuối học kì II"
          />
        </label>

        <div>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "w-full min-h-28 border-2 border-dashed border-nb-black rounded-xl",
              "bg-nb-bg cursor-pointer flex flex-col items-center justify-center gap-2 p-4",
              "hover:bg-nb-yellow/30 transition-colors"
            )}
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm font-bold">T?i t?p l?n</span>
            <span className="text-[0.7rem] text-[#555]">
              {files.length > 0 ? `Đã chọn ${files.length} file` : "JPG, PNG, PDF, DOCX, TXT"}
            </span>
          </button>
          {files.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {files.map((file) => (
                <div key={`${file.name}-${file.size}`} className="text-[0.7rem] font-bold text-[#555] flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  {file.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-bold uppercase">Trang cần đọc nếu là PDF dài</span>
          <input
            className="nb-input text-sm"
            value={pageRange}
            onChange={(event) => setPageRange(event.target.value)}
            placeholder="VD: 1-4, 6-9"
          />
          <span className="text-[0.68rem] font-semibold text-[#666]">
            Để trống để đọc toàn bộ PDF và tự tách các đề. Có thể nhập nhiều khoảng như khi in tài liệu.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] font-bold uppercase">Hoặc paste text đề</span>
          <textarea
            className="nb-input text-sm min-h-40 resize-y"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Dán nội dung đề và đáp án ở đây..."
          />
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <NbButton
            fullWidth
            loading={loading}
            disabled={!text.trim() && files.length === 0}
            onClick={parseProblems}
            icon={<Languages className="w-4 h-4" />}
          >
            Đọc đề
          </NbButton>
          {result && (
            <NbButton
              fullWidth
              variant="secondary"
              loading={saving}
              onClick={saveResult}
              icon={<Save className="w-4 h-4" />}
            >
              {mode === "admin"
                ? results.length > 1 ? "Lưu tất cả vào kho" : "Lưu kho đề"
                : results.length > 1 ? "Lưu tất cả" : "Lưu lịch sử"}
            </NbButton>
          )}
        </div>

        {uploading && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[0.7rem] font-bold uppercase">
              <span>Đang upload Cloudinary</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-nb-bg rounded-full overflow-hidden border border-nb-black">
              <div className="h-full bg-nb-purple transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {error && <p className="text-sm font-bold text-nb-red">{error}</p>}
        {saveMessage && <p className="text-sm font-bold text-nb-green">{saveMessage}</p>}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm">Kết quả đọc đề</h3>
            <p className="text-sm font-semibold text-[#555]">
              {result
                ? results.length > 1
                  ? `${results.length} bộ đề · đang xem ${result.questions.length} câu`
                  : `${result.questions.length} câu hỏi`
                : "Chưa có dữ liệu"}
            </p>
          </div>
          {result && mode === "student" && (
            <NbButton variant="ghost" size="sm" onClick={() => setShowAnswers((value) => !value)}>
              {showAnswers ? "Ẩn đáp án" : "Xem đáp án"}
            </NbButton>
          )}
        </div>

        {!result ? (
          <div className="nb-card rounded-2xl bg-white p-8 text-center text-sm font-bold text-[#666]">Chưa có dữ liệu</div>
        ) : (
          <div className="flex flex-col gap-4">
            {results.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {results.map((parsedResult, index) => (
                  <button
                    key={parsedResult.questionSet.id}
                    type="button"
                    onClick={() => setActiveResultIndex(index)}
                    className={cn(
                      "border-2 border-nb-black px-3 py-2 text-xs font-bold uppercase",
                      activeResultIndex === index ? "bg-nb-yellow" : "bg-white"
                    )}
                  >
                    {parsedResult.questionSet.title || `Đề ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
            <div className="nb-card rounded-2xl bg-white p-5">
            <div className="font-display text-sm">{result.questionSet.title}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <NbPill color="green">Lớp {result.questionSet.grade}</NbPill>
                <NbPill color="blue">Toán</NbPill>
                <NbPill color="purple">Tiếng Việt</NbPill>
              </div>
            </div>

            {result.questions.slice(0, 12).map((question, questionIndex) => (
              <div key={`${question.id || "question"}-${questionIndex}`} className="nb-card rounded-2xl bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[0.7rem] font-bold uppercase text-[#666]">
                      {question.section || "Câu hỏi"} · Câu {question.questionNumber} · {questionTypeLabels[question.type]}
                    </div>
                    <h4 className="mt-2 text-base font-bold leading-relaxed">{question.stem}</h4>
                  </div>
                  <NbPill color={question.answerSource === "provided" ? "green" : "yellow"}>
                    {Math.round(question.confidence * 100)}%
                  </NbPill>
                </div>

                <QuestionMedia imageUrls={question.imageUrls} visualDescription={question.visualDescription} />

                {question.choices.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {question.choices.map((choice) => (
                      <div key={choice.key} className="border-2 border-nb-black rounded-lg p-3 text-sm font-bold">
                        {choice.key}. {choice.text}
                      </div>
                    ))}
                  </div>
                )}

                {question.subQuestions.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {question.subQuestions.map((subQuestion) => (
                      <div key={subQuestion.label} className="border-2 border-[#ddd] rounded-lg p-3 text-sm">
                        <span className="font-bold">{subQuestion.label}.</span> {subQuestion.stem}
                        {showAnswers && subQuestion.answerText && (
                          <div className="mt-2 font-bold text-nb-green">Đáp án: {subQuestion.answerText}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showAnswers && (
                  <div className="mt-4 bg-nb-green/10 border-2 border-nb-green rounded-lg p-3 text-sm">
                    <div className="font-bold text-nb-green">
                      Đáp án: {question.answerText || question.answer || "Chưa có"}
                    </div>
                    {question.explanation && (
                      <div className="mt-1 font-semibold text-[#333]">{question.explanation}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {result.questions.length > 12 && (
              <div className="nb-card rounded-2xl bg-white p-5 text-sm font-bold text-[#555]">
                Đang chỉ hiển thị 12 câu đầu trong {result.questions.length} câu. Với PDF dài nhiều đề, hãy nhập khoảng trang như 1-2, 3-4 rồi đọc từng đề để lưu thành từng bộ riêng.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
