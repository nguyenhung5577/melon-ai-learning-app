"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { FileText, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { AdminGuard } from "@/components/shared/AdminGuard";
import { useAuthContext } from "@/lib/auth/auth-context";
import { setDocument } from "@/lib/db/firestore-helpers";
import { collections } from "@/lib/db/firestore";
import { buildLessonFromExercises, saveGeneratedLesson } from "@/lib/lessons/generated-lessons-store";
import { type Lesson, type Subject } from "@/lib/lessons/lesson-store";
import { uploadPdf } from "@/lib/storage/upload";
import { cn } from "@/lib/utils";

const ingestSchema = z.object({
  lessonId: z.string()
    .min(3, "Mã bài học quá ngắn")
    .max(20, "Mã bài học quá dài")
    .regex(/^[a-zA-Z0-9-]+$/, "Mã bài học chỉ gồm chữ, số hoặc dấu gạch ngang"),
});

type UploadStatus = "idle" | "storing" | "ingesting" | "success" | "error";

interface UploadResult {
  success: boolean;
  lessonId: string;
  storageUrl?: string;
  fileId?: string;
  chunkCount?: number;
  charCount?: number;
  error?: string;
}

interface IngestStartResponse {
  message?: string;
  job_id?: string;
  file_id?: string;
  status?: string;
  chunks?: number;
  chars?: number;
  error?: string;
}

interface IngestStatusResponse {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed" | "not_found";
  file_id?: string;
  chunks?: number | null;
  error?: string | null;
}

interface GeneratedExercise {
  question: string;
  choices?: Record<string, string>;
  answer?: string;
  explanation?: string;
}

export default function PdfUploadPage() {
  const { user, logout } = useAuthContext();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [subject, setSubject] = useState<Subject>("math");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [exerciseTopic, setExerciseTopic] = useState("");
  const [exerciseFileId, setExerciseFileId] = useState("");
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [generatedExercises, setGeneratedExercises] = useState<GeneratedExercise[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  async function pollIngestJob(jobId: string): Promise<IngestStatusResponse> {
    for (let attempt = 0; attempt < 180; attempt++) {
      const res = await fetch(`/api/v1/rag/ingest/${jobId}`, { cache: "no-store" });
      const data = (await res.json()) as IngestStatusResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "Không đọc được trạng thái xử lý.");
      }
      if (data.status === "completed" || data.status === "failed" || data.status === "not_found") {
        return data;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Quá thời gian xử lý. Vui lòng thử lại.");
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type === "application/pdf") {
      setFile(droppedFile);
      setFieldError(null);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFieldError(null);
    }
  }

  async function handleUpload() {
    if (!file || !lessonId) return;

    const validation = ingestSchema.safeParse({ lessonId });
    if (!validation.success) {
      setFieldError(validation.error.issues[0].message);
      return;
    }
    setFieldError(null);
    setResult(null);
    setUploadProgress(0);

    try {
      setStatus("storing");
      const storageUrl = await uploadPdf(file, (progress) => {
        setUploadProgress(progress);
      });

      setStatus("ingesting");
      const response = await fetch("/api/v1/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          subject,
          pdfUrl: storageUrl,
        }),
      });

      const startData = (await response.json()) as IngestStartResponse;
      if (!response.ok) {
        throw new Error(startData.error || "Không xử lý được tài liệu.");
      }

      let fileId = startData.file_id;
      let chunkCount = startData.chunks;

      if (startData.job_id) {
        const finalStatus = await pollIngestJob(startData.job_id);
        if (finalStatus.status !== "completed") {
          throw new Error(finalStatus.error ?? "Không xử lý được tài liệu.");
        }
        fileId = finalStatus.file_id ?? fileId;
        chunkCount = finalStatus.chunks ?? chunkCount;
      }

      const lessonMetadata: Lesson = {
        id: lessonId,
        title: file.name.replace(/\.pdf$/i, ""),
        subject,
        type: "reading",
        emoji: "📄",
        description: "Tài liệu PDF dùng để Melon AI tạo bài học.",
        duration: 10,
        xpReward: 100,
        difficulty: 1,
        tags: ["math_curriculum_v2", "grade_4", "grade_5", "pdf", "rag"],
        slides: [],
        aiEnabled: true,
        audioEnabled: false,
        thumbnailBg: "#38b6ff",
        pdfUrl: storageUrl,
        isRAG: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDocument(collections.lessons, lessonId, lessonMetadata);

      setResult({
        success: true,
        lessonId,
        storageUrl,
        fileId,
        chunkCount,
        charCount: startData.chars,
      });
      setExerciseFileId(fileId ?? "");
      setExerciseTopic(file.name.replace(/\.pdf$/i, ""));
      setStatus("success");
    } catch (err) {
      setResult({
        success: false,
        lessonId,
        error: err instanceof Error ? err.message : "Không tải được tệp.",
      });
      setStatus("error");
    }
  }

  async function handleGenerateExercises() {
    if (!exerciseTopic.trim() || !exerciseFileId.trim()) return;
    setExerciseLoading(true);
    setExerciseError(null);
    setSaveMessage(null);
    setGeneratedExercises([]);
    try {
      const res = await fetch("/api/v1/exercise/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: exerciseTopic.trim(),
          fileId: exerciseFileId.trim(),
          count: 5,
          difficulty: "medium",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không tạo được bài tập.");
      }
      setGeneratedExercises(data.questions ?? []);
    } catch (err) {
      setExerciseError(err instanceof Error ? err.message : "Không tạo được bài tập.");
    } finally {
      setExerciseLoading(false);
    }
  }

  function handleSaveLesson() {
    if (!exerciseTopic.trim() || generatedExercises.length === 0) return;
    const lesson = buildLessonFromExercises({
      topic: exerciseTopic.trim(),
      subject,
      questions: generatedExercises,
      sourceFileId: exerciseFileId.trim() || undefined,
    });
    saveGeneratedLesson(lesson);
    setSaveMessage(`Đã lưu bài "${lesson.title}". Có thể học bài này ở mục Bài học.`);
  }

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName ?? "Quản trị viên"} onLogout={handleLogout}>
        <SectionHeader
          title="Tải PDF và RAG"
          subtitle="Thêm tài liệu học tập vào cơ sở dữ liệu AI"
          badge={<NbPill color="orange">Chỉ admin</NbPill>}
        />

        <div className="max-w-5xl mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-6">
              <div className="nb-card rounded-2xl p-6 bg-white">
                <h3 className="font-display text-sm mb-6 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-nb-purple" />
                  Thông tin bài học
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-[0.7rem] uppercase mb-1.5">Mã bài học, ví dụ math-101</label>
                    <input
                      type="text"
                      placeholder="Nhập mã không trùng..."
                      className={cn("nb-input text-sm", fieldError && "border-nb-red focus:ring-nb-red")}
                      value={lessonId}
                      onChange={(e) => {
                        setLessonId(e.target.value);
                        if (fieldError) setFieldError(null);
                      }}
                      disabled={status !== "idle"}
                    />
                    {fieldError && <p className="mt-1 text-[0.65rem] font-bold text-nb-red">{fieldError}</p>}
                  </div>

                  <div>
                    <label className="block font-bold text-[0.7rem] uppercase mb-1.5">Môn học</label>
                    <select
                      className="nb-input text-sm cursor-pointer"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as Subject)}
                      disabled={status !== "idle"}
                    >
                      <option value="math">Toán lớp 4-5</option>
                    </select>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "nb-card rounded-2xl p-8 border-dashed border-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                  dragging ? "border-nb-purple bg-nb-purple/5 scale-[1.02]" : "border-[#ccc] hover:border-nb-purple",
                  file ? "bg-nb-green/5 border-nb-green border-solid" : "",
                  status !== "idle" ? "opacity-50 pointer-events-none" : ""
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  ref={inputRef}
                  onChange={handleFileChange}
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-nb-green flex items-center justify-center text-white [box-shadow:var(--nb-shadow-sm)]">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-sm mt-2">{file.name}</div>
                    <div className="text-[0.65rem] text-[#666]">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    <NbButton variant="secondary" size="sm" className="mt-2 text-[0.65rem] h-8">Đổi tệp</NbButton>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-nb-bg flex items-center justify-center text-[#999]">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-sm mt-2">Thả PDF vào đây</div>
                    <div className="text-[0.65rem] text-[#666]">hoặc bấm để chọn tệp</div>
                  </div>
                )}
              </div>

              <NbButton
                variant="primary"
                size="lg"
                fullWidth
                disabled={!file || !lessonId || status !== "idle"}
                loading={status !== "idle" && status !== "success" && status !== "error"}
                onClick={handleUpload}
              >
                {status === "idle" ? "Đưa vào Melon AI" : "Đang xử lý..."}
              </NbButton>
            </div>

            <div className="flex flex-col gap-6">
              {status !== "idle" && (
                <div className="nb-card rounded-2xl p-6 bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="font-display text-sm mb-6">Tiến độ tải lên</h3>

                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-[0.65rem] font-bold uppercase">
                        <span>1. Lưu trữ Cloudinary</span>
                        {status === "storing" ? (
                          <span className="text-nb-purple">{uploadProgress}%</span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-nb-green" />
                        )}
                      </div>
                      <div className="h-2 bg-nb-bg rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all duration-300", status === "storing" ? "bg-nb-purple" : "bg-nb-green")}
                          style={{ width: status === "storing" ? `${uploadProgress}%` : "100%" }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-[0.65rem] font-bold uppercase">
                        <span>2. Melon AI đọc tài liệu</span>
                        {status === "storing" ? (
                          <span className="text-[#ccc]">Đang chờ...</span>
                        ) : status === "ingesting" ? (
                          <Loader2 className="w-4 h-4 text-nb-purple animate-spin" />
                        ) : status === "success" ? (
                          <CheckCircle className="w-4 h-4 text-nb-green" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-nb-red" />
                        )}
                      </div>
                      <div className="h-2 bg-nb-bg rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-1000",
                            status === "ingesting" ? "bg-nb-purple animate-pulse w-full" :
                            status === "success" ? "bg-nb-green w-full" :
                            status === "error" ? "bg-nb-red w-full" : "w-0"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {status === "success" && result && (
                    <div className="mt-8 p-4 bg-nb-green/10 border-2 border-nb-green rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-nb-green font-bold text-xs">
                        <CheckCircle className="w-4 h-4" />
                        Thành công! Bài {result.lessonId} đã sẵn sàng.
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[0.65rem] font-bold">
                        <div className="bg-white p-2 rounded-lg border border-nb-green/30">
                          <div className="text-[#666] mb-1">ĐOẠN</div>
                          <div>{result.chunkCount ?? 0}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-nb-green/30">
                          <div className="text-[#666] mb-1">ID TỆP</div>
                          <div className="truncate">{result.fileId ?? "không có"}</div>
                        </div>
                      </div>
                      <NbButton variant="secondary" size="sm" onClick={() => setStatus("idle")}>
                        Tải tệp khác
                      </NbButton>
                    </div>
                  )}

                  {status === "error" && result && (
                    <div className="mt-8 p-4 bg-nb-red/10 border-2 border-nb-red rounded-xl flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-nb-red font-bold text-xs">
                        <AlertCircle className="w-4 h-4" />
                        Có lỗi xảy ra
                      </div>
                      <p className="text-[0.65rem] text-nb-red font-bold">{result.error}</p>
                      <NbButton variant="secondary" size="sm" onClick={() => setStatus("idle")}>
                        Thử lại
                      </NbButton>
                    </div>
                  )}
                </div>
              )}

              <div className="nb-card rounded-2xl p-6 bg-nb-purple/5 border-nb-purple">
                <h3 className="font-display text-xs mb-3">Tạo bài tập</h3>
                <div className="flex flex-col gap-3">
                  <input
                    value={exerciseTopic}
                    onChange={(e) => setExerciseTopic(e.target.value)}
                    placeholder="Chủ đề"
                    className="nb-input text-sm"
                  />
                  <input
                    value={exerciseFileId}
                    onChange={(e) => setExerciseFileId(e.target.value)}
                    placeholder="ID tệp Melon AI"
                    className="nb-input text-sm"
                  />
                  <NbButton
                    variant="secondary"
                    size="sm"
                    disabled={!exerciseTopic.trim() || !exerciseFileId.trim()}
                    loading={exerciseLoading}
                    onClick={handleGenerateExercises}
                  >
                    Tạo quiz
                  </NbButton>
                </div>

                {exerciseError && (
                  <p className="mt-3 text-[0.7rem] text-nb-red font-bold">{exerciseError}</p>
                )}

                {generatedExercises.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="text-[0.7rem] font-bold text-[#555]">
                      Đã tạo {generatedExercises.length} câu hỏi.
                    </div>
                    <NbButton variant="primary" size="sm" onClick={handleSaveLesson}>
                      Lưu thành bài học cục bộ
                    </NbButton>
                  </div>
                )}

                {saveMessage && (
                  <p className="mt-3 text-[0.7rem] text-nb-green font-bold">{saveMessage}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
