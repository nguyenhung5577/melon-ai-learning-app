"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BatteryCharging,
  BookOpen,
  CheckCircle2,
  Cloud,
  Crown,
  Flag,
  LockKeyhole,
  Mountain,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { KidShell } from "@/components/layout/KidShell";
import { KidOnlyGuard } from "@/components/shared/KidOnlyGuard";
import { NbPill } from "@/components/shared/NbPill";
import { SectionContainer } from "@/components/shared/SectionHeader";
import { useAuthContext } from "@/lib/auth/auth-context";
import { auth } from "@/lib/auth/firebase";
import type { CourseRunSnapshot, CourseStageType } from "@/lib/progress/types";
import { cn } from "@/lib/utils";

type JourneyState = "completed" | "current" | "retry" | "ready" | "skipped" | "locked";
type TagTone = "priority" | "momentum" | "review" | "today" | "done";

const stageOffsets = [
  "sm:translate-y-5",
  "sm:-translate-y-3",
  "sm:translate-y-4",
  "sm:-translate-y-2",
  "sm:translate-y-5",
];

const tagStyles: Record<TagTone, string> = {
  priority: "border-[#0e0e0e] bg-[#ffd166] text-nb-black shadow-[3px_3px_0_#0e0e0e]",
  momentum: "border-[#0e0e0e] bg-nb-green text-white shadow-[3px_3px_0_#0e0e0e]",
  review: "border-[#0e0e0e] bg-nb-blue text-nb-black shadow-[3px_3px_0_#0e0e0e]",
  today: "border-[#0e0e0e] bg-nb-purple text-nb-black shadow-[3px_3px_0_#0e0e0e]",
  done: "border-[#0e0e0e] bg-nb-yellow text-nb-black shadow-[3px_3px_0_#0e0e0e]",
};

const stageStatusCopy: Record<JourneyState, string> = {
  completed: "Đã vững",
  current: "Đang học",
  retry: "Ôn lại",
  ready: "Đã mở",
  skipped: "Đã qua",
  locked: "Sắp mở",
};

function stageIcon(stageType: CourseStageType): LucideIcon {
  switch (stageType) {
    case "diagnostic":
      return Flag;
    case "foundation":
      return Shield;
    case "practice":
      return Target;
    case "checkpoint":
      return Star;
    case "remedial":
      return BatteryCharging;
    case "challenge":
      return Mountain;
    default:
      return Sparkles;
  }
}

function activeStageProgress(snapshot: CourseRunSnapshot) {
  return snapshot.run.stageProgress[snapshot.currentStage.id];
}

function stageJourneyState(
  snapshot: CourseRunSnapshot,
  stageId: string,
  index: number,
  visibleStageList?: Array<CourseRunSnapshot["pipeline"]["stages"][number]>
): JourneyState {
  const progress = snapshot.run.stageProgress[stageId];
  const isCurrent = snapshot.currentStage.id === stageId;
  const stageList = visibleStageList ?? snapshot.pipeline.stages;
  const currentIndex = stageList.findIndex((stage) => stage.id === snapshot.currentStage.id);

  if (snapshot.run.status === "completed" || progress?.status === "mastered") return "completed";
  if (progress?.status === "retry_required") return "retry";
  if (isCurrent) return "current";
  if (!progress && index < currentIndex) return "skipped";
  if (!progress) return "locked";
  return "ready";
}

function visibleStages(snapshot: CourseRunSnapshot) {
  const allowed = snapshot.run.visibleStageIds?.length
    ? snapshot.run.visibleStageIds
    : snapshot.pipeline.stages.map((stage) => stage.id);
  const byId = new Map(snapshot.pipeline.stages.map((stage) => [stage.id, stage] as const));
  return allowed
    .map((stageId) => byId.get(stageId))
    .filter((stage): stage is CourseRunSnapshot["pipeline"]["stages"][number] => Boolean(stage));
}

function energyValue(snapshot: CourseRunSnapshot) {
  if (snapshot.run.status === "completed") return 100;
  const progress = activeStageProgress(snapshot);
  if (!progress) return 18;
  return Math.min(100, Math.max(10, progress.accuracy));
}

function reviewNeeded(snapshot: CourseRunSnapshot) {
  const progress = activeStageProgress(snapshot);
  return Boolean(progress?.status === "retry_required" || (progress && progress.attempts > 0 && progress.accuracy < 60));
}

function stageTypeRank(stageType: CourseStageType) {
  switch (stageType) {
    case "diagnostic":
      return 0;
    case "foundation":
      return 1;
    case "practice":
      return 2;
    case "checkpoint":
      return 3;
    case "challenge":
      return 4;
    case "remedial":
      return 5;
    default:
      return 9;
  }
}

function learningOrderValue(snapshot: CourseRunSnapshot) {
  const progress = activeStageProgress(snapshot);
  const accuracy = progress?.accuracy ?? 0;
  const attempts = progress?.attempts ?? 0;
  const reviewRank = reviewNeeded(snapshot) ? 1 : 0;
  const stageRank = stageTypeRank(snapshot.currentStage.stageType);
  const curriculumRank = snapshot.course.recommendedOrder ?? 999;
  const priorityRank = 1000 - (snapshot.run.priorityScore ?? 0);
  const masteryRank = Math.max(0, 100 - accuracy);
  const freshnessRank = attempts === 0 ? -10 : 0;

  return [reviewRank, stageRank, curriculumRank, priorityRank, freshnessRank, masteryRank];
}

function compareTuples(left: number[], right: number[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function sortRunsForLearning(runs: CourseRunSnapshot[]) {
  return [...runs].sort((left, right) => {
    const tupleDiff = compareTuples(learningOrderValue(left), learningOrderValue(right));
    if (tupleDiff !== 0) return tupleDiff;
    return left.course.title.localeCompare(right.course.title, "vi");
  });
}

function fillShowcaseRuns(
  primaryRuns: CourseRunSnapshot[],
  fallbackRuns: CourseRunSnapshot[],
  minCount: number
) {
  if (primaryRuns.length >= minCount) return primaryRuns;
  const seen = new Set(primaryRuns.map((snapshot) => snapshot.run.id));
  const supplemented = [...primaryRuns];

  for (const snapshot of fallbackRuns) {
    if (seen.has(snapshot.run.id)) continue;
    supplemented.push(snapshot);
    seen.add(snapshot.run.id);
    if (supplemented.length >= minCount) break;
  }

  return supplemented;
}

function dynamicTag(snapshot: CourseRunSnapshot, position: number): {
  label: string;
  tone: TagTone;
  Icon: LucideIcon;
} {
  const progress = activeStageProgress(snapshot);

  if (snapshot.run.status === "completed") {
    return { label: "Đã hoàn thành", tone: "done", Icon: Trophy };
  }

  if (progress?.status === "retry_required" || (progress && progress.attempts > 0 && progress.accuracy < 60)) {
    return { label: position === 0 ? "Mục tiêu ưu tiên" : "Ôn lại", tone: "review", Icon: Shield };
  }

  if (progress && progress.accuracy >= 80) {
    return { label: "Đang vào đà", tone: "momentum", Icon: Zap };
  }

  if (position === 0) {
    return { label: "Mục tiêu ưu tiên", tone: "priority", Icon: Target };
  }

  return { label: "Khóa tiếp theo", tone: "today", Icon: Sparkles };
}

function ctaCopy(snapshot: CourseRunSnapshot, isPriority: boolean) {
  if (snapshot.run.status === "completed") return "Luyện đề";

  const progress = activeStageProgress(snapshot);
  if (isPriority && (progress?.status === "retry_required" || (progress && progress.attempts > 0 && progress.accuracy < 60))) {
    return "Ôn lại";
  }

  if (isPriority) return `Học chặng ${snapshot.currentStage.title}`;
  return "Mở khóa học";
}

function DynamicTag({
  snapshot,
  position,
  compact = false,
}: {
  snapshot: CourseRunSnapshot;
  position: number;
  compact?: boolean;
}) {
  const tag = dynamicTag(snapshot, position);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border-2 px-3 py-1 font-display text-[0.62rem] leading-none [letter-spacing:0]",
        tagStyles[tag.tone],
        compact && "px-2.5 py-0.5 text-[0.55rem]"
      )}
    >
      <tag.Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{tag.label}</span>
    </span>
  );
}

function EnergyBar({ value, compact = false }: { value: number; compact?: boolean }) {
  const level = Math.max(0, Math.min(100, value));
  const segmentCount = compact ? 4 : 5;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-black text-[#243042]">
          <BatteryCharging className="h-4 w-4 text-nb-green" />
          Độ nắm vững
        </div>
        <div className="flex items-center gap-1 text-xs font-black text-[#667085]">
          <Star className="h-3.5 w-3.5 fill-[#ffd166] text-nb-black" />
          {Math.max(1, Math.ceil(level / 20))}/{segmentCount}
        </div>
      </div>
      <div
        className={cn(
          "grid gap-1 rounded-lg border-2 border-nb-black bg-white p-1 shadow-[2px_2px_0_#0e0e0e]",
          compact ? "h-7" : "h-8"
        )}
        style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }}
        aria-label="Độ nắm vững chặng hiện tại"
      >
        {Array.from({ length: segmentCount }).map((_, index) => {
          const filled = level >= ((index + 1) / segmentCount) * 100 - 1;
          const partial = !filled && level > (index / segmentCount) * 100;
          return (
            <span
              key={index}
              className={cn(
                "rounded-[4px] border border-nb-black/20 transition-all duration-500",
                filled && "bg-nb-green",
                partial && "bg-[#ffd166]",
                !filled && !partial && "bg-[#eef2f6]"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function JourneyMap({ snapshot, compact = false }: { snapshot: CourseRunSnapshot; compact?: boolean }) {
  const stages = visibleStages(snapshot);
  return (
    <div className={cn("relative", compact ? "pt-2 pb-1" : "pt-6")}>
      <div className="absolute left-5 right-5 top-[72px] hidden h-1 rounded-full bg-nb-black/15 sm:block" />
      <div className="absolute left-5 right-5 top-[72px] hidden border-t-2 border-dashed border-nb-black/45 sm:block" />

      <div
        className={cn("grid grid-cols-1 gap-3", compact ? "sm:gap-2" : "sm:gap-3")}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, stages.length)}, minmax(0, 1fr))` }}
      >
        {stages.map((stage, index) => {
          const Icon = stageIcon(stage.stageType);
          const state = stageJourneyState(snapshot, stage.id, index, stages);
          const isCurrent = state === "current" || state === "retry";
          const isLocked = state === "locked";
          const isSkipped = state === "skipped";

          return (
            <div
              key={stage.id}
              className={cn(
                "relative z-10 flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-nb-black p-3 text-center shadow-[3px_3px_0_#0e0e0e] transition-all duration-300",
                compact ? "min-h-[86px] p-2" : "sm:min-h-[132px]",
                !compact && stageOffsets[index % stageOffsets.length],
                state === "completed" && "bg-nb-green text-white",
                state === "current" && "bg-[#ffd166] shadow-[0_0_0_4px_rgba(255,209,102,0.45),4px_4px_0_#0e0e0e] melon-route-pulse",
                state === "retry" && "bg-nb-blue shadow-[0_0_0_4px_rgba(56,182,255,0.32),4px_4px_0_#0e0e0e]",
                state === "ready" && "bg-white",
                isSkipped && "scale-[0.92] border-dashed bg-[#f7f8fa] text-[#667085] opacity-70 shadow-none",
                isLocked && "border-[#cfd6df] bg-[#eef2f6] text-[#667085] shadow-none"
              )}
            >
              {isLocked ? <Cloud className="absolute right-2 top-2 h-6 w-6 text-white opacity-90" /> : null}
              <div
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full border-2 border-nb-black bg-white text-nb-black",
                  compact && "h-8 w-8",
                  isCurrent && "bg-nb-black text-white",
                  state === "completed" && "bg-white text-nb-green",
                  isLocked && "border-[#cfd6df] text-[#98a2b3]"
                )}
              >
                {isLocked ? <LockKeyhole className="h-4 w-4" /> : <Icon className={cn("h-5 w-5", compact && "h-4 w-4")} />}
              </div>
              <div className="space-y-1">
                <div className={cn("font-display text-[0.6rem] leading-tight [letter-spacing:0]", compact && "text-[0.5rem]")}>
                  Chặng {index + 1}
                </div>
                <div className={cn("text-sm font-black leading-tight", compact && "text-xs")}>{stage.title}</div>
                <div className={cn("text-[0.68rem] font-black leading-tight", compact && "text-[0.6rem]")}>
                  {stageStatusCopy[state]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityCourseCard({ snapshot }: { snapshot: CourseRunSnapshot }) {
  return (
    <article className="relative overflow-hidden rounded-lg border-4 border-nb-black bg-[#fff3c4] p-5 shadow-[0_0_0_4px_rgba(255,209,102,0.5),8px_8px_0_#0e0e0e]">
      <div className="absolute right-4 top-4 hidden rotate-6 rounded-full border-2 border-nb-black bg-white p-2 shadow-[3px_3px_0_#0e0e0e] sm:block">
        <Crown className="h-7 w-7 fill-[#ffd166] text-nb-black" />
      </div>

      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-4 pr-0 sm:pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <DynamicTag snapshot={snapshot} position={0} />
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-nb-black bg-white px-3 py-1 text-xs font-black shadow-[2px_2px_0_#0e0e0e]">
              <BookOpen className="h-3.5 w-3.5" />
              Lớp {snapshot.course.grade}
            </span>
          </div>

          <div>
            <h2 className="max-w-full break-words text-2xl font-black leading-tight text-[#243042] [overflow-wrap:anywhere] sm:max-w-[720px] sm:text-3xl">
              {snapshot.course.title}
            </h2>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <JourneyMap snapshot={snapshot} />
          <div className="flex flex-col justify-between gap-4 rounded-lg border-2 border-nb-black bg-white p-4 shadow-[4px_4px_0_#0e0e0e]">
            <EnergyBar value={energyValue(snapshot)} />
            <div className="space-y-2">
              <div className="text-lg font-black leading-tight text-[#243042]">{snapshot.currentStage.title}</div>
            </div>
            <Link
              href={`/study?courseRunId=${encodeURIComponent(snapshot.run.id)}&autoStart=1`}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-4 border-nb-black bg-nb-black px-4 py-3 text-center font-display text-[0.72rem] leading-tight text-white shadow-[5px_5px_0_#ff914d] transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[7px_7px_0_#ff914d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-orange [letter-spacing:0]"
            >
              {ctaCopy(snapshot, true)}
              <ArrowRight className="h-5 w-5 shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactCourseCard({
  snapshot,
  position,
  completed = false,
  className,
}: {
  snapshot: CourseRunSnapshot;
  position: number;
  completed?: boolean;
  className?: string;
}) {
  const canOpenCourse = completed || snapshot.run.status === "active";
  const showMastery = completed || snapshot.run.status === "active";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border-2 border-nb-black bg-white p-4 shadow-[4px_4px_0_#0e0e0e] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5",
        completed && "melon-completed-card border-[#d0d5dd] bg-[#f7f8fa] shadow-none",
        className
      )}
    >
      {completed ? (
        <div className="melon-confetti absolute right-3 top-3 flex gap-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-nb-yellow" />
          <span className="h-2 w-2 rounded-full bg-nb-green" />
          <span className="h-2 w-2 rounded-full bg-nb-pink" />
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <DynamicTag snapshot={snapshot} position={position} compact />
            <h3 className="text-base font-black leading-tight text-[#243042]">{snapshot.course.title}</h3>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-nb-black bg-[#fff3c4] shadow-[2px_2px_0_#0e0e0e]">
            {completed ? <Trophy className="h-5 w-5 text-nb-orange" /> : <Sparkles className="h-5 w-5 text-nb-orange" />}
          </div>
        </div>

        <JourneyMap snapshot={snapshot} compact />

        <div className={cn("grid gap-3", showMastery && canOpenCourse && "sm:grid-cols-[1fr_auto] sm:items-end")}>
          {showMastery ? <EnergyBar value={energyValue(snapshot)} compact /> : null}
          {canOpenCourse ? (
            <Link
              href={completed ? "/practice" : `/study?courseRunId=${encodeURIComponent(snapshot.run.id)}`}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-nb-black px-3 py-2 text-center font-display text-[0.58rem] leading-tight shadow-[3px_3px_0_#0e0e0e] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 [letter-spacing:0]",
                completed ? "bg-white text-nb-black" : "bg-nb-black text-white"
              )}
            >
              {ctaCopy(snapshot, false)}
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CourseStrip({
  runs,
  startPosition = 1,
  completed = false,
}: {
  runs: CourseRunSnapshot[];
  startPosition?: number;
  completed?: boolean;
}) {
  if (runs.length === 1) {
    return (
      <div className="max-w-[420px]">
        <CompactCourseCard
          key={runs[0].run.id}
          snapshot={runs[0]}
          position={startPosition}
          completed={completed}
        />
      </div>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex min-w-full gap-4 px-1">
        {runs.map((snapshot, index) => (
          <CompactCourseCard
            key={snapshot.run.id}
            snapshot={snapshot}
            position={startPosition + index}
            completed={completed}
            className="w-[320px] min-w-[320px] md:w-[340px] md:min-w-[340px]"
          />
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-nb-black/25 bg-white/60 py-16 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border-2 border-nb-black bg-white shadow-[3px_3px_0_#0e0e0e]">
        <Sparkles className="h-7 w-7 animate-pulse text-nb-orange" />
      </div>
      <p className="font-display text-sm text-[#667085] [letter-spacing:0]">Đang tải</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-nb-black/25 bg-white/70 py-16 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border-2 border-nb-black bg-white shadow-[3px_3px_0_#0e0e0e]">
        <BookOpen className="h-7 w-7 text-nb-blue" />
      </div>
      <p className="font-display text-sm text-[#667085] [letter-spacing:0]">Chưa có khóa học</p>
    </div>
  );
}

export default function LessonsPage() {
  const { user, logout } = useAuthContext();
  const userUid = user?.uid;
  const [authOpen, setAuthOpen] = useState(false);
  const [showMoreCourses, setShowMoreCourses] = useState(false);
  const [moreCoursesTab, setMoreCoursesTab] = useState<"next" | "review" | "completed">("next");
  const moreCoursesRef = useRef<HTMLDivElement | null>(null);

  const runsQuery = useQuery({
    queryKey: ["courseRuns", userUid, "all"],
    queryFn: async () => {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) throw new Error("Bạn cần đăng nhập để tải khóa học.");
      const res = await fetch(`/api/v1/course-run/${userUid}?status=all`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Không tải được khóa học.");
      }
      return (data.runs ?? []) as CourseRunSnapshot[];
    },
    enabled: Boolean(userUid && user?.role === "kid"),
    staleTime: 2 * 60 * 1000,
  });

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const loading = runsQuery.isLoading || runsQuery.isFetching;

  const activeRuns = useMemo(
    () => sortRunsForLearning(runs.filter((snapshot) => snapshot.run.status === "active")),
    [runs]
  );
  const pausedRuns = useMemo(
    () => sortRunsForLearning(runs.filter((snapshot) => snapshot.run.status === "paused")),
    [runs]
  );
  const completedRuns = useMemo(
    () => [...runs.filter((snapshot) => snapshot.run.status === "completed")].sort(
      (left, right) => (left.course.recommendedOrder - right.course.recommendedOrder)
        || left.course.title.localeCompare(right.course.title, "vi")
    ),
    [runs]
  );
  const currentRun = useMemo(() => activeRuns[0] ?? null, [activeRuns]);
  const queuedRuns = useMemo(() => activeRuns.slice(1), [activeRuns]);
  const nextRuns = useMemo(() => queuedRuns.filter((snapshot) => !reviewNeeded(snapshot)), [queuedRuns]);
  const reviewRuns = useMemo(() => queuedRuns.filter((snapshot) => reviewNeeded(snapshot)), [queuedRuns]);
  const showcaseNextRuns = useMemo(() => fillShowcaseRuns(nextRuns, pausedRuns, 3), [nextRuns, pausedRuns]);
  const showcaseReviewRuns = useMemo(() => fillShowcaseRuns(reviewRuns, pausedRuns, 3), [pausedRuns, reviewRuns]);
  const allFinished = runs.length > 0 && activeRuns.length === 0;
  const hasMoreCourses = nextRuns.length > 0 || reviewRuns.length > 0 || completedRuns.length > 0;
  const availableTabs = useMemo(() => {
    const tabs: Array<"next" | "review" | "completed"> = [];
    if (nextRuns.length > 0) tabs.push("next");
    if (reviewRuns.length > 0) tabs.push("review");
    if (completedRuns.length > 0) tabs.push("completed");
    return tabs;
  }, [completedRuns.length, nextRuns.length, reviewRuns.length]);
  const activeMoreCoursesTab = availableTabs.includes(moreCoursesTab)
    ? moreCoursesTab
    : (availableTabs[0] ?? "next");

  useEffect(() => {
    if (!showMoreCourses) return;
    moreCoursesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showMoreCourses]);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      photoURL={user?.photoURL}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      <KidOnlyGuard>
        <SectionContainer className="space-y-7">
          <section className="rounded-lg border-4 border-nb-black bg-white p-5 shadow-[6px_6px_0_#0e0e0e]">
            <div className="flex flex-wrap items-center gap-2">
              <NbPill color="orange" icon={<BookOpen className="h-3 w-3" />}>
                {runs.length} khóa
              </NbPill>
              <NbPill color="blue" icon={<Sparkles className="h-3 w-3" />}>
                Đang học
              </NbPill>
            </div>
          </section>

          {loading ? (
            <LoadingState />
          ) : runs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-8">
              {currentRun ? (
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-nb-orange" />
                    <h2 className="font-display text-sm text-[#243042] [letter-spacing:0]">Mục tiêu ưu tiên</h2>
                  </div>
                  <PriorityCourseCard snapshot={currentRun} />
                  {hasMoreCourses ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowMoreCourses((value) => !value)}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border-2 border-nb-black bg-white px-4 py-2 text-xs font-black text-[#243042] shadow-[3px_3px_0_#0e0e0e] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nb-orange"
                        aria-expanded={showMoreCourses}
                        aria-controls="more-courses"
                      >
                        {showMoreCourses ? "Thu gọn" : "Xem thêm"}
                        <ArrowRight className={cn("h-4 w-4 transition-transform", showMoreCourses && "rotate-90")} />
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {showMoreCourses && hasMoreCourses ? (
                <div ref={moreCoursesRef} id="more-courses" className="scroll-mt-6 space-y-8">
                  <section className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {nextRuns.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setMoreCoursesTab("next")}
                          className={cn(
                            "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black shadow-[3px_3px_0_#0e0e0e] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5",
                            activeMoreCoursesTab === "next"
                              ? "border-nb-black bg-nb-purple text-nb-black"
                              : "border-nb-black bg-white text-[#243042]"
                          )}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Học tiếp theo
                        </button>
                      ) : null}
                      {reviewRuns.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setMoreCoursesTab("review")}
                          className={cn(
                            "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black shadow-[3px_3px_0_#0e0e0e] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5",
                            activeMoreCoursesTab === "review"
                              ? "border-nb-black bg-nb-blue text-nb-black"
                              : "border-nb-black bg-white text-[#243042]"
                          )}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Ôn lại sau đó
                        </button>
                      ) : null}
                      {completedRuns.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setMoreCoursesTab("completed")}
                          className={cn(
                            "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border-2 px-4 py-2 text-xs font-black shadow-[3px_3px_0_#0e0e0e] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5",
                            activeMoreCoursesTab === "completed"
                              ? "border-nb-black bg-nb-yellow text-nb-black"
                              : "border-nb-black bg-white text-[#243042]"
                          )}
                        >
                          <Trophy className="h-3.5 w-3.5" />
                          Đã hoàn thành
                        </button>
                      ) : null}
                    </div>

                    {activeMoreCoursesTab === "next" && nextRuns.length > 0 ? (
                      <CourseStrip runs={showcaseNextRuns} startPosition={1} />
                    ) : null}

                    {activeMoreCoursesTab === "review" && reviewRuns.length > 0 ? (
                      <CourseStrip runs={showcaseReviewRuns} startPosition={nextRuns.length + 1} />
                    ) : null}

                    {activeMoreCoursesTab === "completed" && completedRuns.length > 0 ? (
                      <CourseStrip runs={completedRuns} startPosition={activeRuns.length} completed />
                    ) : null}
                  </section>
                </div>
              ) : null}

              {allFinished ? (
                <section className="rounded-lg border-4 border-nb-black bg-white p-6 shadow-[6px_6px_0_#0e0e0e]">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <NbPill color="yellow" icon={<CheckCircle2 className="h-3 w-3" />}>
                        Đã hoàn thành hết
                      </NbPill>
                      <h2 className="mt-3 text-xl font-black leading-tight text-[#243042]">Hoàn thành tất cả khóa hiện có</h2>
                    </div>
                    <Link
                      href="/practice"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-4 border-nb-black bg-nb-black px-5 py-3 font-display text-[0.72rem] text-white shadow-[5px_5px_0_#ff914d] [letter-spacing:0]"
                    >
                      Sang luyện đề
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </SectionContainer>
      </KidOnlyGuard>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
