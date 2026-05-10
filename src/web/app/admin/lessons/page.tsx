"use client";

import Link from "next/link";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { AdminShell } from "@/components/layout/AdminShell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { NbButton } from "@/components/shared/NbButton";
import { NbPill } from "@/components/shared/NbPill";
import { useAuthContext } from "@/lib/auth/auth-context";
import { getAllLessons, type Lesson } from "@/lib/lessons/lesson-store";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function AdminLessonsPage() {
  const { user, logout } = useAuthContext();
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => {
    getAllLessons().then(setLessons);
  }, []);

  return (
    <AdminShell userName={user?.displayName ?? "Admin"} onLogout={logout}>
      <SectionHeader
        title="Lessons"
        subtitle="Manage lesson content and curriculum"
        badge={<NbPill color="green">{lessons.length} lessons</NbPill>}
        action={
          <NbButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
            Add Lesson
          </NbButton>
        }
      />

      <div className="mt-6 nb-card rounded-2xl overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="[border-bottom:var(--nb-border)] bg-nb-bg">
              <th className="text-left px-5 py-3 font-display text-[0.7rem] uppercase">Lesson</th>
              <th className="text-left px-5 py-3 font-display text-[0.7rem] uppercase hidden md:table-cell">Subject</th>
              <th className="text-left px-5 py-3 font-display text-[0.7rem] uppercase hidden lg:table-cell">Type</th>
              <th className="text-left px-5 py-3 font-display text-[0.7rem] uppercase hidden lg:table-cell">XP</th>
              <th className="text-left px-5 py-3 font-display text-[0.7rem] uppercase">AI</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson, i) => (
              <tr
                key={lesson.id}
                className={cn(
                  "transition-colors hover:bg-nb-bg",
                  i < lessons.length - 1 && "[border-bottom:2px_solid_#eee]"
                )}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lesson.emoji}</span>
                    <div>
                      <div className="font-bold text-nb-black">{lesson.title}</div>
                      <div className="text-xs text-[#888]">{lesson.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 hidden md:table-cell">
                  <NbPill
                    color={
                      lesson.subject === "math" ? "orange" :
                      lesson.subject === "science" ? "green" :
                      lesson.subject === "english" ? "purple" :
                      lesson.subject === "coding" ? "yellow" : "blue"
                    }
                  >
                    {lesson.subject}
                  </NbPill>
                </td>
                <td className="px-5 py-4 hidden lg:table-cell font-semibold text-[#666] capitalize">
                  {lesson.type}
                </td>
                <td className="px-5 py-4 hidden lg:table-cell">
                  <span className="font-bold text-nb-orange">+{lesson.xpReward}</span>
                </td>
                <td className="px-5 py-4">
                  {lesson.aiEnabled && (
                    <NbPill color="purple">AI</NbPill>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/lessons/${lesson.id}`} target="_blank">
                      <button className="p-1.5 hover:bg-nb-bg rounded cursor-pointer border-none bg-transparent" aria-label="View">
                        <Eye className="w-4 h-4 text-[#888]" />
                      </button>
                    </Link>
                    <button className="p-1.5 hover:bg-nb-bg rounded cursor-pointer border-none bg-transparent" aria-label="Edit">
                      <Edit className="w-4 h-4 text-[#888]" />
                    </button>
                    <button className="p-1.5 hover:bg-nb-pink/20 rounded cursor-pointer border-none bg-transparent" aria-label="Delete">
                      <Trash2 className="w-4 h-4 text-nb-red/70" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
