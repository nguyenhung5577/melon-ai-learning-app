"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { FileText, Upload, CheckCircle, AlertCircle, Loader2, Cloud } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { uploadPdf } from "@/lib/storage/upload";
import { setDocument } from "@/lib/db/firestore-helpers";
import { collections } from "@/lib/db/firestore";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useRouter } from "next/navigation";

const ingestSchema = z.object({
  lessonId: z.string()
    .min(3, "Lesson ID is too short")
    .max(20, "Lesson ID is too long")
    .regex(/^[a-zA-Z0-9-]+$/, "Lesson ID must be alphanumeric or hyphens"),
});

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
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [lessonId, setLessonId] = useState("");
  const [subject, setSubject] = useState("science");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

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
    
    const valid = ingestSchema.safeParse({ lessonId: lessonId.trim() });
    if (!valid.success) {
      setFieldError(valid.error.issues[0].message);
      return;
    }

    setFieldError(null);
    setResult(null);
    let storageUrl: string | undefined;
    try {
      setStatus("storing");
      setUploadProgress(0);
      storageUrl = await uploadPdf(file, setUploadProgress);
      
      // Create or update Firestore lesson with the Cloudinary URL
      try {
        await setDocument(collections.lessons, lessonId.trim(), {
          title: lessonId.trim(),
          subject: subject as any,
          cloudinaryUrl: storageUrl
        } as any, true);
      } catch (e) {
        console.warn("Failed to update lesson with cloudinaryUrl", e);
      }
    } catch {
      storageUrl = undefined;
    }

    // Step 2 — RAG ingest (Pinecone embedding)
    setStatus("ingesting");
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
      setResult({ success: false, lessonId, error: err instanceof Error ? err.message : "Failed", storageUrl });
      setStatus("error");
    }
  }

  return (
    <AdminShell userName={user?.displayName ?? "Admin"} onLogout={handleLogout}>
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

           <div>
            <label className="block font-bold text-[0.8rem] uppercase mb-2">
              Lesson ID *
            </label>
            <input
              value={lessonId}
              onChange={(e) => {
                setLessonId(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              placeholder="e.g. lesson-006"
              className={cn("nb-input", fieldError && "border-nb-red focus:ring-nb-red")}
            />
            {fieldError && (
              <div className="mt-2 flex items-center gap-1 text-nb-red text-xs font-bold">
                <AlertCircle className="w-3 h-3" /> {fieldError}
              </div>
            )}
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

          {status === "storing" && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold text-[#666]">
                <span className="flex items-center gap-1"><Cloud className="w-3 h-3" /> Cloudinary</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-nb-black/10 overflow-hidden [border:1px_solid_#0e0e0e]">
                <div
                  className="h-full bg-nb-orange transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
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
                        <Cloud className="w-3 h-3" /> View in Cloudinary
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <div className="font-display text-sm text-nb-red mb-1">Error</div>
                    <div className="text-sm font-medium mb-1">{result.error}</div>
                    {result.storageUrl && (
                      <a
                        href={result.storageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs font-semibold text-nb-blue underline underline-offset-2"
                      >
                        <Cloud className="w-3 h-3" /> View in Cloudinary
                      </a>
                    )}
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
