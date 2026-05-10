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
import { AdminGuard } from "@/components/shared/AdminGuard";
import { Subject } from "@/lib/lessons/lesson-store";

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
  const [subject, setSubject] = useState<Subject>("science");
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

    setStatus("storing");
    setUploadProgress(0);
    
    try {
      // 1. Upload to Cloudinary
      const storageUrl = await uploadPdf(file, (progress) => {
        setUploadProgress(progress);
      });

      // 2. Ingest to RAG API
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ingestion failed");
      }

      // 3. Update Lesson metadata in Firestore
      await setDocument(collections.lessons, lessonId, {
        id: lessonId,
        title: file.name.replace(".pdf", ""),
        subject,
        pdfUrl: storageUrl,
        isRAG: true,
        updatedAt: new Date().toISOString(),
      } as any);

      setResult({
        success: true,
        lessonId,
        storageUrl,
        chunkCount: data.chunks,
        charCount: data.chars,
      });
      setStatus("success");
    } catch (err: any) {
      console.error("Upload error:", err);
      setResult({
        success: false,
        lessonId,
        error: err.message,
      });
      setStatus("error");
    }
  }

  return (
    <AdminGuard>
      <AdminShell userName={user?.displayName ?? "Admin"} onLogout={handleLogout}>
        <SectionHeader
          title="PDF & RAG Upload"
          subtitle="Add new learning materials to the AI database"
          badge={<NbPill color="orange">Admin Only</NbPill>}
        />

        <div className="max-w-4xl mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Form */}
            <div className="flex flex-col gap-6">
              <div className="nb-card rounded-2xl p-6 bg-white">
                <h3 className="font-display text-sm mb-6 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-nb-purple" />
                  Lesson Metadata
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block font-bold text-[0.7rem] uppercase mb-1.5">Lesson ID (e.g. math-101)</label>
                    <input
                      type="text"
                      placeholder="Enter a unique ID..."
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
                    <label className="block font-bold text-[0.7rem] uppercase mb-1.5">Subject</label>
                    <select
                      className="nb-input text-sm cursor-pointer"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value as Subject)}
                      disabled={status !== "idle"}
                    >
                      <option value="science">Science</option>
                      <option value="math">Math</option>
                      <option value="english">English</option>
                      <option value="coding">Coding</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Upload Dropzone */}
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
                    <NbButton variant="secondary" size="sm" className="mt-2 text-[0.65rem] h-8">Change File</NbButton>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-nb-bg flex items-center justify-center text-[#999]">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-sm mt-2">Drop your PDF here</div>
                    <div className="text-[0.65rem] text-[#666]">or click to browse from files</div>
                  </div>
                )}
              </div>

              <NbButton
                variant="primary"
                size="lg"
                fullWidth
                disabled={!file || !lessonId || status !== "idle"}
                loading={status !== "idle"}
                onClick={handleUpload}
              >
                {status === "idle" ? "Ingest to Melon AI" : "Processing..."}
              </NbButton>
            </div>

            {/* Right: Status / Progress */}
            <div className="flex flex-col gap-6">
              {status !== "idle" && (
                <div className="nb-card rounded-2xl p-6 bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="font-display text-sm mb-6">Upload Progress</h3>
                  
                  <div className="space-y-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-[0.65rem] font-bold uppercase">
                        <span>1. Cloudinary Storage</span>
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
                        <span>2. RAG Ingestion (Pinecone)</span>
                        {status === "storing" ? (
                          <span className="text-[#ccc]">Waiting...</span>
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
                        Success! Lesson {result.lessonId} is ready.
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[0.65rem] font-bold">
                        <div className="bg-white p-2 rounded-lg border border-nb-green/30">
                          <div className="text-[#666] mb-1">CHUNKS</div>
                          <div>{result.chunkCount}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-nb-green/30">
                          <div className="text-[#666] mb-1">CHARACTERS</div>
                          <div>{result.charCount}</div>
                        </div>
                      </div>
                      <NbButton variant="secondary" size="sm" onClick={() => window.location.reload()}>
                        Upload Another
                      </NbButton>
                    </div>
                  )}

                  {status === "error" && result && (
                    <div className="mt-8 p-4 bg-nb-red/10 border-2 border-nb-red rounded-xl flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-nb-red font-bold text-xs">
                        <AlertCircle className="w-4 h-4" />
                        Error occurred
                      </div>
                      <p className="text-[0.65rem] text-nb-red font-bold">{result.error}</p>
                      <NbButton variant="secondary" size="sm" onClick={() => setStatus("idle")}>
                        Try Again
                      </NbButton>
                    </div>
                  )}
                </div>
              )}

              {/* Tips card */}
              <div className="nb-card rounded-2xl p-6 bg-nb-purple/5 border-nb-purple">
                <h3 className="font-display text-xs mb-3">Ingestion Guide</h3>
                <ul className="text-[0.7rem] space-y-2 text-[#555] font-semibold">
                  <li className="flex gap-2">
                    <span className="text-nb-purple">•</span>
                    Only use high-quality PDFs with selectable text.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nb-purple">•</span>
                    Lesson ID must be unique (overwrites existing).
                  </li>
                  <li className="flex gap-2">
                    <span className="text-nb-purple">•</span>
                    Large files (&gt;10MB) may take 30-60 seconds to process.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}
