"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BatteryCharging,
  BookOpen,
  CheckCircle2,
  Cloud,
  Crown,
  Flag,
  Info,
  LockKeyhole,
  Mountain,
  RefreshCcw,
  Rocket,
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
import type { CourseRunSnapshot, CourseStageStatus, CourseStageType } from "@/lib/progress/types";
import { cn } from "@/lib/utils";

type JourneyState = "completed" | "current" | "retry" | "ready" | "skipped" | "locked";
type TagTone = "priority" | "momentum" | "review" | "today" | "done" | "locked";

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
  locked: "border-[#d0d5dd] bg-white text-[#667085]",
};

const stageStatusCopy: Record<JourneyState, string> = {
  completed: "Đã vững",
  current: "Đang sáng nhất",
  retry: "Nạp thêm năng lượng",
  ready: "Đã mở",
  skipped: "Được đi tắt",
  locked: "Sắp mở khóa",
};

const parentStageStatusCopy: Record<CourseStageStatus, string> = {
  locked: "Đang khóa",
  ready: "Đã mở",
  in_progress: "Đang học",
  mastered: "Đã đạt",
  retry_required: "Cần củng cố",
};

function parentStatusLabel(status?: CourseStageStatus) {
  return status ? parentStageStatusCopy[status] : "Chưa có lượt làm";
}

function firstLower(text: string) {
  if (!text) return text;
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function conceptName(snapshot: CourseRunSnapshot) {
  return snapshot.course.conceptLabels[0] ?? snapshot.course.primaryConcept ?? "phần này";
}

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

function stageJourneyState(snapshot: CourseRunSnapshot, stageId: string, index: number): JourneyState {
  const progress = snapshot.run.stageProgress[stageId];
  const isCurrent = snapshot.currentStage.id === stageId;
  const currentIndex = snapshot.pipeline.stages.findIndex((stage) => stage.id === snapshot.currentStage.id);

  if (snapshot.run.status === "completed" || progress?.status === "mastered") return "completed";
  if (progress?.status === "retry_required") return "retry";
  if (isCurrent) return "current";
  if (!progress && index < currentIndex) return "skipped";
  if (!progress) return "locked";
  return "ready";
}

function isReviewRun(snapshot: CourseRunSnapshot) {
  const currentIndex = snapshot.pipeline.stages.findIndex((stage) => stage.id === snapshot.currentStage.id);
  return snapshot.pipeline.stages.some((stage, index) => {
    const progress = snapshot.run.stageProgress[stage.id];
    return index < currentIndex && progress?.status === "retry_required";
  });
}

function skippedStageCount(snapshot: CourseRunSnapshot) {
  const currentIndex = snapshot.pipeline.stages.findIndex((stage) => stage.id === snapshot.currentStage.id);
  return snapshot.pipeline.stages.filter((stage, index) => {
    return index < currentIndex && !snapshot.run.stageProgress[stage.id];
  }).length;
}

function energyValue(snapshot: CourseRunSnapshot) {
  if (snapshot.run.status === "completed") return 100;
  const progress = activeStageProgress(snapshot);
  if (!progress) return 18;
  return Math.min(100, Math.max(10, progress.accuracy));
}

function childInsight(snapshot: CourseRunSnapshot, position: number) {
  const progress = activeStageProgress(snapshot);
  const concept = conceptName(snapshot);
  const misses = progress ? Math.max(0, progress.attempts - progress.correct) : 0;

  if (snapshot.run.status === "completed") {
    return `Mình đã chinh phục ${concept}. Huy hiệu đang nằm trong kho báu của Melon!`;
  }

  if (progress?.status === "retry_required" || (progress && progress.attempts > 0 && progress.accuracy < 60)) {
    return misses >= 3
      ? `Vì gần đây mình sai ${misses} câu ở ${concept}, Melon rủ mình củng cố lại cho chắc.`
      : `Melon thấy mình hơi vướng ở ${concept}, mình cùng lùi lại một chút để xây nền thật chắc nhé!`;
  }

  if (progress && progress.accuracy >= 80) {
    return `Mình đang vào đà ở ${concept}. Melon mở đường nhanh hơn cho hôm nay.`;
  }

  if (skippedStageCount(snapshot) > 0) {
    return `Phần đầu mình đã đủ chắc rồi. Melon cho mình đi tắt tới ${snapshot.currentStage.title}.`;
  }

  if (position === 0) {
    return `Melon chọn riêng ${concept} cho hôm nay để mình học đúng phần cần nhất.`;
  }

  return `Nhiệm vụ này đang chờ phía sau. Xong mục tiêu ưu tiên, Melon sẽ gọi mình quay lại.`;
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
    return { label: position === 0 ? "Mục tiêu ưu tiên" : "Củng cố sức mạnh", tone: "review", Icon: Shield };
  }

  if (progress && progress.accuracy >= 80) {
    return { label: "Đang vào đà", tone: "momentum", Icon: Zap };
  }

  if (position === 0) {
    return { label: "Mục tiêu ưu tiên", tone: "priority", Icon: Target };
  }

  return { label: "Gợi ý hôm nay", tone: "today", Icon: Sparkles };
}

function ctaCopy(snapshot: CourseRunSnapshot, isPriority: boolean) {
  if (snapshot.run.status === "completed") return "Luyện đề giữ phong độ";

  const progress = activeStageProgress(snapshot);
  if (isPriority && (progress?.status === "retry_required" || (progress && progress.attempts > 0 && progress.accuracy < 60))) {
    return "Bắt đầu giải cứu điểm yếu";
  }

  if (isPriority) return `Học tiếp chặng ${snapshot.currentStage.title}`;
  return "Xem hành trình";
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

function MelonMascotBubble({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex max-w-full items-start gap-3", compact && "gap-2")}>
      <div
        className={cn(
          "grid shrink-0 place-items-center rounded-full border-2 border-nb-black bg-white shadow-[3px_3px_0_#0e0e0e]",
          compact ? "h-10 w-10" : "h-14 w-14"
        )}
      >
        <Image
          src="/icon.png"
          alt="Melon"
          width={compact ? 28 : 40}
          height={compact ? 28 : 40}
          className="object-contain"
        />
      </div>
      <div className="relative min-w-0 flex-1 rounded-lg border-2 border-nb-black bg-white px-4 py-3 shadow-[3px_3px_0_#0e0e0e]">
        <span className="absolute -left-2 top-4 h-3 w-3 rotate-45 border-b-2 border-l-2 border-nb-black bg-white" />
        <p className={cn("break-words font-bold leading-relaxed text-[#243042] [overflow-wrap:anywhere]", compact ? "text-xs" : "text-sm")}>{children}</p>
      </div>
    </div>
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
          Thanh năng lượng
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
        aria-label="Thanh năng lượng học tập"
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
  const hasSkip = skippedStageCount(snapshot) > 0;
  const hasReview = isReviewRun(snapshot);

  return (
    <div className={cn("relative", compact ? "pt-2" : "pt-6")}>
      <div className="absolute left-5 right-5 top-[72px] hidden h-1 rounded-full bg-nb-black/15 sm:block" />
      <div className="absolute left-5 right-5 top-[72px] hidden border-t-2 border-dashed border-nb-black/45 sm:block" />

      {hasSkip && !compact ? (
        <div className="mb-8 inline-flex max-w-full items-center gap-2 rounded-full border-2 border-nb-black bg-white px-3 py-1 text-xs font-black text-[#243042] shadow-[3px_3px_0_#0e0e0e]">
          <Rocket className="h-4 w-4 text-nb-orange" />
          <span className="min-w-0 break-words">Melon cho mình đi tắt vì phần đầu đã đủ chắc</span>
        </div>
      ) : null}

      {hasReview && !compact ? (
        <div className="mb-8 ml-0 inline-flex max-w-full items-center gap-2 rounded-full border-2 border-nb-black bg-nb-blue px-3 py-1 text-xs font-black text-[#243042] shadow-[3px_3px_0_#0e0e0e] sm:ml-8">
          <RefreshCcw className="h-4 w-4" />
          <span className="min-w-0 break-words">Quay lại nạp thêm năng lượng rồi bứt phá tiếp</span>
        </div>
      ) : null}

      <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-5", compact ? "sm:gap-2" : "sm:gap-3")}>
        {snapshot.pipeline.stages.map((stage, index) => {
          const Icon = stageIcon(stage.stageType);
          const state = stageJourneyState(snapshot, stage.id, index);
          const isCurrent = state === "current" || state === "retry";
          const isLocked = state === "locked";
          const isSkipped = state === "skipped";

          return (
            <div
              key={stage.id}
              className={cn(
                "relative z-10 flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-nb-black p-3 text-center shadow-[3px_3px_0_#0e0e0e] transition-all duration-300",
                compact ? "min-h-[86px] p-2" : "sm:min-h-[132px]",
                stageOffsets[index % stageOffsets.length],
                state === "completed" && "bg-nb-green text-white",
                state === "current" && "bg-[#ffd166] shadow-[0_0_0_4px_rgba(255,209,102,0.45),4px_4px_0_#0e0e0e] melon-route-pulse",
                state === "retry" && "bg-nb-blue shadow-[0_0_0_4px_rgba(56,182,255,0.32),4px_4px_0_#0e0e0e]",
                state === "ready" && "bg-white",
                isSkipped && "scale-[0.92] border-dashed bg-[#f7f8fa] text-[#667085] opacity-70 shadow-none",
                isLocked && "border-[#cfd6df] bg-[#eef2f6] text-[#667085] shadow-none"
              )}
            >
              {isLocked ? (
                <Cloud className="absolute right-2 top-2 h-6 w-6 text-white opacity-90" />
              ) : null}
              {isSkipped ? (
                <Rocket className="absolute right-2 top-2 h-4 w-4 text-nb-orange" />
              ) : null}
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

function ParentStats({ snapshot }: { snapshot: CourseRunSnapshot }) {
  const progress = activeStageProgress(snapshot);
  const attempts = progress?.attempts ?? 0;
  const correct = progress?.correct ?? 0;
  const accuracy = progress ? `${progress.accuracy}%` : "Chưa có dữ liệu";

  return (
    <details className="group rounded-lg border-2 border-nb-black bg-white/80 px-3 py-2 shadow-[2px_2px_0_#0e0e0e]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black text-[#243042] marker:hidden">
        <span className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Góc ba mẹ
        </span>
        <Info className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-2 text-xs font-semibold leading-relaxed text-[#475467] sm:grid-cols-2">
        <div>Độ chính xác chặng hiện tại: <strong>{accuracy}</strong></div>
        <div>Số câu đã làm: <strong>{attempts}</strong>, đúng <strong>{correct}</strong></div>
        <div>Điểm trọng tâm: <strong>{snapshot.course.conceptLabels.join(", ")}</strong></div>
        <div>Trạng thái: <strong>{parentStatusLabel(progress?.status)}</strong></div>
        <div className="sm:col-span-2">
          Đề xuất hệ thống: <strong>{snapshot.run.personalizedReason || `Melon ưu tiên ${firstLower(snapshot.course.title)} cho hôm nay.`}</strong>
        </div>
      </div>
    </details>
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
            <p className="mt-2 max-w-[780px] text-sm font-semibold leading-relaxed text-[#475467]">
              {snapshot.course.goalText || snapshot.course.description}
            </p>
          </div>

          <MelonMascotBubble>{childInsight(snapshot, 0)}</MelonMascotBubble>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <JourneyMap snapshot={snapshot} />
          <div className="flex flex-col justify-between gap-4 rounded-lg border-2 border-nb-black bg-white p-4 shadow-[4px_4px_0_#0e0e0e]">
            <EnergyBar value={energyValue(snapshot)} />
            <div className="space-y-2">
              <div className="text-xs font-black uppercase text-[#667085]">Nhiệm vụ ngay bây giờ</div>
              <div className="text-lg font-black leading-tight text-[#243042]">{snapshot.currentStage.title}</div>
              <p className="text-sm font-semibold leading-relaxed text-[#475467]">{snapshot.currentStage.supportText}</p>
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

        <ParentStats snapshot={snapshot} />
      </div>
    </article>
  );
}

function CompactCourseCard({
  snapshot,
  position,
  completed = false,
}: {
  snapshot: CourseRunSnapshot;
  position: number;
  completed?: boolean;
}) {
  const progress = activeStageProgress(snapshot);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border-2 border-nb-black bg-white p-4 shadow-[4px_4px_0_#0e0e0e] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5",
        completed && "melon-completed-card border-[#d0d5dd] bg-[#f7f8fa] shadow-none"
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
            <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-[#667085]">
              {completed ? `Huy hiệu ${conceptName(snapshot)} đã được cất vào bộ sưu tập.` : childInsight(snapshot, position)}
            </p>
          </div>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-nb-black bg-[#fff3c4] shadow-[2px_2px_0_#0e0e0e]">
            {completed ? <Trophy className="h-5 w-5 text-nb-orange" /> : <Sparkles className="h-5 w-5 text-nb-orange" />}
          </div>
        </div>

        <JourneyMap snapshot={snapshot} compact />

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <EnergyBar value={energyValue(snapshot)} compact />
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
        </div>

        {progress ? <ParentStats snapshot={snapshot} /> : null}
      </div>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-nb-black/25 bg-white/60 py-16 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border-2 border-nb-black bg-white shadow-[3px_3px_0_#0e0e0e]">
        <Sparkles className="h-7 w-7 animate-pulse text-nb-orange" />
      </div>
      <p className="font-display text-sm text-[#667085] [letter-spacing:0]">Melon đang vẽ lộ trình...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-nb-black/25 bg-white/70 py-16 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border-2 border-nb-black bg-white shadow-[3px_3px_0_#0e0e0e]">
        <BookOpen className="h-7 w-7 text-nb-blue" />
      </div>
      <p className="font-display text-sm text-[#667085] [letter-spacing:0]">Chưa có nhiệm vụ phù hợp</p>
    </div>
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
  const queuedRuns = useMemo(() => activeRuns.slice(1), [activeRuns]);
  const allFinished = runs.length > 0 && activeRuns.length === 0;

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
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <NbPill color="orange" icon={<BookOpen className="h-3 w-3" />}>
                    {runs.length} khóa
                  </NbPill>
                  <NbPill color="blue" icon={<Sparkles className="h-3 w-3" />}>
                    Lộ trình riêng
                  </NbPill>
                </div>
                <h1 className="text-2xl font-black leading-tight text-[#243042] sm:text-3xl">
                  Hành trình hôm nay của {user?.displayName ?? "mình"}
                </h1>
                <p className="mt-2 max-w-[680px] text-sm font-semibold leading-relaxed text-[#475467]">
                  Melon đã sắp đường học theo điểm mạnh, điểm vướng và nhịp làm bài gần đây của mình.
                </p>
              </div>
              <MelonMascotBubble compact>
                Không ai học giống ai. Melon sẽ mở đúng chặng mình cần nhất hôm nay.
              </MelonMascotBubble>
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-nb-orange" />
                        <h2 className="font-display text-sm text-[#243042] [letter-spacing:0]">
                          Mục tiêu ưu tiên
                        </h2>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#667085]">
                        Khóa Melon đang đẩy lên đầu tiên cho hôm nay.
                      </p>
                    </div>
                  </div>
                  <PriorityCourseCard snapshot={currentRun} />
                </section>
              ) : null}

              {queuedRuns.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <NbPill color="purple" icon={<Sparkles className="h-3 w-3" />}>
                      Sắp tới
                    </NbPill>
                    <p className="text-sm font-semibold text-[#667085]">
                      Những nhiệm vụ đang chờ sau khi mình xong mục tiêu chính.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {queuedRuns.map((snapshot, index) => (
                      <CompactCourseCard
                        key={snapshot.run.id}
                        snapshot={snapshot}
                        position={index + 1}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {allFinished ? (
                <section className="rounded-lg border-4 border-nb-black bg-white p-6 shadow-[6px_6px_0_#0e0e0e]">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <NbPill color="yellow" icon={<CheckCircle2 className="h-3 w-3" />}>
                        Đã hoàn thành hết
                      </NbPill>
                      <h2 className="mt-3 text-xl font-black leading-tight text-[#243042]">
                        Mình đã đi hết các khóa hiện có.
                      </h2>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-[#667085]">
                        Melon mở chế độ luyện đề để mình giữ phong độ và gom thêm huy hiệu.
                      </p>
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

              {completedRuns.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <NbPill color="yellow" icon={<Trophy className="h-3 w-3" />}>
                      Đã hoàn thành
                    </NbPill>
                    <p className="text-sm font-semibold text-[#667085]">
                      Huy hiệu đã nhận sẽ nằm ở đây, không tranh chỗ với mục tiêu hôm nay.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {completedRuns.map((snapshot, index) => (
                      <CompactCourseCard
                        key={snapshot.run.id}
                        snapshot={snapshot}
                        position={activeRuns.length + index}
                        completed
                      />
                    ))}
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
