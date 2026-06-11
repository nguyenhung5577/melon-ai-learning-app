"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Sparkles, Target, Trophy } from "lucide-react";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbPill } from "@/components/shared/NbPill";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { useAuthContext } from "@/lib/auth/auth-context";
import type { CourseRunSnapshot } from "@/lib/progress/types";
import { cn } from "@/lib/utils";

function priorityReason(snapshot: CourseRunSnapshot, position: number) {
  if (position === 0) {
    return `Khóa này đang được ưu tiên đầu tiên vì ${snapshot.run.personalizedReason.charAt(0).toLowerCase()}${snapshot.run.personalizedReason.slice(1)}`;
  }

  if (snapshot.run.status === "completed") {
    return "Khóa này đã hoàn thành, nên Melon giữ lại ở phần dưới để con có thể quay lại ôn thêm khi cần.";
  }

  return `Khóa này đang xếp sau ${position} khóa ưu tiên hơn ở thời điểm hiện tại.`;
}

function stageStatusLabel(snapshot: CourseRunSnapshot, stageId: string) {
  const progress = snapshot.run.stageProgress[stageId];
  const isCurrent = snapshot.currentStage.id === stageId;

  if (progress?.status === "mastered") return "Đã xong";
  if (progress?.status === "retry_required") return "Cần ôn lại";
  if (snapshot.run.status === "completed" && isCurrent) return "Đã hoàn thành";
  if (isCurrent) return "Đang học";
  if (progress) return "Đã mở";
  return "Chưa tới";
}

function CourseCard({
  snapshot,
  position,
  ctaLabel,
  ctaHref,
  ctaVariant = "primary",
}: {
  snapshot: CourseRunSnapshot;
  position: number;
  ctaLabel?: string;
  ctaHref?: string;
  ctaVariant?: "primary" | "ghost";
}) {
  const currentStageProgress = snapshot.run.stageProgress[snapshot.currentStage.id];
  const isCompleted = snapshot.run.status === "completed";

  return (
    <article className="rounded-2xl border-2 border-nb-black bg-white p-5 [box-shadow:6px_6px_0_var(--nb-black)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.7rem] font-black uppercase text-[#666]">
            Lớp {snapshot.course.grade}
          </div>
          <h3 className="mt-2 font-display text-[0.95rem] leading-snug">
            {snapshot.course.title}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">
            {snapshot.course.description}
          </p>
        </div>
        <NbPill color={isCompleted ? "yellow" : "green"} icon={isCompleted ? <Trophy className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}>
          {isCompleted ? "Hoàn thành" : snapshot.currentStage.title}
        </NbPill>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {snapshot.pipeline.stages.map((stage, index) => {
          const isCurrent = snapshot.currentStage.id === stage.id;
          return (
            <div
              key={stage.id}
              className={cn(
                "rounded-xl border-2 border-nb-black p-3 [box-shadow:3px_3px_0_var(--nb-black)]",
                isCurrent && !isCompleted ? "bg-nb-yellow" : "bg-nb-bg"
              )}
            >
              <div className="text-[0.65rem] font-black uppercase text-[#666]">
                Chặng {index + 1}
              </div>
              <div className="mt-1 text-sm font-black leading-snug">{stage.title}</div>
              <div className="mt-2 text-[0.7rem] font-semibold text-[#555]">
                {stageStatusLabel(snapshot, stage.id)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#555]">
            {isCompleted
              ? "Con đã đi hết các chặng của khóa này."
              : currentStageProgress
                ? `${currentStageProgress.accuracy}% đúng ở chặng này`
                : "Chưa có lượt làm ở chặng này"}
          </div>
          <div className="mt-1 text-xs font-semibold leading-relaxed text-[#777]">
            {priorityReason(snapshot, position)}
          </div>
        </div>
        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-display text-[0.75rem]",
              ctaVariant === "primary"
                ? "bg-nb-black text-white"
                : "bg-white text-nb-black border-2 border-nb-black"
            )}
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function LessonsPage() {
  const { user, logout } = useAuthContext();
  const userUid = user?.uid;
  const [authOpen, setAuthOpen] = useState(false);
  const [runs, setRuns] = useState<CourseRunSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userUid) return;

    let mounted = true;

    async function loadRuns() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/course-run/${userUid}?status=all`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Không tải được khóa học.");
        }
        if (!mounted) return;
        setRuns((data.runs ?? []) as CourseRunSnapshot[]);
      } catch {
        if (mounted) setRuns([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadRuns();

    return () => {
      mounted = false;
    };
  }, [userUid]);

  const activeRuns = useMemo(
    () => runs.filter((snapshot) => snapshot.run.status === "active"),
    [runs]
  );
  const completedRuns = useMemo(
    () => runs.filter((snapshot) => snapshot.run.status === "completed"),
    [runs]
  );
  const currentRun = useMemo(() => activeRuns[0] ?? null, [activeRuns]);
  const allFinished = runs.length > 0 && activeRuns.length === 0;

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      <KidOnlyGuard>
        <SectionContainer>
          <SectionHeader
            title="Khóa học Toán"
            subtitle="Mỗi khóa có lộ trình riêng. Melon sẽ điều chỉnh chặng học theo kết quả làm bài của con."
            badge={
              <NbPill color="orange" icon={<BookOpen className="w-3 h-3" />}>
                {runs.length} khóa
              </NbPill>
            }
          />

          {currentRun && (
            <div className="mb-6 rounded-2xl border-2 border-nb-black bg-white p-5 [box-shadow:6px_6px_0_var(--nb-black)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-display text-sm">{currentRun.course.title}</div>
                    <NbPill color="green" icon={<Target className="h-3 w-3" />}>
                      Chặng {currentRun.run.currentStageOrder}
                    </NbPill>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">
                    {currentRun.run.personalizedReason}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentRun.course.conceptLabels.map((label) => (
                      <NbPill key={label} color="orange">{label}</NbPill>
                    ))}
                    {currentRun.currentStage.questionFilter.rubricLevels.map((rubric) => (
                      <NbPill key={rubric} color="yellow">{rubric.replaceAll("_", " ")}</NbPill>
                    ))}
                  </div>
                </div>
                <Link
                  href={`/study?courseRunId=${encodeURIComponent(currentRun.run.id)}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-nb-black px-5 py-3 font-display text-[0.8rem] text-white [box-shadow:4px_4px_0_var(--nb-orange)]"
                >
                  Vào học ngay
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border-2 border-dashed border-nb-black/20 py-16 text-center">
              <p className="font-display text-sm text-[#666]">Đang tải lộ trình...</p>
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-nb-black/20 py-16 text-center">
              <div className="mb-4 text-5xl">📚</div>
              <p className="font-display text-sm text-[#666]">Chưa có khóa học phù hợp</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {activeRuns.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <NbPill color="green" icon={<Sparkles className="w-3 h-3" />}>Đang học</NbPill>
                    <p className="text-sm font-semibold text-[#555]">
                      Các khóa Melon đang ưu tiên cho con lúc này.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {activeRuns.map((snapshot) => (
                      <CourseCard
                        key={snapshot.run.id}
                        snapshot={snapshot}
                        position={activeRuns.findIndex((item) => item.run.id === snapshot.run.id)}
                        ctaLabel="Mở lộ trình"
                        ctaHref={`/study?courseRunId=${encodeURIComponent(snapshot.run.id)}`}
                      />
                    ))}
                  </div>
                </section>
              )}

              {allFinished && (
                <section className="rounded-2xl border-2 border-nb-black bg-white p-6 [box-shadow:6px_6px_0_var(--nb-black)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <NbPill color="yellow" icon={<CheckCircle2 className="w-3 h-3" />}>
                          Đã hoàn thành hết
                        </NbPill>
                      </div>
                      <h3 className="mt-3 font-display text-lg">Con đã đi hết các khóa hiện có.</h3>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#555]">
                        Bây giờ con có thể luyện đề trọn vẹn hoặc quay lại một khóa đã xong để ôn thêm.
                      </p>
                    </div>
                    <Link
                      href="/practice"
                      className="inline-flex items-center gap-2 rounded-xl bg-nb-black px-5 py-3 font-display text-[0.8rem] text-white [box-shadow:4px_4px_0_var(--nb-orange)]"
                    >
                      Sang luyện đề
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </section>
              )}

              {completedRuns.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center gap-2">
                    <NbPill color="yellow" icon={<Trophy className="w-3 h-3" />}>Đã hoàn thành</NbPill>
                    <p className="text-sm font-semibold text-[#555]">
                      Các khóa con đã đi hết chặng.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {completedRuns.map((snapshot) => (
                      <CourseCard
                        key={snapshot.run.id}
                        snapshot={snapshot}
                        position={activeRuns.length + completedRuns.findIndex((item) => item.run.id === snapshot.run.id)}
                        ctaLabel="Luyện đề"
                        ctaHref="/practice"
                        ctaVariant="ghost"
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
