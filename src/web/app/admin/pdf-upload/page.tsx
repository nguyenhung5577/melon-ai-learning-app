"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { FileText, Upload, CheckCircle, AlertCircle, Loader2, Cloud } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { uploadFile, pdfPath, type UploadProgress } from "@/lib/storage/upload";
import { cn } from "@/lib/utils";

type UploadStatus = "idle" | "storing" | "ingesting" | "success" | "error";

interface UploadResult {
  success: boolean;
  lessonId: string;
  storageUrl?: string;
  chunkCount?: number;
  charCount?: number;
  error?: string;
}

export default function PdfUploadPage() {
  const { user, logout } = useAuthContext();
  const [file, setFile] = useState<File | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [subject, setSubject] = useState("science");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    try {
      // Step 1 — upload to Firebase Storage
      setStatus("storing");
      storageUrl = await uploadFile(
        file,
        pdfPath(lessonId.trim(), file.name),
        setUploadProgress
      );
    } catch {
      // Firebase Storage not configured — proceed without persistent storage
      storageUrl = undefined;
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
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Ingest failed");

      setResult({ ...data, success: true, storageUrl });
      setStatus("success");
      setFile(null);
      setLessonId("");
    } catch (err) {
      setResult({ success: false, lessonId, error: err instanceof Error ? err.message : "Failed" });
      setStatus("error");
    }
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
              onChange={(e) => setSubject(e.target.value)}
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
          {status === "storing" && uploadProgress && (
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
                      <b>{result.chunkCount}</b> chunks · <b>{result.charCount?.toLocaleString()}</b> chars → Pinecone
                    </div>
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
              <li>2. Text is chunked into ~500 char segments with overlap</li>
              <li>3. OpenAI embeds each chunk (text-embedding-3-small)</li>
              <li>4. Vectors stored in Pinecone under the lesson ID</li>
              <li>5. Students can then take AI-generated quizzes from this content</li>
            </ol>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
