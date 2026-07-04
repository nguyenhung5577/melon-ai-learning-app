"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, FileText, History, RefreshCcw } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { KidShell } from "@/components/layout/KidShell";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { collections } from "@/lib/db/firestore";
import { queryDocuments } from "@/lib/db/firestore-helpers";
import { useAuthContext } from "@/lib/auth/auth-context";
import type { GeneratedQuestionSet, QuestionSet } from "@/lib/problems/types";
import type { StudentExerciseAttemptRecord } from "@/lib/progress/types";
import { where } from "firebase/firestore";

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

function textValue(value: unknown) {
  return String(value ?? "");
}

function historyStorageKey(uid: string) {
  return `melon:practice-exam-history:${uid}`;
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

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  if (hours > 0) return `${hours} giờ ${remainMinutes} phút`;
  return `${Math.max(1, minutes)} phút`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeHistory(localItems: ExamHistoryItem[], savedItems: ExamHistoryItem[]) {
  const merged: ExamHistoryItem[] = [];
  const sorted = [...localItems, ...savedItems].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  for (const item of sorted) {
    const itemTime = Date.parse(item.submittedAt);
    const duplicated = merged.some((existing) => {
      if (existing.questionSetId !== item.questionSetId) return false;
      const existingTime = Date.parse(existing.submittedAt);
      return Number.isFinite(itemTime) &&
        Number.isFinite(existingTime) &&
        Math.abs(existingTime - itemTime) <= 2 * 60 * 1000;
    });
    if (!duplicated) merged.push(item);
  }

  return merged.slice(0, 50);
}

function historyFromAttempts(
  attempts: StudentExerciseAttemptRecord[],
  setById: Map<string, QuestionSet | GeneratedQuestionSet>
): ExamHistoryItem[] {
  const groups = new Map<string, StudentExerciseAttemptRecord[]>();

  for (const attempt of attempts) {
    if (attempt.source !== "question_bank") continue;
    const questionSetId = textValue(attempt.questionSetId).trim();
    if (!questionSetId) continue;

    const submittedAtMs = Date.parse(attempt.submittedAt);
    if (!Number.isFinite(submittedAtMs)) continue;

    const tenMinuteBucket = Math.floor(submittedAtMs / (10 * 60 * 1000));
    const key = `${questionSetId}:${tenMinuteBucket}`;
    groups.set(key, [...(groups.get(key) ?? []), attempt]);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const latestByQuestion = new Map<string, StudentExerciseAttemptRecord>();
    for (const attempt of group) {
      const current = latestByQuestion.get(attempt.questionId);
      if (!current || attempt.submittedAt > current.submittedAt) {
        latestByQuestion.set(attempt.questionId, attempt);
      }
    }

    const attemptsInRun = Array.from(latestByQuestion.values());
    const latest = attemptsInRun.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
    const questionSetId = textValue(latest.questionSetId).trim();
    const set = setById.get(questionSetId);
    const title = textValue(set?.title).trim() || textValue(latest.sourceTitle).trim() || "Đề luyện";

    return {
      id: `saved-${key}`,
      questionSetId,
      title,
      grade: set?.grade ?? latest.grade,
      submittedAt: latest.submittedAt,
      total: attemptsInRun.length,
      answered: attemptsInRun.length,
      correct: attemptsInRun.filter((attempt) => attempt.isCorrect).length,
      durationSeconds: attemptsInRun.reduce((sum, attempt) => sum + Math.max(0, Number(attempt.timeSpentSeconds ?? Math.round(attempt.timeSpentMs / 1000) ?? 0)), 0),
      source: "saved" as const,
    };
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export default function PracticeHistoryPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [localHistory, setLocalHistory] = useState<ExamHistoryItem[]>([]);
  const [savedHistory, setSavedHistory] = useState<ExamHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const history = useMemo(() => mergeHistory(localHistory, savedHistory), [localHistory, savedHistory]);

  useEffect(() => {
    if (!user?.uid) return;
    const timer = window.setTimeout(() => setLocalHistory(readLocalExamHistory(user.uid)), 0);
    return () => window.clearTimeout(timer);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    let mounted = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);

      Promise.all([
        queryDocuments(collections.questionSets),
        queryDocuments(collections.generatedQuestionSets, where("childUid", "==", user.uid)).catch(() => [] as GeneratedQuestionSet[]),
        queryDocuments(collections.studentExerciseAttempts, where("childUid", "==", user.uid)),
      ])
        .then(([sets, generatedSets, attempts]) => {
          if (!mounted) return;
          const setById = new Map<string, QuestionSet | GeneratedQuestionSet>();
          for (const set of sets) setById.set(set.id, set);
          for (const set of generatedSets) setById.set(set.id, set);
          setSavedHistory(historyFromAttempts(attempts, setById));
        })
        .catch(() => {
          if (mounted) setError("Chưa tải được lịch sử luyện đề.");
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [user?.uid]);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.photoURL}
      onLogout={logout}
      onLogin={() => setAuthOpen(true)}
    >
      <KidOnlyGuard>
        <SectionContainer>
          <SectionHeader
            title="Lịch sử luyện đề"
            subtitle="Xem lại các lượt nộp đề gần đây"
            badge={<NbPill color="green">{history.length} lượt</NbPill>}
            action={
              <NbButton type="button" variant="ghost" size="sm" onClick={() => router.push("/practice")}>
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </NbButton>
            }
          />

          {error ? (
            <div className="mt-5 rounded-xl bg-[#fff0c8] p-3 text-sm font-bold text-nb-red [border:var(--nb-border)]">
              {error}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl bg-white p-5 [border:var(--nb-border)] [box-shadow:var(--nb-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-nb-orange" />
                <h3 className="font-display text-sm">Các lượt làm bài</h3>
              </div>
              <NbPill color="yellow">{loading ? "Đang tải" : `${history.length} lượt`}</NbPill>
            </div>

            {history.length === 0 ? (
              <div className="mt-5 rounded-xl border-2 border-dashed border-nb-black/20 py-16 text-center">
                <p className="font-display text-sm text-[#666]">Chưa có lịch sử luyện đề.</p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {history.map((item) => {
                  const accuracy = Math.round((item.correct / Math.max(1, item.total)) * 100);
                  return (
                    <div key={item.id} className="rounded-[20px] bg-[#fff9ed] p-5 [border:var(--nb-border)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.grade ? <NbPill color="green">Lớp {item.grade}</NbPill> : null}
                            <NbPill color={accuracy >= 80 ? "green" : accuracy >= 60 ? "yellow" : "orange"}>
                              {accuracy}% đúng
                            </NbPill>
                          </div>
                          <h4 className="mt-3 font-display text-[0.95rem] leading-snug">{item.title}</h4>
                          <p className="mt-2 text-xs font-bold text-[#666]">{formatDate(item.submittedAt)}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-display text-2xl text-nb-orange">{item.correct}/{item.total}</div>
                          <div className="mt-1 text-xs font-bold text-[#666]">Đã làm {item.answered}/{item.total} câu</div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <NbPill color="blue" icon={<Clock3 className="h-3 w-3" />}>
                          {formatDuration(item.durationSeconds)}
                        </NbPill>
                        <NbPill color="gray" icon={<FileText className="h-3 w-3" />}>
                          {formatClock(item.durationSeconds)}
                        </NbPill>
                        <NbButton type="button" variant="ghost" size="sm" onClick={() => router.push("/practice")}>
                          <RefreshCcw className="h-4 w-4" />
                          Làm lại
                        </NbButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
