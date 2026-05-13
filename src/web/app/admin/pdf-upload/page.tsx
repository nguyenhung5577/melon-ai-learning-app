"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { FileText, Upload, CheckCircle, AlertCircle, Loader2, Cloud } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { buildLessonFromExercises, saveGeneratedLesson } from "@/lib/lessons/generated-lessons-store";
import type { Subject } from "@/lib/lessons/mock-lessons";
import { uploadFile, pdfPath, type UploadProgress } from "@/lib/storage/upload";
import { cn } from "@/lib/utils";

type UploadStatus = "idle" | "storing" | "ingesting" | "success" | "error";
const ENABLE_FIREBASE_UPLOAD = process.env.NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE_UPLOAD === "true";

interface UploadResult {
  success?: boolean;
  message?: string;
  file_id?: string;
  chunks?: number;
  storageUrl?: string;
  error?: string;
}

interface IngestStartResponse {
  message?: string;
  job_id?: string;
  file_id?: string;
  status?: string;
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
  const [file, setFile] = useState<File | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [subject, setSubject] = useState<Subject>("science");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [exerciseTopic, setExerciseTopic] = useState("");
  const [exerciseFileId, setExerciseFileId] = useState("");
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [generatedExercises, setGeneratedExercises] = useState<GeneratedExercise[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pollIngestJob(jobId: string): Promise<IngestStatusResponse> {
    for (let attempt = 0; attempt < 180; attempt++) {
      const res = await fetch(`/api/v1/rag/ingest/${jobId}`, { cache: "no-store" });
      const data = (await res.json()) as IngestStatusResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to read ingest status");
      }
      if (data.status === "completed" || data.status === "failed" || data.status === "not_found") {
        return data;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Ingest timeout. Please try again.");
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") setFile(f);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  async function handleUpload() {
    if (!file || !lessonId.trim()) return;
    setResult(null);
    setUploadProgress(null);

    let storageUrl: string | undefined;

    if (ENABLE_FIREBASE_UPLOAD) {
      try {
        // Step 1 — optional upload to Firebase Storage
        setStatus("storing");
        storageUrl = await uploadFile(
          file,
          pdfPath(lessonId.trim(), file.name),
          setUploadProgress
        );
      } catch {
        // Firebase Storage is optional for this flow.
        storageUrl = undefined;
      }
    }

    // Step 2 — RAG ingest (Pinecone embedding)
    setStatus("ingesting");
    setUploadProgress(null);
    const form = new FormData();
    form.append("file", file);
    form.append("lessonId", lessonId.trim());
    form.append("subject", subject);

    try {
      const res = await fetch("/api/v1/rag/ingest", { method: "POST", body: form });
      const startData = (await res.json()) as IngestStartResponse;
      if (!res.ok) throw new Error(startData.error ?? "Ingest failed to start");
      if (!startData.job_id) throw new Error("Ingest job id missing from backend");

      const finalStatus = await pollIngestJob(startData.job_id);
      if (finalStatus.status !== "completed") {
        throw new Error(finalStatus.error ?? "Ingest failed");
      }

      const data: UploadResult = {
        success: true,
        message: "success",
        file_id: finalStatus.file_id ?? startData.file_id,
        chunks: finalStatus.chunks ?? 0,
        storageUrl,
      };

      setResult(data);
      setStatus("success");
      setFile(null);
      setLessonId("");
      if (data.file_id) {
        setExerciseFileId(data.file_id);
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Failed" });
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
        throw new Error(data.error ?? "Failed to generate exercises");
      }
      setGeneratedExercises(data.questions ?? []);
    } catch (err) {
      setExerciseError(err instanceof Error ? err.message : "Failed to generate exercises");
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
    setSaveMessage(`Saved lesson "${lesson.title}". You can now learn it in /lessons.`);
  }

  return (
    <AdminShell userName={user?.displayName ?? "Admin"} onLogout={logout}>
      <SectionHeader
        title="PDF Upload / RAG Ingest"
        subtitle="Upload lesson PDFs to build the AI quiz knowledge base"
        badge={<NbPill color="purple">RAG Module</NbPill>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* Upload form */}
        <div className="flex flex-col gap-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "h-48 [border:var(--nb-border)] rounded-2xl flex flex-col items-center justify-center",
              "gap-3 cursor-pointer transition-all duration-150",
              dragging
                ? "bg-nb-purple [box-shadow:var(--nb-shadow)] -translate-x-0.5 -translate-y-0.5"
                : "bg-white hover:bg-nb-bg [box-shadow:var(--nb-shadow-sm)]"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <>
                <FileText className="w-10 h-10 text-nb-orange" />
                <div className="font-display text-sm text-nb-black">{file.name}</div>
                <div className="text-xs font-semibold text-[#666]">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-[#888]" />
                <div className="font-display text-sm text-[#888]">Drop PDF here</div>
                <div className="text-xs font-semibold text-[#aaa]">or click to browse</div>
              </>
            )}
          </div>

          {/* Lesson ID */}
          <div>
            <label className="block font-bold text-[0.8rem] uppercase mb-2">
              Lesson ID *
            </label>
            <input
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              placeholder="e.g. lesson-006"
              className="nb-input"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block font-bold text-[0.8rem] uppercase mb-2">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
              className="nb-input cursor-pointer"
            >
              {["math", "science", "english", "history", "coding"].map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          <NbButton
            variant="primary"
            size="lg"
            loading={status === "storing" || status === "ingesting"}
            disabled={!file || !lessonId.trim()}
            onClick={handleUpload}
            icon={<Upload className="w-4 h-4" />}
          >
            {status === "storing" ? "Uploading to Storage…" : status === "ingesting" ? "Building Index…" : "Ingest PDF"}
          </NbButton>

          {/* Firebase Storage upload progress */}
          {ENABLE_FIREBASE_UPLOAD && status === "storing" && uploadProgress && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold text-[#666]">
                <span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> Firebase Storage</span>
                <span>{uploadProgress.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-nb-black/10 overflow-hidden [border:1px_solid_#0e0e0e]">
                <div
                  className="h-full bg-nb-orange transition-all duration-150"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}
          {!ENABLE_FIREBASE_UPLOAD && (
            <p className="text-xs font-semibold text-[#666]">
              Firebase upload is currently disabled. Set `NEXT_PUBLIC_ENABLE_FIREBASE_STORAGE_UPLOAD=true` to enable.
            </p>
          )}
        </div>

        {/* Status + instructions */}
        <div className="flex flex-col gap-4">
          {/* Result */}
          {result && (
            <div
              className={cn(
                "nb-card rounded-2xl p-5 flex items-start gap-3",
                result.success ? "bg-nb-green/10" : "bg-nb-red/10"
              )}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-nb-green flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-nb-red flex-shrink-0 mt-0.5" />
              )}
              <div>
                {result.success ? (
                  <>
                    <div className="font-display text-sm text-nb-green mb-1">Ingested!</div>
                    <div className="text-sm font-medium">
                      <b>{result.chunks ?? 0}</b> chunks indexed in melon-ai-backend
                    </div>
                    {result.file_id && (
                      <div className="text-xs font-semibold text-[#666] mt-1">
                        File ID: <span className="font-mono">{result.file_id}</span>
                      </div>
                    )}
                    {result.storageUrl && (
                      <a
                        href={result.storageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs font-semibold text-nb-blue underline underline-offset-2"
                      >
                        <Cloud className="w-3 h-3" /> View in Firebase Storage
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <div className="font-display text-sm text-nb-red mb-1">Error</div>
                    <div className="text-sm font-medium">{result.error}</div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Processing indicator */}
          {status === "ingesting" && (
            <div className="nb-card rounded-2xl p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-nb-orange" />
              <div className="font-bold text-sm">Chunking → OpenAI embedding → Pinecone…</div>
            </div>
          )}

          {/* Instructions */}
          <div className="nb-card rounded-2xl p-5 bg-nb-bg">
            <h3 className="font-display text-sm mb-3">How it works</h3>
            <ol className="flex flex-col gap-2 text-sm font-medium text-[#555]">
              <li>1. Upload a PDF lesson (textbook, worksheet, notes)</li>
              <li>2. Frontend sends file to `melon-ai-backend /api/v1/ingest`</li>
              <li>3. Backend chunks and stores vectors in its RAG store</li>
              <li>4. Response returns `file_id` for lesson generation context</li>
              <li>5. Use this `file_id` when calling quiz/content generation APIs</li>
            </ol>
          </div>

          <div className="nb-card rounded-2xl p-5 bg-white flex flex-col gap-3">
            <h3 className="font-display text-sm">Generate Exercises (RAG + OpenAI)</h3>
            <input
              value={exerciseTopic}
              onChange={(e) => setExerciseTopic(e.target.value)}
              placeholder="Topic, e.g. Photosynthesis"
              className="nb-input"
            />
            <input
              value={exerciseFileId}
              onChange={(e) => setExerciseFileId(e.target.value)}
              placeholder="file_id from ingest result"
              className="nb-input font-mono"
            />
            <NbButton
              variant="primary"
              size="sm"
              onClick={handleGenerateExercises}
              disabled={!exerciseTopic.trim() || !exerciseFileId.trim() || exerciseLoading}
              loading={exerciseLoading}
            >
              Generate 5 Exercises
            </NbButton>
            {exerciseError && (
              <p className="text-sm font-semibold text-nb-red">{exerciseError}</p>
            )}
            {generatedExercises.length > 0 && (
              <div className="flex flex-col gap-3">
                {generatedExercises.map((item, idx) => (
                  <div key={idx} className="rounded-xl border-2 border-nb-black/20 p-3 bg-nb-bg">
                    <p className="font-bold text-sm mb-2">{idx + 1}. {item.question}</p>
                    <div className="text-xs font-semibold text-[#666] grid grid-cols-1 gap-1">
                      {Object.entries(item.choices ?? {}).map(([k, v]) => (
                        <span key={k}>{k}) {v}</span>
                      ))}
                    </div>
                    {item.answer && (
                      <p className="text-xs font-bold text-nb-green mt-2">Answer: {item.answer}</p>
                    )}
                  </div>
                ))}
                <NbButton variant="secondary" size="sm" onClick={handleSaveLesson}>
                  Save as Lesson
                </NbButton>
                {saveMessage && (
                  <p className="text-xs font-semibold text-nb-green">{saveMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
