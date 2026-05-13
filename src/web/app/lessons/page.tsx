"use client";

import { useEffect, useState } from "react";
import { BookOpen, Filter } from "lucide-react";
import { KidShell } from "@/components/layout/KidShell";
import { AuthModal } from "@/components/auth/AuthModal";
import { LessonCard } from "@/components/lessons/LessonCard";
import { SectionContainer, SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { MOCK_LESSONS, type Lesson, type Subject } from "@/lib/lessons/mock-lessons";
import { getGeneratedLessons } from "@/lib/lessons/generated-lessons-store";
import { cn } from "@/lib/utils";

const subjects: Array<{ id: Subject | "all"; label: string; emoji: string }> = [
  { id: "all", label: "All", emoji: "🎯" },
  { id: "math", label: "Math", emoji: "🔢" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "english", label: "English", emoji: "📝" },
  { id: "history", label: "History", emoji: "🏛️" },
  { id: "coding", label: "Coding", emoji: "💻" },
];

export default function LessonsPage() {
  const { user, logout } = useAuthContext();
  const [authOpen, setAuthOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Subject | "all">("all");
  const [generatedLessons, setGeneratedLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    setGeneratedLessons(getGeneratedLessons());
  }, []);

  const allLessons = [...generatedLessons, ...MOCK_LESSONS];

  const filtered =
    activeSubject === "all"
      ? allLessons
      : allLessons.filter((l) => l.subject === activeSubject);

  return (
    <KidShell
      userName={user?.displayName ?? undefined}
      onLogin={() => setAuthOpen(true)}
      onLogout={logout}
    >
      <SectionContainer>
        <SectionHeader
          title="Lessons"
          subtitle="Pick a subject and start learning"
          badge={
            <NbPill color="orange" icon={<BookOpen className="w-3 h-3" />}>
              {allLessons.length} lessons
            </NbPill>
          }
          action={
            <NbButton variant="ghost" size="sm" icon={<Filter className="w-3.5 h-3.5" />}>
              Filter
            </NbButton>
          }
        />

        {/* Subject filter tabs */}
        <div className="flex gap-2 overflow-x-auto nb-scrollbar-hide pb-1 mb-8">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSubject(s.id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-4 py-2",
                "[border:var(--nb-border)] font-display text-[0.7rem] cursor-pointer",
                "transition-all duration-150 rounded-full",
                activeSubject === s.id
                  ? "bg-nb-black text-white [box-shadow:3px_3px_0_var(--nb-orange)]"
                  : "bg-white text-nb-black hover:bg-nb-yellow [box-shadow:3px_3px_0_var(--nb-black)]"
              )}
            >
              <span>{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Lessons grid — scroll on desktop, wrap on mobile */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-nb-black/20 rounded-2xl">
            <div className="text-5xl mb-4">📭</div>
            <p className="font-display text-sm text-[#666]">No lessons yet for this subject</p>
          </div>
        ) : (
          <div
            className="flex gap-5 overflow-x-auto pb-4 nb-scrollbar"
            style={{ paddingBottom: "1.5rem" }}
          >
            {filtered.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} progress={0} />
            ))}
          </div>
        )}
      </SectionContainer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </KidShell>
  );
}
