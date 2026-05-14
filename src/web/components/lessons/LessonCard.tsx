"use client";

import Link from "next/link";
import { Clock, Zap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { NbPill } from "@/components/shared/NbPill";
import type { Lesson } from "@/lib/lessons/lesson-store";

const subjectColors: Record<string, string> = {
  math:    "text-nb-orange",
  science: "text-nb-green",
  english: "text-nb-purple",
  history: "text-nb-blue",
  coding:  "text-nb-yellow",
};

const difficultyLabels = ["", "Easy", "Medium", "Hard"] as const;
const difficultyColors = ["", "bg-nb-green", "bg-nb-yellow", "bg-nb-orange"] as const;

interface LessonCardProps {
  lesson: Lesson;
  progress?: number; // 0-100
}

export function LessonCard({ lesson, progress = 0 }: LessonCardProps) {
  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="block no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nb-orange"
    >
      <article
        className={cn(
          "flex-shrink-0 w-[220px] bg-white [border:var(--nb-border)] rounded-[20px]",
          "[box-shadow:var(--nb-shadow)] overflow-hidden cursor-pointer",
          "transition-all duration-200",
          "hover:-translate-x-1 hover:-translate-y-1 hover:[box-shadow:var(--nb-shadow-lg)]",
          "flex flex-col"
        )}
        aria-label={`Lesson: ${lesson.title}`}
      >
        {/* Thumbnail */}
        <div
          className="w-full h-[120px] flex items-center justify-center text-5xl relative overflow-hidden"
          style={{ background: lesson.thumbnailBg, borderBottom: "3px solid #0e0e0e" }}
        >
          {lesson.emoji}

          {/* Type pill */}
          <div className="absolute top-2.5 left-2.5">
            <span className="flex items-center gap-1 bg-white [border:2px_solid_var(--nb-black)] rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase">
              {lesson.type}
            </span>
          </div>

          {/* AI chip */}
          {lesson.aiEnabled && (
            <div className="absolute top-2.5 right-2.5">
              <NbPill color="purple" className="text-[0.6rem] py-0.5 px-1.5">
                <Brain className="w-2.5 h-2.5" />
                AI
              </NbPill>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-2 flex-1">
          <span
            className={cn(
              "text-[0.65rem] font-black uppercase",
              subjectColors[lesson.subject] ?? "text-[#666]"
            )}
          >
            {lesson.subject}
          </span>

          <h3 className="font-display text-[0.8rem] leading-snug line-clamp-2">
            {lesson.title}
          </h3>

          <div className="flex items-center gap-2 text-[0.7rem] font-bold text-[#666] mt-auto">
            <Clock className="w-3 h-3" />
            {lesson.duration}m
            <span className="ml-auto flex items-center gap-1">
              <Zap className="w-3 h-3 text-nb-orange" />
              +{lesson.xpReward}xp
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex justify-between text-[0.65rem] font-black">
              <span>{progress > 0 ? "In progress" : "Not started"}</span>
              <span>{progress}%</span>
            </div>
            <div className="nb-progress-track h-2.5">
              <div
                className="nb-progress-fill"
                style={{
                  width: `${progress}%`,
                  background:
                    "linear-gradient(90deg, var(--nb-orange) 0%, var(--nb-pink) 100%)",
                  height: "100%",
                }}
              />
            </div>
          </div>

          {/* Difficulty */}
          <div className="mt-1">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 [border:2px_solid_var(--nb-black)]",
                "text-[0.6rem] font-black uppercase text-nb-black rounded-full",
                difficultyColors[lesson.difficulty]
              )}
            >
              {difficultyLabels[lesson.difficulty]}
            </span>
          </div>
        </div>

        {/* Start button */}
        <button
          className={cn(
            "mx-4 mb-4 py-2 px-4 bg-nb-black text-white rounded-lg",
            "[border:none] font-display text-[0.65rem] cursor-pointer",
            "transition-all duration-150",
            "hover:bg-nb-orange hover:text-nb-black"
          )}
        >
          {progress > 0 ? "Continue →" : "Start Lesson →"}
        </button>
      </article>
    </Link>
  );
}
