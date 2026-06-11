"use client";

import Link from "next/link";
import { Brain, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { NbPill } from "@/components/shared/NbPill";
import type { Lesson } from "@/lib/lessons/lesson-store";

const subjectColors: Record<string, string> = {
  math: "text-nb-orange",
};

const subjectLabels: Record<string, string> = {
  math: "Toán",
};

const typeLabels: Record<string, string> = {
  video: "Video",
  interactive: "Tương tác",
  quiz: "Luyện nhanh",
  reading: "Đọc hiểu",
};

const difficultyLabels = ["", "Cơ bản", "Vừa sức", "Nâng cao"] as const;
const difficultyColors = ["", "bg-nb-green", "bg-nb-yellow", "bg-nb-orange"] as const;

interface LessonCardProps {
  lesson: Lesson;
  progress?: number;
}

export function LessonCard({ lesson, progress = 0 }: LessonCardProps) {
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nb-orange"
    >
      <article
        className={cn(
          "flex-shrink-0 w-[260px] bg-white [border:var(--nb-border)] rounded-[20px]",
          "[box-shadow:var(--nb-shadow)] overflow-hidden cursor-pointer",
          "transition-all duration-200",
          "hover:-translate-x-1 hover:-translate-y-1 hover:[box-shadow:var(--nb-shadow-lg)]",
          "flex flex-col"
        )}
        aria-label={`Bài học: ${lesson.title}`}
      >
        <div
          className="relative flex h-[128px] w-full items-center justify-center overflow-hidden text-5xl"
          style={{ background: lesson.thumbnailBg, borderBottom: "3px solid #0e0e0e" }}
        >
          {lesson.emoji}

          <div className="absolute left-2.5 top-2.5">
            <span className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-black uppercase [border:2px_solid_var(--nb-black)]">
              {typeLabels[lesson.type] ?? lesson.type}
            </span>
          </div>

          {lesson.aiEnabled && (
            <div className="absolute right-2.5 top-2.5">
              <NbPill color="purple" className="px-1.5 py-0.5 text-[0.6rem]">
                <Brain className="h-2.5 w-2.5" />
                AI
              </NbPill>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <span
            className={cn(
              "text-[0.65rem] font-black uppercase",
              subjectColors[lesson.subject] ?? "text-[#666]"
            )}
          >
            {subjectLabels[lesson.subject] ?? lesson.subject}
          </span>

          <h3 className="font-display text-[0.8rem] leading-snug line-clamp-3">
            {lesson.title}
          </h3>

          <p className="line-clamp-2 text-xs font-semibold leading-relaxed text-[#555]">
            {lesson.description}
          </p>

          <div className="mt-auto flex items-center gap-2 text-[0.7rem] font-bold text-[#666]">
            <Clock className="h-3 w-3" />
            {lesson.duration} phút
            <span className="ml-auto flex items-center gap-1">
              <Zap className="h-3 w-3 text-nb-orange" />
              +{lesson.xpReward} XP
            </span>
          </div>

          <div className="mt-1 flex flex-col gap-1">
            <div className="flex justify-between text-[0.65rem] font-black">
              <span>{progress > 0 ? "Đang học" : "Chưa bắt đầu"}</span>
              <span>{progress}%</span>
            </div>
            <div className="nb-progress-track h-2.5">
              <div
                className="nb-progress-fill"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--nb-orange) 0%, var(--nb-pink) 100%)",
                  height: "100%",
                }}
              />
            </div>
          </div>

          <div className="mt-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase text-nb-black",
                "[border:2px_solid_var(--nb-black)]",
                difficultyColors[lesson.difficulty]
              )}
            >
              {difficultyLabels[lesson.difficulty]}
            </span>
          </div>
        </div>

        <button
          className={cn(
            "mx-4 mb-4 rounded-lg bg-nb-black px-4 py-2 text-white",
            "[border:none] font-display text-[0.65rem] cursor-pointer",
            "transition-all duration-150",
            "hover:bg-nb-orange hover:text-nb-black"
          )}
        >
          {progress > 0 ? "Học tiếp →" : "Bắt đầu →"}
        </button>
      </article>
    </Link>
  );
}
